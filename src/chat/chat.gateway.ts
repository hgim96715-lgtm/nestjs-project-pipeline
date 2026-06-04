import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WsException,
} from '@nestjs/websockets';
import { WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AuthService } from 'src/auth/auth.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { WsTransactionInterceptor } from 'src/common/interceptor/ws-transaction.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { WsQueryRunner } from 'src/common/decorator/ws-query-runner.decorator';
import type { QueryRunner } from 'typeorm';

@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private readonly chatService: ChatService,
        private readonly authService: AuthService,
    ) {}
    handleDisconnect(client: Socket) {
        const user = client.data.user;
        if (user) {
            this.chatService.removeClient(user.sub);
        }
        client.disconnect();
    }
    async handleConnection(client: Socket) {
        console.log('client', client.data); // client {}

        try {
            const rawToken = client.handshake.headers.authorization as string;
            const payload = await this.authService.parseBearerToken(rawToken, false);
            console.log(`${payload.sub} id , ${payload.role} role connected`, payload); // { sub: 1, role: 0, type: 'access', iat: 1780545966, exp: 1784433966 }
            if (payload) {
                client.data.user = payload;
                this.chatService.registerClient(payload.sub, client);
                await this.chatService.joinUserRoom(payload, client);
            } else {
                client.disconnect();
            }
        } catch (error) {
            console.error('chat connection failed', error);
            client.disconnect();
        }
    }
    @SubscribeMessage('sendMessage')
    @UseInterceptors(WsTransactionInterceptor)
    async handleEvent(
        @MessageBody() body: CreateChatDto,
        @ConnectedSocket() client: Socket,
        @WsQueryRunner() qr: QueryRunner,
    ) {
        const payload = client.data.user;
        if (!payload) {
            throw new WsException('인증되지 않은 소켓입니다. 연결 시 Bearer access 토큰이 필요합니다.');
        }
        await this.chatService.createMessage(payload, body, qr);
    }
}
