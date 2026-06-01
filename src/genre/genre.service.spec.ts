import { Test, TestingModule } from '@nestjs/testing';
import { GenreService } from './genre.service';
import { Genre } from './entity/genre.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateGenreDto } from './dto/create-genre.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateGenreDto } from './dto/update-genre.dto';

const mockGenreRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

describe('GenreService', () => {
    let service: GenreService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GenreService,
                {
                    provide: getRepositoryToken(Genre),
                    useValue: mockGenreRepository,
                },
            ],
        }).compile();

        service = module.get<GenreService>(GenreService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a new genre and return it', async () => {
            const createGenreDto: CreateGenreDto = {
                name: 'test',
            };
            const result = {
                id: 1,
                name: createGenreDto.name,
            };

            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValueOnce(null);
            jest.spyOn(mockGenreRepository, 'save').mockResolvedValueOnce(result);
            const createGenre = await service.create(createGenreDto);
            expect(createGenre).toEqual(result);
            expect(mockGenreRepository.findOne).toHaveBeenCalledWith({
                where: { name: createGenreDto.name },
            });
            expect(mockGenreRepository.save).toHaveBeenCalledWith(createGenreDto);
        });
        it('should throw a  NotFoundException if genre already exists', async () => {
            const createGenreDto: CreateGenreDto = {
                name: 'test',
            };
            const existingGenre = {
                id: 1,
                name: createGenreDto.name,
            };
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValue(existingGenre);
            await expect(service.create(createGenreDto)).rejects.toThrow(NotFoundException);
            await expect(service.create(createGenreDto)).rejects.toThrow('이미 존재하는 장르입니다.');
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
            jest.spyOn(mockGenreRepository, 'find').mockResolvedValue(genres);
            const result = await service.findAll();
            expect(result).toEqual(genres);
            expect(mockGenreRepository.find).toHaveBeenCalled();
        });
    });
    describe('findOne', () => {
        it('should return a genre by id', async () => {
            const genreId = 1;
            const genre = {
                id: genreId,
                name: 'test',
            };
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValue(genre);
            const result = await service.findOne(genreId);
            expect(result).toEqual(genre);
            expect(mockGenreRepository.findOne).toHaveBeenCalledWith({ where: { id: genreId } });
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
            jest.spyOn(mockGenreRepository, 'findOne')
                .mockResolvedValueOnce(genre)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(updatedGenre);
            jest.spyOn(mockGenreRepository, 'update').mockResolvedValueOnce(undefined);
            const result = await service.update(genreId, updateGenreDto);
            expect(result).toEqual(updatedGenre);
            expect(mockGenreRepository.update).toHaveBeenCalledWith({ id: genreId }, updateGenreDto);
        });
        it('should throw a NotFoundException if genre not found', async () => {
            const updateGenreDto: UpdateGenreDto = {
                name: 'test2',
            };
            const genreId = 1;
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValue(null);
            await expect(service.update(genreId, updateGenreDto)).rejects.toThrow(NotFoundException);
            await expect(service.update(genreId, updateGenreDto)).rejects.toThrow('존재하지 않는 장르입니다.');
        });
        it('should throw a ConflictException if genre name is already in use', async () => {
            const updateGenreDto: UpdateGenreDto = {
                name: 'test2',
            };
            const genreId = 1;
            const genre = {
                id: genreId,
                name: 'test',
            };
            const duplicateGenre = {
                id: 2,
                name: updateGenreDto.name,
            };
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValue(genre).mockResolvedValue(duplicateGenre);
            await expect(service.update(genreId, updateGenreDto)).rejects.toThrow(ConflictException);
            await expect(service.update(genreId, updateGenreDto)).rejects.toThrow('이미 존재하는 장르입니다.');
        });
    });
    describe('remove', () => {
        it('should delete a genre and return the deleted genre', async () => {
            const genreId = 1;
            const genre = {
                id: genreId,
                name: 'test',
                movies: [],
            };
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValueOnce(genre);
            jest.spyOn(mockGenreRepository, 'delete').mockResolvedValueOnce(undefined);
            const result = await service.remove(genreId);
            expect(result).toEqual(`${genreId}가 삭제되었습니다.`);
            expect(mockGenreRepository.findOne).toHaveBeenCalledWith({
                where: { id: genreId },
                relations: { movies: true },
            });
            expect(mockGenreRepository.delete).toHaveBeenCalledWith(genreId);
        });
        it('should throw a NotFoundException if genre not found', async () => {
            const genreId = 1;
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValue(null);
            await expect(service.remove(genreId)).rejects.toThrow(NotFoundException);
            await expect(service.remove(genreId)).rejects.toThrow('존재하지 않는 장르입니다.');
        });
        it('should throw a ConflictException if genre is used in a movie', async () => {
            const genreId = 1;
            const genre = {
                id: genreId,
                name: 'test',
                movies: [{ id: 1 }, { id: 2 }],
            };
            jest.spyOn(mockGenreRepository, 'findOne').mockResolvedValue(genre);
            await expect(service.remove(genreId)).rejects.toThrow(ConflictException);
            await expect(service.remove(genreId)).rejects.toThrow('영화에서 사용중인 장르는 삭제 할 수없습니다.');
        });
    });
});
