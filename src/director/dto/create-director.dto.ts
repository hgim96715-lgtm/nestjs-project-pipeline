import { Type } from "class-transformer";
import { IsDate, IsDateString, IsNotEmpty, IsString } from "class-validator";

export class CreateDirectorDto {
    @IsNotEmpty()
    @IsString()
    name:string;

    @IsNotEmpty()
    @Type(()=>Date)
    @IsDate()
    dob:Date;

    @IsNotEmpty()
    @IsString()
    nationality:string;
}
