import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

@Processor('thumbnail-generation')
export class ThumbnailGenerationProcessor extends WorkerHost {
    async process(job: Job, token?: string): Promise<any> {
        const { videoId, videoPath } = job.data;

        console.log(videoId, videoPath);
        return 0;
    }
}
