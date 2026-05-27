import { Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';
import { MovieFilesPipe } from 'src/movie/pipe/movie-files.pipe';

@Controller('common')
export class CommonController {
    @Post('video')
    @UseInterceptors(
        FilesInterceptor('movies', 3, {
            storage: movieUploadStorage,
        }),
    )
    createVideo(
        @UploadedFiles(
            new MovieFilesPipe({
                maxSize: 800,
                mimetype: 'video/mp4',
                maxCount: 3,
            }),
        )
        movies: Express.Multer.File[],
    ) {
        return movies.map((movie) => ({
            fileName: movie.filename,
        }));
    }
}
