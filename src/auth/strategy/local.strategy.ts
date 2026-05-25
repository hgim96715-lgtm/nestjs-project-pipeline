import { Injectable } from "@nestjs/common";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { AuthService } from "../auth.service";
import { Strategy } from "passport-local";

export class LocalAuthGuard extends AuthGuard('local'){}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy){

    constructor(private readonly authService:AuthService){
        super({usernameField:'email'})
    }

    async validate(username:string,passport:string){
        const user= await this.authService.authenticate(username,passport)
        return user;
    }

}