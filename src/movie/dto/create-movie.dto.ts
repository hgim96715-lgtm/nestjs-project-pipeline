import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMovieDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsString()
    detail: string;

    @IsNotEmpty()
    @IsNumber()
    directorId: number;

    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    genreIds: number[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    files?: string[];
}
