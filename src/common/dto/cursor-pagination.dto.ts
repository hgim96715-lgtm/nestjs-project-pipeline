import { IsArray, IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class cursorPaginationDto{
    @IsOptional()
    @IsString()
    cursor?:string;

    @IsOptional()
    @IsArray()
    @IsString({each:true})
    order:string[]=['id_DESC'];

    @IsOptional() 
    @IsInt()
    take:number=5;
}