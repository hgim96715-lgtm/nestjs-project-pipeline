import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterModule } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';
import { TasksService } from './tasks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/movie/entity/movie.entity';
import { DefaultLogger } from './logger/default.logger';

@Module({
    imports: [
        MulterModule.register({
            storage: movieUploadStorage,
        }),
        TypeOrmModule.forFeature([Movie]),
    ],
    providers: [CommonService, TasksService, DefaultLogger],
    exports: [CommonService, DefaultLogger],
    controllers: [CommonController],
})
export class CommonModule {}
