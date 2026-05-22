import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Director } from './entity/director.entity';
import { Not, Repository } from 'typeorm';
import { NotFoundError } from 'rxjs';

@Injectable()
export class DirectorService {
  constructor(@InjectRepository(Director) private readonly directorRepository:Repository<Director>){}

  async create(createDirectorDto: CreateDirectorDto) {
    const duplicateDirector= await this.directorRepository.findOne({
      where:{
        name:createDirectorDto.name,
        dob:createDirectorDto.dob
      }
    });

    if (duplicateDirector){
      throw new ConflictException(`동일한 이름과 생년월일을 가진 감독이 존재합니다.
         id:${duplicateDirector.id}번을 확인해주세요`)
    }
    const director=this.directorRepository.create(createDirectorDto);
    return await this.directorRepository.save(director);
  }

  findAll() {
    return this.directorRepository.find();
  }

  findOne(id: number) {
    return this.directorRepository.findOne({where:{id}});
  }

  // 동명이인이 있을수 있어서 name을 unique하게 안했는데 만약 dob까지 같다면 같은 사람이 아닐까?
  async update(id: number, updateDirectorDto: UpdateDirectorDto) {
    const director=await this.directorRepository.findOne({where:{id}})

    if(!director){
      throw new NotFoundException('해당 id의 감독은 존재하지 않습니다.');
    }
    const nextName=updateDirectorDto.name ?? director.name;
    const nextDob=updateDirectorDto.dob ?? director.dob;
    // console.log(updateDirectorDto.name )

    // console.log(nextName,nextDob)

    const duplicateDirector= await this.directorRepository.findOne({
      where:{
        name:nextName,
        dob:nextDob,
        id: Not(id)
      }
    });
    // console.log(duplicateDirector)

    if (duplicateDirector) {
      throw new ConflictException(
        `동일한 이름과 생년월일을 가진 감독이 이미 존재합니다. id: ${duplicateDirector.id}번을 확인해주세요.`,
      );
    }

    await this.directorRepository.update(id,updateDirectorDto);

    const newDirector=await this.directorRepository.findOne({where:{id},})

    return newDirector

  }

  async remove(id: number) {
    const director=await this.directorRepository.findOne({where:{id}})

    if(!director){
      throw new NotFoundException('존재하지 않는 ID 감독입니다.')
    }
    await this.directorRepository.delete(id);
    return `${id}번 감독이 삭제되었습니다.`
  }
}
