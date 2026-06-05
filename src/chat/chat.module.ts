import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/common/prisma.module';

@Module({
    imports: [PrismaModule, AuthModule],
    providers: [ChatGateway, ChatService],
    exports: [ChatService],
})
export class ChatModule {}
