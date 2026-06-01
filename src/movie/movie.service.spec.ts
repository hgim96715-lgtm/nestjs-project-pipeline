import { MovieService } from './movie.service';

jest.mock('fs/promises', () => ({
    stat: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
}));

import { TestBed, type Mocked } from '@suites/unit';
import { stat, mkdir, rename } from 'fs/promises';
import { join } from 'path';
import { Movie } from './entity/movie.entity';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { Director } from 'src/director/entity/director.entity';
import { MovieUserLike } from './entity/movie-user-like.entity';
import { User } from 'src/user/entity/user.entity';
import { MovieFile } from './entity/movie-file.entity';
import { MovieDetail } from './entity/movie-detail.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommonService } from 'src/common/common.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { normalizeTempRefs } from './utils/normalize-temp-refs';
import { SelectQueryBuilder } from 'typeorm';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';

describe('MovieService', () => {
    let service: MovieService;
    let movieRepository: Mocked<Repository<Movie>>;
    let movieDetailRepository: Mocked<Repository<MovieDetail>>;
    let movieFileRepository: Mocked<Repository<MovieFile>>;
    let genreRepository: Mocked<Repository<Genre>>;
    let directorRepository: Mocked<Repository<Director>>;
    let movieUserLikeRepository: Mocked<Repository<MovieUserLike>>;
    let userRepository: Mocked<Repository<User>>;

    let dataSource: Mocked<DataSource>;
    let commonService: Mocked<CommonService>;
    let cacheManager: Mocked<Cache>;

    beforeEach(async () => {
        const { unit, unitRef } = await TestBed.solitary(MovieService).compile();
        service = unit;

        movieRepository = unitRef.get(getRepositoryToken(Movie) as string);
        movieDetailRepository = unitRef.get(getRepositoryToken(MovieDetail) as string);
        movieFileRepository = unitRef.get(getRepositoryToken(MovieFile) as string);
        genreRepository = unitRef.get(getRepositoryToken(Genre) as string);
        directorRepository = unitRef.get(getRepositoryToken(Director) as string);
        movieUserLikeRepository = unitRef.get(getRepositoryToken(MovieUserLike) as string);
        userRepository = unitRef.get(getRepositoryToken(User) as string);

        dataSource = unitRef.get(DataSource);
        commonService = unitRef.get(CommonService);
        cacheManager = unitRef.get(CACHE_MANAGER);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('normalizeTempRefs', () => {
        it('should normalize temp refs', () => {
            const refs = ['test.mp4', ' test2.mp4 ', '', '   ', 'test3.mp4'];
            expect(normalizeTempRefs(refs)).toEqual(['test.mp4', 'test2.mp4', 'test3.mp4']);
        });

        it('should return empty array for empty input', () => {
            expect(normalizeTempRefs()).toEqual([]);
            expect(normalizeTempRefs([])).toEqual([]);
        });
    });

    describe('findMovieRecent', () => {
        it('should return the recent movies', async () => {
            const recentMovies = [
                {
                    id: 1,
                    title: 'test',
                    createAt: new Date(),
                },
                {
                    id: 2,
                    title: 'test2',
                    createAt: new Date(),
                },
            ];
            jest.spyOn(movieRepository, 'find').mockResolvedValue(recentMovies as Movie[]);
            jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
            jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);

            const result = await service.findMovieRecent();
            expect(movieRepository.find).toHaveBeenCalledWith({
                order: { createAt: 'DESC' },
                take: 10,
            });
            expect(cacheManager.get).toHaveBeenCalledWith('MOVIE_RECENT');
            expect(cacheManager.set).toHaveBeenCalledWith('MOVIE_RECENT', recentMovies);
            expect(result).toEqual(recentMovies);
        });
        it('should return the cached movies', async () => {
            const cachedMovies = [
                {
                    id: 1,
                    title: 'test',
                    createAt: new Date(),
                },
                {
                    id: 2,
                    title: 'test2',
                    createAt: new Date(),
                },
            ];
            jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedMovies);
            jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);

            const result = await service.findMovieRecent();
            expect(cacheManager.get).toHaveBeenCalledWith('MOVIE_RECENT');
            expect(cacheManager.set).not.toHaveBeenCalled();
            expect(result).toEqual(cachedMovies);
        });
    });
    describe('findAll', () => {
        const dto = { title: 'test', order: ['id_DESC'], take: 10 };
        const userId = 1;
        const movies = [
            { id: 1, title: 'test', createAt: new Date() },
            { id: 2, title: 'test2', createAt: new Date() },
        ];

        let movieQbMock: {
            distinct: jest.Mock;
            leftJoinAndSelect: jest.Mock;
            where: jest.Mock;
            getManyAndCount: jest.Mock;
        };
        let likeQbMock: {
            leftJoinAndSelect: jest.Mock;
            where: jest.Mock;
            andWhere: jest.Mock;
            getMany: jest.Mock;
        };

        const setupFindAllMocks = (likedMovies: Array<{ movie: { id: number }; isLike: boolean }> = []) => {
            movieQbMock = {
                distinct: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([movies, movies.length]),
            };
            likeQbMock = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(likedMovies),
            };

            jest.spyOn(movieRepository, 'createQueryBuilder').mockReturnValue(
                movieQbMock as unknown as SelectQueryBuilder<Movie>,
            );
            jest.spyOn(commonService, 'applyCursorPaginationParamsToQb').mockResolvedValue({
                nextCursor: null,
            } as Awaited<ReturnType<CommonService['applyCursorPaginationParamsToQb']>>);
            jest.spyOn(movieUserLikeRepository, 'createQueryBuilder').mockReturnValue(
                likeQbMock as unknown as SelectQueryBuilder<MovieUserLike>,
            );
        };

        it('should return movies with null likeStatus when user has no likes', async () => {
            setupFindAllMocks();

            const result = await service.findAll(dto, userId);

            expect(movieRepository.createQueryBuilder).toHaveBeenCalledWith('movie');
            expect(movieQbMock.distinct).toHaveBeenCalledWith(true);
            expect(commonService.applyCursorPaginationParamsToQb).toHaveBeenCalledWith(movieQbMock, dto);
            expect(movieUserLikeRepository.createQueryBuilder).toHaveBeenCalledWith('mul');
            expect(likeQbMock.where).toHaveBeenCalledWith('movie.id IN (:...movieIds)', { movieIds: [1, 2] });
            expect(likeQbMock.andWhere).toHaveBeenCalledWith('user.id=:userId', { userId });
            expect(result).toEqual({
                data: movies.map((movie) => ({ ...movie, likeStatus: null })),
                count: 2,
                nextCursor: null,
            });
        });

        it('should attach likeStatus from likeMovieMap when user has likes', async () => {
            setupFindAllMocks([
                { movie: { id: 1 }, isLike: true },
                { movie: { id: 2 }, isLike: false },
            ]);

            const result = await service.findAll(dto, userId);

            expect(likeQbMock.getMany).toHaveBeenCalled();
            expect(result).toEqual({
                data: [
                    { ...movies[0], likeStatus: true },
                    { ...movies[1], likeStatus: false },
                ],
                count: 2,
                nextCursor: null,
            });
        });
    });
    describe('findOne', () => {
        it('should return a movie by id', async () => {
            const movie = {
                id: 1,
                title: 'test',
                createAt: new Date(),
            };
            const qbMock = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(movie as Movie),
            } as unknown as SelectQueryBuilder<Movie>;
            jest.spyOn(movieRepository, 'createQueryBuilder').mockReturnValue(qbMock);

            const result = await service.findOne(1);
            expect(movieRepository.createQueryBuilder).toHaveBeenCalledWith('movie');
            expect(qbMock.leftJoinAndSelect).toHaveBeenCalledTimes(4);
            expect(qbMock.where).toHaveBeenCalledWith('movie.id=:id', { id: 1 });
            expect(result).toEqual(movie);
        });

        it('should throw NotFoundException when movie does not exist', async () => {
            const qbMock = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(null),
            } as unknown as SelectQueryBuilder<Movie>;
            jest.spyOn(movieRepository, 'createQueryBuilder').mockReturnValue(qbMock);

            await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
        });
    });
    describe('create', () => {
        it('should create a new movie without files and return it', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'test detail',
                directorId: 1,
                genreIds: [1, 2],
            };
            const userId = 1;
            const director = { id: 1, name: 'test director' } as Director;
            const genres = [
                { id: 1, name: 'genre1' },
                { id: 2, name: 'genre2' },
            ] as Genre[];
            const createdMovie = {
                id: 1,
                title: 'test',
                detail: { id: 10, detail: 'test detail' },
                director,
                genres,
                files: [],
            } as unknown as Movie;

            const insertQbMock = {
                insert: jest.fn().mockReturnThis(),
                into: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                execute: jest
                    .fn()
                    .mockResolvedValueOnce({ identifiers: [{ id: 10 }] })
                    .mockResolvedValueOnce({ identifiers: [{ id: 1 }] }),
                relation: jest.fn().mockReturnThis(),
                of: jest.fn().mockReturnThis(),
                add: jest.fn().mockResolvedValue(undefined),
            };
            const managerMock = {
                exists: jest.fn().mockResolvedValue(false),
                findOne: jest.fn().mockResolvedValueOnce(director).mockResolvedValueOnce(createdMovie),
                find: jest.fn().mockResolvedValue(genres),
                createQueryBuilder: jest.fn().mockReturnValue(insertQbMock),
                create: jest.fn(),
                save: jest.fn(),
            };
            const qrMock = { manager: managerMock } as unknown as QueryRunner;

            const result = await service.create(createMovieDto, [], qrMock, userId);

            expect(managerMock.exists).toHaveBeenCalledWith(Movie, { where: { title: createMovieDto.title } });
            expect(managerMock.findOne).toHaveBeenCalledWith(Director, { where: { id: createMovieDto.directorId } });
            expect(managerMock.find).toHaveBeenCalled();
            expect(insertQbMock.execute).toHaveBeenCalledTimes(2);
            expect(insertQbMock.relation).toHaveBeenCalledWith(Movie, 'genres');
            expect(insertQbMock.of).toHaveBeenCalledWith(1);
            expect(insertQbMock.add).toHaveBeenCalledWith([1, 2]);
            expect(result).toEqual(createdMovie);
        });
        it('should throw a NotFoundException if genre not found', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'test detail',
                directorId: 1,
                genreIds: [1, 2],
            };
            const director = { id: 1, name: 'test director' } as Director;
            const managerMock = {
                exists: jest.fn().mockResolvedValue(false),
                findOne: jest.fn().mockResolvedValue(director),
                find: jest.fn().mockResolvedValue([{ id: 1, name: 'genre1' }]),
            };
            const qrMock = {
                manager: managerMock,
            } as unknown as QueryRunner;
            jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(qrMock);
            await expect(service.create(createMovieDto, [], qrMock, 1)).rejects.toThrow(NotFoundException);
            expect(managerMock.find).toHaveBeenCalledWith(Genre, {
                where: { id: In([1, 2]) },
            });
        });
        it('should throw a ConflictException if title already exists', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'test detail',
                directorId: 1,
                genreIds: [1, 2],
            };
            const managerMock = {
                exists: jest.fn().mockResolvedValue(true),
            };
            const qrMock = {
                manager: managerMock,
            } as unknown as QueryRunner;
            jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(qrMock);
            await expect(service.create(createMovieDto, [], qrMock, 1)).rejects.toThrow(ConflictException);
            expect(managerMock.exists).toHaveBeenCalledWith(Movie, {
                where: { title: createMovieDto.title },
            });
        });
        it('should throw a NotFoundException if director not found', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'test detail',
                directorId: 1,
                genreIds: [1, 2],
            };
            const managerMock = {
                exists: jest.fn().mockResolvedValue(false),
                findOne: jest.fn().mockResolvedValue(null),
            };
            const qrMock = {
                manager: managerMock,
            } as unknown as QueryRunner;
            jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(qrMock);
            await expect(service.create(createMovieDto, [], qrMock, 1)).rejects.toThrow(NotFoundException);
            expect(managerMock.findOne).toHaveBeenCalledWith(Director, { where: { id: 1 } });
        });

        const setupCreateWithFilesMocks = () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'test detail',
                directorId: 1,
                genreIds: [1, 2],
            };
            const userId = 1;
            const director = { id: 1, name: 'test director' } as Director;
            const genres = [
                { id: 1, name: 'genre1' },
                { id: 2, name: 'genre2' },
            ] as Genre[];
            const createdMovie = {
                id: 1,
                title: 'test',
                detail: { id: 10, detail: 'test detail' },
                director,
                genres,
                files: [{ id: 1, path: 'public/movie/1/clip.mp4', originalName: 'clip.mp4' }],
            } as unknown as Movie;

            const insertQbMock = {
                insert: jest.fn().mockReturnThis(),
                into: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                execute: jest
                    .fn()
                    .mockResolvedValueOnce({ identifiers: [{ id: 10 }] })
                    .mockResolvedValueOnce({ identifiers: [{ id: 1 }] }),
                relation: jest.fn().mockReturnThis(),
                of: jest.fn().mockReturnThis(),
                add: jest.fn().mockResolvedValue(undefined),
            };
            const managerMock = {
                exists: jest.fn().mockResolvedValue(false),
                findOne: jest.fn().mockResolvedValueOnce(director).mockResolvedValueOnce(createdMovie),
                find: jest.fn().mockResolvedValue(genres),
                createQueryBuilder: jest.fn().mockReturnValue(insertQbMock),
                create: jest.fn((_entity, data) => data),
                save: jest.fn().mockResolvedValue(undefined),
            };
            const qrMock = { manager: managerMock } as unknown as QueryRunner;

            return { createMovieDto, userId, createdMovie, insertQbMock, managerMock, qrMock };
        };

        beforeEach(() => {
            jest.mocked(stat).mockReset();
            jest.mocked(mkdir).mockReset();
            jest.mocked(rename).mockReset();
        });

        it('should move temp files and save MovieFile records when files are provided', async () => {
            const { createMovieDto, userId, createdMovie, managerMock, qrMock } = setupCreateWithFilesMocks();
            const files = ['clip.mp4'];

            jest.mocked(stat).mockResolvedValue({ size: 1024 } as Awaited<ReturnType<typeof stat>>);
            jest.mocked(mkdir).mockResolvedValue(undefined);
            jest.mocked(rename).mockResolvedValue(undefined);

            const result = await service.create(createMovieDto, files, qrMock, userId);

            const tempPath = join(process.cwd(), 'public', 'temp', 'clip.mp4');
            const movieDir = join(process.cwd(), 'public', 'movie', '1');
            const destPath = join(movieDir, 'clip.mp4');

            expect(stat).toHaveBeenCalledWith(tempPath);
            expect(mkdir).toHaveBeenCalledWith(movieDir, { recursive: true });
            expect(rename).toHaveBeenCalledWith(tempPath, destPath);
            expect(managerMock.create).toHaveBeenCalledWith(
                MovieFile,
                expect.objectContaining({
                    path: 'public/movie/1/clip.mp4',
                    originalName: 'clip.mp4',
                    mimetype: 'video/mp4',
                    size: 1024,
                    movie: { id: 1 },
                }),
            );
            expect(managerMock.save).toHaveBeenCalledWith(MovieFile, [
                expect.objectContaining({ originalName: 'clip.mp4' }),
            ]);
            expect(result).toEqual(createdMovie);
        });

        it('should throw BadRequestException when a temp file does not exist', async () => {
            const { createMovieDto, qrMock } = setupCreateWithFilesMocks();

            jest.mocked(stat).mockRejectedValue(new Error('ENOENT'));

            await expect(service.create(createMovieDto, ['missing.mp4'], qrMock, 1)).rejects.toThrow(
                new BadRequestException('존재하지 않는 파일이 있습니다. -> missing.mp4'),
            );
            expect(mkdir).not.toHaveBeenCalled();
            expect(rename).not.toHaveBeenCalled();
        });

        it('should roll back moved files when saving MovieFile fails', async () => {
            const { createMovieDto, userId, managerMock, qrMock } = setupCreateWithFilesMocks();
            const files = ['clip.mp4'];
            const tempPath = join(process.cwd(), 'public', 'temp', 'clip.mp4');
            const destPath = join(process.cwd(), 'public', 'movie', '1', 'clip.mp4');

            jest.mocked(stat).mockResolvedValue({ size: 1024 } as Awaited<ReturnType<typeof stat>>);
            jest.mocked(mkdir).mockResolvedValue(undefined);
            jest.mocked(rename).mockResolvedValue(undefined);
            managerMock.save.mockRejectedValue(new Error('DB error'));

            await expect(service.create(createMovieDto, files, qrMock, userId)).rejects.toThrow('DB error');

            expect(rename).toHaveBeenCalledWith(tempPath, destPath);
            expect(rename).toHaveBeenCalledWith(destPath, tempPath);
            expect(managerMock.save).toHaveBeenCalled();
        });

        it('should roll back already moved files when a later rename fails', async () => {
            const { createMovieDto, userId, managerMock, qrMock } = setupCreateWithFilesMocks();
            const files = ['a.mp4', 'b.mp4'];
            const tempA = join(process.cwd(), 'public', 'temp', 'a.mp4');
            const destA = join(process.cwd(), 'public', 'movie', '1', 'a.mp4');

            jest.mocked(stat).mockResolvedValue({ size: 100 } as Awaited<ReturnType<typeof stat>>);
            jest.mocked(mkdir).mockResolvedValue(undefined);
            jest.mocked(rename).mockImplementation((src: string, dest: string) => {
                if (dest.includes('public/temp')) {
                    return Promise.resolve(undefined);
                }
                if (src.includes('b.mp4')) {
                    return Promise.reject(new Error('rename failed'));
                }
                return Promise.resolve(undefined);
            });

            await expect(service.create(createMovieDto, files, qrMock, userId)).rejects.toThrow('rename failed');

            expect(rename).toHaveBeenCalledWith(tempA, destA);
            expect(rename).toHaveBeenCalledWith(destA, tempA);
            expect(managerMock.save).not.toHaveBeenCalled();
        });
    });
    describe('update', () => {
        it('should update a movie and return the updated movie', async () => {
            const updateMovieDto: UpdateMovieDto = {
                title: 'test2',
                detail: 'test detail2',
                directorId: 2,
                genreIds: [2, 3],
            };
            const movie = {
                id: 1,
                title: 'test',
                detail: { id: 10, detail: 'test detail' },
                director: { id: 1, name: 'test director' },
                genres: [
                    { id: 1, name: 'genre1' },
                    { id: 2, name: 'genre2' },
                ],
                files: [],
                createAt: new Date(),
                updateAt: new Date(),
            } as unknown as Movie;
            const director = { id: 2, name: 'test director2' } as Director;
            const genres = [
                { id: 2, name: 'genre2' },
                { id: 3, name: 'genre3' },
            ] as Genre[];
            const updatedMovie = {
                ...movie,
                title: 'test2',
                detail: { ...movie.detail, detail: 'test detail2' },
                director,
                genres,
            } as Movie;

            const updateQbMock = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue(undefined),
            };
            const relationQbMock = {
                relation: jest.fn().mockReturnThis(),
                of: jest.fn().mockReturnThis(),
                addAndRemove: jest.fn().mockResolvedValue(undefined),
            };
            const managerMock = {
                findOne: jest.fn().mockResolvedValueOnce(movie).mockResolvedValueOnce(director),
                find: jest.fn().mockResolvedValue(genres),
                createQueryBuilder: jest
                    .fn()
                    .mockReturnValueOnce(updateQbMock)
                    .mockReturnValueOnce(updateQbMock)
                    .mockReturnValueOnce(relationQbMock),
            };
            const qrMock = {
                connect: jest.fn().mockResolvedValue(undefined),
                startTransaction: jest.fn().mockResolvedValue(undefined),
                commitTransaction: jest.fn().mockResolvedValue(undefined),
                rollbackTransaction: jest.fn().mockResolvedValue(undefined),
                release: jest.fn().mockResolvedValue(undefined),
                manager: managerMock,
            } as unknown as QueryRunner;

            jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(qrMock);
            jest.spyOn(movieRepository, 'findOne').mockResolvedValue(updatedMovie);

            const result = await service.update(1, updateMovieDto);

            expect(dataSource.createQueryRunner).toHaveBeenCalled();
            expect(qrMock.connect).toHaveBeenCalled();
            expect(qrMock.startTransaction).toHaveBeenCalled();
            expect(managerMock.findOne).toHaveBeenNthCalledWith(1, Movie, {
                where: { id: 1 },
                relations: { detail: true, genres: true },
            });
            expect(managerMock.findOne).toHaveBeenNthCalledWith(2, Director, { where: { id: 2 } });
            expect(managerMock.find).toHaveBeenCalledWith(Genre, {
                where: { id: In([2, 3]) },
            });
            expect(updateQbMock.update).toHaveBeenCalledWith(Movie);
            expect(updateQbMock.set).toHaveBeenCalledWith(expect.objectContaining({ title: 'test2', director }));
            expect(updateQbMock.set).toHaveBeenCalledWith({ detail: 'test detail2' });
            expect(updateQbMock.where).toHaveBeenCalledWith('id=:id', { id: 1 });
            expect(updateQbMock.where).toHaveBeenCalledWith('id=:id', { id: movie.detail.id });
            expect(updateQbMock.execute).toHaveBeenCalledTimes(2);
            expect(relationQbMock.relation).toHaveBeenCalledWith(Movie, 'genres');
            expect(relationQbMock.of).toHaveBeenCalledWith(1);
            expect(relationQbMock.addAndRemove).toHaveBeenCalledWith([2, 3], [1, 2]);
            expect(qrMock.commitTransaction).toHaveBeenCalled();
            expect(movieRepository.findOne).toHaveBeenCalledWith({
                where: { id: 1 },
                relations: { detail: true, director: true, genres: true, files: true },
            });
            expect(qrMock.release).toHaveBeenCalled();
            expect(result).toEqual(updatedMovie);
        });
        it('should throw a NotFoundException if movie not found', async () => {
            const updateMovieDto: UpdateMovieDto = {
                title: 'test2',
            };
            const managerMock = {
                findOne: jest.fn().mockResolvedValue(null),
            };
            const qrMock = {
                connect: jest.fn().mockResolvedValue(undefined),
                startTransaction: jest.fn().mockResolvedValue(undefined),
                rollbackTransaction: jest.fn().mockResolvedValue(undefined),
                release: jest.fn().mockResolvedValue(undefined),
                manager: managerMock,
            } as unknown as QueryRunner;

            jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(qrMock);

            await expect(service.update(1, updateMovieDto)).rejects.toThrow(
                new NotFoundException('id가 1인 영화는 존재하지 않습니다. '),
            );
            expect(managerMock.findOne).toHaveBeenCalledWith(Movie, {
                where: { id: 1 },
                relations: { detail: true, genres: true },
            });
            expect(qrMock.rollbackTransaction).toHaveBeenCalled();
            expect(qrMock.release).toHaveBeenCalled();
        });

        it('should throw a NotFoundException if genre not found', async () => {
            const updateMovieDto: UpdateMovieDto = {
                genreIds: [1, 2],
            };
            const movie = {
                id: 1,
                title: 'test',
                detail: { id: 10, detail: 'test detail' },
                genres: [{ id: 1, name: 'genre1' }],
            } as unknown as Movie;
            const managerMock = {
                findOne: jest.fn().mockResolvedValue(movie),
                find: jest.fn().mockResolvedValue([{ id: 1, name: 'genre1' }]),
            };
            const qrMock = {
                connect: jest.fn().mockResolvedValue(undefined),
                startTransaction: jest.fn().mockResolvedValue(undefined),
                commitTransaction: jest.fn().mockResolvedValue(undefined),
                rollbackTransaction: jest.fn().mockResolvedValue(undefined),
                release: jest.fn().mockResolvedValue(undefined),
                manager: managerMock,
            } as unknown as QueryRunner;

            jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(qrMock);

            const error = await service.update(1, updateMovieDto).catch((e) => e);
            expect(error).toBeInstanceOf(NotFoundException);
            expect(error.message).toContain('존재하지 않는 장르가 있습니다.');
            expect(error.message).toContain('존재하는 ids ->1');
            expect(managerMock.find).toHaveBeenCalledWith(Genre, {
                where: { id: In([1, 2]) },
            });
            expect(qrMock.rollbackTransaction).toHaveBeenCalled();
            expect(qrMock.commitTransaction).not.toHaveBeenCalled();
            expect(qrMock.release).toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('should delete movie files, movie, and detail then return message', async () => {
            const movie = {
                id: 1,
                title: 'test',
                detail: { id: 10, detail: 'test detail' },
            } as unknown as Movie;
            const deleteQbMock = {
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue(undefined),
            };

            jest.spyOn(movieRepository, 'findOne').mockResolvedValue(movie);
            jest.spyOn(movieFileRepository, 'delete').mockResolvedValue({ affected: 1, raw: [] });
            jest.spyOn(movieRepository, 'createQueryBuilder').mockReturnValue(
                deleteQbMock as unknown as SelectQueryBuilder<Movie>,
            );
            jest.spyOn(movieDetailRepository, 'delete').mockResolvedValue({ affected: 1, raw: [] });

            const result = await service.remove(1);

            expect(movieRepository.findOne).toHaveBeenCalledWith({
                where: { id: 1 },
                relations: { detail: true },
            });
            expect(movieFileRepository.delete).toHaveBeenCalledWith({ movie: { id: 1 } });
            expect(movieRepository.createQueryBuilder).toHaveBeenCalled();
            expect(deleteQbMock.delete).toHaveBeenCalled();
            expect(deleteQbMock.where).toHaveBeenCalledWith('id=:id', { id: 1 });
            expect(deleteQbMock.execute).toHaveBeenCalled();
            expect(movieDetailRepository.delete).toHaveBeenCalledWith(10);
            expect(result).toBe('1의 영화가 삭제되었습니다.');
        });

        it('should throw NotFoundException when movie does not exist', async () => {
            jest.spyOn(movieRepository, 'findOne').mockResolvedValue(null);

            await expect(service.remove(1)).rejects.toThrow(
                new NotFoundException('1의 영화는 존재하지 않습니다.'),
            );
            expect(movieFileRepository.delete).not.toHaveBeenCalled();
        });
    });

    describe('toggleMovieLie', () => {
        const movieId = 1;
        const userId = 2;
        const movie = { id: movieId, title: 'test' } as Movie;
        const user = { id: userId, email: 'user@test.com' } as User;

        const setupLikeQb = (firstGetOne: MovieUserLike | null, secondGetOne: MovieUserLike | null) => {
            const likeQbMock = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValueOnce(firstGetOne).mockResolvedValueOnce(secondGetOne),
            };
            jest.spyOn(movieUserLikeRepository, 'createQueryBuilder').mockReturnValue(
                likeQbMock as unknown as SelectQueryBuilder<MovieUserLike>,
            );
            return likeQbMock;
        };

        beforeEach(() => {
            jest.spyOn(movieRepository, 'findOne').mockResolvedValue(movie);
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
        });

        it('should save a new like record when none exists', async () => {
            const savedLike = { movie, user, isLike: true } as MovieUserLike;
            setupLikeQb(null, savedLike);
            jest.spyOn(movieUserLikeRepository, 'save').mockResolvedValue(savedLike);

            const result = await service.toggleMovieLie(movieId, userId, true);

            expect(movieUserLikeRepository.save).toHaveBeenCalledWith({ movie, user, isLike: true });
            expect(result).toEqual({ isLike: true });
        });

        it('should delete like record when toggling off the same state', async () => {
            const likeRecord = { movie, user, isLike: true } as MovieUserLike;
            setupLikeQb(likeRecord, null);
            jest.spyOn(movieUserLikeRepository, 'delete').mockResolvedValue({ affected: 1, raw: [] });

            const result = await service.toggleMovieLie(movieId, userId, true);

            expect(movieUserLikeRepository.delete).toHaveBeenCalledWith({ movie, user });
            expect(result).toEqual({ isLike: null });
        });

        it('should update like record when state changes', async () => {
            const likeRecord = { movie, user, isLike: false } as MovieUserLike;
            const updatedLike = { movie, user, isLike: true } as MovieUserLike;
            setupLikeQb(likeRecord, updatedLike);
            jest.spyOn(movieUserLikeRepository, 'update').mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

            const result = await service.toggleMovieLie(movieId, userId, true);

            expect(movieUserLikeRepository.update).toHaveBeenCalledWith({ movie, user }, { isLike: true });
            expect(result).toEqual({ isLike: true });
        });

        it('should throw NotFoundException when movie does not exist', async () => {
            jest.spyOn(movieRepository, 'findOne').mockResolvedValue(null);

            await expect(service.toggleMovieLie(movieId, userId, true)).rejects.toThrow(
                new NotFoundException('1의 영화는 존재하지 않습니다.'),
            );
        });

        it('should throw UnauthorizedException when user does not exist', async () => {
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

            await expect(service.toggleMovieLie(movieId, userId, true)).rejects.toThrow(
                new UnauthorizedException('사용자 정보를 찾을 수 없습니다.'),
            );
        });
    });
});
