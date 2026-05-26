import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Response } from "express";
import { QueryFailedError } from "typeorm";

@Catch(QueryFailedError)
export class QueryFailedException implements ExceptionFilter{
    catch(exception: QueryFailedError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status= 400;

        let message = '데이터베이스 에러가 발생했습니다.';

        if(exception.message.includes('duplicate key')){
            message='중복 키 에러가 났습니다!'
        }

        response.status(status)
        .json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message
        });

    }
}   