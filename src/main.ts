import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './common/const/env.const';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as ffprobeStatic from 'ffprobe-static';

import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });
    const config = new DocumentBuilder()
        .setTitle('NestJS API')
        .setDescription('NestJS API Description')
        .setVersion('1.0')
        .addBasicAuth()
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    const configService = app.get(ConfigService);
    const redisClient = createClient({
        socket: {
            host: configService.getOrThrow<string>(envVariableKeys.redisHost),
            port: configService.getOrThrow<number>(envVariableKeys.redisPort),
        },
    });
    await redisClient.connect();
    app.use(
        session({
            store: new RedisStore({ client: redisClient }),
            secret: configService.getOrThrow<string>(envVariableKeys.sessionSecret),
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: configService.getOrThrow<string>(envVariableKeys.env) === 'prod',
                maxAge: 1000 * 60 * 60 * 24 * 30,
                sameSite: 'strict',
            },
        }),
    );
    await app.listen(process.env.PORT || 3001);
}
bootstrap();
