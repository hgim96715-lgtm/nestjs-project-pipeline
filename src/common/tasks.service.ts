import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { readdir, unlink } from 'fs/promises';
import { join, parse } from 'path';
import { Movie } from 'src/movie/entity/movie.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TasksService {
    constructor(@InjectRepository(Movie) private readonly movieRepository: Repository<Movie>) {}

    private readonly tempFolderPath = join(process.cwd(), 'public', 'temp');

    @Cron('0 0 * * *')
    async deleteExpiredTempFiles() {
        const tempFiles = await readdir(this.tempFolderPath);

        const deleteFilesTargets = tempFiles.filter((file) => {
            const filename = parse(file).name;
            const [_, timestamp] = filename.split('_');

            const createdAt = Number(timestamp);

            try {
                const aDayInMilSec = 24 * 60 * 60 * 1000;
                const now = Date.now();
                return now - createdAt > aDayInMilSec;
            } catch (e) {
                return true;
            }
        });

        await Promise.all(deleteFilesTargets.map((file) => unlink(join(this.tempFolderPath, file))));
    }

    /*
    UPDATE movie m SET m.likeCount=(
    SELECT COUNT(*) FROM movie_user_like mul WHERE m.id=mul.movieId AND mul.isLike=true)
    */
    // @Cron('0 * * * * *')
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
