import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys, parseRedisConnection } from './common/const/env.const';
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
    const port = Number(process.env.PORT) || 3001;
    console.log(`Starting application on 0.0.0.0:${port} (ENV=${process.env.ENV ?? 'unknown'})`);

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
    const redis = parseRedisConnection(
        configService.getOrThrow<string>(envVariableKeys.redisHost),
        configService.getOrThrow<number>(envVariableKeys.redisPort),
        configService.get<string>(envVariableKeys.redisTls),
    );
    console.log(`Connecting to Redis at ${redis.url}`);
    const redisClient = createClient({ url: redis.url });
    try {
        await redisClient.connect();
        console.log(`Redis connected (${redis.url})`);
    } catch (err) {
        console.error(`Redis connection failed (${redis.url}):`, err);
        throw err;
    }
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
    await app.listen(port, '0.0.0.0');
    console.log(`Application is listening on 0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
    console.error('Application bootstrap failed:', err);
    process.exit(1);
});
