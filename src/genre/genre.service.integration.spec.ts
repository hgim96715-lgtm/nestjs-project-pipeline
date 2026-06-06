import '../../test/load-integration-env';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/prisma.service';
import { integrationTestImports, resetIntegrationTestData } from '../../test/integration-db.helpers';
import { GenreService } from './genre.service';

describe('GenreService - Integration Test', () => {
    let service: GenreService;
    let prisma: PrismaService;
    let moduleRef: TestingModule;

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [...integrationTestImports()],
            providers: [GenreService],
        }).compile();

        service = moduleRef.get(GenreService);
        prisma = moduleRef.get(PrismaService);
    }, 30_000);

    afterAll(async () => {
        await prisma?.$disconnect();
        await moduleRef?.close();
    });

    beforeEach(async () => {
        await resetIntegrationTestData(prisma);
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
            const genre = await service.create({ name: 'linked-genre' });
            const user = await prisma.user.create({
                data: { email: 'genre-int@test.com', password: 'hashed' },
            });
            const director = await prisma.director.create({
                data: {
                    name: 'dir',
                    dob: new Date('1990-01-01'),
                    nationality: 'KR',
                },
            });
            const movieDetail = await prisma.movie_detail.create({
                data: { detail: 'detail' },
            });
            const movie = await prisma.movie.create({
                data: {
                    title: 'genre-linked-movie',
                    detailId: movieDetail.id,
                    directorId: director.id,
                    creatorId: user.id,
                },
            });
            await prisma.movie_genres_genre.create({
                data: { movieId: movie.id, genreId: genre.id },
            });

            const linked = await prisma.genre.findUnique({
                where: { id: genre.id },
                include: { movie_genres_genre: true },
            });

            expect(linked!.movie_genres_genre.length).toBeGreaterThan(0);

            await expect(service.remove(genre.id)).rejects.toThrow(ConflictException);
        });

        it('throws NotFoundException when genre does not exist', async () => {
            await expect(service.remove(99999)).rejects.toThrow(NotFoundException);
        });
    });
});
