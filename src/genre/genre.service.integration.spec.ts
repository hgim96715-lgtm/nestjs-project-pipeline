import '../../test/load-integration-env';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { integrationTestImports } from '../../test/integration-db.helpers';
import { Director } from 'src/director/entity/director.entity';
import { Movie } from 'src/movie/entity/movie.entity';
import { MovieDetail } from 'src/movie/entity/movie-detail.entity';
import { User } from 'src/user/entity/user.entity';
import { Genre } from './entity/genre.entity';
import { GenreService } from './genre.service';

async function resetGenreTestData(dataSource: DataSource) {
    await dataSource.query(`
        TRUNCATE TABLE
            movie_user_like,
            movie_file,
            movie_genres_genre,
            movie,
            movie_detail,
            genre,
            director,
            "user"
        RESTART IDENTITY CASCADE
    `);
}

describe('GenreService - Integration Test', () => {
    let service: GenreService;
    let dataSource: DataSource;
    let moduleRef: TestingModule;

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [
                ...integrationTestImports(),
                TypeOrmModule.forFeature([Genre, Movie, MovieDetail, Director, User]),
            ],
            providers: [GenreService],
        }).compile();

        service = moduleRef.get(GenreService);
        dataSource = moduleRef.get(DataSource);
    }, 30_000);

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
        }
        await moduleRef?.close();
    });

    beforeEach(async () => {
        await resetGenreTestData(dataSource);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('persists a new genre', async () => {
            const created = await service.create({ name: 'integration-genre' });

            expect(created).toMatchObject({ name: 'integration-genre' });
            expect(created.id).toBeDefined();
        });

        it('throws when genre name already exists', async () => {
            await service.create({ name: 'duplicate-genre' });

            await expect(service.create({ name: 'duplicate-genre' })).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        it('updates genre name', async () => {
            const genre = await service.create({ name: 'before' });

            const updated = await service.update(genre.id, { name: 'after' });

            expect(updated).toMatchObject({ id: genre.id, name: 'after' });
        });

        it('throws ConflictException when renaming to existing name', async () => {
            await service.create({ name: 'genre-a' });
            const genreB = await service.create({ name: 'genre-b' });

            await expect(service.update(genreB.id, { name: 'genre-a' })).rejects.toThrow(ConflictException);
        });
    });

    describe('remove', () => {
        it('deletes genre when not linked to movies', async () => {
            const genre = await service.create({ name: 'deletable' });

            const message = await service.remove(genre.id);

            expect(message).toContain(String(genre.id));
            expect(await service.findOne(genre.id)).toBeNull();
        });

        it('throws ConflictException when genre is used by movies', async () => {
            const genreRepository = dataSource.getRepository(Genre);
            const movieRepository = dataSource.getRepository(Movie);
            const movieDetailRepository = dataSource.getRepository(MovieDetail);
            const directorRepository = dataSource.getRepository(Director);
            const userRepository = dataSource.getRepository(User);

            const genre = await service.create({ name: 'linked-genre' });
            const user = await userRepository.save(
                userRepository.create({ email: 'genre-int@test.com', password: 'hashed' }),
            );
            const director = await directorRepository.save(
                directorRepository.create({
                    name: 'dir',
                    dob: new Date('1990-01-01'),
                    nationality: 'KR',
                }),
            );

            await movieRepository.save(
                movieRepository.create({
                    title: 'genre-linked-movie',
                    detail: movieDetailRepository.create({ detail: 'detail' }),
                    director,
                    genres: [genre],
                    creator: user,
                    createAt: new Date(),
                    updateAt: new Date(),
                    files: [],
                }),
            );

            const linked = await genreRepository.findOne({
                where: { id: genre.id },
                relations: { movies: true },
            });

            expect(linked!.movies.length).toBeGreaterThan(0);

            await expect(service.remove(genre.id)).rejects.toThrow(ConflictException);
        });

        it('throws NotFoundException when genre does not exist', async () => {
            await expect(service.remove(99999)).rejects.toThrow(NotFoundException);
        });
    });
});
