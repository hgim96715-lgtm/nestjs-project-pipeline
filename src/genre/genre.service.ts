import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateGenreDto } from './dto/create-genre.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Genre } from './entity/genre.entity';
import { PrismaService } from 'src/common/prisma.service';

@Injectable()
export class GenreService {
    constructor(
        //@InjectRepository(Genre) private readonly genreRepository:Repository<Genre>
        private readonly prisma: PrismaService,
    ) {}
    async create(createGenreDto: CreateGenreDto) {
        const genre = await this.prisma.genre.findUnique({
            where: { name: createGenreDto.name },
        });
        if (genre) {
            throw new NotFoundException('이미 존재하는 장르입니다.');
        }
        return this.prisma.genre.create({
            data: createGenreDto,
        });
    }

    findAll() {
        return this.prisma.genre.findMany();
    }

    findOne(id: number) {
        return this.prisma.genre.findUnique({ where: { id } });
    }

    async update(id: number, updateGenreDto: UpdateGenreDto) {
        const genre = await this.prisma.genre.findUnique({ where: { id } });

        if (!genre) {
            throw new NotFoundException('존재하지 않는 장르입니다.');
        }
        //이름 중복이 있으면 안되니깐 확인해야하지 않을까?
        if (updateGenreDto.name) {
            const dupicateGenre = await this.prisma.genre.findUnique({
                where: {
                    name: updateGenreDto.name,
                    NOT: { id },
                    // id: Not(id),
                },
            });

            if (dupicateGenre) {
                throw new ConflictException(`이미 존재하는 장르입니다. id는 ${dupicateGenre.id}`);
            }
        }

        // console.log({...updateGenreDto})
        await this.prisma.genre.update({
            where: { id },
            data: updateGenreDto,
        });
        return await this.prisma.genre.findUnique({ where: { id } });
    }

    // 영화와 연결된 장르는 삭제하지 않도록 relation을 함께 조회해야한다!
    async remove(id: number) {
        const genre = await this.prisma.genre.findUnique({
            where: { id },
            include: {
                movie_genres_genre: {
                    select: { movieId: true },
                },
            },
        });

        if (genre && genre.movie_genres_genre.length > 0) {
            throw new ConflictException(`영화에서 사용중인 장르는 삭제 할 수없습니다.
        연결된 영화 ID:${genre.movie_genres_genre.map((movie) => movie.movieId).join(',')}`);
        }

        // if (!genre) {
        //     throw new NotFoundException('존재하지 않는 장르입니다.');
        // }
        // if (genre.prisma.movie_genres_genre.length > 0) {
        //     throw new ConflictException(`영화에서 사용중인 장르는 삭제 할 수없습니다.
        // 연결된 영화 ID:${genre.movies.map((movie) => movie.id).join(',')}`);
        // }

        if (!genre) {
            throw new NotFoundException('존재하지 않는 장르입니다.');
        }

        await this.prisma.genre.delete({ where: { id } });
        return `${id}가 삭제되었습니다.`;
    }
}
