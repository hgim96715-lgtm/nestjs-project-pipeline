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
        try {
            const rawToken = client.handshake.headers.authorization as string;
            const payload = await this.authService.parseBearerToken(rawToken, false);
            if (payload) {
                client.data.user = payload;
                this.chatService.registerClient(payload.sub, client);
                await this.chatService.joinUserRoom(payload, client);
            } else {
                client.disconnect();
            }
        } catch {
            client.disconnect();
        }
    }

    @SubscribeMessage('sendMessage')
    async handleEvent(@MessageBody() body: CreateChatDto, @ConnectedSocket() client: Socket) {
        const payload = client.data.user;
        if (!payload) {
            throw new WsException('인증되지 않은 소켓입니다. 연결 시 Bearer access 토큰이 필요합니다.');
        }
        await this.chatService.createMessage(payload, body);
    }
}
