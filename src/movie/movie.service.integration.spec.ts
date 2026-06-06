import '../../test/load-integration-env';

import { Test, TestingModule } from '@nestjs/testing';
import { MovieService } from './movie.service';
import { CACHE_MANAGER, Cache, CacheModule } from '@nestjs/cache-manager';
import { CommonService } from 'src/common/common.service';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma.service';
import { integrationTestImports, resetIntegrationTestData } from '../../test/integration-db.helpers';
import { director, genre, movie, user } from '../../generated/prisma/prisma/client';

describe('MovieService - Integration Test', () => {
    let service: MovieService;
    let prisma: PrismaService;
    let moduleRef: TestingModule;
    let cacheManager: Cache;
    let users: user[];
    let directors: director[];
    let genres: genre[];
    let movies: movie[];

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [...integrationTestImports(), CacheModule.register({ isGlobal: true })],
            providers: [MovieService, CommonService],
        }).compile();

        service = moduleRef.get(MovieService);
        prisma = moduleRef.get(PrismaService);
        cacheManager = moduleRef.get(CACHE_MANAGER);
    }, 30_000);

    afterAll(async () => {
        await prisma?.$disconnect();
        await moduleRef?.close();
    });

    beforeEach(async () => {
        await cacheManager.clear();
        await resetIntegrationTestData(prisma);

        users = await Promise.all([
            prisma.user.create({ data: { email: 'test1@test.com', password: 'password' } }),
            prisma.user.create({ data: { email: 'test2@test.com', password: 'password' } }),
        ]);

        directors = await Promise.all([
            prisma.director.create({
                data: {
                    dob: new Date('1990-01-01'),
                    nationality: 'Korean',
                    name: 'director1',
                },
            }),
            prisma.director.create({
                data: {
                    dob: new Date('1991-01-01'),
                    nationality: 'Korean',
                    name: 'director2',
                },
            }),
        ]);

        genres = await Promise.all([
            prisma.genre.create({ data: { name: 'genre1' } }),
            prisma.genre.create({ data: { name: 'genre2' } }),
        ]);

        movies = [];
        for (let i = 1; i <= 10; i++) {
            const movieDetail = await prisma.movie_detail.create({
                data: { detail: `detail${i}` },
            });
            const movie = await prisma.movie.create({
                data: {
                    title: `movie ${i}`,
                    detailId: movieDetail.id,
                    directorId: directors[0].id,
                    creatorId: users[0].id,
                    createAt: new Date('2026-01-01'),
                },
            });
            await prisma.movie_genres_genre.createMany({
                data: genres.map((genre) => ({
                    movieId: movie.id,
                    genreId: genre.id,
                })),
            });
            movies.push(movie);
        }
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findMovieRecent', () => {
        it('should return the recent movies', async () => {
            const recentMovies = (await service.findMovieRecent()) as movie[];
            const sortedResult = [...movies].sort((a, b) => b.createAt.getTime() - a.createAt.getTime());
            const sortedIds = sortedResult.slice(0, 10).map((x) => x.id);
            expect(recentMovies).toHaveLength(10);
            expect(recentMovies.map((x) => x.id)).toEqual(sortedIds);
        });

        it('should cache the recent movies', async () => {
            const result = (await service.findMovieRecent()) as movie[];
            const cachedResult = await cacheManager.get('MOVIE_RECENT');
            expect(cachedResult).toEqual(result);
        });
    });

    describe('findAll', () => {
        it('should return movies with correct titles', async () => {
            const dto = {
                title: 'movie 1',
                order: ['id_ASC'],
                take: 10,
            };
            const result = await service.findAll(dto);
            expect(result.data).toHaveLength(movies.filter((x) => x.title.includes(dto.title)).length);
            expect(result.data[0].title).toBe(dto.title);
            expect(result.data[0]).not.toHaveProperty('likeStatus');
        });
    });

    it('should return likeStatus if userId is provided', async () => {
        const dto: GetMoviesDto = {
            order: ['id_ASC'],
            take: 10,
        };
        const result = await service.findAll(dto, users[0].id);
        expect(result.data).toHaveLength(movies.length);
        expect(result.data[0]).toHaveProperty('likeStatus');
    });

    describe('findOne', () => {
        it('should return a movie by id', async () => {
            const movieId = movies[0].id;
            const result = await service.findOne(movieId);
            expect(result).toHaveProperty('id');
            expect(result.title).toBe(movies[0].title);
            expect(result.movie_detail).toHaveProperty('id');
            expect(result.movie_detail.detail).toBe(`detail1`);
            expect(result.director.id).toBe(movies[0].directorId);
            expect(result.movie_genres_genre.map((x) => x.genreId).sort()).toEqual(
                genres.map((g) => g.id).sort(),
            );
        });

        it('should throw NotFoundException when movie does not exist', async () => {
            await expect(service.findOne(99999)).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create a new movie correctly', async () => {
            const tempDir = join(process.cwd(), 'public', 'temp');
            await mkdir(tempDir, { recursive: true });
            await writeFile(join(tempDir, 'test.mp4'), 'integration-test');

            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'test detail',
                directorId: directors[0].id,
                genreIds: [genres[0].id],
            };

            const result = await service.create(createMovieDto, ['test.mp4'], users[0].id);

            expect(result).toHaveProperty('id');
            expect(result!.title).toBe(createMovieDto.title);
            expect(result!.movie_detail).toHaveProperty('id');
            expect(result!.movie_detail.detail).toBe(createMovieDto.detail);
            expect(result!.director.id).toBe(createMovieDto.directorId);
            expect(result!.movie_genres_genre.map((x) => x.genreId)).toEqual(createMovieDto.genreIds);
        });
    });

    describe('update', () => {
        it('should update a movie correctly', async () => {
            const movieId = movies[0].id;
            const updateMovieDto: UpdateMovieDto = {
                title: 'test2',
                detail: 'test detail2',
                directorId: directors[1].id,
                genreIds: [genres[1].id],
            };
            const result = await service.update(movieId, updateMovieDto);
            expect(result).toHaveProperty('id');
            expect(result!.title).toBe(updateMovieDto.title);
            expect(result!.movie_detail.detail).toBe(updateMovieDto.detail);
            expect(result!.director.id).toBe(updateMovieDto.directorId);
            expect(result!.movie_genres_genre.map((x) => x.genreId)).toEqual(updateMovieDto.genreIds);
        });

        it('should throw an error if the movie does not exist', async () => {
            const updateMovieDto: UpdateMovieDto = {
                title: 'test2',
            };
            await expect(service.update(999, updateMovieDto)).rejects.toThrow(NotFoundException);
        });

        it('should throw an error if the genre does not exist', async () => {
            const updateMovieDto: UpdateMovieDto = {
                genreIds: [999],
            };
            await expect(service.update(movies[0].id, updateMovieDto)).rejects.toThrow(NotFoundException);
        });

        it('should throw an error if one of the genre ids does not exist', async () => {
            const updateMovieDto: UpdateMovieDto = {
                genreIds: [genres[0].id, genres[1].id, 999],
            };
            await expect(service.update(movies[0].id, updateMovieDto)).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove', () => {
        it('should delete a movie correctly', async () => {
            const movieId = movies[0].id;
            const result = await service.remove(movieId);
            expect(result).toBe(`${movieId}의 영화가 삭제되었습니다.`);
        });

        it('should throw an error if the movie does not exist', async () => {
            await expect(service.remove(999)).rejects.toThrow(NotFoundException);
        });
    });

    describe('toggleMovieLike', () => {
        it('should create like correctly', async () => {
            const userId = users[0].id;
            const movieId = movies[0].id;
            const result = await service.toggleMovieLie(movieId, userId, true);
            expect(result).toEqual({ isLike: true });
        });

        it('should create dislike correctly', async () => {
            const userId = users[0].id;
            const movieId = movies[0].id;
            const result = await service.toggleMovieLie(movieId, userId, false);
            expect(result).toEqual({ isLike: false });
        });

        it('should toggle like correctly', async () => {
            const userId = users[0].id;
            const movieId = movies[0].id;
            await service.toggleMovieLie(movieId, userId, true);
            const result = await service.toggleMovieLie(movieId, userId, true);
            expect(result.isLike).toBeNull();
        });

        it('should toggle dislike correctly', async () => {
            const userId = users[0].id;
            const movieId = movies[0].id;
            await service.toggleMovieLie(movieId, userId, false);
            const result = await service.toggleMovieLie(movieId, userId, false);
            expect(result.isLike).toBeNull();
        });
    });
});
