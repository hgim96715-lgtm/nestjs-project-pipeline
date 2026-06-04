import { Module } from '@nestjs/common';
import { ThumbnailGenerationProcessor } from './thumbnail-generation.worker';
import { BullModule } from '@nestjs/bullmq';

@Module({
    imports: [BullModule.registerQueue({ name: 'thumbnail-generation' })],
    controllers: [],
    providers: [ThumbnailGenerationProcessor],
    exports: [ThumbnailGenerationProcessor],
})
export class WorkerModule {}
