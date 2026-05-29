import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { NotFoundException } from '@nestjs/common';

const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

describe('UserService', () => {
    let service: UserService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('findAll', () => {
        it('should return all users', async () => {
            const users = [
                {
                    id: 1,
                    email: 'test@test.com',
                },
            ];
            mockUserRepository.find.mockResolvedValue(users);
            const result = await service.findAll();
            expect(result).toEqual(users);
            expect(mockUserRepository.find).toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('should return a user by id', async () => {
            const user = { id: 1, email: 'test@test.com' };
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
            const result = await service.findOne(1);
            expect(result).toEqual(user);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
        });
        it('should throw a NotFoundException if user not found', async () => {
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);
            await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
        });
    });

    describe('remove', () => {
        it('should delete a user by id', async () => {
            const id = 999;
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue({ id: 1 });
            jest.spyOn(mockUserRepository, 'delete').mockResolvedValue({ affected: 1 });
            const result = await service.remove(id);
            expect(result).toBe(`${id}번 사용자가 삭제되었습니다.`);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id } });
        });
        it('should throw a NotFoundException if user not found', async () => {
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);
            await expect(service.remove(999)).rejects.toThrow(NotFoundException);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
            expect(mockUserRepository.delete).not.toHaveBeenCalled();
        });
    });
});
