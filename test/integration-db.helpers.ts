import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { PrismaModule } from '../src/common/prisma.module';
import { PrismaService } from '../src/common/prisma.service';

const INTEGRATION_TRUNCATE_SQL = `
    TRUNCATE TABLE
        chat,
        chat_room_users_user,
        chat_room_user_user,
        chat_room,
        movie_user_like,
        movie_file,
        movie_genres_genre,
        movie,
        movie_detail,
        genre,
        director,
        "user"
    RESTART IDENTITY CASCADE
`;

export function integrationTestImports() {
    return [
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            validationSchema: Joi.object({
                ENV: Joi.string().valid('dev', 'prod').required(),
                DB_TYPE: Joi.string().valid('postgres').required(),
                DB_HOST: Joi.string().required(),
                DB_PORT: Joi.number().required(),
                DB_USERNAME: Joi.string().required(),
                DB_PASSWORD: Joi.string().required(),
                DB_DATABASE: Joi.string().required(),
                DATABASE_URL: Joi.string().required(),
                SALT_ROUNDS: Joi.number().required(),
                ACCESS_TOKEN_SECRET: Joi.string().required(),
                REFRESH_TOKEN_SECRET: Joi.string().required(),
            }),
        }),
        PrismaModule,
    ];
}

export async function resetIntegrationTestData(prisma: PrismaService) {
    await prisma.$executeRawUnsafe(INTEGRATION_TRUNCATE_SQL);
}
