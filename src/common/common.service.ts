import { BadRequestException, Injectable } from '@nestjs/common';
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

    async applyCursorPaginationParamsToQb<T extends ObjectLiteral>(qb:SelectQueryBuilder<T>,dto:cursorPaginationDto){

        let {cursor,take,order}=dto;

        if(cursor){

            const decodeCursor=Buffer.from(cursor,'base64').toString('utf-8')

            const cursorObj=JSON.parse(decodeCursor)
            // console.log(`cursorObj:${cursorObj}`)

            // (column1,column2,column3) >(value1,value2,value3)

            order= cursorObj.order;

            const {values} = cursorObj;

            const whereConditions: string[]=[];
            const parameters: Record<string,any>={};

            for (let i=0;i<order.length;i++){
                const [column,direction]=order[i].split('_');

                if(direction !=='ASC' && direction !=='DESC'){
                    throw new BadRequestException(
                        'Order는 ASC 또는 DESC로 입력되어야합니다.',
                    );
                }

                const comparisonOperator=direction==='DESC'?'<':'>';

                const conditions:string[]=[];

                for(let j=0;j<i;j++){
                    const[previousColum]=order[j].split('_');
                    conditions.push(`${qb.alias}.${previousColum}=:${qb.alias}_${previousColum}`)
                    // console.log(conditions)

                    parameters[`${qb.alias}_${previousColum}`]=values[previousColum]
                }

                conditions.push(
                    `${qb.alias}.${column} ${comparisonOperator} :${qb.alias}_${column}`
                )
                parameters[`${qb.alias}_${column}`]=values[column];
                whereConditions.push(`(${conditions.join(' AND ')})`);
            }

            qb.andWhere(`(${whereConditions.join(' OR ')})`, parameters); 
        }

    
        // ["id_DESC",..]
        for(let i=0; i<order.length; i++){
            const [column,direction]=order[i].split('_');
            // console.log(column)

            if(direction !== 'ASC' && direction !== 'DESC'){
                throw new BadRequestException('Order는 ASC 또는 DESC로 입력되어야합니다.')
            }

            if(i===0){
                qb.orderBy(`${qb.alias}.${column}`,direction)
            }else{
                qb.addOrderBy(`${qb.alias}.${column}`,direction)
            }
        }


        qb.take(take)

        const results= await qb.getMany()


        const nextCursor=this.generateNextCursor(results,order)

        return {qb,nextCursor}
    }

    generateNextCursor<T extends ObjectLiteral>(results:T[], order:string[]): string | null{
        if(results.length==0) return null;

        const lastItem=results[results.length-1]

        const values={};

        order.forEach((columOrder)=>{
            const [column]=columOrder.split('_')
            values[column]=lastItem[column];
        });

        const cursorObj={values,order};

        const nextCursor=Buffer.from(JSON.stringify(cursorObj)).toString('base64')

        return nextCursor;

    }
}
