import { Module } from '@nestjs/common';
import { DirectorService } from './director.service';
import { DirectorController } from './director.controller';
import { PrismaModule } from 'src/common/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [DirectorController],
    providers: [DirectorService],
})
export class DirectorModule {}
