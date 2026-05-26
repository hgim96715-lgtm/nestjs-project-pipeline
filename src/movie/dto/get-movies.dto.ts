import { IsInt, IsOptional, IsString } from "class-validator";
import { pagePaginationDto } from "src/common/dto/page-pagination.dto";

export class GetMoviesDto extends pagePaginationDto{

    @IsOptional()
    @IsString()
    title?:string;
}