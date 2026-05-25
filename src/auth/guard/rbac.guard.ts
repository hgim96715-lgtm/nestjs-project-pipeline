import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "src/user/entity/user.entity";
import { RBAC } from "../decorator/rbac.decorator";

@Injectable()

export class RBACGuard implements CanActivate{
    constructor(private readonly reflector:Reflector){}

    canActivate(context: ExecutionContext): boolean {
        const role= this.reflector.get<Role>(RBAC,context.getHandler());

        if(role === undefined){
            return true;
        }

        // console.log(Object.values(Role))

        if(!Object.values(Role).includes(role)){
            return true;
        }

        const request=context.switchToHttp().getRequest();
        const user=request.user;

        if(!user){
            return false;
        }

        // console.log('현재 사용자 role:', user.role);
        // console.log('필요 role:', role);
        // console.log('role 계산:', user.role, '<=', role);
        return user.role<=role;
    }
}