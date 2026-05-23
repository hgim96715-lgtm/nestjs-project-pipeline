import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entity/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt'
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class AuthService {
    constructor(@InjectRepository(User) private readonly userRepository:Repository<User>,
private readonly configService:ConfigService){}

    parseBasicToken(rawToken:string){
        // Basic dGVzdGRkQGNvZGZhY3RvcnkuYWk6YXNkZnNkZmRmZHNm
        // console.log(rawToken)
        const basicSplit=rawToken.split(' ');
        
        if(basicSplit.length !==2){
            throw new BadRequestException('토큰 포맷이 잘못되었습니다.확인해주세요!')
        }

        const [_,token]=basicSplit;

        const decoded=Buffer.from(token,'base64').toString('utf-8');

        // :로 분리
        const tokenSplit=decoded.split(':');

        if(tokenSplit.length !==2 ){
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요')
        }

        const [email,password]=tokenSplit
        return {email,password}
    }

    async register(rawToken:string){
        const {email,password}= this.parseBasicToken(rawToken);

        const user = await this.userRepository.findOne({where:{email}})

        if(user){
            throw new ConflictException('이미 가입한 이메일입니다.')
        }

        const hash= await bcrypt.hash(password,this.configService.getOrThrow<number>(envVariableKeys.hashRounds));

        await this.userRepository.save({email,password:hash})

        return this.userRepository.findOne({where:{email}})

    }


    
}
