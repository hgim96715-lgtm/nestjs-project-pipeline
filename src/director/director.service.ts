import { Injectable } from '@nestjs/common';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Director } from './entity/director.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DirectorService {
  constructor(@InjectRepository(Director) private readonly directorRepository:Repository<Director>){}

  create(createDirectorDto: CreateDirectorDto) {
    return 'This action adds a new director';
  }

  findAll() {
    return `This action returns all director`;
  }

  findOne(id: number) {
    return `This action returns a #${id} director`;
  }

  update(id: number, updateDirectorDto: UpdateDirectorDto) {
    return `This action updates a #${id} director`;
  }

  remove(id: number) {
    return `This action removes a #${id} director`;
  }
}
