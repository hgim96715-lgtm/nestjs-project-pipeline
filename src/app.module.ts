import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MovieModule } from './movie/movie.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GenreModule } from './genre/genre.module';
import { DirectorModule } from './director/director.module';

import * as Joi from 'joi';
import { envVariableKeys } from './common/const/env.const';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/guard/auth.guard';
import { BearerTokenMiddleware } from './auth/middleware/bearer-token.middleware';
import { RBACGuard } from './auth/guard/rbac.guard';
import { CommonModule } from './common/common.module';
import { ResponseTimeInterceptor } from './common/interceptor/ex.response-time.interceptor';
import { CacheInterceptor } from './common/interceptor/ex.cache.interceptor';
import { ForbiddenExceptionFilter } from './common/filter/forbidden.filter';
import { QueryFailedException } from './common/filter/query-failed.filter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CommonController } from './common/common.controller';

import { CacheModule } from '@nestjs/cache-manager';
import { minutes, Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
    imports: [
        MovieModule,
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                ENV: Joi.string().valid('dev', 'prod').required(),
                DB_TYPE: Joi.string().valid('postgres').required(),
                DB_HOST: Joi.string().required(),
                DB_PORT: Joi.number().required(),
                DB_USER: Joi.string().required(),
                DB_PASSWORD: Joi.string().required(),
                DB_DATABASE: Joi.string().required(),
                HASH_ROUNDS: Joi.number().required(),
                ACCESS_TOKEN_SECRET: Joi.string().required(),
                REFRESH_TOKEN_SECRET: Joi.string().required(),
            }),
        }),
        TypeOrmModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
                type: configService.get<string>(envVariableKeys.dbType) as 'postgres',
                host: configService.get<string>(envVariableKeys.dbHost),
                port: configService.get<number>(envVariableKeys.dbPort),
                username: configService.get<string>(envVariableKeys.dbUsername),
                password: configService.get<string>(envVariableKeys.dbPassword),
                database: configService.get<string>(envVariableKeys.dbDatabase),
                //
                autoLoadEntities: true,
                synchronize: true,
            }),
            inject: [ConfigService],
        }),
        GenreModule,
        DirectorModule,
        AuthModule,
        UserModule,
        CommonModule,
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'public'),
            serveRoot: '/public',
        }),
        CacheModule.register({
            ttl: 0,
            max: 10,
            isGlobal: true,
        }),
        ThrottlerModule.forRoot({
            throttlers: [
                {
                    ttl: minutes(1),
                    limit: 20,
                },
            ],
            errorMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        }),
    ],
    controllers: [CommonController],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RBACGuard,
        },
        { provide: APP_INTERCEPTOR, useClass: ResponseTimeInterceptor },
        {
            provide: APP_FILTER,
            useClass: ForbiddenExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: QueryFailedException,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(BearerTokenMiddleware)
            .exclude(
                {
                    path: 'auth/login',
                    method: RequestMethod.POST,
                },
                {
                    path: 'auth/register',
                    method: RequestMethod.POST,
                },
            )
            .forRoutes('*');
    }
}
