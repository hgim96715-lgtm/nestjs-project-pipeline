import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';

export const WsQueryRunner = createParamDecorator((data: any, ctx: ExecutionContext) => {
    const client = ctx.switchToWs().getClient();

    if (!client || !client.data || !client.data.queryRunner) {
        throw new InternalServerErrorException('WsQueryRunner 객체를 찾을 수 없습니다.');
    }
    return client.data.queryRunner;
});
