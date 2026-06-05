import { Module } from '@nestjs/common';
import { DirectorService } from './director.service';
import { DirectorController } from './director.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Director } from './entity/director.entity';
import { PrismaModule } from 'src/common/prisma.module';

@Module({
    imports: [TypeOrmModule.forFeature([Director]), PrismaModule],
    controllers: [DirectorController],
    providers: [DirectorService],
})
export class DirectorModule {}
