import './load-integration-env';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp } from './e2e-app.helpers';

describe('App (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        app = await createE2eApp();
    }, 60_000);

    afterAll(async () => {
        await app?.close();
    });

    it('GET /v1/movie returns 200 without auth', async () => {
        await request(app.getHttpServer()).get('/v1/movie').query({ take: 1 }).expect(200);
    });
});
