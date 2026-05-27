import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterModule } from '@nestjs/platform-express';
import { movieUploadStorage } from './config/movie-upload.storage';

@Module({
    imports: [
        MulterModule.register({
            storage: movieUploadStorage,
        }),
    ],
    providers: [CommonService],
    exports: [CommonService],
    controllers: [CommonController],
})
export class CommonModule {}
