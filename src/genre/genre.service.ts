import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateGenreDto } from './dto/create-genre.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Genre } from './entity/genre.entity';

@Injectable()
export class GenreService {
  constructor(@InjectRepository(Genre) private readonly genreRepository:Repository<Genre>){}
  async create(createGenreDto: CreateGenreDto) {
    const genre=await this.genreRepository.findOne({
      where:{name:createGenreDto.name}
    })
    if(genre){
      throw new NotFoundException('이미 존재하는 장르입니다.')
    }
    return this.genreRepository.save(createGenreDto);
  }

  findAll() {
    return this.genreRepository.find();
  }

  findOne(id: number) {
    return this.genreRepository.findOne({where:{id}});
  }

  async update(id: number, updateGenreDto: UpdateGenreDto) {
    const genre= await this.genreRepository.findOne({where:{id}});

    if(!genre){
      throw new NotFoundException('존재하지 않는 장르입니다.')
    }
    //이름 중복이 있으면 안되니깐 확인해야하지 않을까?
    if(updateGenreDto.name){
      const dupicateGenre=await this.genreRepository.findOne({
        where:{
          name:updateGenreDto.name,
          id:Not(id)
        }
      });

      if (dupicateGenre){
        throw new ConflictException(`이미 존재하는 장르입니다. id는 ${dupicateGenre.id}`)
      }
    }

    // console.log({...updateGenreDto})
    await this.genreRepository.update({
      id
    },{
      ...updateGenreDto
    })
    return await this.genreRepository.findOne({where:{id}})
  }

  // 영화와 연결된 장르는 삭제하지 않도록 relation을 함께 조회해야한다!
  async remove(id: number) {
    const genre= await this.genreRepository.findOne({
      where:{id},
      relations:{movies:true}
    })
    if (!genre){
      throw new NotFoundException('존재하지 않는 장르입니다.')
    }
    if(genre.movies.length>0){
      throw new ConflictException(`영화에서 사용중인 장르는 삭제 할 수없습니다.
        연결된 영화 ID:${genre.movies.map((movie)=>movie.id).join(',')}`)
    }
    
    await this.genreRepository.delete(id);
    return `${id}가 삭제되었습니다.`;
  }
}
