import { Module } from '@nestjs/common';
import { MovieService } from './movie.service';
import { MovieController } from './movie.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { MovieDetail } from './entity/movie-detail.entity';
import { MovieFile } from './entity/movie-file.entity';
import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
    imports: [TypeOrmModule.forFeature([Movie, MovieDetail, MovieFile, Director, Genre]), CommonModule],
    controllers: [MovieController],
    providers: [MovieService],
})
export class MovieModule {}
