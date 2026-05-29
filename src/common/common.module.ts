import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterModule } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';
import { TasksService } from './tasks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/movie/entity/movie.entity';

@Module({
    imports: [
        MulterModule.register({
            storage: movieUploadStorage,
        }),
        TypeOrmModule.forFeature([Movie]),
    ],
    providers: [CommonService, TasksService],
    exports: [CommonService],
    controllers: [CommonController],
})
export class CommonModule {}
