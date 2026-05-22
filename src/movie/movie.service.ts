import { Injectable } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { Repository } from 'typeorm';
import { MovieDetail } from './entity/movie-detail.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { Director } from 'src/director/entity/director.entity';

@Injectable()
export class MovieService {
  constructor(@InjectRepository(Movie) private readonly movieRepository:Repository<Movie>,
@InjectRepository(MovieDetail) private readonly movieDetailRepository:Repository<MovieDetail>,
@InjectRepository(Genre) private readonly genreRepository:Repository<Genre>,
@InjectRepository(Director) private readonly directorRepository:Repository<Director>){}

  async findAll() {
    const qb= await this.movieRepository
    .createQueryBuilder('moive')
    .leftJoinAndSelect('movie.director','director')

    return `This action returns all movie`;
  }

  findOne(id: number) {
    return `This action returns a #${id} movie`;
  }

  update(id: number, updateMovieDto: UpdateMovieDto) {
    return `This action updates a #${id} movie`;
  }

  remove(id: number) {
    return `This action removes a #${id} movie`;
  }
}
