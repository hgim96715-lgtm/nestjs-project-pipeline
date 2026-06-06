import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterModule } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';
import { TasksService } from './tasks.service';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { parseRedisConnection } from './const/env.const';
import { PrismaModule } from './prisma.module';

@Module({
    imports: [
        MulterModule.register({
            storage: movieUploadStorage,
        }),
        PrismaModule,

        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const redis = parseRedisConnection(
                    config.getOrThrow('REDIS_HOST'),
                    config.getOrThrow('REDIS_PORT'),
                    config.get('REDIS_TLS'),
                );
                return {
                    connection: {
                        host: redis.host,
                        port: redis.port,
                        ...(redis.tls ? { tls: {} } : {}),
                    },
                };
            },
        }),
        BullModule.registerQueue({
            name: 'thumbnail-generation',
        }),
    ],
    providers: [CommonService, TasksService],
    exports: [CommonService],
    controllers: [CommonController],
})
export class CommonModule {}
