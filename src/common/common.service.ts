import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { pagePaginationDto } from './dto/page-pagination.dto';
import { cursorPaginationDto } from './dto/cursor-pagination.dto';

@Injectable()
export class CommonService {
    constructor(){}
    applyPagePaginationParamsToQb<T extends ObjectLiteral>(qb:SelectQueryBuilder<T>,dto:pagePaginationDto){
        const {page,take}= dto;

        const skip=(page-1)*take;
        
        qb.take(take)
        qb.skip(skip)
    }

    applyCursorPaginationParamsToQb<T extends ObjectLiteral>(qb:SelectQueryBuilder<T>,dto:cursorPaginationDto){

        const {id,order}=dto;

        if(id){
            const direction= order==='ASC'? '>':'<';
            qb.where(`${qb.alias}.id ${direction}=:id`,{id})
        }
        qb.orderBy(`${qb.alias}.id`,order)

        qb.take()
    }
}
