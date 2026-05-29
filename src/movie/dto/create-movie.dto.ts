import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMovieDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: '영화 제목' })
    title: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: '영화 상세정보' })
    detail: string;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({ description: '감독 ID', example: 1 })
    directorId: number;

    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    @ApiProperty({ description: '장르 ID 배열', example: [1, 2, 3] })
    genreIds: number[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => (value === undefined ? [] : Array.isArray(value) ? value : [value]))
    @ApiProperty({
        description: '영화 파일 정보 배열',
        example: ['5b634a68-0028-4c44-8639-8acc2bc56a67_1780051943474.mp4'],
    })
    files?: string[];
}
