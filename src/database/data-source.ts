import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

const dbHost = process.env.DB_HOST ?? '';
const isLocalDb = ['localhost', '127.0.0.1', 'postgres'].includes(dbHost);

export default new DataSource({
    type: process.env.DB_TYPE as 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    logging: false,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
    ...(!isLocalDb
        ? {
              ssl: {
                  rejectUnauthorized: false,
              },
          }
        : {}),
});
