import { Test, TestingModule } from '@nestjs/testing';
import { GenreController } from './genre.controller';
import { GenreService } from './genre.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Genre } from './entity/genre.entity';
import { CreateGenreDto } from './dto/create-genre.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';

const mockGenreRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

describe('GenreController', () => {
    let controller: GenreController;
    let service: GenreService;
    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GenreController],
            providers: [
                GenreService,
                {
                    provide: getRepositoryToken(Genre),
                    useValue: mockGenreRepository,
                },
            ],
        }).compile();

        controller = module.get<GenreController>(GenreController);
        service = module.get<GenreService>(GenreService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    describe('create', () => {
        it('should create a new genre and return it', async () => {
            const createDirectorDto: CreateGenreDto = {
                name: 'test',
            };
            const result = {
                id: 1,
                name: createDirectorDto.name,
            };
            jest.spyOn(service, 'create').mockResolvedValue(result as Genre);
            const createGenre = await controller.create(createDirectorDto);
            expect(service.create).toHaveBeenCalledWith(createDirectorDto);
            expect(createGenre).toEqual(result);
        });
    });
    describe('findAll', () => {
        it('should return all genres', async () => {
            const genres = [
                {
                    id: 1,
                    name: 'test',
                },
                {
                    id: 2,
                    name: 'test2',
                },
            ];
            jest.spyOn(service, 'findAll').mockResolvedValue(genres as Genre[]);
            const findAllGenres = await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
            expect(findAllGenres).toEqual(genres);
        });
    });
    describe('findOne', () => {
        it('should return a genre by id', async () => {
            const genreId = 1;
            const genre = {
                id: genreId,
                name: 'test',
            };
            jest.spyOn(service, 'findOne').mockResolvedValue(genre as Genre);
            const findOneGenre = await controller.findOne(genreId);
            expect(service.findOne).toHaveBeenCalledWith(genreId);
            expect(findOneGenre).toEqual(genre);
        });
    });

    describe('update', () => {
        it('should update a genre and return the updated genre', async () => {
            const updateGenreDto: UpdateGenreDto = {
                name: 'test2',
            };
            const genreId = 1;
            const genre = {
                id: genreId,
                name: 'test',
            };
            const updatedGenre = { ...genre, ...updateGenreDto };
            jest.spyOn(service, 'update').mockResolvedValue(updatedGenre as Genre);
            const result = await controller.update(genreId, updateGenreDto);
            expect(service.update).toHaveBeenCalledWith(genreId, updateGenreDto);
            expect(result).toEqual(updatedGenre);
        });
    });
    describe('remove', () => {
        it('should remove a genre and return the removed genre', async () => {
            const genreId = 1;
            const result = `${genreId}가 삭제되었습니다.`;

            jest.spyOn(service, 'remove').mockResolvedValue(result);
            const removeGenre = await controller.remove(genreId);
            expect(service.remove).toHaveBeenCalledWith(genreId);
            expect(removeGenre).toEqual(result);
        });
    });
});
