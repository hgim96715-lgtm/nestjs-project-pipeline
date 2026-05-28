import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';

export const QueryRunner = createParamDecorator((data: any, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request || !request.queryRunner) {
        throw new InternalServerErrorException('QueryRunner 객체를 찾을 수 없습니다.');
    }
    // console.log('request.queryRunner', request.queryRunner);
    return request.queryRunner;
});
