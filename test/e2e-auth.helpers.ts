import * as bcrypt from 'bcrypt';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AuthService } from '../src/auth/auth.service';
import { Role, User } from '../src/user/entity/user.entity';

export const E2E_PASSWORD = 'E2eTest1!';

export const E2E_USER_EMAIL = {
    admin: 'e2e-admin@test.com',
    paidUser: 'e2e-paid@test.com',
    user: 'e2e-user@test.com',
} as const;

export type E2eUserKey = keyof typeof E2E_USER_EMAIL;

export type E2eUsers = Record<E2eUserKey, User>;

export function basicAuthHeader(email: string, password: string = E2E_PASSWORD): string {
    const encoded = Buffer.from(`${email}:${password}`).toString('base64');
    return `Basic ${encoded}`;
}

export function bearerAuth(accessToken: string): string {
    return `Bearer ${accessToken}`;
}

export async function seedE2eUsers(userRepository: Repository<User>): Promise<E2eUsers> {
    const saltRounds = Number(process.env.SALT_ROUNDS);
    if (!saltRounds) {
        throw new Error('SALT_ROUNDS is required for e2e user seeding');
    }

    const passwordHash = await bcrypt.hash(E2E_PASSWORD, saltRounds);

    const [admin, paidUser, user] = await userRepository.save([
        userRepository.create({
            email: E2E_USER_EMAIL.admin,
            password: passwordHash,
            role: Role.admin,
        }),
        userRepository.create({
            email: E2E_USER_EMAIL.paidUser,
            password: passwordHash,
            role: Role.paidUser,
        }),
        userRepository.create({
            email: E2E_USER_EMAIL.user,
            password: passwordHash,
            role: Role.user,
        }),
    ]);

    return { admin, paidUser, user };
}

/** E2E용 access JWT (로그인 rate limit 회피) */
export async function issueAccessToken(app: INestApplication<App>, user: User): Promise<string> {
    const authService = app.get(AuthService);
    return authService.issueToken({ id: user.id, role: user.role }, false);
}

export async function issueAccessTokens(app: INestApplication<App>, users: E2eUsers): Promise<Record<E2eUserKey, string>> {
    const [admin, paidUser, user] = await Promise.all([
        issueAccessToken(app, users.admin),
        issueAccessToken(app, users.paidUser),
        issueAccessToken(app, users.user),
    ]);
    return { admin, paidUser, user };
}

export async function loginAccessToken(app: INestApplication<App>, email: string): Promise<string> {
    const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Authorization', basicAuthHeader(email));

    if (res.status !== 201 && res.status !== 200) {
        throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
    }

    return res.body.accessToken as string;
}
