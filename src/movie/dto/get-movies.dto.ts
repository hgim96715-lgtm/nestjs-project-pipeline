import { IsInt, IsOptional, IsString } from "class-validator";
import { cursorPaginationDto } from "src/common/dto/cursor-pagination.dto";
import { pagePaginationDto } from "src/common/dto/page-pagination.dto";

export class GetMoviesDto extends cursorPaginationDto{

    @IsOptional()
    @IsString()
    title?:string;
}