import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, of, retry, tap } from "rxjs";

@Injectable()
export class CacheInterceptor implements NestInterceptor{
    private cahche=new Map<string,any>();

    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        const request=context.switchToHttp().getRequest();

        const key=`${request.method}-${request.path}`;

        if(this.cahche.has(key)){
            return of(this.cahche.get(key)) 
        }

        return next.handle()
        .pipe(
            tap(response=>this.cahche.set(key,response)),
        )
    }
}