import { createLogger, format, transports } from 'winston';
import { join } from 'path';

export const tasksLogger = createLogger({
    level: 'debug',
    defaultMeta: { context: 'TasksService' },
    format: format.combine(format.timestamp(), format.json()),
    transports: [
        new transports.File({
            dirname: join(process.cwd(), 'logs'),
            filename: 'tasks.log',
        }),
    ],
});
