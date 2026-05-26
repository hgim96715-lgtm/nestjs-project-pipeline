import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { Repository,DataSource, In, Not, Like } from 'typeorm';
import { MovieDetail } from './entity/movie-detail.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { Director } from 'src/director/entity/director.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CommonService } from 'src/common/common.service';
import { QueryRunner } from 'typeorm/browser';

@Injectable()
export class MovieService {
  constructor(@InjectRepository(Movie) private readonly movieRepository:Repository<Movie>,
@InjectRepository(MovieDetail) private readonly movieDetailRepository:Repository<MovieDetail>,
@InjectRepository(Genre) private readonly genreRepository:Repository<Genre>,
@InjectRepository(Director) private readonly directorRepository:Repository<Director>,
private readonly dataSource:DataSource,
private readonly commonService:CommonService){}

  async findAll(dto:GetMoviesDto) {
    // const { title,page,take } = dto

    const {title}=dto;

    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.director', 'director')
      .leftJoinAndSelect('movie.genres', 'genres');

    if (title) {
      qb.where('movie.title LIKE :title', { title: `%${title}%` });
    }

    // this.commonService.applyPagePaginationParamsToQb(qb,dto)
    const{nextCursor}=await this.commonService.applyCursorPaginationParamsToQb(qb,dto)

    const [data,count]=await qb.getManyAndCount();

    return{
      data,
      count,
      nextCursor,
    }
  }

  async findOne(id: number) {
   const movie=await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.director','director')
      .leftJoinAndSelect('movie.genres','genres')
      .leftJoinAndSelect('movie.detail','detail')
      .where('movie.id=:id',{id})
      .getOne();
   return movie;
  }
  
  async create(createMovieDto:CreateMovieDto,qr:QueryRunner){

      const director=await qr.manager.findOne(Director,{where:{id:createMovieDto.directorId}});
      if (!director){
        throw new NotFoundException('존재하지 않는 감독의 ID입니다.')
      }
      const genres=await qr.manager.find(Genre,{where:{id:In(createMovieDto.genreIds)}})

      
      if(genres.length!== createMovieDto.genreIds.length ){
        throw new NotFoundException(`존재하지 않는 장르가 있습니다.존재하는 장르는 ${genres.map((genre)=>genre.id).join(',')}`)
      }

      const movieDetail=await qr.manager.createQueryBuilder()
        .insert()
        .into(MovieDetail)
        .values({detail:createMovieDto.detail})
        .execute();

      const movieDetailId=movieDetail.identifiers[0].id;
      
      const movie= await qr.manager.createQueryBuilder()
        .insert()
        .into(Movie)
        .values({title:createMovieDto.title,detail:{id:movieDetailId},director,genres})
        .execute();
      
      const movieId= movie.identifiers[0].id;

      await qr.manager.createQueryBuilder()
        .relation(Movie,'genres')
        .of(movieId)
        .add(genres.map((genre)=>genre.id))

      return await qr.manager.findOne(Movie,{
        where:{id:movieId},relations:{detail:true,director:true,genres:true}
      })
    
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    const qr=this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try{
      const movie=await qr.manager.findOne(Movie,{
        where:{id},relations:{detail:true,genres:true}
      });

      if(!movie){
        throw new NotFoundException(`id가 ${id}인 영화는 존재하지 않습니다. `)
      }
      // MovieDetail, Director, Genre 관계 필드는 따로 처리
      // Movie 테이블에 직접 수정할 일반 필드만 분리
      const {detail,directorId,genreIds,...movieRest}=updateMovieDto;

      let newDirector;

      if(directorId){
        const director=await qr.manager.findOne(Director,{where:{id:directorId}});
        newDirector=director
      }

      let newGeres;
      if(genreIds){
        const genres=await qr.manager.find(Genre,{
          where:{id:In(genreIds)}
        });
        if(genres.length !== updateMovieDto.genreIds?.length){
          throw new NotFoundException(`존재하지 않는 장르가 있습니다.
            존재하는 ids ->${genres.map((genre)=>genre.id).join(',')}`)
        }
        newGeres=genres;

      }

      // 전달된 Movie 필드와, 변경할 감독이 있을 경우에만 director를 수정 객체에 포함
      const movieUpdateFields={
        ...movieRest,
        ...(newDirector&&{director:newDirector}),
      }

      await qr.manager.createQueryBuilder()
        .update(Movie)
        .set(movieUpdateFields)
        .where('id=:id',{id})
        .execute()

      if(detail){
        await qr.manager.createQueryBuilder()
        .update(MovieDetail)
        .set({detail})
        .where('id=:id',{id:movie.detail.id})
        .execute();
      }

      if(newGeres){
        await qr.manager.createQueryBuilder()
        .relation(Movie,'genres')
        .of(id)
        .addAndRemove(newGeres.map((genre)=>genre.id),movie.genres.map((genre)=>genre.id))
      }
      await qr.commitTransaction();
      return this.movieRepository.findOne({
        where:{id},relations:{detail:true,director:true,genres:true}
      })
        
    }catch(e){
      await qr.rollbackTransaction();
      throw e;
    }
    finally{
      await qr.release();
    }
  }

  async remove(id: number) {
    const movie=await this.movieRepository.findOne({where:{id}});
    
    if(!movie){
      throw new NotFoundException(`${id}의 영화는 존재하지 않습니다.`)
    }
    await this.movieRepository.createQueryBuilder()
    .delete()
    .where('id=:id',{id})
    .execute()

    await this.movieDetailRepository.delete(movie.detail.id)

    return `${id}의 영화가 삭제되었습니다.`
  }
}
