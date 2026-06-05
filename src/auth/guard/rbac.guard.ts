import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/user/entity/user.entity';
import { RBAC } from '../decorator/rbac.decorator';

@Injectable()
export class RBACGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const role = this.reflector.get<Role>(RBAC, context.getHandler());

        if (role === undefined) {
            return true;
        }

        // console.log(Object.values(Role))

        if (!Object.values(Role).includes(role)) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            return false;
        }

        // role은 enum 문자열이므로 권한 우선순위로 비교합니다.
        const priority: Record<Role, number> = {
            [Role.admin]: 0,
            [Role.paidUser]: 1,
            [Role.user]: 2,
        };

        return priority[user.role] <= priority[role];
    }
}
