import { Test, TestingModule } from '@nestjs/testing';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Director } from './entity/director.entity';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';

const mockDirectorRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

describe('DirectorController', () => {
    let controller: DirectorController;
    let service: DirectorService;
    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DirectorController],
            providers: [
                DirectorService,
                {
                    provide: getRepositoryToken(Director),
                    useValue: mockDirectorRepository,
                },
            ],
        }).compile();

        controller = module.get<DirectorController>(DirectorController);
        service = module.get<DirectorService>(DirectorService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should create a new director and return it', async () => {
            const createDirectorDto: CreateDirectorDto = {
                name: 'test',
                dob: new Date(),
                nationality: 'test',
            };
            const result = {
                id: 1,
                name: createDirectorDto.name,
                dob: createDirectorDto.dob,
                nationality: createDirectorDto.nationality,
            };
            jest.spyOn(service, 'create').mockResolvedValue(result as Director);
            const createDirector = await controller.create(createDirectorDto);
            expect(service.create).toHaveBeenCalledWith(createDirectorDto);
            expect(createDirector).toEqual(result);
        });
    });
    describe('findAll', () => {
        it('should return all directors', async () => {
            const directors = [
                {
                    id: 1,
                    name: 'test',
                    dob: new Date(),
                    nationality: 'test',
                },
                {
                    id: 2,
                    name: 'test2',
                    dob: new Date(),
                    nationality: 'test2',
                },
            ];
            jest.spyOn(service, 'findAll').mockResolvedValue(directors as Director[]);
            const findAllDirectors = await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
            expect(findAllDirectors).toEqual(directors);
        });
    });
    describe('findOne', () => {
        it('should return a director by id', async () => {
            const directorId = 1;
            const director = {
                id: directorId,
                name: 'test',
                dob: new Date(),
                nationality: 'test',
            };
            jest.spyOn(service, 'findOne').mockResolvedValue(director as Director);
            const findOneDirector = await controller.findOne(directorId);
            expect(service.findOne).toHaveBeenCalledWith(directorId);
            expect(findOneDirector).toEqual(director);
        });
    });
    describe('update', () => {
        it('should update a director and return the updated director', async () => {
            const updateDirectorDto: UpdateDirectorDto = {
                name: 'test2',
                dob: new Date(),
                nationality: 'test2.nationality',
            };
            const directorId = 1;
            const director = {
                id: directorId,
                name: 'test',
                dob: new Date(),
                nationality: 'test.nationality',
            };
            const updateDirector = { ...director, ...updateDirectorDto };

            jest.spyOn(service, 'update').mockResolvedValue(updateDirector as Director);
            const result = await controller.update(directorId, updateDirectorDto);
            expect(service.update).toHaveBeenCalledWith(directorId, updateDirectorDto);
            expect(result).toEqual(updateDirector);
        });
    });
    describe('remove', () => {
        it('should call remove method from DirectorService with correct ID', async () => {
            const directorId = 1;
            jest.spyOn(service, 'remove').mockResolvedValueOnce(`${directorId}번 감독이 삭제되었습니다.`);
            const result = await controller.remove(directorId);
            expect(service.remove).toHaveBeenCalledWith(directorId);
            expect(result).toEqual(`${directorId}번 감독이 삭제되었습니다.`);
        });
    });
});
