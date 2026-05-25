import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MovieModule } from './movie/movie.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GenreModule } from './genre/genre.module';
import { DirectorModule } from './director/director.module';

import * as Joi from 'joi';
import { envVariableKeys } from './common/const/env.const';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/guard/auth.guard';
import { BearerTokenMiddleware } from './auth/middleware/bearer-token.middleware';
import { RBACGuard } from './auth/guard/rbac.guard';

@Module({
  imports: [MovieModule,
    ConfigModule.forRoot({
      isGlobal:true,
      validationSchema: Joi.object({
        ENV:Joi.string().valid('dev','prod').required(),
        DB_TYPE:Joi.string().valid('postgres').required(),
        DB_HOST:Joi.string().required(),
        DB_PORT:Joi.number().required(),
        DB_USER:Joi.string().required(),
        DB_PASSWORD:Joi.string().required(),
        DB_DATABASE:Joi.string().required(),
        HASH_ROUNDS:Joi.number().required(),
        ACCESS_TOKEN_SECRET:Joi.string().required(),
        REFRESH_TOKEN_SECRET:Joi.string().required()
      })
    }),
    TypeOrmModule.forRootAsync({
      useFactory:(configService:ConfigService)=>({
       type:configService.get<string>(envVariableKeys.dbType) as "postgres",
       host:configService.get<string>(envVariableKeys.dbHost),
       port:configService.get<number>(envVariableKeys.dbPort),
       username:configService.get<string>(envVariableKeys.dbUsername),
       password:configService.get<string>(envVariableKeys.dbPassword),
       database:configService.get<string>(envVariableKeys.dbDatabase),
       //
       autoLoadEntities:true,
       synchronize:true,
      }),
      inject:[ConfigService],
    }),
    GenreModule,
    DirectorModule,
    AuthModule,
    UserModule
  ],
  controllers: [],
  providers: [{
    provide: APP_GUARD,
    useClass:AuthGuard
  },{
    provide:APP_GUARD,
    useClass:RBACGuard
  }],
})

export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
      consumer.apply(BearerTokenMiddleware)
      .exclude({
        path:'auth/login',
        method:RequestMethod.POST
      },
    {
      path:'auth/register',
      method: RequestMethod.POST
    })
    .forRoutes('*');
    }
  }
