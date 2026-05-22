import { Module } from '@nestjs/common';
import { MovieModule } from './movie/movie.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { GenreModule } from './genre/genre.module';
import { DirectorModule } from './director/director.module';

@Module({
  imports: [MovieModule,
    TypeOrmModule.forRootAsync({
      useFactory:(configService:ConfigService)=>({
       autoLoadEntities:true, 
      })
    }),
    GenreModule,
    DirectorModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
