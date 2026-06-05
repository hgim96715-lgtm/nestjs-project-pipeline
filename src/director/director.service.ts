import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { PrismaService } from 'src/common/prisma.service';

@Injectable()
export class DirectorService {
    constructor(private readonly prisma: PrismaService) {}

    async create(createDirectorDto: CreateDirectorDto) {
        const duplicateDirector = await this.prisma.director.findUnique({
            where: {
                name_dob: {
                    name: createDirectorDto.name,
                    dob: createDirectorDto.dob,
                },
            },
        });

        if (duplicateDirector) {
            throw new ConflictException(`동일한 이름과 생년월일을 가진 감독이 존재합니다.
         id:${duplicateDirector.id}번을 확인해주세요`);
        }
        return await this.prisma.director.create({
            data: createDirectorDto,
        });
    }

    findAll() {
        return this.prisma.director.findMany();
    }

    findOne(id: number) {
        return this.prisma.director.findUnique({ where: { id } });
    }

    // 동명이인이 있을수 있어서 name을 unique하게 안했는데 만약 dob까지 같다면 같은 사람이 아닐까?
    async update(id: number, updateDirectorDto: UpdateDirectorDto) {
        const director = await this.prisma.director.findUnique({ where: { id } });

        if (!director) {
            throw new NotFoundException('해당 id의 감독은 존재하지 않습니다.');
        }
        const nextName = updateDirectorDto.name ?? director.name;
        const nextDob = updateDirectorDto.dob ?? director.dob;

        const duplicateDirector = await this.prisma.director.findUnique({
            where: {
                name_dob: {
                    name: nextName,
                    dob: nextDob,
                },
            },
        });

        if (duplicateDirector && duplicateDirector.id !== id) {
            throw new ConflictException(
                `동일한 이름과 생년월일을 가진 감독이 이미 존재합니다. id: ${duplicateDirector.id}번을 확인해주세요.`,
            );
        }

        await this.prisma.director.update({
            where: { id },
            data: updateDirectorDto,
        });

        const newDirector = await this.prisma.director.findUnique({ where: { id } });

        return newDirector;
    }

    async remove(id: number) {
        const director = await this.prisma.director.findUnique({ where: { id } });

        if (!director) {
            throw new NotFoundException('존재하지 않는 ID 감독입니다.');
        }
        await this.prisma.director.delete({ where: { id } });
        return `${id}번 감독이 삭제되었습니다.`;
    }
}
