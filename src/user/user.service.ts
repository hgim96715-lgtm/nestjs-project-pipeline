import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/common/prisma.service';
import { Role as PrismaRole } from '../../generated/prisma/prisma/client';

@Injectable()
export class UserService {
    constructor(
        // @InjectRepository(User) private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    async create(createUserDto: CreateUserDto) {
        const { email, password } = createUserDto;

        const user = await this.prisma.user.findUnique({ where: { email } });

        // const user = await this.userRepository.findOne({ where: { email } });

        if (user) {
            throw new ConflictException('이미 가입한 이메일입니다.');
        }

        const hash = await bcrypt.hash(password, this.configService.getOrThrow<string>(envVariableKeys.saltrounds));

        // await this.userRepository.save({email,password:hash}) default user
        await this.prisma.user.create({
            data: {
                email,
                password: hash,
                role: PrismaRole.admin,
            },
        });
        // await this.userRepository.save({ email, password: hash, role: Role.admin });

        return this.prisma.user.findUnique({ where: { email } });
        // return this.userRepository.findOne({ where: { email } });
    }

    findAll() {
        return this.prisma.user.findMany({
            omit: {
                password: true,
            },
        });
        // return this.userRepository.find();
    }

    async findOne(id: number) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        // const user = await this.userRepository.findOne({ where: { id } });

        if (!user) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }
        return user;
    }

    async update(id: number, updateUserDto: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        // const user = await this.userRepository.findOne({ where: { id } });

        if (!user) {
            throw new NotFoundException('존재하지 않는 id입니다.');
        }
        if (user.email !== updateUserDto.email) {
            const emailUser = await this.prisma.user.findUnique({ where: { email: updateUserDto.email } });
            if (emailUser) {
                throw new ConflictException('이미 가입한 이메일입니다.');
            }
        }

        const { password, ...rest } = updateUserDto;
        const updatePayload: UpdateUserDto = { ...rest };

        if (password) {
            updatePayload.password = await bcrypt.hash(
                password,
                this.configService.getOrThrow<string>(envVariableKeys.saltrounds),
            );
        }

        await this.prisma.user.update({ where: { id }, data: updatePayload });
        // await this.userRepository.update({ id }, updatePayload);

        return this.prisma.user.findUnique({ where: { id } });
        // return this.userRepository.findOne({ where: { id } });
    }

    async remove(id: number) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        // const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }
        await this.prisma.user.delete({ where: { id } });
        // await this.userRepository.delete(id);
        return `${id}번 사용자가 삭제되었습니다.`;
    }
}
