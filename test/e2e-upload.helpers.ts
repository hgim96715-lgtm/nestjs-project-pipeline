import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bearerAuth } from './e2e-auth.helpers';

export async function uploadTempVideo(
    app: INestApplication<App>,
    accessToken: string,
    options?: { filename?: string; content?: Buffer },
): Promise<string> {
    const filename = options?.filename ?? 'clip.mp4';
    const content = options?.content ?? Buffer.from('fake-mp4-bytes');

    const res = await request(app.getHttpServer())
        .post('/v1/common/video')
        .set('Authorization', bearerAuth(accessToken))
        .attach('movies', content, {
            filename,
            contentType: 'video/mp4',
        })
        .expect(201);

    return res.body[0].fileName as string;
}
