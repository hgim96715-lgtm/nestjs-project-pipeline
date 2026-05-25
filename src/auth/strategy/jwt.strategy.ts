import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { ExtractJwt,Strategy } from "passport-jwt";
import { envVariableKeys } from "src/common/const/env.const";

export class JwtAuthGuard extends AuthGuard('jwt'){}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(private readonly configService:ConfigService){
        super({jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration:false,
            secretOrKey: configService.getOrThrow<string>(envVariableKeys.accessTokenSecret)
        })
    }
    async validate(payload:any){
        return payload;
    }
}