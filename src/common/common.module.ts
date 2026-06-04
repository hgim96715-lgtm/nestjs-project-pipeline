import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterModule } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';
import { TasksService } from './tasks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/movie/entity/movie.entity';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        MulterModule.register({
            storage: movieUploadStorage,
        }),
        TypeOrmModule.forFeature([Movie]),

        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.getOrThrow('REDIS_HOST'),
                    port: config.getOrThrow('REDIS_PORT'),
                },
            }),
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
