import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { mkdir } from 'fs/promises';

@Processor('thumbnail-generation')
export class ThumbnailGenerationProcessor extends WorkerHost {
    async process(job: Job): Promise<string[]> {
        const { videoId, videoPath } = job.data as {
            videoId: string[];
            videoPath: string[];
        };

        const outputDirectory = join(process.cwd(), 'public', 'thumbnail');
        await mkdir(outputDirectory, { recursive: true });

        const createThumbnail = (id: string, path: string): Promise<string> => {
            const outputName = `${id}.png`;
            const outputPath = join(outputDirectory, outputName);

            console.log(`영상 thumbnail 생성 시작: ${id}`);

            return new Promise((resolve, reject) => {
                ffmpeg(path)
                    .screenshots({
                        count: 1,
                        filename: outputName,
                        folder: outputDirectory,
                        size: '320x240',
                    })
                    .on('end', () => {
                        console.log(`영상 thumbnail 생성 완료: ${id}`);
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        console.error(`영상 thumbnail 생성 실패: ${id}`, err);
                        reject(err);
                    });
            });
        };

        const thumbnails = await Promise.all(videoPath.map((path, i) => createThumbnail(videoId[i], path)));

        return thumbnails;
    }
}
