import { IsNotEmpty, IsString } from "class-validator";

export class CreateMovieDto {
    @IsNotEmpty()
    @IsString()
    title:string;

    @IsNotEmpty()
    @IsString()
    detail:string;
}

