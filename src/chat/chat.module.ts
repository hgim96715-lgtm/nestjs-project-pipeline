import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entity/chat.entity';
import { ChatRoom } from './entity/chat-room.entity';
import { User } from 'src/user/entity/user.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Chat, ChatRoom, User]), AuthModule],
    providers: [ChatGateway, ChatService],
    exports: [ChatService],
})
export class ChatModule {}
