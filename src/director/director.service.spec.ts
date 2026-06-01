import { Test, TestingModule } from '@nestjs/testing';
import { DirectorService } from './director.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Director } from './entity/director.entity';
import { CreateDirectorDto } from './dto/create-director.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateDirectorDto } from './dto/update-director.dto';

const mockDirectorRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
};

describe('DirectorService', () => {
    let service: DirectorService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DirectorService,
                {
                    provide: getRepositoryToken(Director),
                    useValue: mockDirectorRepository,
                },
            ],
        }).compile();

        service = module.get<DirectorService>(DirectorService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
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
            jest.spyOn(mockDirectorRepository, 'findOne').mockResolvedValueOnce(null);
            jest.spyOn(mockDirectorRepository, 'create').mockReturnValueOnce(result);
            jest.spyOn(mockDirectorRepository, 'save').mockResolvedValueOnce(result);

            const createDirector = await service.create(createDirectorDto);
            expect(createDirector).toEqual(result);
            expect(mockDirectorRepository.findOne).toHaveBeenCalledWith({
                where: { name: createDirectorDto.name, dob: createDirectorDto.dob },
            });
            expect(mockDirectorRepository.save).toHaveBeenCalledWith(result);
        });
        it('should throw a ConflictException if director already exists', async () => {
            const createDirectorDto: CreateDirectorDto = {
                name: 'test',
                dob: new Date(),
                nationality: 'test.nationality',
            };
            const existingDirector = {
                id: 1,
                name: createDirectorDto.name,
                dob: createDirectorDto.dob,
                nationality: createDirectorDto.nationality,
            };
            jest.spyOn(mockDirectorRepository, 'findOne').mockResolvedValue(existingDirector);

            await expect(service.create(createDirectorDto)).rejects.toThrow(ConflictException);
            await expect(service.create(createDirectorDto)).rejects.toThrow(`id:${existingDirector.id}번`);
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
            jest.spyOn(mockDirectorRepository, 'find').mockResolvedValue(directors);
            const result = await service.findAll();
            expect(result).toEqual(directors);
            expect(mockDirectorRepository.find).toHaveBeenCalled();
        });
    });
    describe('findOne', () => {
        it('should return a directory by id', async () => {
            const director = {
                id: 1,
                name: 'test',
                dob: new Date(),
                nationality: 'test',
            };
            jest.spyOn(mockDirectorRepository, 'findOne').mockResolvedValueOnce(director);
            const result = await service.findOne(1);
            expect(result).toEqual(director);
            expect(mockDirectorRepository.findOne).toHaveBeenCalledWith({ where: { id: director.id } });
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

            jest.spyOn(mockDirectorRepository, 'findOne')
                .mockResolvedValueOnce(director)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(updateDirector);

            jest.spyOn(mockDirectorRepository, 'update').mockResolvedValueOnce(undefined);

            const result = await service.update(directorId, updateDirectorDto);
            expect(result).toEqual(updateDirector);
            expect(mockDirectorRepository.update).toHaveBeenCalledWith(directorId, updateDirectorDto);
        });
        it('should throw a NotFoundException if director not found', async () => {
            const updateDirectorDto: UpdateDirectorDto = {
                name: 'test2',
                dob: new Date(),
                nationality: 'test2.nationality',
            };
            const directorId = 1;
            jest.spyOn(mockDirectorRepository, 'findOne').mockResolvedValue(null);

            await expect(service.update(directorId, updateDirectorDto)).rejects.toThrow(NotFoundException);
            await expect(service.update(directorId, updateDirectorDto)).rejects.toThrow(
                '해당 id의 감독은 존재하지 않습니다.',
            );
        });
        it('should throw a ConflictException if director already exists', async () => {
            const updateDirectorDto: UpdateDirectorDto = {
                name: 'test2',
                dob: new Date(),
                nationality: 'test2.nationality',
            };
            const directorId = 1;
            const existingDirector = {
                id: directorId,
                name: 'test',
                dob: new Date(),
                nationality: 'test.nationality',
            };
            const duplicateDirectorId = 2;
            const duplicateDirector = {
                id: duplicateDirectorId,
                name: updateDirectorDto.name,
                dob: updateDirectorDto.dob,
                nationality: updateDirectorDto.nationality,
            };

            jest.spyOn(mockDirectorRepository, 'findOne')
                .mockResolvedValueOnce(existingDirector)
                .mockResolvedValueOnce(duplicateDirector);

            await expect(service.update(directorId, updateDirectorDto)).rejects.toThrow(
                `동일한 이름과 생년월일을 가진 감독이 이미 존재합니다. id: ${duplicateDirectorId}번을 확인해주세요.`,
            );
        });
    });
    describe('remove', () => {
        it('should delete a director and return the deleted director', async () => {
            const direcotrId = 1;
            const director = {
                id: direcotrId,
                name: 'test',
                dob: new Date(),
                nationality: 'test.nationality',
            };
            jest.spyOn(mockDirectorRepository, 'findOne').mockResolvedValueOnce(director);
            jest.spyOn(mockDirectorRepository, 'delete').mockResolvedValueOnce(undefined);

            const result = await service.remove(direcotrId);
            expect(result).toEqual(`${direcotrId}번 감독이 삭제되었습니다.`);
            expect(mockDirectorRepository.findOne).toHaveBeenCalledWith({ where: { id: direcotrId } });
            expect(mockDirectorRepository.delete).toHaveBeenCalledWith(direcotrId);
        });
        it('should throw a NotFoundException if director not found', async () => {
            const directorId = 1;
            jest.spyOn(mockDirectorRepository, 'findOne').mockResolvedValue(null);
            await expect(service.remove(directorId)).rejects.toThrow(NotFoundException);
            await expect(service.remove(directorId)).rejects.toThrow('존재하지 않는 ID 감독입니다.');
        });
    });
});
