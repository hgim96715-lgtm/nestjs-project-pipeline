import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });
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
    await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
