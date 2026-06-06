import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/prisma/client';

const dbHost = process.env.DB_HOST ?? '';
const isLocalDb = ['localhost', '127.0.0.1', 'postgres'].includes(dbHost);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
            ...(!isLocalDb
                ? {
                      ssl: {
                          rejectUnauthorized: false,
                      },
                  }
                : {}),
        });

        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
