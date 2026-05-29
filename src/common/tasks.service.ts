import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { readdir, unlink } from 'fs/promises';
import { join, parse } from 'path';
import { Movie } from 'src/movie/entity/movie.entity';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_NEST_PROVIDER, WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Movie) private readonly movieRepository: Repository<Movie>,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    ) {}

    private readonly tempFolderPath = join(process.cwd(), 'public', 'temp');

    @Cron('0 0 * * * *')
    async deleteExpiredTempFiles() {
        try {
            const tempFiles = await readdir(this.tempFolderPath);

            const deleteFilesTargets = tempFiles.filter((file) => {
                const filename = parse(file).name;
                const [_, timestamp] = filename.split('_');

                const createdAt = Number(timestamp);
                const aDayInMilSec = 24 * 60 * 60 * 1000;
                const now = Date.now();
                const duration = aDayInMilSec - (Date.now() - createdAt);
                return now - createdAt > aDayInMilSec;
            });
            if (deleteFilesTargets.length == 0) {
                this.logger.debug?.(
                    {
                        message: '삭제할 만료 temp 파일이 없습니다.',
                        scannedFiles: tempFiles.length,
                    },
                    TasksService.name,
                );
                return;
            }
            await Promise.all(deleteFilesTargets.map((file) => unlink(join(this.tempFolderPath, file))));

            this.logger.log(
                {
                    message: '만료된 temp 파일 삭제를 완료했습니다.',
                    scannedFiles: tempFiles.length,
                    deletedCount: deleteFilesTargets.length,
                    deletedFiles: deleteFilesTargets,
                },
                TasksService.name,
            );
        } catch (error) {
            this.logger.error(
                {
                    message: '만료된 temp 파일 삭제 중 오류가 발생했습니다.',
                    folderPath: this.tempFolderPath,
                    errorMessage: error.message,
                },
                TasksService.name,
            );
        }
    }

    @Cron('0 0 * * * *')
    async calculateMovieLikeCount() {
        console.log('run');
        await this.movieRepository.query(
            `UPDATE movie m SET "likeCount"=(
            SELECT COUNT(*) FROM movie_user_like mul WHERE m.id=mul."movieId" AND mul."isLike"=true)`,
        );
        await this.movieRepository.query(
            `UPDATE movie m SET "dislikeCount"=(
             SELECT COUNT(*) FROM movie_user_like mul WHERE m.id=mul."movieId" AND mul."isLike"=false)`,
        );
    }
}
