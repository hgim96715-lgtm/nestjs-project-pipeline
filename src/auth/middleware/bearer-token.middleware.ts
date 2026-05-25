import { BadRequestException, Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { NextFunction, Request, Response } from "express";
import { envVariableKeys } from "src/common/const/env.const";

@Injectable()

export class BearerTokenMiddleware implements NestMiddleware{
    constructor(private readonly jwtService:JwtService,
        private readonly configService:ConfigService
    ){}

    validateBearerToken(rawToken:string){
        const bearerSplit = rawToken.split(' ');
        if (bearerSplit.length !==2){
            throw new BadRequestException('토큰포맷이 잘못되었습니다. 확인해주세요!')
        }

        const[bearer,token]=bearerSplit;

        if(bearer.toLowerCase() !== 'bearer'){
            throw new BadRequestException('토큰포맷이 잘못되었습니다. 확인해주세요!')
        }
        return token;
    }

    async use(req:Request,res:Response,next:NextFunction){
        const authHeader = req.headers['authorization'];

        if(!authHeader){
            next();
            return;
        }

        const token= this.validateBearerToken(authHeader);

        try{
            const decodedPayload = this.jwtService.decode(token);
            // console.log(decodedPayload)
            
            if(decodedPayload.type !== 'refresh' && decodedPayload.type !== 'access'){
                throw new BadRequestException('잘못된 토큰입니다.')
            }

            

            const secretKey=decodedPayload.type === 'refresh'? envVariableKeys.refreshTokenSecret:envVariableKeys.accessTokenSecret
             
            const payload= await this.jwtService.verifyAsync(token,{
                secret: this.configService.getOrThrow<string>(secretKey)
            })

            req.user =payload;
        } catch(e){
            //
        }
        next()
    }
}