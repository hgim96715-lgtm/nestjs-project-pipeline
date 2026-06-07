# 테스트 문서

단위 · 통합 · E2E 테스트 구조와 실행 방법입니다.

---

## 사전 준비 (통합 · E2E)

1. PostgreSQL 실행 (Docker Compose 등)
2. `.env.test.example` → **`.env.test`** 복사 후 `DB_DATABASE=movie_test` 설정 (`*_test` 접미사 필수)
3. `.env`에 `DB_*` 설정 (`DATABASE_URL` 없으면 `load-integration-env`가 자동 조합)
4. 테스트 DB 생성: `pnpm db:test:create`

통합·E2E는 `test/load-integration-env.ts`가 `.env`를 읽은 뒤 `.env.test`로 덮어씁니다. **개발 DB와 분리**해서 사용하세요.

---

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run build` | `prisma generate` + NestJS 빌드 (`dist/`) |
| `npm run migration:run` | TypeORM migration (`dist/src/database/data-source.js`) |
| `npm run migration:deploy` | Prisma migration (`prisma migrate deploy`) |
| `node scripts/run-prisma-rds-migration.js` | RDS Prisma migration (baseline·`db push` 포함) |
| `pnpm test` | 전체 단위 테스트 (`src/**/*.spec.ts`, integration·e2e 제외) |
| `pnpm test:cov` | 전체 coverage |
| `pnpm test:integration` | 통합 테스트 (`*.integration.spec.ts`, **`--runInBand`**, `NODE_OPTIONS=--experimental-vm-modules`) |
| `pnpm test:integration:watch` | 통합 watch |
| `pnpm test:e2e` | E2E 전체 (`test/jest-e2e.json`) |
| `pnpm test:e2e:movie` | Movie E2E만 |
| `pnpm test:e2e:common` | Common video 업로드 E2E만 |
| `pnpm test:e2e:auth` | Auth E2E만 |
| `pnpm test:movie` | Movie 모듈 단위 + coverage |
| `pnpm test:movie:watch` | Movie watch + coverage |
| `pnpm test:common` | Common 모듈 단위 + coverage |
| `pnpm test:auth` | Auth 모듈 단위 + coverage |
| `pnpm test:user` | User 모듈 단위 + coverage |
| `pnpm test:user:watch` | User watch + coverage |
| `pnpm test:genre` | Genre 모듈 단위 + coverage |
| `pnpm test:director` | Director 모듈 단위 + coverage |

coverage 수집 시 `*.module.ts`, `*.dto.ts`, `*.entity.ts`는 제외 (비즈니스 로직 위주).

---

## 테스트 구조

| 구분 | 위치 | 내용 |
| --- | --- | --- |
| **단위** | `src/**/*.spec.ts` | Service·Controller·Pipe mock 테스트 |
| **통합** | `src/**/*.integration.spec.ts` | 실 DB — Prisma (`integrationTestImports`, `resetIntegrationTestData`) |
| **E2E** | `test/*.e2e-spec.ts` | HTTP Supertest (`AppModule` 전체) |
| **헬퍼** | `test/integration-db.helpers.ts`, `test/load-integration-env.ts` 등 | DB reset·앱·인증·업로드 공통 설정 |

---

## E2E 시나리오

| 스펙 | 검증 |
| --- | --- |
| `movie.e2e-spec.ts` | 목록·recent·단건(404), RBAC CUD, like, 2-step 업로드, 로그인 스모크 |
| `common.e2e-spec.ts` | `POST /v1/common/video` — 403, 잘못된 mimetype 400, mp4 업로드 |
| `auth.e2e-spec.ts` | register, login 401/성공, private 403·access/refresh |
| `app.e2e-spec.ts` | `GET /v1/movie` 공개 조회 스모크 |

---

## 통합 테스트 시드·권한 (E2E)

E2E 인증 테스트용 계정 (`test/e2e-auth.helpers.ts`, 비밀번호 `E2eTest1!`):

| 이메일 | Role |
| --- | --- |
| `e2e-admin@test.com` | admin (`0`) |
| `e2e-paid@test.com` | paidUser (`1`) |
| `e2e-user@test.com` | user (`2`) |

JWT는 대부분 `AuthService.issueToken`으로 발급합니다 (login `@Throttle` 회피). login HTTP 검증은 `auth.e2e-spec.ts`에서 별도 수행합니다.

---

## 브라우저 수동 확인

서버 기동 후: **`http://localhost:3001/public/movie/index.html`**

- Movie `GET` 목록·recent·단건
- Bearer 토큰 입력 시 인증 API 호출 가능

---

## 관련 트러블슈팅

통합·E2E·CI 관련 이슈는 [트러블슈팅](./troubleshooting.md)을 참고하세요.
