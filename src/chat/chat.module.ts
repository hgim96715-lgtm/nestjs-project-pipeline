import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entity/chat.entity';
import { ChatRoom } from './entity/chat-room.entity';
import { User } from 'src/user/entity/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Chat, ChatRoom, User])],
    providers: [ChatGateway, ChatService],
    exports: [ChatService],
})
export class ChatModule {}
