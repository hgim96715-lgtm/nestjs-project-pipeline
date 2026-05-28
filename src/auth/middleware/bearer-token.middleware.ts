import { BadRequestException, Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { envVariableKeys } from 'src/common/const/env.const';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class BearerTokenMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER) private readonly cacheManger: Cache,
    ) {}

    validateBearerToken(rawToken: string) {
        // console.log('rawToken', rawToken);
        const bearerSplit = rawToken.split(' ');
        if (bearerSplit.length !== 2) {
            throw new BadRequestException('토큰포맷이 잘못되었습니다. 확인해주세요!');
        }

        const [bearer, token] = bearerSplit;

        if (bearer.toLowerCase() !== 'bearer') {
            throw new BadRequestException('토큰포맷이 잘못되었습니다. 확인해주세요!');
        }
        return token;
    }

    async use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            next();
            return;
        }

        const token = this.validateBearerToken(authHeader);
        const tokenHash = createHash('sha256').update(token).digest('hex');

        const blockTokenKey = `auth:block:${tokenHash}`;
        const blockedTokenPayload = await this.cacheManger.get(blockTokenKey);

        if (blockedTokenPayload) {
            throw new UnauthorizedException('토큰이 블락되었습니다. 다시 재발급해주세요!');
        }

        try {
            const decodedPayload = this.jwtService.decode(token);

            if (decodedPayload.type !== 'refresh' && decodedPayload.type !== 'access') {
                throw new BadRequestException('잘못된 토큰입니다.');
            }

            const secretKey =
                decodedPayload.type === 'refresh'
                    ? envVariableKeys.refreshTokenSecret
                    : envVariableKeys.accessTokenSecret;

            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.getOrThrow<string>(secretKey),
            });

            if (!payload.exp) {
                throw new UnauthorizedException('만료 시간이 없는 토큰입니다. 유의하세요!');
            }

            req.user = payload;
        } catch (e) {
            if (e instanceof Error && e.name === 'TokenExpiredError') {
                throw new UnauthorizedException('토큰이 만료되었습니다. 다시 재발급해주세요!');
            }
        }
        next();
    }
}
