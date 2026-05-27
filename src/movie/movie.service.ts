import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, rename, stat, unlink } from 'fs/promises';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { Repository, DataSource, In } from 'typeorm';
import { MovieDetail } from './entity/movie-detail.entity';
import { MovieFile } from './entity/movie-file.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { Director } from 'src/director/entity/director.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CommonService } from 'src/common/common.service';
import { QueryRunner } from 'typeorm/browser';
import { basename, isAbsolute, join, relative } from 'path';

@Injectable()
export class MovieService {
    constructor(
        @InjectRepository(Movie) private readonly movieRepository: Repository<Movie>,
        @InjectRepository(MovieDetail) private readonly movieDetailRepository: Repository<MovieDetail>,
        @InjectRepository(MovieFile) private readonly movieFileRepository: Repository<MovieFile>,
        @InjectRepository(Genre) private readonly genreRepository: Repository<Genre>,
        @InjectRepository(Director) private readonly directorRepository: Repository<Director>,
        private readonly dataSource: DataSource,
        private readonly commonService: CommonService,
    ) {}

    /** DB 트랜잭션 실패 시 멀터가 이미 저장한 디스크 파일 제거 */
    private async cleanupUploadedFiles(movies?: Express.Multer.File[]) {
        if (!movies?.length) {
            return;
        }

        await Promise.all(movies.map((file) => unlink(file.path).catch(() => undefined)));
    }

    //파일 경로 문자열 정리를 위해
    private normalizeTempRefs(files?: string[]) {
        if (!files?.length) return [];
        return files
            .filter((v) => typeof v === 'string')
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
    }

    async findAll(dto: GetMoviesDto) {
        // const { title,page,take } = dto

        const { title } = dto;

        const qb = this.movieRepository
            .createQueryBuilder('movie')
            .distinct(true)
            .leftJoinAndSelect('movie.director', 'director')
            .leftJoinAndSelect('movie.genres', 'genres')
            .leftJoinAndSelect('movie.files', 'files');

        if (title) {
            qb.where('movie.title LIKE :title', { title: `%${title}%` });
        }

        // this.commonService.applyPagePaginationParamsToQb(qb,dto)
        const { nextCursor } = await this.commonService.applyCursorPaginationParamsToQb(qb, dto);

        const [data, count] = await qb.getManyAndCount();

        return {
            data,
            count,
            nextCursor,
        };
    }

    async findOne(id: number) {
        const movie = await this.movieRepository
            .createQueryBuilder('movie')
            .leftJoinAndSelect('movie.director', 'director')
            .leftJoinAndSelect('movie.genres', 'genres')
            .leftJoinAndSelect('movie.detail', 'detail')
            .leftJoinAndSelect('movie.files', 'files')
            .where('movie.id=:id', { id })
            .getOne();
        return movie;
    }

