import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class DefaultLogger extends ConsoleLogger {
    warn(message: unknown, ...rest: unknown[]): void {
        console.log('---------warn---------');
        super.warn(message, ...rest);
    }

    error(message: unknown, ...rest: unknown[]): void {
        console.log('---------error---------');
        super.error(message, ...rest);
    }
}
