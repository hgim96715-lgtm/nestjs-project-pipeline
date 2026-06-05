import './load-integration-env';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthService } from '../src/auth/auth.service';
import { User } from '../src/user/entity/user.entity';
import { basicAuthHeader, bearerAuth, E2E_USER_EMAIL, issueAccessToken, seedE2eUsers } from './e2e-auth.helpers';
import { createE2eApp } from './e2e-app.helpers';

describe('Auth (e2e)', () => {
    let app: INestApplication<App>;
    let dataSource: DataSource;

    beforeAll(async () => {
        app = await createE2eApp();
        dataSource = app.get(DataSource);
    }, 60_000);

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(async () => {
        await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
    });

    describe('POST /v1/auth/register', () => {
        it('registers a new user with Basic auth', async () => {
            const email = `auth-register-${Date.now()}@test.com`;

            const res = await request(app.getHttpServer())
                .post('/v1/auth/register')
                .set('Authorization', basicAuthHeader(email, 'Register1!'))
                .expect(201);

            expect(res.body).toMatchObject({
                email,
                role: 'admin',
            });
            expect(res.body).not.toHaveProperty('password');
        });
    });

    describe('POST /v1/auth/login', () => {
        it('returns 401 for wrong password', async () => {
            await seedE2eUsers(dataSource.getRepository(User));

            await request(app.getHttpServer())
                .post('/v1/auth/login')
                .set('Authorization', basicAuthHeader(E2E_USER_EMAIL.admin, 'wrong-password'))
                .expect(401);
        });

        it('returns tokens and allows access to private route', async () => {
            const users = await seedE2eUsers(dataSource.getRepository(User));

            const loginRes = await request(app.getHttpServer())
                .post('/v1/auth/login')
                .set('Authorization', basicAuthHeader(E2E_USER_EMAIL.admin))
                .expect(201);

            expect(loginRes.body).toMatchObject({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            });

            const privateRes = await request(app.getHttpServer())
                .get('/v1/auth/private')
                .set('Authorization', bearerAuth(loginRes.body.accessToken))
                .expect(200);

            expect(privateRes.body).toMatchObject({
                sub: users.admin.id,
                role: users.admin.role,
                type: 'access',
            });
        });
    });

    describe('GET /v1/auth/private', () => {
        it('returns 403 without token', async () => {
            await request(app.getHttpServer()).get('/v1/auth/private').expect(403);
        });

        it('returns 403 when using refresh token', async () => {
            const users = await seedE2eUsers(dataSource.getRepository(User));
            const authService = app.get(AuthService);
            const refreshToken = await authService.issueToken({ id: users.admin.id, role: users.admin.role }, true);

            await request(app.getHttpServer())
                .get('/v1/auth/private')
                .set('Authorization', bearerAuth(refreshToken))
                .expect(403);
        });

        it('returns jwt payload for valid access token', async () => {
            const users = await seedE2eUsers(dataSource.getRepository(User));
            const token = await issueAccessToken(app, users.user);

            const res = await request(app.getHttpServer())
                .get('/v1/auth/private')
                .set('Authorization', bearerAuth(token))
                .expect(200);

            expect(res.body).toMatchObject({
                sub: users.user.id,
                type: 'access',
            });
        });
    });
});
