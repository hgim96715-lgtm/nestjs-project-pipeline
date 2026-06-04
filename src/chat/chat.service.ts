import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { ChatRoom } from './entity/chat-room.entity';
import { QueryRunner, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Role, User } from 'src/user/entity/user.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { WsException } from '@nestjs/websockets';
import { Chat } from './entity/chat.entity';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ChatService {
    private readonly connectedClients: Map<number, Socket> = new Map();

    constructor(
        @InjectRepository(ChatRoom) private readonly chatRoomRepository: Repository<ChatRoom>,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
    ) {}

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
        const chatRooms = await this.chatRoomRepository
            .createQueryBuilder('chatRoom')
            .innerJoin('chatRoom.users', 'user', 'user.id=:userId', { userId: user.sub })
            .getMany();

        chatRooms.forEach((room) => {
            client.join(this.getRoomName(room.id));
        });
    }

    async createMessage(payload: { sub: number }, { message, room }: CreateChatDto, qr: QueryRunner) {
        const user = await this.userRepository.findOne({ where: { id: payload.sub } });
        if (!user) {
            throw new WsException('존재하지 않는 사용자입니다.');
        }
        const chatRoom = await this.getOrCreateChatRoom(user, qr, room);
        if (!chatRoom) {
            throw new WsException('채팅방을 찾을 수 없습니다.');
        }

        const msgModel = await qr.manager.save(Chat, {
            author: user,
            message,
            chatRoom,
        });

        const roomName = this.getRoomName(chatRoom.id);
        const chatMessage = plainToInstance(Chat, msgModel);
        const client = this.connectedClients.get(user.id);

        if (client) {
            client.join(roomName);
            client.to(roomName).emit('newMessage', chatMessage);
            client.emit('newMessage', chatMessage);
        }
    }

    async getOrCreateChatRoom(user: User, qr: QueryRunner, room?: number) {
        if (user.role === Role.admin) {
            if (!room) {
                throw new WsException('admin은 room값이 필수입니다.');
            }
            const chatRoom = await qr.manager.findOne(ChatRoom, {
                where: { id: room },
                relations: { users: true },
            });
            if (!chatRoom) {
                throw new WsException(`id ${room} 채팅방이 존재하지 않습니다.`);
            }
            return chatRoom;
        }
        let chatRoom = await qr.manager
            .createQueryBuilder(ChatRoom, 'chatRoom')
            .innerJoin('chatRoom.users', 'user')
            .where('user.id=:userId', { userId: user.id })
            .getOne();

        if (!chatRoom) {
            const adminUser = await qr.manager.findOne(User, { where: { role: Role.admin } });
            if (!adminUser) {
                throw new WsException('관리자 계정이 없어 채팅방을 생성할 수 없습니다.');
            }
            chatRoom = await qr.manager.save(ChatRoom, { users: [user, adminUser] });
            const chatRoomId = chatRoom.id;

            const roomName = this.getRoomName(chatRoomId);
            [user.id, adminUser.id].forEach((userId) => {
                const connectedClient = this.connectedClients.get(userId);
                if (connectedClient) {
                    connectedClient.join(roomName);
                    connectedClient.emit('roomCreated', chatRoomId);
                }
            });
        }
        return chatRoom;
    }
}
