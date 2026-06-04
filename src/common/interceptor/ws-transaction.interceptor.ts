import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { catchError, Observable, tap } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class WsTransactionInterceptor implements NestInterceptor {
    constructor(private readonly dataSource: DataSource) {}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {
        const client = context.switchToWs().getClient();

        const qr = this.dataSource.createQueryRunner();

        await qr.connect();
        await qr.startTransaction();

        client.data.queryRunner = qr;

        return next.handle().pipe(
            catchError(async (e) => {
                await qr.rollbackTransaction();
                await qr.release();

                const uploadedPaths = client.data.uploadedMoviePaths as string[] | undefined;
                if (uploadedPaths?.length) {
                    await Promise.all(uploadedPaths.map((path) => unlink(path).catch(() => undefined)));
                }

                throw e;
            }),
            tap(async () => {
                await qr.commitTransaction();
                await qr.release();
            }),
        );
    }
}
