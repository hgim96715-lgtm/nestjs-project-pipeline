import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role, User } from 'src/user/entity/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { createHash } from 'crypto';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/common/prisma.service';
import { Role as PrismaRole } from '../../generated/prisma/prisma/client';
@Injectable()
export class AuthService {
    constructor(
        // @InjectRepository(User) private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly prisma: PrismaService,
    ) {}

    async tokenBlock(token: string) {
        const payload = await this.jwtService.decode(token);
        const expiryDate = new Date(payload.exp * 1000);

        const now = Date.now();
        const diff = (+expiryDate - now) / 1000;

        const tokenHash = createHash('sha256').update(token).digest('hex');
        const blockTokenKey = `auth:block:${tokenHash}`;

        // const blockTokenKey = `BLOCK_TOKEN_${token}`;

        const remainingTime = Math.max(diff * 1000, 1);

        await this.cacheManager.set(blockTokenKey, payload, remainingTime);

        return true;
    }

    parseBasicToken(rawToken: string) {
        // Basic {token}
        // console.log(rawToken)
        if (!rawToken) {
            throw new BadRequestException('Authorization 헤더가 필요합니다.');
        }
        const basicSplit = rawToken.split(' ');

        if (basicSplit.length !== 2) {
            throw new BadRequestException('토큰 포맷이 잘못되었습니다.확인해주세요!');
        }

        const [basic, token] = basicSplit;

        if (basic.toLowerCase() !== 'basic') {
            throw new BadRequestException('토큰 포맷이 잘못되었습니다.');
        }

        const decoded = Buffer.from(token, 'base64').toString('utf-8');

        // :로 분리
        const tokenSplit = decoded.split(':');

        if (tokenSplit.length !== 2) {
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요');
        }

        const [email, password] = tokenSplit;
        return { email, password };
    }

    async parseBearerToken(rawToken: string, isRefreshToken: boolean) {
        // Bearer {token}
        // console.log(rawToken)
        const bearerSplit = rawToken.split(' ');

        if (bearerSplit.length !== 2) {
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요');
        }

        const [bearer, token] = bearerSplit;

        if (bearer.toLowerCase() !== 'bearer') {
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.getOrThrow<string>(
                    isRefreshToken ? envVariableKeys.refreshTokenSecret : envVariableKeys.accessTokenSecret,
                ),
            });
            // console.log(payload)
            if (isRefreshToken) {
                if (payload.type !== 'refresh') {
                    throw new BadRequestException('refresh 토큰이 아닙니다.');
                }
            } else {
                if (payload.type !== 'access') {
                    throw new BadRequestException('access 토큰이 아닙니다.');
                }
            }
            return payload;
        } catch (e) {
            throw new UnauthorizedException('유효하지 않는 토큰입니다.');
        }
    }

    async register(rawToken: string) {
        const { email, password } = this.parseBasicToken(rawToken);

        return this.userService.create({ email, password });
    }

    async authenticate(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        // const user = await this.userRepository.findOne({ where: { email } });

        if (!user) {
            throw new UnauthorizedException('잘못된 로그인 정보입니다.');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            throw new UnauthorizedException('잘못된 로그인 정보입니다.');
        }
        return user;
    }

    async issueToken(user: { id: number; role: unknown }, isRfreshToken: boolean) {
        const refreshTokenSecret = this.configService.getOrThrow<string>(envVariableKeys.refreshTokenSecret);
        const accessTokenSecret = this.configService.getOrThrow<string>(envVariableKeys.accessTokenSecret);

        return this.jwtService.signAsync(
            {
                sub: user.id,
                role: user.role,
                type: isRfreshToken ? 'refresh' : 'access',
            },
            {
                secret: isRfreshToken ? refreshTokenSecret : accessTokenSecret,
                expiresIn: isRfreshToken ? '24h' : '1080h',
            },
        );
    }

    async login(rawToken: string) {
        const { email, password } = this.parseBasicToken(rawToken);

        const user = await this.authenticate(email, password);

        return {
            user: { id: user.id, role: user.role },
            refreshToken: await this.issueToken(user, true),
            accessToken: await this.issueToken(user, false),
        };
    }
}
