import '../../test/load-integration-env';

import { Test, TestingModule } from '@nestjs/testing';
import { MovieService } from './movie.service';
import { CACHE_MANAGER, Cache, CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { MovieDetail } from './entity/movie-detail.entity';
import { MovieFile } from './entity/movie-file.entity';
import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { MovieUserLike } from './entity/movie-user-like.entity';
import { User } from 'src/user/entity/user.entity';
import { CommonService } from 'src/common/common.service';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { envVariableKeys } from 'src/common/const/env.const';
import * as Joi from 'joi';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { NotFoundException } from '@nestjs/common';

async function resetMovieTestData(dataSource: DataSource) {
    await dataSource.query(`
        TRUNCATE TABLE
            movie_user_like,
            movie_file,
            movie_genres_genre,
            movie,
            movie_detail,
            genre,
            director,
            "user"
        RESTART IDENTITY CASCADE
    `);
}

describe('MovieService - Integration Test', () => {
    let service: MovieService;
    let dataSource: DataSource;
    let moduleRef: TestingModule;
    let cacheManager: Cache;
    let users: User[];
    let directors: Director[];
    let genres: Genre[];
    let movies: Movie[];

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    validationSchema: Joi.object({
                        ENV: Joi.string().valid('dev', 'prod').required(),
                        DB_TYPE: Joi.string().valid('postgres').required(),
                        DB_HOST: Joi.string().required(),
                        DB_PORT: Joi.number().required(),
                        DB_USER: Joi.string().required(),
                        DB_PASSWORD: Joi.string().required(),
                        DB_DATABASE: Joi.string().required(),
                        SALT_ROUNDS: Joi.number().required(),
                        ACCESS_TOKEN_SECRET: Joi.string().required(),
                        REFRESH_TOKEN_SECRET: Joi.string().required(),
                    }),
                }),
                CacheModule.register({ isGlobal: true }),
                TypeOrmModule.forRootAsync({
                    inject: [ConfigService],
                    useFactory: (configService: ConfigService) => ({
                        type: configService.get<string>(envVariableKeys.dbType) as 'postgres',
                        host: configService.get<string>(envVariableKeys.dbHost),
                        port: configService.get<number>(envVariableKeys.dbPort),
                        username: configService.get<string>(envVariableKeys.dbUsername),
                        password: configService.get<string>(envVariableKeys.dbPassword),
                        database: configService.get<string>(envVariableKeys.dbDatabase),
                        entities: [Movie, MovieDetail, MovieFile, Director, Genre, MovieUserLike, User],
                        synchronize: true,
                    }),
                }),
                TypeOrmModule.forFeature([Movie, MovieDetail, MovieFile, Director, Genre, MovieUserLike, User]),
            ],
            providers: [MovieService, CommonService],
        }).compile();

        service = moduleRef.get<MovieService>(MovieService);
        dataSource = moduleRef.get<DataSource>(DataSource);
        cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);
    }, 30_000);

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
        }
        await moduleRef?.close();
    });

    beforeEach(async () => {
        await cacheManager.clear();
        await resetMovieTestData(dataSource);

        const movieRepository = dataSource.getRepository(Movie);
        const movieDetailRepository = dataSource.getRepository(MovieDetail);
        const userRepository = dataSource.getRepository(User);
        const genreRepository = dataSource.getRepository(Genre);
        const directorRepository = dataSource.getRepository(Director);

        users = await userRepository.save([
            userRepository.create({ email: 'test1@test.com', password: 'password' }),
            userRepository.create({ email: 'test2@test.com', password: 'password' }),
        ]);

        directors = await directorRepository.save([
            directorRepository.create({
                dob: new Date('1990-01-01'),
                nationality: 'Korean',
                name: 'director1',
            }),
            directorRepository.create({
                dob: new Date('1991-01-01'),
                nationality: 'Korean',
                name: 'director2',
            }),
        ]);

        genres = await genreRepository.save([
            genreRepository.create({ name: 'genre1' }),
            genreRepository.create({ name: 'genre2' }),
        ]);

        movies = await movieRepository.save(
            Array.from({ length: 10 }, (_, i) => {
                const x = i + 1;
                return movieRepository.create({
                    title: `movie ${x}`,
                    detail: movieDetailRepository.create({ detail: `detail${x}` }),
                    director: directors[0],
                    genres: genres.slice(0, 2),
                    creator: users[0],
                    createAt: new Date('2026-01-01'),
                    updateAt: new Date('2026-01-01'),
                    files: [],
                });
            }),
        );
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('findMovieRecent', () => {
        it('should return the recent movies', async () => {
            const recentMovies = (await service.findMovieRecent()) as Movie[];
            let sortedResult = [...movies];
            sortedResult.sort((a, b) => b.createAt.getTime() - a.createAt.getTime());
            let sortedIds = sortedResult.slice(0, 10).map((x) => x.id);
            expect(recentMovies).toHaveLength(10);
            expect(recentMovies.map((x) => x.id)).toEqual(sortedIds);
        });
        it('should cache the recent movies', async () => {
            const result = (await service.findMovieRecent()) as Movie[];
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
            expect(result!.title).toBe(movies[0].title);
            expect(result!.detail).toHaveProperty('id');
            expect(result!.detail.detail).toBe(movies[0].detail.detail);
            expect(result!.director.id).toBe(movies[0].director.id);
            expect(result!.genres.map((x) => x.id)).toEqual(movies[0].genres.map((x) => x.id));
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

            const qr = dataSource.createQueryRunner();
            await qr.connect();
            await qr.startTransaction();

            try {
                const result = await service.create(createMovieDto, ['test.mp4'], qr, users[0].id);
                await qr.commitTransaction();

                expect(result).toHaveProperty('id');
                expect(result!.title).toBe(createMovieDto.title);
                expect(result!.detail).toHaveProperty('id');
                expect(result!.detail.detail).toBe(createMovieDto.detail);
                expect(result!.director.id).toBe(createMovieDto.directorId);
                expect(result!.genres.map((x) => x.id)).toEqual(createMovieDto.genreIds);
            } finally {
                await qr.release();
            }
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
            expect(result!.detail).toHaveProperty('id');
            expect(result!.detail.detail).toBe(updateMovieDto.detail);
            expect(result!.director.id).toBe(updateMovieDto.directorId);
            expect(result!.genres.map((x) => x.id)).toEqual(updateMovieDto.genreIds);
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
        it('should throw an error if the genre does not exist', async () => {
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
