import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { Public } from "../decorator/public.decorator";

@Injectable()
export class AuthGuard implements CanActivate{
    constructor(private readonly reflector:Reflector){}
    canActivate(context: ExecutionContext) {
        const isPublic=this.reflector.get(Public,context.getHandler());

        if(isPublic){
            return true;
        }

        const request= context.switchToHttp().getRequest()

        console.log('user',request.user)

        if(!request.user || request.user.type !== 'access'){
            return false
        }

        return true;
    }
}