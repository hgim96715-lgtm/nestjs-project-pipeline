import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Request,
    Delete,
    ParseIntPipe,
    Query,
    UseInterceptors,
    Version,
} from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('movie')
export class MovieController {
    constructor(private readonly movieService: MovieService) {}

    @Public()
    @Get()
    findAll(@Query() dto: GetMoviesDto, @UserId() userId?: number) {
        return this.movieService.findAll(dto, userId);
    }

    @Public()
    // @UseInterceptors(CacheInterceptor)
    @Get('recent')
    async getMoviesRecent() {
        return this.movieService.findMovieRecent();
    }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.movieService.findOne(id);
    }

    @RBAC(Role.admin)
    @Post()
    @UseInterceptors(TransactionInterceptor)
    create(@Body() createMovieDto: CreateMovieDto, @QueryRunner() queryRunner, @UserId() userId: number) {
        return this.movieService.create(createMovieDto, createMovieDto.files ?? [], queryRunner, userId);
    }

    // 좋아요 & 좋아요 취소
    @Post(':id/like')
    createMovieLike(@Param('id', ParseIntPipe) movieId: number, @UserId() userId: number) {
        return this.movieService.toggleMovieLie(movieId, userId, true);
    }

    @Post(':id/unlike')
    createMovieUnlike(@Param('id', ParseIntPipe) movieId: number, @UserId() userId: number) {
        return this.movieService.toggleMovieLie(movieId, userId, false);
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
