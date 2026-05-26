import { Controller, Get, Post, Body, Patch, Param, Request,Delete, UsePipes, ParseIntPipe, Query, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';
import { GetMoviesDto } from './dto/get-movies.dto';
import { CacheInterceptor } from 'src/common/interceptor/ex.cache.interceptor';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

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
  @UseInterceptors(TransactionInterceptor)
  @UseInterceptors(FileFieldsInterceptor([{
    name:'movie',
    maxCount:1,
  },{
    name:'poster',
    maxCount:2,
  }],{
    limits:{
      fileSize:200000,
    },
    fileFilter(req,file,callback){
      if(file.mimetype !=='video/mp4'){
        return callback(new BadRequestException('MP4 타입만 업로드 가능합니다.'),false)
      }
      console.log(file)
      return callback(null,false);
    }
  }))
  create(@Body() createMovieDto: CreateMovieDto,
  @Request() req,
  @UploadedFiles() files:{
      movie?:Express.Multer.File[],
      poster?:Express.Multer.File[]
  }) {
    console.log("=======파일==========")
  console.log(files)
    // console.log('Controller DTO:', createMovieDto);
    return this.movieService.create(createMovieDto,req.queryRunner)
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
