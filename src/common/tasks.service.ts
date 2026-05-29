import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { readdir, unlink } from 'fs/promises';
import { join, parse } from 'path';
import { Movie } from 'src/movie/entity/movie.entity';
import { Repository } from 'typeorm';
import { tasksLogger } from './logger/tasks.logger';

@Injectable()
export class TasksService {
    constructor(@InjectRepository(Movie) private readonly movieRepository: Repository<Movie>) {}

    private readonly tempFolderPath = join(process.cwd(), 'public', 'temp');

    @Cron('0 0 0 * * *')
    async deleteExpiredTempFiles() {
        try {
            const tempFiles = await readdir(this.tempFolderPath);

            const deleteFilesTargets = tempFiles.filter((file) => {
                const filename = parse(file).name;
                const [_, timestamp] = filename.split('_');

                const createdAt = Number(timestamp);
                const aDayInMilSec = 24 * 60 * 60 * 1000;
                return Date.now() - createdAt > aDayInMilSec;
            });

            if (deleteFilesTargets.length === 0) {
                tasksLogger.debug({
                    message: '삭제할 만료 temp 파일이 없습니다.',
                    scannedFiles: tempFiles.length,
                });
                return;
            }

            await Promise.all(deleteFilesTargets.map((file) => unlink(join(this.tempFolderPath, file))));

            tasksLogger.info({
                message: '만료된 temp 파일 삭제를 완료했습니다.',
                scannedFiles: tempFiles.length,
                deletedCount: deleteFilesTargets.length,
                deletedFiles: deleteFilesTargets,
            });
        } catch (error) {
            tasksLogger.error({
                message: '만료된 temp 파일 삭제 중 오류가 발생했습니다.',
                folderPath: this.tempFolderPath,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
        }
    }

    @Cron('0 0 0 * * *')
    async calculateMovieLikeCount() {
        try {
            tasksLogger.info({ message: '영화 like/dislike 집계 시작' });

            await this.movieRepository.query(
                `UPDATE movie m SET "likeCount"=(
            SELECT COUNT(*) FROM movie_user_like mul WHERE m.id=mul."movieId" AND mul."isLike"=true)`,
            );
            await this.movieRepository.query(
                `UPDATE movie m SET "dislikeCount"=(
             SELECT COUNT(*) FROM movie_user_like mul WHERE m.id=mul."movieId" AND mul."isLike"=false)`,
            );

            tasksLogger.info({ message: '영화 like/dislike 집계 완료' });
        } catch (error) {
            tasksLogger.error({
                message: '영화 like/dislike 집계 중 오류가 발생했습니다.',
                errorMessage: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
