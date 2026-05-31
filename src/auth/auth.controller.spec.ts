import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from 'src/user/entity/user.entity';
import { Authorization } from './decorator/authorization.decorator';

const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    tokenBlock: jest.fn(),
    loginUserPassport: jest.fn(),
    private: jest.fn(),
    rotateAccessToken: jest.fn(),
    issueToken: jest.fn(),
    parseBearerToken: jest.fn(),
};

describe('AuthController', () => {
    let controller: AuthController;
    let service: AuthService;
    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                AuthService,
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('register', () => {
        it('should register a new user', async () => {
            const rawToken = 'Basic test.token:test.password';
            const user = { email: 'test.token', password: 'test.password' };
            jest.spyOn(service, 'register').mockResolvedValue(user as User);
            const result = await controller.registrUser(rawToken);
            expect(service.register).toHaveBeenCalledWith(rawToken);
            expect(result).toEqual(user);
        });
    });
    describe('login', () => {
        it('should login a user', async () => {
            const rawToken = 'Basic test.token:test.password';
            jest.spyOn(service, 'login').mockResolvedValue({
                refreshToken: 'refresh-token',
                accessToken: 'access-token',
            });
            const result = await controller.loginUser(rawToken);
            expect(service.login).toHaveBeenCalledWith(rawToken);
            expect(result).toEqual({ refreshToken: 'refresh-token', accessToken: 'access-token' });
        });
    });

    describe('blockToken', () => {
        it('should block a token', async () => {
            const token = 'test.token';
            jest.spyOn(service, 'tokenBlock').mockResolvedValue(true);

            const result = await controller.blockToken(token);
            expect(service.tokenBlock).toHaveBeenCalledWith(token);
            expect(result).toEqual(true);
        });
    });

    describe('loginUserPassport', () => {
        it('should login a user with passport', async () => {
            const req = { user: { id: 1, email: 'test.token' } };
            jest.spyOn(service, 'issueToken')
                .mockResolvedValueOnce('refresh-token')
                .mockResolvedValueOnce('access-token');
            const result = await controller.loginUserPassport(req);
            expect(service.issueToken).toHaveBeenCalledWith(req.user, true);
            expect(service.issueToken).toHaveBeenCalledWith(req.user, false);
            expect(result).toEqual({ refreshToken: 'refresh-token', accessToken: 'access-token' });
        });
    });

    describe('private', () => {
        it('should return a private route', async () => {
            const req = { user: { id: 1, email: 'test.token' } };
            const result = await controller.private(req);
            expect(result).toEqual(req.user);
        });
    });

    describe('rotateAccessToken', () => {
        it('should rotate an access token', async () => {
            const req = { headers: { authorization: 'Bearer test.token' } };
            const payload = { id: 1, email: 'test.token' };

            jest.spyOn(service, 'parseBearerToken').mockResolvedValue(payload);
            jest.spyOn(service, 'issueToken').mockResolvedValue('access-token');

            const result = await controller.rotateAccessToken(req);

            expect(service.parseBearerToken).toHaveBeenCalledWith('Bearer test.token', true);
            expect(service.issueToken).toHaveBeenCalledWith(payload, false);
            expect(result).toEqual({ accessToken: 'access-token' });
        });
    });
});
