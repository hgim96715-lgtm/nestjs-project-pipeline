import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Socket } from 'socket.io';

@WebSocketGateway()
export class ChatGateway {
    constructor(private readonly chatService: ChatService) {}

    @SubscribeMessage('message')
    async handleMessage(@MessageBody() data: { message: string }, @ConnectedSocket() client: Socket) {
        console.log('received message', data);
    }

    @SubscribeMessage('sendMessage')
    async sendMessage(@MessageBody() data: { message: string }, @ConnectedSocket() client: Socket) {
        console.log('received sendMessage', data);

        client.emit('sendMessage', {
            ...data,
            from: 'server',
        });
    }
}
