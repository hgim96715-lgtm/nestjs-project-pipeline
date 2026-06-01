import { Test, TestingModule } from '@nestjs/testing';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { GetMoviesDto } from './dto/get-movies.dto';
import { Movie } from './entity/movie.entity';
import { QueryRunner } from 'typeorm';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';

const mockMovieService = {
    findAll: jest.fn(),
    findMovieRecent: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    toggleMovieLie: jest.fn(),
};

describe('MovieController', () => {
    let controller: MovieController;
    let service: MovieService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MovieController],
            providers: [
                {
                    provide: MovieService,
                    useValue: mockMovieService,
                },
            ],
        })
            .overrideInterceptor(TransactionInterceptor)
            .useValue({
                intercept: (_context: unknown, next: { handle: () => unknown }) => next.handle(),
            })
            .compile();

        controller = module.get<MovieController>(MovieController);
        service = module.get<MovieService>(MovieService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return movies from service', async () => {
            const dto: GetMoviesDto = { title: 'test', take: 10, order: ['id_ASC'] };
            const userId = 1;
            const result = { data: [{ id: 1, title: 'test' }], count: 1, nextCursor: null };

            jest.spyOn(service, 'findAll').mockResolvedValue(result as Awaited<ReturnType<MovieService['findAll']>>);

            const movies = await controller.findAll(dto, userId);

            expect(service.findAll).toHaveBeenCalledWith(dto, userId);
            expect(movies).toEqual(result);
        });

        it('should call findAll without userId when unauthenticated', async () => {
            const dto: GetMoviesDto = { take: 10, order: ['id_ASC'] };
            jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], count: 0, nextCursor: null });

            await controller.findAll(dto, undefined);

            expect(service.findAll).toHaveBeenCalledWith(dto, undefined);
        });
    });

    describe('getMoviesRecent', () => {
        it('should return recent movies from service', async () => {
            const recent = [{ id: 1, title: 'test', createAt: new Date() }];
            jest.spyOn(service, 'findMovieRecent').mockResolvedValue(recent as Movie[]);

            const result = await controller.getMoviesRecent();

            expect(service.findMovieRecent).toHaveBeenCalled();
            expect(result).toEqual(recent);
        });
    });

    describe('findOne', () => {
        it('should return a movie by id', async () => {
            const movie = { id: 1, title: 'test' } as Movie;
            jest.spyOn(service, 'findOne').mockResolvedValue(movie);

            const result = await controller.findOne(1);

            expect(service.findOne).toHaveBeenCalledWith(1);
            expect(result).toEqual(movie);
        });
    });

    describe('create', () => {
        it('should create a movie with files from dto', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'detail',
                directorId: 1,
                genreIds: [1],
                files: ['clip.mp4'],
            };
            const userId = 2;
            const queryRunner = { manager: {} } as QueryRunner;
            const created = { id: 1, title: 'test' } as Movie;

            jest.spyOn(service, 'create').mockResolvedValue(created);

            const result = await controller.create(createMovieDto, queryRunner, userId);

            expect(service.create).toHaveBeenCalledWith(createMovieDto, ['clip.mp4'], queryRunner, userId);
            expect(result).toEqual(created);
        });

        it('should pass empty files array when dto.files is omitted', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'test',
                detail: 'detail',
                directorId: 1,
                genreIds: [1],
            };
            const queryRunner = { manager: {} } as QueryRunner;

            jest.spyOn(service, 'create').mockResolvedValue({ id: 1 } as Movie);

            await controller.create(createMovieDto, queryRunner, 1);

            expect(service.create).toHaveBeenCalledWith(createMovieDto, [], queryRunner, 1);
        });
    });

    describe('createMovieLike', () => {
        it('should toggle like with isLike true', async () => {
            const likeResult = { isLike: true };
            jest.spyOn(service, 'toggleMovieLie').mockResolvedValue(likeResult);

            const result = await controller.createMovieLike(1, 2);

            expect(service.toggleMovieLie).toHaveBeenCalledWith(1, 2, true);
            expect(result).toEqual(likeResult);
        });
    });

    describe('createMovieUnlike', () => {
        it('should toggle like with isLike false', async () => {
            const unlikeResult = { isLike: false };
            jest.spyOn(service, 'toggleMovieLie').mockResolvedValue(unlikeResult);

            const result = await controller.createMovieUnlike(1, 2);

            expect(service.toggleMovieLie).toHaveBeenCalledWith(1, 2, false);
            expect(result).toEqual(unlikeResult);
        });
    });

    describe('update', () => {
        it('should update a movie and return the updated movie', async () => {
            const updateMovieDto: UpdateMovieDto = { title: 'updated' };
            const updated = { id: 1, title: 'updated' } as Movie;

            jest.spyOn(service, 'update').mockResolvedValue(updated);

            const result = await controller.update(1, updateMovieDto);

            expect(service.update).toHaveBeenCalledWith(1, updateMovieDto);
            expect(result).toEqual(updated);
        });
    });

    describe('remove', () => {
        it('should remove a movie and return the message', async () => {
            const message = '1의 영화가 삭제되었습니다.';
            jest.spyOn(service, 'remove').mockResolvedValue(message);

            const result = await controller.remove(1);

            expect(service.remove).toHaveBeenCalledWith(1);
            expect(result).toEqual(message);
        });
    });
});
