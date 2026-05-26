import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseIntPipe, Query } from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';
import { GetMoviesDto } from './dto/get-movies.dto';

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Public()
  @Get()
  findAll(@Query()dto:GetMoviesDto) {
    return this.movieService.findAll(dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id',ParseIntPipe) id: number) {
    return this.movieService.findOne(id);
  }

  @RBAC(Role.admin)
  @Post()
  create(@Body() createMovieDto: CreateMovieDto) {
    // console.log('Controller DTO:', createMovieDto);
    return this.movieService.create(createMovieDto)
  }


  @RBAC(Role.paidUser)
  @Patch(':id')
  update(@Param('id',ParseIntPipe) id: number, @Body() updateMovieDto: UpdateMovieDto) {
    return this.movieService.update(id, updateMovieDto);
  }

  @RBAC(Role.admin)
  @Delete(':id')
  remove(@Param('id',ParseIntPipe) id: number) {
    return this.movieService.remove(id);
  }
}
