import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CreateChatDto } from './dto/create-chat.dto';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from 'src/common/prisma.service';
import { Prisma, Role, chat_room, user } from '../../generated/prisma/prisma/client';

type PrismaClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ChatService {
    private readonly connectedClients: Map<number, Socket> = new Map();

    constructor(private readonly prisma: PrismaService) {}

    private getRoomName(roomId: number) {
        return `chatRoom/${roomId}`;
    }

    registerClient(userId: number, client: Socket) {
        this.connectedClients.set(userId, client);
    }

    removeClient(userId: number) {
        this.connectedClients.delete(userId);
    }

    async joinUserRoom(user: { sub: number }, client: Socket) {
        const chatRooms = await this.prisma.chat_room.findMany({
            where: {
                chat_room_users_user: {
                    some: {
                        userId: user.sub,
                    },
                },
            },
        });
        chatRooms.forEach((room) => {
            client.join(this.getRoomName(room.id));
        });
    }

    async createMessage(payload: { sub: number }, { message, room }: CreateChatDto) {
        const { user, chatRoom, msgModel, roomCreated, participantIds } = await this.prisma.$transaction(async (tx) => {
            const foundUser = await tx.user.findUnique({ where: { id: payload.sub } });
            if (!foundUser) {
                throw new WsException('존재하지 않는 사용자입니다.');
            }

            const { chatRoom, created, participantIds } = await this.getOrCreateChatRoom(tx, foundUser, room);

            const msgModel = await tx.chat.create({
                data: {
                    authorId: foundUser.id,
                    message,
                    chatRoomId: chatRoom.id,
                },
            });

            return { user: foundUser, chatRoom, msgModel, roomCreated: created, participantIds };
        });

        if (roomCreated && participantIds) {
            const roomName = this.getRoomName(chatRoom.id);
            participantIds.forEach((userId) => {
                const connectedClient = this.connectedClients.get(userId);
                if (connectedClient) {
                    connectedClient.join(roomName);
                    connectedClient.emit('roomCreated', chatRoom.id);
                }
            });
        }

        const roomName = this.getRoomName(chatRoom.id);
        const client = this.connectedClients.get(user.id);

        if (client) {
            client.join(roomName);
            client.to(roomName).emit('newMessage', msgModel);
            client.emit('newMessage', msgModel);
        }
    }

    private async getOrCreateChatRoom(
        prisma: PrismaClient,
        user: user,
        room?: number,
    ): Promise<{ chatRoom: chat_room; created: boolean; participantIds?: number[] }> {
        if (user.role === Role.admin) {
            if (!room) {
                throw new WsException('admin은 room값이 필수입니다.');
            }
            const chatRoom = await prisma.chat_room.findUnique({
                where: { id: room },
            });
            if (!chatRoom) {
                throw new WsException(`id ${room} 채팅방이 존재하지 않습니다.`);
            }
            return { chatRoom, created: false };
        }

        const existingRoom = await prisma.chat_room.findFirst({
            where: {
                chat_room_users_user: {
                    some: { userId: user.id },
                },
            },
        });

        if (existingRoom) {
            return { chatRoom: existingRoom, created: false };
        }

        const adminUser = await prisma.user.findFirst({ where: { role: Role.admin } });
        if (!adminUser) {
            throw new WsException('관리자 계정이 없어 채팅방을 생성할 수 없습니다.');
        }

        const chatRoom = await prisma.chat_room.create({
            data: {
                chat_room_users_user: {
                    create: [{ userId: user.id }, { userId: adminUser.id }],
                },
            },
        });

        return { chatRoom, created: true, participantIds: [user.id, adminUser.id] };
    }
}
