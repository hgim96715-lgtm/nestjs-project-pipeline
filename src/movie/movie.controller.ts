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
} from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';

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
    create(@Body() createMovieDto: CreateMovieDto, @Request() req) {
        return this.movieService.create(createMovieDto, createMovieDto.files ?? [], req.queryRunner);
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
