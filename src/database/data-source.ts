import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

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
});
