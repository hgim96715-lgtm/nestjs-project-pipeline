import { IsIn, IsInt, IsOptional } from "class-validator";

export class cursorPaginationDto{
    @IsOptional()
    @IsInt()
    id:number;

    @IsOptional()
    @IsIn(['ASC','DESC'])
    order:'ASC'| 'DESC'='DESC';

    @IsOptional()
    @IsInt()
    take:number=5;
}