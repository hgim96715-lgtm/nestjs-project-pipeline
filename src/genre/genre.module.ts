import { Module } from '@nestjs/common';
import { GenreService } from './genre.service';
import { GenreController } from './genre.controller';
import { Genre } from './entity/genre.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrismaModule } from 'src/common/prisma.module';

@Module({
    imports: [TypeOrmModule.forFeature([Genre]), PrismaModule],
    controllers: [GenreController],
    providers: [GenreService],
})
export class GenreModule {}