    async create(createMovieDto: CreateMovieDto, files: string[], qr: QueryRunner) {
        const refs = this.normalizeTempRefs(files);

        try {
            const titleExists = await qr.manager.exists(Movie, {
                where: { title: createMovieDto.title },
            });
            if (titleExists) {
                throw new ConflictException('이미 존재하는 영화 제목입니다.');
            }

            const director = await qr.manager.findOne(Director, { where: { id: createMovieDto.directorId } });
            if (!director) {
                throw new NotFoundException('존재하지 않는 감독의 ID입니다.');
            }
            const genres = await qr.manager.find(Genre, { where: { id: In(createMovieDto.genreIds) } });

            if (genres.length !== createMovieDto.genreIds.length) {
                throw new NotFoundException(
                    `존재하지 않는 장르가 있습니다.존재하는 장르는 ${genres.map((genre) => genre.id).join(',')}`,
                );
            }

            const movieDetail = await qr.manager
                .createQueryBuilder()
                .insert()
                .into(MovieDetail)
                .values({ detail: createMovieDto.detail })
                .execute();

            const movieDetailId = movieDetail.identifiers[0].id;

            const movie = await qr.manager
                .createQueryBuilder()
                .insert()
                .into(Movie)
                .values({ title: createMovieDto.title, detail: { id: movieDetailId }, director, genres })
                .execute();

            const movieId = movie.identifiers[0].id;

            await qr.manager
                .createQueryBuilder()
                .relation(Movie, 'genres')
                .of(movieId)
                .add(genres.map((genre) => genre.id));

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

                const movieDir = join(process.cwd(), 'public', 'movie', String(movieId));

                await mkdir(movieDir, { recursive: true });

                const renamed: Array<{ srcAbs: string; destAbs: string }> = [];

                try {
                    const movieFiles = await Promise.all(
                        refs.map(async (_, idx) => {
                            const srcAbs = scrAbsPaths[idx];
                            const st = srcStats[idx]!;
                            const filename = basename(srcAbs);
                            const destAbs = join(movieDir, filename);

                            await rename(srcAbs, destAbs);
                            renamed.push({ srcAbs, destAbs });

                            const publicPath = relative(process.cwd(), destAbs);

                            return qr.manager.create(MovieFile, {
                                path: publicPath,
                                originalName: filename,
                                mimetype: 'video/mp4',
                                size: st!.size,
                                movie: { id: movieId },
                            });
                        }),
                    );
                    await qr.manager.save(MovieFile, movieFiles);
                } catch (err) {
                    // filesystem 부분 실패 시 되돌리기 (DB 트랜잭션 롤백과 별개라서 방어)
                    await Promise.all(renamed.map((r) => rename(r.destAbs, r.srcAbs).catch(() => undefined)));
                    throw err;
                }
            }

            return await qr.manager.findOne(Movie, {
                where: { id: movieId },
                relations: { detail: true, director: true, genres: true, files: true },
            });
        } catch (error) {
            throw error;
        }
    }

    async update(id: number, updateMovieDto: UpdateMovieDto) {
        const qr = this.dataSource.createQueryRunner();

        await qr.connect();
        await qr.startTransaction();

        try {
            const movie = await qr.manager.findOne(Movie, {
                where: { id },
                relations: { detail: true, genres: true },
            });

            if (!movie) {
                throw new NotFoundException(`id가 ${id}인 영화는 존재하지 않습니다. `);
            }
            // MovieDetail, Director, Genre 관계 필드는 따로 처리
            // Movie 테이블에 직접 수정할 일반 필드만 분리
            const { detail, directorId, genreIds, ...movieRest } = updateMovieDto;

            let newDirector;

            if (directorId) {
                const director = await qr.manager.findOne(Director, { where: { id: directorId } });
                newDirector = director;
            }

            let newGeres;
            if (genreIds) {
                const genres = await qr.manager.find(Genre, {
                    where: { id: In(genreIds) },
                });
                if (genres.length !== updateMovieDto.genreIds?.length) {
                    throw new NotFoundException(`존재하지 않는 장르가 있습니다.
            존재하는 ids ->${genres.map((genre) => genre.id).join(',')}`);
                }
                newGeres = genres;
            }

            // 전달된 Movie 필드와, 변경할 감독이 있을 경우에만 director를 수정 객체에 포함
            const movieUpdateFields = {
                ...movieRest,
                ...(newDirector && { director: newDirector }),
            };

            await qr.manager
                .createQueryBuilder()
                .update(Movie)
                .set(movieUpdateFields)
                .where('id=:id', { id })
                .execute();

            if (detail) {
                await qr.manager
                    .createQueryBuilder()
                    .update(MovieDetail)
                    .set({ detail })
                    .where('id=:id', { id: movie.detail.id })
                    .execute();
            }

            if (newGeres) {
                await qr.manager
                    .createQueryBuilder()
                    .relation(Movie, 'genres')
                    .of(id)
                    .addAndRemove(
                        newGeres.map((genre) => genre.id),
                        movie.genres.map((genre) => genre.id),
                    );
            }
            await qr.commitTransaction();
            return this.movieRepository.findOne({
                where: { id },
                relations: { detail: true, director: true, genres: true, files: true },
            });
        } catch (e) {
            await qr.rollbackTransaction();
            throw e;
        } finally {
            await qr.release();
        }
    }

    async remove(id: number) {
        const movie = await this.movieRepository.findOne({ where: { id }, relations: { detail: true } });

        if (!movie) {
            throw new NotFoundException(`${id}의 영화는 존재하지 않습니다.`);
        }

        // FK 때문에 MovieFile을 먼저 삭제하는 게 안전함.
        await this.movieFileRepository.delete({ movie: { id } } as any);

        await this.movieRepository.createQueryBuilder().delete().where('id=:id', { id }).execute();

        await this.movieDetailRepository.delete(movie.detail.id);

        return `${id}의 영화가 삭제되었습니다.`;
    }
}
