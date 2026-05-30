import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role, User } from './entity/user.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';

jest.mock('bcrypt', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockConfigService = {
    getOrThrow: jest.fn(),
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
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a new user and return it', async () => {
            const createUserDto: CreateUserDto = {
                email: 'test@test.com',
                password: 'password',
            };
            const saltRounds = 10;
            const hashedPassword = 'hashedPassword';
            const result = {
                id: 1,
                email: createUserDto.email,
                password: hashedPassword,
            };

            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(null);
            jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue(saltRounds);
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(result);
            const createdUser = await service.create(createUserDto);
            expect(createdUser).toEqual(result);
            expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(1, { where: { email: createUserDto.email } });
            expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(2, { where: { email: createUserDto.email } });
            expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(expect.anything());
            expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, saltRounds);
            expect(mockUserRepository.save).toHaveBeenCalledWith({
                email: createUserDto.email,
                password: hashedPassword,
                role: Role.admin,
            });
        });
        it('should throw a ConflictException if user already exists', async () => {
            const createUserDto: CreateUserDto = {
                email: 'test@test.com',
                password: 'password',
            };
            const result = {
                id: 1,
                email: createUserDto.email,
                password: 'hashedPassword',
                role: Role.admin,
            };
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(result);
            await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: createUserDto.email } });
        });
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

    describe('update', () => {
        it('should update a user if exists and return the updated user', async () => {
            const updateUserDto: UpdateUserDto = {
                email: 'test@test.com',
                password: 'password',
            };

            const saltRounds = 10;
            const hashedPassword = 'hashedPassword';

            const exitUser = {
                id: 1,
                email: 'test@test.com',
                password: 'hashedPassword',
                role: Role.admin,
            };

            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(exitUser);
            jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue(saltRounds);
            (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
            jest.spyOn(mockUserRepository, 'update').mockResolvedValue(undefined);
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce({
                ...exitUser,
                password: hashedPassword,
            });
            const result = await service.update(1, updateUserDto);
            expect(result).toEqual({ ...exitUser, password: hashedPassword });
            expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(1, { where: { id: 1 } });
            expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(2, { where: { id: 1 } });
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                { id: exitUser.id },
                { email: updateUserDto.email, password: hashedPassword },
            );
            expect(bcrypt.hash).toHaveBeenCalledWith(updateUserDto.password, saltRounds);
        });

        it('should throw a NotFoundException if user not found', async () => {
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);
            const updateUserDto: UpdateUserDto = {
                email: 'test@test.com',
                password: 'password',
            };
            await expect(service.update(999, updateUserDto)).rejects.toThrow(NotFoundException);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });

        it('should update email without hashing when password is omitted', async () => {
            const updateUserDto: UpdateUserDto = {
                email: 'test@test.com',
            };
            const exitUser = {
                id: 1,
                email: 'test@test.com',
                password: 'hashedPassword',
                role: Role.admin,
            };
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(exitUser);
            jest.spyOn(mockUserRepository, 'update').mockResolvedValue(undefined);
            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce({
                ...exitUser,
                email: updateUserDto.email,
            });
            const result = await service.update(1, updateUserDto);
            expect(result).toEqual({ ...exitUser, email: updateUserDto.email });
            expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(1, { where: { id: 1 } });
            expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(2, { where: { id: 1 } });
            expect(mockUserRepository.update).toHaveBeenCalledWith({ id: exitUser.id }, { email: updateUserDto.email });
            expect(bcrypt.hash).not.toHaveBeenCalled();
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
