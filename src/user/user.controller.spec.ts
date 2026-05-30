import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Role, User } from './entity/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
};

describe('UserController', () => {
    let controller: UserController;
    let service: UserService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserController],
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
            ],
        }).compile();

        controller = module.get<UserController>(UserController);
        service = module.get<UserService>(UserService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should return correct value', async () => {
            const createUserDto: CreateUserDto = {
                email: 'test@test.com',
                password: 'password',
            };

            const user = {
                id: 1,
                ...createUserDto,
                password: 'hashedPassword',
                role: Role.admin,
            };

            jest.spyOn(service, 'create').mockResolvedValue(user as User);
            const result = await controller.create(createUserDto);
            expect(service.create).toHaveBeenCalledWith(createUserDto);
            expect(result).toEqual(user);
        });
    });
    describe('findAll', () => {
        it('should return a list of users', async () => {
            const users = [
                {
                    id: 1,
                    email: 'test@test.com',
                },
                {
                    id: 2,
                    email: 'test2@test.com',
                },
            ];
            jest.spyOn(service, 'findAll').mockResolvedValue(users as User[]);
            const result = await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
            expect(result).toEqual(users);
        });
    });
    describe('findOne', () => {
        it('should return a user by id', async () => {
            const user = {
                id: 1,
                email: 'test@test.com',
            };
            jest.spyOn(service, 'findOne').mockResolvedValue(user as User);
            const result = await controller.findOne(1);
            expect(service.findOne).toHaveBeenCalledWith(1);
            expect(result).toEqual(user);
        });
    });
    describe('update', () => {
        it('should update a user and return the updated user', async () => {
            const updateUserDto: UpdateUserDto = {
                email: 'test@test.com',
                password: 'password',
            };
            const user = {
                id: 1,
                ...updateUserDto,
                password: 'hashedPassword',
                role: Role.admin,
            };
            jest.spyOn(service, 'update').mockResolvedValue(user as User);
            const result = await controller.update(1, updateUserDto);
            expect(service.update).toHaveBeenCalledWith(1, updateUserDto);
            expect(result).toEqual(user);
        });
    });
    describe('remove', () => {
        it('should remove a user and return the removed user', async () => {
            const user = {
                id: 1,
                email: 'test@test.com',
            };
            jest.spyOn(service, 'remove').mockResolvedValue(`1번 사용자가 삭제되었습니다.`);
            const result = await controller.remove(1);
            expect(service.remove).toHaveBeenCalledWith(1);
            expect(result).toEqual(`1번 사용자가 삭제되었습니다.`);
        });
    });
});
