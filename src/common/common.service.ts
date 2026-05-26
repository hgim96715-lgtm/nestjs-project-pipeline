import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { pagePaginationDto } from './dto/page-pagination.dto';

@Injectable()
export class CommonService {
    constructor(){}
    applyPagePaginationParamsToQb<T extends ObjectLiteral>(qb:SelectQueryBuilder<T>,dto:pagePaginationDto){
        const {page,take}= dto;

        const skip=(page-1)*take;
        
            qb.take(take)
            qb.skip(skip)
    }
}
