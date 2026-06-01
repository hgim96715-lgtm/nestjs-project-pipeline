import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { envVariableKeys } from '../src/common/const/env.const';
import { Director } from '../src/director/entity/director.entity';
import { Genre } from '../src/genre/entity/genre.entity';
import { Movie } from '../src/movie/entity/movie.entity';
import { MovieDetail } from '../src/movie/entity/movie-detail.entity';
import { MovieFile } from '../src/movie/entity/movie-file.entity';
import { MovieUserLike } from '../src/movie/entity/movie-user-like.entity';
import { User } from '../src/user/entity/user.entity';
import * as Joi from 'joi';
import { EntitySchema, EntityTarget, MixedList, ObjectLiteral } from 'typeorm';

export const INTEGRATION_ENTITIES = [Movie, MovieDetail, MovieFile, Director, Genre, MovieUserLike, User] as const;

export function integrationTestImports(entities: EntityTarget<ObjectLiteral>[] = [...INTEGRATION_ENTITIES]) {
    return [
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            validationSchema: Joi.object({
                ENV: Joi.string().valid('dev', 'prod').required(),
                DB_TYPE: Joi.string().valid('postgres').required(),
                DB_HOST: Joi.string().required(),
                DB_PORT: Joi.number().required(),
                DB_USER: Joi.string().required(),
                DB_PASSWORD: Joi.string().required(),
                DB_DATABASE: Joi.string().required(),
                SALT_ROUNDS: Joi.number().required(),
                ACCESS_TOKEN_SECRET: Joi.string().required(),
                REFRESH_TOKEN_SECRET: Joi.string().required(),
            }),
        }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
                type: configService.get<string>(envVariableKeys.dbType) as 'postgres',
                host: configService.get<string>(envVariableKeys.dbHost),
                port: configService.get<number>(envVariableKeys.dbPort),
                username: configService.get<string>(envVariableKeys.dbUsername),
                password: configService.get<string>(envVariableKeys.dbPassword),
                database: configService.get<string>(envVariableKeys.dbDatabase),
                entities: entities as MixedList<string | Function | EntitySchema>,
                synchronize: true,
            }),
        }),
    ];
}
