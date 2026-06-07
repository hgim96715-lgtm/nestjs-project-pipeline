# 배포 문서

AWS Elastic Beanstalk + GitHub Actions CI/CD 기준입니다.

---

## 아키텍처

```
workflow_dispatch (수동 트리거)
  → GitHub Actions (.github/workflows/deploy.yml)
      → npm ci --legacy-peer-deps
      → npm run build          (prisma generate + nest build)
      → npm run migration:deploy  (RDS, SSL — Prisma)
          └─ P3005(기존 TypeORM 스키마) → migrate resolve baseline → 재실행
      → deployment.zip → S3
      → EB CreateApplicationVersion + UpdateEnvironment
  → Elastic Beanstalk (NestJS-Project-EB-env)
      → node dist/src/main.js (Procfile)
      → RDS PostgreSQL (SSL)
```

> 배포 트리거는 `main` push가 아니라 **Actions 탭에서 workflow_dispatch**로 실행합니다.

---

## 환경 변수

| 변수 | 설명 |
| --- | --- |
| `ENV` | `dev` \| `prod` (prod: SSL·`synchronize: false`) |
| `DB_TYPE` | `postgres` |
| `DB_HOST` | PostgreSQL 호스트 (로컬: `localhost`, prod: RDS 엔드포인트) |
| `DB_PORT` | 포트 (기본 `5432`, 로컬 Docker: `.env` 예시 `5556`) |
| `DB_USERNAME` | DB 사용자 |
| `DB_PASSWORD` | DB 비밀번호 |
| `DB_DATABASE` | DB 이름 |
| `DATABASE_URL` | Prisma·TypeORM 공용 연결 URL (`postgresql://user:pass@host:port/db`) — **CI·런타임 필수** |
| `SALT_ROUNDS` | bcrypt password hashing cost (숫자) |
| `ACCESS_TOKEN_SECRET` | access JWT 서명 키 |
| `REFRESH_TOKEN_SECRET` | refresh JWT 서명 키 |
| `REDIS_HOST` | Redis 호스트 |
| `REDIS_PORT` | Redis 포트 (기본 `6379`) |
| `REDIS_INSIGHT_PORT` | Redis Insight 포트 (기본 `5540`) |
| `SESSION_SECRET` | 세션 서명 키 |
| `AWS_REGION` | S3·AWS 리전 (예: `ap-northeast-2`) |
| `AWS_S3_BUCKET` | S3 버킷 이름 |
| `PORT` | HTTP 포트 (EB에서 자동 주입, 로컬 기본 `3001`) |

로컬: `.env` · `.env.test` (테스트 DB). prod/CI: GitHub Repository **Secrets** (아래 표).

로컬에서 `DATABASE_URL`이 없으면 `test/load-integration-env.ts`가 `DB_*`로 조합합니다. **CI·EB는 `DATABASE_URL` Secret을 직접 설정**하세요.

---

## GitHub Secrets (Repository)

| Secret | 용도 |
| --- | --- |
| `ENV` | `prod` (미설정 시 CI 기본 `prod`) |
| `DB_TYPE` | `postgres` (미설정 시 기본) |
| `DB_HOST` | RDS 엔드포인트 |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | RDS 사용자 |
| `DB_PASSWORD` | RDS 비밀번호 |
| `DB_DATABASE` | RDS DB 이름 |
| `DATABASE_URL` | Prisma migration·런타임 연결 URL (RDS SSL 포함 권장) |
| `SALT_ROUNDS` | bcrypt cost |
| `ACCESS_TOKEN_SECRET` | JWT |
| `REFRESH_TOKEN_SECRET` | JWT |
| `REDIS_HOST` | Redis 호스트 |
| `REDIS_PORT` | Redis 포트 |
| `REDIS_INSIGHT_PORT` | Redis Insight 포트 |
| `SESSION_SECRET` | 세션 서명 키 |
| `AWS_ACCESS_KEY_ID` | CI → S3·EB |
| `AWS_SECRET_ACCESS_KEY` | CI → S3·EB |
| `AWS_REGION` | 예: `ap-northeast-2` |
| `AWS_S3_BUCKET` | deployment.zip 업로드 버킷 |

EB **환경 변수**에도 동일 DB·JWT·Redis·AWS 값을 설정해야 런타임 앱이 RDS에 붙습니다 (CI `.env`는 build/migration용).

---

## Migration

### TypeORM (로컬·레거시)

```bash
npm run build    # prisma generate 포함
npm run migration:run   # dist/src/database/data-source.js
```

`.env`의 `DB_*`·`DATABASE_URL`이 가리키는 DB에 migration이 적용됩니다.

### Prisma (CI·prod)

```bash
npm run build
npm run migration:deploy
```

CI 워크플로는 `migration:deploy` 실행 후 **P3005**(DB에 스키마는 있으나 Prisma migration 이력 없음 — TypeORM RDS 전환 시 흔함)이면 아래 baseline을 적용합니다.

```bash
npx prisma migrate resolve --applied "20260605052743_init"
npm run migration:deploy
```

로컬/RDS에서 동일 로직을 한 번에 실행하려면:

```bash
node scripts/run-prisma-rds-migration.js
```

- core 테이블(`movie`, `user`) 없음 → `prisma db push` 후 baseline
- core 테이블 있음 + P3005 → baseline 후 `migrate deploy`

**prod RDS**에 직접 실행할 때는 SSL·접근 권한을 확인하세요.

---

## CI 빌드 검증

배포 워크플로는 zip 전에 아래를 확인합니다.

- `dist/src/main.js` 존재
- `Procfile`에 `dist/src/main.js` 참조
- `generated/prisma` (또는 `dist/generated/prisma`) 클라이언트 생성
- `@redis/client` reply-utils (런타임 의존성)

---

## RDS 초기화 (데이터 없을 때)

스키마·migration 이력이 꼬였을 때 (데이터 **없을 때만**):

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

이후 `npm run migration:deploy`(Prisma) 또는 `npm run migration:run`(TypeORM) 또는 CI 재배포.

**주의**: RDS에 `synchronize`로 만든 테이블만 있고 `migrations`/`_prisma_migrations` 기록이 없으면 충돌 → 빈 DB면 migration만, 기존 스키마 있으면 DROP 후 재실행 또는 baseline 필요.

---

## 배포 후 확인

- Health: EB 콘솔 **Ok**
- Swagger: `http://{EB-URL}/api`
- API: `GET http://{EB-URL}/v1/movie` (공개)

---

## Swagger / curl (배포 환경)

```bash
# 회원가입 (Basic Auth)
curl -X POST "http://{EB-URL}/v1/auth/register" -u "user@example.com:password"

# 로그인
curl -X POST "http://{EB-URL}/v1/auth/login" -u "user@example.com:password"

# 인증 확인
curl "http://{EB-URL}/v1/auth/private" -H "Authorization: Bearer {accessToken}"
```
