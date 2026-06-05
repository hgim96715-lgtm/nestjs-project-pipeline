import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { mkdir, rename, stat } from 'fs/promises';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CommonService } from 'src/common/common.service';
import { basename, isAbsolute, join, relative } from 'path';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { normalizeTempRefs } from './utils/normalize-temp-refs';
import { PrismaService } from 'src/common/prisma.service';
import { Prisma } from '../../generated/prisma/prisma/client';

@Injectable()
export class MovieService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly commonService: CommonService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    // /** DB 트랜잭션 실패 시 멀터가 이미 저장한 디스크 파일 제거 */
    // private async cleanupUploadedFiles(movies?: Express.Multer.File[]) {
    //     if (!movies?.length) {
    //         return;
    //     }

    //     await Promise.all(movies.map((file) => unlink(file.path).catch(() => undefined)));
    // }

    async findMovieRecent() {
        const cacheKey = 'MOVIE_RECENT';

        const cacheData = await this.cacheManager.get(cacheKey);

        if (cacheData) {
            return cacheData;
        }

        const data = await this.prisma.movie.findMany({
            orderBy: { createAt: 'desc' },
            take: 10,
        });

        await this.cacheManager.set(cacheKey, data);
        return data;
    }

    async findAll(dto: GetMoviesDto, userId?: number) {
        const { title } = dto;
        const { cursorWhere, orderBy, take, order } = this.commonService.parseCursorPagination(dto);

        const titleWhere: Prisma.movieWhereInput = title ? { title: { contains: title } } : {};
        const where: Prisma.movieWhereInput = cursorWhere
            ? {
                  AND: [titleWhere, cursorWhere],
              }
            : titleWhere;

        const include = {
            movie_genres_genre: { include: { genre: true } },
            director: true,
            movie_file: true,
        } as const;

        const movies = await this.prisma.movie.findMany({
            where,
            orderBy,
            take,
            include,
        });
        const count = await this.prisma.movie.count({ where: titleWhere });

        const nextCursor = this.commonService.generateNextCursor(movies, order);

        let likeMovieMap: Record<number, boolean> = {};
        if (userId) {
            const movieIds = movies.map((movie) => movie.id);
            const likedMovies =
                movieIds.length === 0
                    ? []
                    : await this.prisma.movie_user_like.findMany({
                          where: {
                              movieId: { in: movieIds },
                              userId,
                          },
                      });

            likeMovieMap = likedMovies.reduce<Record<number, boolean>>((acc, next) => {
                acc[next.movieId] = next.isLike;
                return acc;
            }, {});
        }

        const data = movies.map((movie) => {
            if (!userId) {
                return movie;
            }

            return {
                ...movie,
                likeStatus: movie.id in likeMovieMap ? likeMovieMap[movie.id] : null,
            };
        });

        return {
            data,
            count,
            nextCursor,
        };
    }

    async findOne(id: number) {
        const movie = await this.prisma.movie.findUnique({
            where: { id },
            include: {
                movie_detail: true,
                director: true,
                movie_genres_genre: { include: { genre: true } },
                movie_file: true,
            },
        });
        // const movie = await this.movieRepository
        //     .createQueryBuilder('movie')
        //     .leftJoinAndSelect('movie.director', 'director')
        //     .leftJoinAndSelect('movie.genres', 'genres')
        //     .leftJoinAndSelect('movie.detail', 'detail')
        //     .leftJoinAndSelect('movie.files', 'files')
        //     .where('movie.id=:id', { id })
        //     .getOne();

        if (!movie) {
            throw new NotFoundException(`id가 ${id}인 영화는 존재하지 않습니다.`);
        }

        return movie;
    }

    async create(createMovieDto: CreateMovieDto, files: string[], userId: number) {
        const refs = normalizeTempRefs(files);

        return this.prisma.$transaction(async (prisma) => {
            const titleExists = await prisma.movie.findUnique({
                where: { title: createMovieDto.title },
            });
            if (titleExists) {
                throw new ConflictException('이미 존재하는 영화 제목입니다.');
            }

            const director = await prisma.director.findUnique({
                where: { id: createMovieDto.directorId },
            });
            if (!director) {
                throw new NotFoundException('존재하지 않는 감독의 ID입니다.');
            }

            const genres = await prisma.genre.findMany({
                where: { id: { in: createMovieDto.genreIds } },
            });
            if (genres.length !== createMovieDto.genreIds.length) {
                throw new NotFoundException(
                    `존재하지 않는 장르가 있습니다.존재하는 장르는 ${genres.map((genre) => genre.id).join(',')}`,
                );
            }

            const movieDetail = await prisma.movie_detail.create({
                data: { detail: createMovieDto.detail },
            });

            const movie = await prisma.movie.create({
                data: {
                    title: createMovieDto.title,
                    detailId: movieDetail.id,
                    directorId: director.id,
                    creatorId: userId,
                },
            });

            await prisma.movie_genres_genre.createMany({
                data: genres.map((genre) => ({
                    movieId: movie.id,
                    genreId: genre.id,
                })),
            });

            if (refs.length) {
                const resolveSrcAbs = (ref: string) =>
                    isAbsolute(ref)
                        ? ref
                        : ref.includes('/')
                          ? join(process.cwd(), ref)
                          : join(process.cwd(), 'public', 'temp', ref);

                const scrAbsPaths = refs.map(resolveSrcAbs);
                const srcStats = await Promise.all(scrAbsPaths.map((p) => stat(p).catch(() => null)));
                const whoMissingRefs = refs.filter((_, i) => !srcStats[i]);

                if (whoMissingRefs.length) {
                    throw new BadRequestException(`존재하지 않는 파일이 있습니다. -> ${whoMissingRefs.join(', ')}`);
                }

                const movieDir = join(process.cwd(), 'public', 'movie', String(movie.id));
                await mkdir(movieDir, { recursive: true });

                const renamed: Array<{ srcAbs: string; destAbs: string }> = [];

                try {
                    await Promise.all(
                        refs.map(async (_, idx) => {
                            const srcAbs = scrAbsPaths[idx];
                            const st = srcStats[idx]!;
                            const filename = basename(srcAbs);
                            const destAbs = join(movieDir, filename);

                            await rename(srcAbs, destAbs);
                            renamed.push({ srcAbs, destAbs });

                            const publicPath = relative(process.cwd(), destAbs);

                            await prisma.movie_file.create({
                                data: {
                                    path: publicPath,
                                    originalName: filename,
                                    mimetype: 'video/mp4',
                                    size: st.size,
                                    movieId: movie.id,
                                },
                            });
                        }),
                    );
                } catch (err) {
                    await Promise.all(renamed.map((r) => rename(r.destAbs, r.srcAbs).catch(() => undefined)));
                    throw err;
                }
            }

            return prisma.movie.findUnique({
                where: { id: movie.id },
                include: {
                    movie_detail: true,
                    director: true,
                    movie_genres_genre: { include: { genre: true } },
                    movie_file: true,
                },
            });
        });
    }

    async update(id: number, updateMovieDto: UpdateMovieDto) {
        return this.prisma.$transaction(async (prisma) => {
            const existingMovie = await prisma.movie.findUnique({
                where: { id },
                include: { movie_genres_genre: true },
            });
            if (!existingMovie) {
                throw new NotFoundException(`id가 ${id}인 영화는 존재하지 않습니다.`);
            }

            const { detail, directorId, genreIds, files: _files, title } = updateMovieDto;

            if (title !== undefined) {
                const duplicateTitle = await prisma.movie.findFirst({
                    where: {
                        title,
                        NOT: { id },
                    },
                });
                if (duplicateTitle) {
                    throw new ConflictException('이미 존재하는 영화 제목입니다.');
                }

                await prisma.movie.update({
                    where: { id },
                    data: { title },
                });
            }

            if (directorId !== undefined) {
                const director = await prisma.director.findUnique({
                    where: { id: directorId },
                });
                if (!director) {
                    throw new NotFoundException('존재하지 않는 감독의 ID입니다.');
                }

                await prisma.movie.update({
                    where: { id },
                    data: { directorId: director.id },
                });
            }

            if (detail !== undefined) {
                await prisma.movie_detail.update({
                    where: { id: existingMovie.detailId },
                    data: { detail },
                });
            }

            if (genreIds !== undefined) {
                const genres = await prisma.genre.findMany({
                    where: { id: { in: genreIds } },
                });
                if (genres.length !== genreIds.length) {
                    throw new NotFoundException(
                        `존재하지 않는 장르가 있습니다.
            존재하는 ids ->${genres.map((genre) => genre.id).join(',')}`,
                    );
                }

                const currentGenreIds = existingMovie.movie_genres_genre.map((row) => row.genreId);
                const nextGenreIds = genres.map((genre) => genre.id);
                const genreIdsToRemove = currentGenreIds.filter((genreId) => !nextGenreIds.includes(genreId));
                const genreIdsToAdd = nextGenreIds.filter((genreId) => !currentGenreIds.includes(genreId));

                if (genreIdsToRemove.length > 0) {
                    await prisma.movie_genres_genre.deleteMany({
                        where: {
                            movieId: id,
                            genreId: { in: genreIdsToRemove },
                        },
                    });
                }

                if (genreIdsToAdd.length > 0) {
                    await prisma.movie_genres_genre.createMany({
                        data: genreIdsToAdd.map((genreId) => ({
                            movieId: id,
                            genreId,
                        })),
                    });
                }
            }

            return prisma.movie.findUnique({
                where: { id },
                include: {
                    movie_detail: true,
                    director: true,
                    movie_genres_genre: { include: { genre: true } },
                    movie_file: true,
                },
            });
        });
    }

    async remove(id: number) {
        return this.prisma.$transaction(async (prisma) => {
            const movie = await prisma.movie.findUnique({ where: { id }, include: { movie_detail: true } });
            if (!movie) {
                throw new NotFoundException(`${id}의 영화는 존재하지 않습니다.`);
            }
            await prisma.movie_file.deleteMany({ where: { movieId: id } });
            await prisma.movie.delete({ where: { id } });
            await prisma.movie_detail.delete({ where: { id: movie.detailId } });
            return `${id}의 영화가 삭제되었습니다.`;
        });
    }

    ///-----좋아요 관련 메서드-----(추가로직)------------------------------------///

    async toggleMovieLie(movieId: number, userId: number, isLike: boolean) {
        return this.prisma.$transaction(async (prisma) => {
            const movie = await prisma.movie.findUnique({ where: { id: movieId } });

            if (!movie) {
                throw new NotFoundException(`${movieId}의 영화는 존재하지 않습니다.`);
            }

            const user = await prisma.user.findUnique({ where: { id: userId } });

            if (!user) {
                throw new UnauthorizedException('사용자 정보를 찾을 수 없습니다.');
            }

            const likeRecord = await prisma.movie_user_like.findUnique({
                where: {
                    movieId_userId: { movieId, userId },
                },
            });

            let likeCountDelta = 0;
            let dislikeCountDelta = 0;

            if (likeRecord) {
                if (likeRecord.isLike === isLike) {
                    await prisma.movie_user_like.delete({
                        where: { movieId_userId: { movieId, userId } },
                    });

                    if (isLike) {
                        likeCountDelta = -1;
                    } else {
                        dislikeCountDelta = -1;
                    }
                } else {
                    await prisma.movie_user_like.update({
                        where: { movieId_userId: { movieId, userId } },
                        data: { isLike },
                    });

                    if (isLike) {
                        likeCountDelta = 1;
                        dislikeCountDelta = -1;
                    } else {
                        likeCountDelta = -1;
                        dislikeCountDelta = 1;
                    }
                }
            } else {
                await prisma.movie_user_like.create({
                    data: {
                        movie: { connect: { id: movieId } },
                        user: { connect: { id: userId } },
                        isLike,
                    },
                });

                if (isLike) {
                    likeCountDelta = 1;
                } else {
                    dislikeCountDelta = 1;
                }
            }

            if (likeCountDelta !== 0 || dislikeCountDelta !== 0) {
                await prisma.movie.update({
                    where: { id: movieId },
                    data: {
                        ...(likeCountDelta !== 0 && { likeCount: { increment: likeCountDelta } }),
                        ...(dislikeCountDelta !== 0 && { dislikeCount: { increment: dislikeCountDelta } }),
                    },
                });
            }

            const result = await prisma.movie_user_like.findUnique({
                where: { movieId_userId: { movieId, userId } },
            });

            return { isLike: result && result.isLike };
        });
    }
}
