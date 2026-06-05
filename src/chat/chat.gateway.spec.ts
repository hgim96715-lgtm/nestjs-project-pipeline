import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/common/prisma.service';

describe('ChatGateway', () => {
    let gateway: ChatGateway;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                ChatService,
                { provide: PrismaService, useValue: {} },
                { provide: AuthService, useValue: {} },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });
});
