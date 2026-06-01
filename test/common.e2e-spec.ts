import './load-integration-env';

import { INestApplication } from '@nestjs/common';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User } from '../src/user/entity/user.entity';
import { bearerAuth, E2eUserKey, E2eUsers, issueAccessTokens, seedE2eUsers } from './e2e-auth.helpers';
import { createE2eApp } from './e2e-app.helpers';
import { uploadTempVideo } from './e2e-upload.helpers';

const TEMP_DIR = join(process.cwd(), 'public', 'temp');

function resetUsers(dataSource: DataSource) {
    return dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
}

function clearTempDir() {
    if (!existsSync(TEMP_DIR)) {
        return;
    }
    for (const name of readdirSync(TEMP_DIR)) {
        rmSync(join(TEMP_DIR, name), { force: true });
    }
}

describe('Common (e2e)', () => {
    let app: INestApplication<App>;
    let dataSource: DataSource;
    let e2eUsers: E2eUsers;
    let accessTokens: Record<E2eUserKey, string>;

    beforeAll(async () => {
        app = await createE2eApp();
        dataSource = app.get(DataSource);
    }, 60_000);

    afterAll(async () => {
        clearTempDir();
        await app?.close();
    });

    beforeEach(async () => {
        clearTempDir();
        await resetUsers(dataSource);
        const userRepository = dataSource.getRepository(User);
        e2eUsers = await seedE2eUsers(userRepository);
        accessTokens = await issueAccessTokens(app, e2eUsers);
    });

    describe('POST /v1/common/video', () => {
        it('returns 403 without token', async () => {
            await request(app.getHttpServer())
                .post('/v1/common/video')
                .attach('movies', Buffer.from('fake-video'), {
                    filename: 'test.mp4',
                    contentType: 'video/mp4',
                })
                .expect(403);
        });

        it('returns 400 for invalid mimetype', async () => {
            await request(app.getHttpServer())
                .post('/v1/common/video')
                .set('Authorization', bearerAuth(accessTokens.user))
                .attach('movies', Buffer.from('not-a-video'), {
                    filename: 'test.txt',
                    contentType: 'text/plain',
                })
                .expect(400);
        });

        it('uploads mp4 and returns fileName', async () => {
            const fileName = await uploadTempVideo(app, accessTokens.user);

            expect(fileName).toMatch(/^[0-9a-f-]+_\d+\.mp4$/i);
            expect(existsSync(join(TEMP_DIR, fileName))).toBe(true);
        });
    });
});
