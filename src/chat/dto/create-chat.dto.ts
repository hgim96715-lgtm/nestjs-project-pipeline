import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateChatDto {
    @IsNotEmpty()
    @IsString()
    message: string;

    @IsNumber()
    @IsOptional()
    room: number;
}
