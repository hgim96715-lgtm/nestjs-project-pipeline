import { Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';
import { MovieFilesPipe } from 'src/movie/pipe/movie-files.pipe';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CommonService } from './common.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Controller('common')
@ApiBearerAuth()
export class CommonController {
    constructor(
        private readonly commonService: CommonService,
        @InjectQueue('thumbnail-generation')
        private readonly thumbnailQueue: Queue,
    ) {}
    @Post('video')
    @UseInterceptors(
        FilesInterceptor('movies', 3, {
            storage: movieUploadStorage,
        }),
    )
    async createVideo(
        @UploadedFiles(
            new MovieFilesPipe({
                maxSize: 800,
                mimetype: 'video/mp4',
                maxCount: 3,
            }),
        )
        movies: Express.Multer.File[],
    ) {
        await this.thumbnailQueue.add('thumbnail', {
            videoId: movies.map((movie) => movie.filename),
            videoPath: movies.map((movie) => movie.path),
        });
        return movies.map((movie) => ({
            fileName: movie.filename,
        }));
    }
}
