import './load-integration-env';

import { existsSync, rmSync } from 'fs';
import { INestApplication } from '@nestjs/common';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Director } from '../src/director/entity/director.entity';
import { Genre } from '../src/genre/entity/genre.entity';
import { Movie } from '../src/movie/entity/movie.entity';
import { MovieDetail } from '../src/movie/entity/movie-detail.entity';
import { User } from '../src/user/entity/user.entity';
import {
    basicAuthHeader,
    bearerAuth,
    E2E_USER_EMAIL,
    E2eUserKey,
    E2eUsers,
    issueAccessTokens,
    seedE2eUsers,
} from './e2e-auth.helpers';
import { createE2eApp } from './e2e-app.helpers';
import { uploadTempVideo } from './e2e-upload.helpers';

async function resetMovieE2eData(dataSource: DataSource) {
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

describe('Movie (e2e)', () => {
    let app: INestApplication<App>;
    let dataSource: DataSource;
    let e2eUsers: E2eUsers;
    let accessTokens: Record<E2eUserKey, string>;
    let movies: Movie[];
    let directorId: number;
    let genreId: number;

    beforeAll(async () => {
        app = await createE2eApp();
        dataSource = app.get(DataSource);
    }, 60_000);

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(async () => {
        await resetMovieE2eData(dataSource);

        const movieRepository = dataSource.getRepository(Movie);
        const movieDetailRepository = dataSource.getRepository(MovieDetail);
        const userRepository = dataSource.getRepository(User);
        const genreRepository = dataSource.getRepository(Genre);
        const directorRepository = dataSource.getRepository(Director);

        e2eUsers = await seedE2eUsers(userRepository);
        accessTokens = await issueAccessTokens(app, e2eUsers);

        const directors = await directorRepository.save([
            directorRepository.create({
                dob: new Date('1990-01-01'),
                nationality: 'Korean',
                name: 'e2e-director',
            }),
        ]);

        const genres = await genreRepository.save([genreRepository.create({ name: 'e2e-genre' })]);

        directorId = directors[0].id;
        genreId = genres[0].id;

        movies = await movieRepository.save([
            movieRepository.create({
                title: 'e2e movie one',
                detail: movieDetailRepository.create({ detail: 'detail one' }),
                director: directors[0],
                genres: [genres[0]],
                creator: e2eUsers.admin,
                createAt: new Date('2026-01-01'),
                updateAt: new Date('2026-01-01'),
                files: [],
            }),
            movieRepository.create({
                title: 'e2e movie two',
                detail: movieDetailRepository.create({ detail: 'detail two' }),
                director: directors[0],
                genres: [genres[0]],
                creator: e2eUsers.admin,
                createAt: new Date('2026-01-02'),
                updateAt: new Date('2026-01-02'),
                files: [],
            }),
        ]);
    });

    describe('GET /v1/movie', () => {
        it('returns paginated movie list', async () => {
            const res = await request(app.getHttpServer())
                .get('/v1/movie')
                .query({ take: 10, order: 'id_ASC' })
                .expect(200);

            expect(res.body).toMatchObject({
                count: 2,
            });
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0]).toMatchObject({
                id: movies[0].id,
                title: 'e2e movie one',
            });
        });

        it('filters by title', async () => {
            const res = await request(app.getHttpServer())
                .get('/v1/movie')
                .query({ title: 'e2e movie one', take: 10, order: 'id_ASC' })
                .expect(200);

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].title).toBe('e2e movie one');
        });

        it('includes likeStatus when authenticated', async () => {
            const token = accessTokens.user;

            await request(app.getHttpServer())
                .post(`/v1/movie/${movies[0].id}/like`)
                .set('Authorization', bearerAuth(token))
                .expect(201);

            const res = await request(app.getHttpServer())
                .get('/v1/movie')
                .query({ take: 10, order: 'id_ASC' })
                .set('Authorization', bearerAuth(token))
                .expect(200);

            const liked = res.body.data.find((m: { id: number }) => m.id === movies[0].id);
            expect(liked).toMatchObject({ id: movies[0].id, likeStatus: true });
        });
    });

    describe('GET /v1/movie/recent', () => {
        it('returns recent movies', async () => {
            const res = await request(app.getHttpServer()).get('/v1/movie/recent').expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].id).toBe(movies[1].id);
        });
    });

    describe('GET /v1/movie/:id', () => {
        it('returns a movie by id', async () => {
            const res = await request(app.getHttpServer()).get(`/v1/movie/${movies[0].id}`).expect(200);

            expect(res.body).toMatchObject({
                id: movies[0].id,
                title: 'e2e movie one',
            });
            expect(res.body.detail).toMatchObject({ detail: 'detail one' });
            expect(res.body.director).toMatchObject({ id: movies[0].director.id });
        });

        it('returns 404 for unknown id', async () => {
            await request(app.getHttpServer()).get('/v1/movie/99999').expect(404);
        });
    });

    describe('POST /v1/movie', () => {
        const createBody = () => ({
            title: 'e2e movie created',
            detail: 'created detail',
            directorId,
            genreIds: [genreId],
        });

        it('returns 403 without token', async () => {
            await request(app.getHttpServer()).post('/v1/movie').send(createBody()).expect(403);
        });

        it('returns 403 for paidUser (admin only)', async () => {
            await request(app.getHttpServer())
                .post('/v1/movie')
                .set('Authorization', bearerAuth(accessTokens.paidUser))
                .send(createBody())
                .expect(403);
        });

        it('creates a movie as admin', async () => {
            const res = await request(app.getHttpServer())
                .post('/v1/movie')
                .set('Authorization', bearerAuth(accessTokens.admin))
                .send(createBody())
                .expect(201);

            expect(res.body).toMatchObject({
                title: 'e2e movie created',
            });
            expect(res.body.detail).toMatchObject({ detail: 'created detail' });
        });

        it('creates a movie with temp video (2-step upload)', async () => {
            const token = accessTokens.admin;
            const fileName = await uploadTempVideo(app, token);
            const tempPath = join(process.cwd(), 'public', 'temp', fileName);

            expect(existsSync(tempPath)).toBe(true);

            const createRes = await request(app.getHttpServer())
                .post('/v1/movie')
                .set('Authorization', bearerAuth(token))
                .send({
                    title: 'e2e movie with video',
                    detail: 'detail with uploaded file',
                    directorId,
                    genreIds: [genreId],
                    files: [fileName],
                })
                .expect(201);

            const movieId = createRes.body.id as number;
            const movieFilePath = join(process.cwd(), 'public', 'movie', String(movieId), fileName);

            expect(createRes.body.files).toHaveLength(1);
            expect(createRes.body.files[0]).toMatchObject({
                originalName: fileName,
                mimetype: 'video/mp4',
                path: `public/movie/${movieId}/${fileName}`,
            });
            expect(existsSync(movieFilePath)).toBe(true);
            expect(existsSync(tempPath)).toBe(false);

            const getRes = await request(app.getHttpServer()).get(`/v1/movie/${movieId}`).expect(200);

            expect(getRes.body.files).toHaveLength(1);
            expect(getRes.body.files[0].path).toBe(`public/movie/${movieId}/${fileName}`);

            rmSync(join(process.cwd(), 'public', 'movie', String(movieId)), {
                recursive: true,
                force: true,
            });
        });

        it('returns 400 when temp file ref does not exist', async () => {
            await request(app.getHttpServer())
                .post('/v1/movie')
                .set('Authorization', bearerAuth(accessTokens.admin))
                .send({
                    ...createBody(),
                    title: 'e2e movie missing file',
                    files: ['non-existent-file.mp4'],
                })
                .expect(400);
        });
    });

    describe('PATCH /v1/movie/:id', () => {
        it('returns 403 without token', async () => {
            await request(app.getHttpServer())
                .patch(`/v1/movie/${movies[0].id}`)
                .send({ title: 'patched' })
                .expect(403);
        });

        it('returns 403 for regular user (paidUser required)', async () => {
            await request(app.getHttpServer())
                .patch(`/v1/movie/${movies[0].id}`)
                .set('Authorization', bearerAuth(accessTokens.user))
                .send({ title: 'patched' })
                .expect(403);
        });

        it('updates a movie as paidUser', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/v1/movie/${movies[0].id}`)
                .set('Authorization', bearerAuth(accessTokens.paidUser))
                .send({ title: 'e2e movie patched' })
                .expect(200);

            expect(res.body).toMatchObject({
                id: movies[0].id,
                title: 'e2e movie patched',
            });
        });
    });

    describe('DELETE /v1/movie/:id', () => {
        it('returns 403 without token', async () => {
            await request(app.getHttpServer()).delete(`/v1/movie/${movies[0].id}`).expect(403);
        });

        it('returns 403 for paidUser (admin only)', async () => {
            await request(app.getHttpServer())
                .delete(`/v1/movie/${movies[0].id}`)
                .set('Authorization', bearerAuth(accessTokens.paidUser))
                .expect(403);
        });

        it('deletes a movie as admin', async () => {
            const res = await request(app.getHttpServer())
                .delete(`/v1/movie/${movies[1].id}`)
                .set('Authorization', bearerAuth(accessTokens.admin))
                .expect(200);

            expect(res.text).toContain(`${movies[1].id}`);

            await request(app.getHttpServer()).get(`/v1/movie/${movies[1].id}`).expect(404);
        });
    });

    describe('POST /v1/movie/:id/like and /unlike', () => {
        it('returns 403 without token', async () => {
            await request(app.getHttpServer()).post(`/v1/movie/${movies[0].id}/like`).expect(403);
        });

        it('likes and unlikes a movie as authenticated user', async () => {
            const likeRes = await request(app.getHttpServer())
                .post(`/v1/movie/${movies[0].id}/like`)
                .set('Authorization', bearerAuth(accessTokens.user))
                .expect(201);

            expect(likeRes.body).toEqual({ isLike: true });

            const unlikeRes = await request(app.getHttpServer())
                .post(`/v1/movie/${movies[0].id}/unlike`)
                .set('Authorization', bearerAuth(accessTokens.user))
                .expect(201);

            expect(unlikeRes.body).toEqual({ isLike: false });
        });
    });

    describe('POST /v1/auth/login (seeded users)', () => {
        it('returns access and refresh tokens for admin', async () => {
            const res = await request(app.getHttpServer())
                .post('/v1/auth/login')
                .set('Authorization', basicAuthHeader(E2E_USER_EMAIL.admin))
                .expect(201);

            expect(res.body).toMatchObject({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            });
        });
    });
});
