import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { DirectorService } from './director.service';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';

@Controller('director')
export class DirectorController {
  constructor(private readonly directorService: DirectorService) {}

  @RBAC(Role.admin)
  @Post()
  create(@Body() createDirectorDto: CreateDirectorDto) {
    return this.directorService.create(createDirectorDto);
  }

  @Get()
  findAll() {
    return this.directorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id',ParseIntPipe) id: number) {
    return this.directorService.findOne(id);
  }

  @RBAC(Role.paidUser)
  @Patch(':id')
  update(@Param('id',ParseIntPipe) id: number, @Body() updateDirectorDto: UpdateDirectorDto) {
    return this.directorService.update(id, updateDirectorDto);
  }

  @RBAC(Role.admin)
  @Delete(':id')
  remove(@Param('id',ParseIntPipe) id: number) {
    return this.directorService.remove(id);
  }
}
