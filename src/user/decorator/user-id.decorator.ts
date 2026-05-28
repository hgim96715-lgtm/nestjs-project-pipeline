import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const UserId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request || !request.user || !request.user.sub) {
        throw new UnauthorizedException('사용자 정보를 찾을 수 없습니다.');
    }
    // console.log('user.sub', request.user.sub);
    return request.user.sub;
});
