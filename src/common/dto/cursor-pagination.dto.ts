import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class cursorPaginationDto {
    @IsOptional()
    @IsString()
    @ApiProperty({
        description: '페이지네이션 cursor',
        example: 'eyJ2YWx1ZXMiOnsiaWQiOjM1fSwib3JkZXIiOlsiaWRfREVTQyJdfQ==',
    })
    cursor?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => (value === undefined ? ['id_DESC'] : Array.isArray(value) ? value : [value]))
    @ApiProperty({
        description: '정렬 순서',
        example: ['id_DESC'],
        type: [String],
    })
    order: string[] = ['id_DESC'];

    @IsOptional()
    @IsInt()
    @ApiProperty({
        description: '한 페이지에 보여줄 아이템 개수',
        example: 5,
    })
    take: number = 5;
}
