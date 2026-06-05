import { Module } from '@nestjs/common';
import { MovieService } from './movie.service';
import { MovieController } from './movie.controller';
import { CommonModule } from 'src/common/common.module';
import { PrismaModule } from 'src/common/prisma.module';

@Module({
    imports: [CommonModule, PrismaModule],
    controllers: [MovieController],
    providers: [MovieService],
})
export class MovieModule {}
