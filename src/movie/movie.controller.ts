import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Request,
    Delete,
    UsePipes,
    ParseIntPipe,
    Query,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CacheInterceptor } from 'src/common/interceptor/ex.cache.interceptor';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MovieFilePipe } from './pipe/movie-file.pipe';
import { MovieFilesPipe } from './pipe/movie-files.pipe';

@Controller('movie')
export class MovieController {
    constructor(private readonly movieService: MovieService) {}

    @Public()
    @Get()
    findAll(@Query() dto: GetMoviesDto) {
        return this.movieService.findAll(dto);
    }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.movieService.findOne(id);
    }

    @RBAC(Role.admin)
    @Post()
    @UseInterceptors(TransactionInterceptor)
    @UseInterceptors(
        FilesInterceptor('movies', 3, {
            limits: {
                fileSize: 800 * 1000000,
            },
            fileFilter(req, file, callback) {
                if (file.mimetype !== 'video/mp4') {
                    return callback(new BadRequestException('MP4 타입만 업로드 가능합니다.'), false);
                }
                console.log(file);
                console.log('mimetype:', file.mimetype);
                return callback(null, true);
            },
        }),
    )
    create(
        @Body() createMovieDto: CreateMovieDto,
        @Request() req,
        @UploadedFiles(
            new MovieFilesPipe({
                maxSize: 300,
                mimetype: 'video/mp4',
                maxCount: 3,
            }),
        )
        movies: Express.Multer.File[],
    ) {
        console.log('=======파일==========');
        console.log(movies);
        // console.log('Controller DTO:', createMovieDto);
        return this.movieService.create(createMovieDto, req.queryRunner);
    }

    @RBAC(Role.paidUser)
    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateMovieDto: UpdateMovieDto) {
        return this.movieService.update(id, updateMovieDto);
    }

    @RBAC(Role.admin)
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.movieService.remove(id);
    }
}
