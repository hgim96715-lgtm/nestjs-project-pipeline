import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role, User } from './entity/user.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) {}

    async create(createUserDto: CreateUserDto) {
        const { email, password } = createUserDto;

        const user = await this.userRepository.findOne({ where: { email } });

        if (user) {
            throw new ConflictException('이미 가입한 이메일입니다.');
        }

        const hash = await crypto.hash(password, this.configService.getOrThrow<string>(envVariableKeys.hashRounds));

        // await this.userRepository.save({email,password:hash}) default user
        await this.userRepository.save({ email, password: hash, role: Role.admin });

        return this.userRepository.findOne({ where: { email } });
    }

    findAll() {
        return this.userRepository.find();
    }

    async findOne(id: number) {
        const user = await this.userRepository.findOne({ where: { id } });

        if (!user) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }
        return user;
    }

    async update(id: number, updateUserDto: UpdateUserDto) {
        const user = await this.userRepository.findOne({ where: { id } });

        if (!user) {
            throw new NotFoundException('존재하지 않는 id입니다.');
        }
        await this.userRepository.update({ id }, updateUserDto);

        return this.userRepository.findOne({ where: { id } });
    }

    async remove(id: number) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }
        await this.userRepository.delete(id);
        return `${id}번 사용자가 삭제되었습니다.`;
    }
}
