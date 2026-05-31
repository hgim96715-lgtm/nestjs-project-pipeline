import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { Role, User } from 'src/user/entity/user.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from 'src/user/user.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { envVariableKeys } from 'src/common/const/env.const';
import * as bcrypt from 'bcrypt';
import { raw } from 'express';
import expectCookies from 'supertest/lib/cookies';

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
const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
};
const mockJwtService = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
    decode: jest.fn(),
};
const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
};

jest.mock('bcrypt', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
}));

describe('AuthService', () => {
    let authService: AuthService;
    let jwtService: JwtService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager,
                },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        jwtService = module.get<JwtService>(JwtService);
    });

    it('should be defined', () => {
        expect(authService).toBeDefined();
    });

    describe('tokenBlock', () => {
        it('should block a token', async () => {
            const token = 'test.token';
            const payload = {
                exp: Math.floor(Date.now() / 1000) + 60,
            };
            const tokenHash = createHash('sha256').update(token).digest('hex');
            const blockTokenKey = `auth:block:${tokenHash}`;
            const expiryDate = new Date(payload.exp * 1000);
            const remainingTime = Math.max(+expiryDate - Date.now(), 1);

            (jwtService.decode as jest.Mock).mockReturnValue(payload);

            const result = await authService.tokenBlock(token);

            expect(result).toBe(true);
            expect(jwtService.decode).toHaveBeenCalledWith(token);
            expect(mockCacheManager.set).toHaveBeenCalledWith(blockTokenKey, payload, remainingTime);
        });
    });

    describe('parseBasicToken', () => {
        it('should parse a valid basic token', () => {
            const rawToken = 'Basic dGVzdC50b2tlbjp0ZXN0LnBhc3N3b3Jk';
            const result = authService.parseBasicToken(rawToken);
            expect(result).toEqual({ email: 'test.token', password: 'test.password' });
        });

        it('should throw when authorization header is missing', () => {
            expect(() => authService.parseBasicToken('')).toThrow(BadRequestException);
            expect(() => authService.parseBasicToken('')).toThrow('Authorization 헤더가 필요합니다.');
        });

        it('should throw when token has wrong number of space-separated parts', () => {
            expect(() => authService.parseBasicToken('Basic')).toThrow(BadRequestException);
            expect(() => authService.parseBasicToken('Basic a b')).toThrow('토큰 포맷이 잘못되었습니다.확인해주세요!');
        });

        it('should throw when scheme is not Basic', () => {
            expect(() => authService.parseBasicToken('Bearer InvalidToken')).toThrow(BadRequestException);
            expect(() => authService.parseBasicToken('Bearer InvalidToken')).toThrow('토큰 포맷이 잘못되었습니다.');
        });

        it('should throw when decoded credentials have no colon', () => {
            const rawToken = `Basic ${Buffer.from('onlyemail').toString('base64')}`;
            expect(() => authService.parseBasicToken(rawToken)).toThrow(BadRequestException);
            expect(() => authService.parseBasicToken(rawToken)).toThrow('토큰포맷이 잘못되었습니다.확인해주세요');
        });

        it('should throw when decoded credentials have too many colons', () => {
            const rawToken = `Basic ${Buffer.from('a:b:c').toString('base64')}`;
            expect(() => authService.parseBasicToken(rawToken)).toThrow(BadRequestException);
            expect(() => authService.parseBasicToken(rawToken)).toThrow('토큰포맷이 잘못되었습니다.확인해주세요');
        });
    });

    describe('parseBearerToken', () => {
        it('should parse a valid access bearer token', async () => {
            const rawToken = 'Bearer test.token';
            const payload = { type: 'access' };
            (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);
            mockConfigService.getOrThrow.mockReturnValue('access-secret');

            const result = await authService.parseBearerToken(rawToken, false);

            expect(jwtService.verifyAsync).toHaveBeenCalledWith('test.token', {
                secret: 'access-secret',
            });
            expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(envVariableKeys.accessTokenSecret);
            expect(result).toEqual(payload);
        });

        it('should parse a valid refresh bearer token', async () => {
            const rawToken = 'Bearer refresh.token';
            const payload = { type: 'refresh' };
            (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);
            mockConfigService.getOrThrow.mockReturnValue('refresh-secret');

            const result = await authService.parseBearerToken(rawToken, true);

            expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh.token', {
                secret: 'refresh-secret',
            });
            expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(envVariableKeys.refreshTokenSecret);
            expect(result).toEqual(payload);
        });

        it('should throw BadRequestException for invalid bearer token format', async () => {
            await expect(authService.parseBearerToken('a', false)).rejects.toThrow(BadRequestException);
            await expect(authService.parseBearerToken('a', false)).rejects.toThrow(
                '토큰포맷이 잘못되었습니다.확인해주세요',
            );
        });

        it('should throw BadRequestException when scheme is not Bearer', async () => {
            await expect(authService.parseBearerToken('Basic a', false)).rejects.toThrow(BadRequestException);
            await expect(authService.parseBearerToken('Basic a', false)).rejects.toThrow(
                '토큰포맷이 잘못되었습니다.확인해주세요',
            );
        });

        it('should throw UnauthorizedException when token verification fails', async () => {
            (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid token'));
            mockConfigService.getOrThrow.mockReturnValue('access-secret');

            await expect(authService.parseBearerToken('Bearer invalid.token', false)).rejects.toThrow(
                UnauthorizedException,
            );
            await expect(authService.parseBearerToken('Bearer invalid.token', false)).rejects.toThrow(
                '유효하지 않는 토큰입니다.',
            );
        });

        it('should throw UnauthorizedException when access token is expected but payload is refresh', async () => {
            (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ type: 'refresh' });
            mockConfigService.getOrThrow.mockReturnValue('access-secret');

            await expect(authService.parseBearerToken('Bearer test.token', false)).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException when refresh token is expected but payload is access', async () => {
            (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ type: 'access' });
            mockConfigService.getOrThrow.mockReturnValue('refresh-secret');

            await expect(authService.parseBearerToken('Bearer test.token', true)).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });

    describe('register', () => {
        it('should register a new user', async () => {
            const rawToken = 'Basic test.token:test.password';

            const user = {
                email: 'test.token',
                password: 'test.password',
            };
            jest.spyOn(authService, 'parseBasicToken').mockReturnValue(user);
            jest.spyOn(mockUserService, 'create').mockResolvedValue(user);

            const result = await authService.register(rawToken);
            expect(authService.parseBasicToken).toHaveBeenCalledWith(rawToken);
            expect(mockUserService.create).toHaveBeenCalledWith(user);
            expect(result).toEqual(user);
        });
    });

    describe('authenticate', () => {
        it('should authenticate a user', async () => {
            const email = 'test@test.com';
            const password = 'password';
            const user = { id: 1, email, password: 'hashedPassword' };

            jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(user);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await authService.authenticate(email, password);

            expect(result).toEqual(user);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(password, user.password);
        });
    });
    it('should throw UnauthorizedException if user not found', async () => {
        const email = 'test@test.com';
        const password = 'password';
        jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);
        await expect(authService.authenticate(email, password)).rejects.toThrow(UnauthorizedException);
        await expect(authService.authenticate(email, password)).rejects.toThrow('잘못된 로그인 정보입니다.');
    });
    it('should throw UnauthorizedException if password is incorrect', async () => {
        const email = 'test@test.com';
        const password = 'password';
        const user = { id: 1, email, password: 'hashedPassword' };
        jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(user);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);
        await expect(authService.authenticate(email, password)).rejects.toThrow(UnauthorizedException);
        await expect(authService.authenticate(email, password)).rejects.toThrow('잘못된 로그인 정보입니다.');
    });

    describe('issueToken', () => {
        const user = { id: 1, role: Role.user };

        beforeEach(() => {
            mockConfigService.getOrThrow.mockImplementation((key: string) => {
                if (key === envVariableKeys.refreshTokenSecret) return 'refresh-secret';
                if (key === envVariableKeys.accessTokenSecret) return 'access-secret';
                throw new Error(`unknown key: ${key}`);
            });
        });

        it('should issue a refresh token', async () => {
            (jwtService.signAsync as jest.Mock).mockResolvedValue('refresh-token');

            const result = await authService.issueToken(user, true);

            expect(result).toEqual('refresh-token');
            expect(jwtService.signAsync).toHaveBeenCalledWith(
                { sub: user.id, role: user.role, type: 'refresh' },
                { secret: 'refresh-secret', expiresIn: '24h' },
            );
        });

        it('should issue an access token', async () => {
            (jwtService.signAsync as jest.Mock).mockResolvedValue('access-token');

            const result = await authService.issueToken(user, false);

            expect(result).toEqual('access-token');
            expect(jwtService.signAsync).toHaveBeenCalledWith(
                { sub: user.id, role: user.role, type: 'access' },
                { secret: 'access-secret', expiresIn: 300 },
            );
        });
    });

    describe('login', () => {
        it('should login a user', async () => {
            const rawToken = 'Basic test.token:test.password';
            const credentials = { email: 'test.token', password: 'test.password' };
            const user = { id: 1, ...credentials, password: 'hashedPassword' };

            jest.spyOn(authService, 'parseBasicToken').mockReturnValue(credentials);
            jest.spyOn(authService, 'authenticate').mockResolvedValueOnce(user as User);

            jest.spyOn(authService, 'issueToken')
                .mockResolvedValueOnce('refresh-token')
                .mockResolvedValueOnce('access-token');

            const result = await authService.login(rawToken);

            expect(authService.parseBasicToken).toHaveBeenCalledWith(rawToken);
            expect(authService.authenticate).toHaveBeenCalledWith(credentials.email, credentials.password);
            expect(authService.issueToken).toHaveBeenCalledWith(user, true);
            expect(authService.issueToken).toHaveBeenCalledWith(user, false);
            expect(result).toEqual({
                refreshToken: 'refresh-token',
                accessToken: 'access-token',
            });
        });
    });
});
