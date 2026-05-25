import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role, User } from 'src/user/entity/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt'
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(@InjectRepository(User) private readonly userRepository:Repository<User>,
private readonly configService:ConfigService,
private readonly jwtService:JwtService){}

    parseBasicToken(rawToken:string){
        // Basic {token}
        // console.log(rawToken)
        const basicSplit=rawToken.split(' ');
        
        if(basicSplit.length !==2){
            throw new BadRequestException('토큰 포맷이 잘못되었습니다.확인해주세요!')
        }

        const [basic,token]=basicSplit;

        if(basic.toLowerCase() !== 'basic'){
            throw new BadRequestException('토큰 포맷이 잘못되었습니다.')
        }

        const decoded=Buffer.from(token,'base64').toString('utf-8');

        // :로 분리
        const tokenSplit=decoded.split(':');

        if(tokenSplit.length !==2 ){
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요')
        }

        const [email,password]=tokenSplit
        return {email,password}
    }
    
    async parseBearerToken(rawToken:string,isRefreshToken:boolean){
        // Bearer {token}
        // console.log(rawToken)
        const bearerSplit= rawToken.split(' ');

        if(bearerSplit.length !==2){
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요')
        }

        const [bearer,token]=bearerSplit;

        if(bearer.toLowerCase() !== 'bearer'){
            throw new BadRequestException('토큰포맷이 잘못되었습니다.확인해주세요')
        }

        try{
            const payload = await this.jwtService.verifyAsync(token,{
                secret: this.configService.getOrThrow<string>(isRefreshToken? envVariableKeys.refreshTokenSecret : envVariableKeys.accessTokenSecret)
            })
            // console.log(payload)
            if(isRefreshToken){
                if(payload.type !=='refresh'){
                    throw new BadRequestException('refresh 토큰이 아닙니다.')
                }
            }else{
                if(payload.type !== 'access'){
                    throw new BadRequestException('access 토큰이 아닙니다.')
                }
            }
            return payload;
        }catch(e){
            throw new UnauthorizedException('유효하지 않는 토큰입니다.')
        }

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

    async authenticate(email:string,password:string){
        const user=await this.userRepository.findOne({where:{email}})

        if(!user){
            throw new UnauthorizedException('잘못된 로그인 정보입니다.')
        }

        const isMatch=await bcrypt.compare(password,user.password);

        if(!isMatch){
            throw new UnauthorizedException('잘못된 로그인 정보입니다.')
        }
        return user
    }

    async issueToken(user:{id:number,role:Role},isRfreshToken:boolean){
        const refreshTokenSecret=this.configService.getOrThrow<string>(envVariableKeys.refreshTokenSecret)
        const accessTokenSecret=this.configService.getOrThrow<string>(envVariableKeys.accessTokenSecret)

        return this.jwtService.signAsync({
            sub:user.id,
            role:user.role,
            type:isRfreshToken? 'refresh':'access'
        },{
            secret:isRfreshToken? refreshTokenSecret:accessTokenSecret,
            expiresIn:isRfreshToken? '24h':300
        })

    }

    async login(rawToken:string){
        const {email,password}=this.parseBasicToken(rawToken)

        const user= await this.authenticate(email,password)

        return {
            refreshToken: await this.issueToken(user,true),
            accessToken: await this.issueToken(user,false)
        }
    }


    
}
