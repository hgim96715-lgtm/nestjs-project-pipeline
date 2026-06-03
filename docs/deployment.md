# 배포 문서

AWS Elastic Beanstalk + GitHub Actions CI/CD 기준입니다.

---

## 아키텍처

```
main push
  → GitHub Actions (.github/workflows/deploy.yml)
      → npm install / build
      → npm run migration:run  (RDS, SSL)
      → deployment.zip → S3
      → EB CreateApplicationVersion + UpdateEnvironment
  → Elastic Beanstalk (NestJS-Project-EB-env)
      → node dist/main.js (Procfile)
      → RDS PostgreSQL (SSL)
```

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
| `SALT_ROUNDS` | bcrypt password hashing cost (숫자) |
| `ACCESS_TOKEN_SECRET` | access JWT 서명 키 |
| `REFRESH_TOKEN_SECRET` | refresh JWT 서명 키 |
| `AWS_REGION` | S3·AWS 리전 (예: `ap-northeast-2`) |
| `AWS_S3_BUCKET` | S3 버킷 이름 |
| `PORT` | HTTP 포트 (EB에서 자동 주입, 로컬 기본 `3001`) |

로컬: `.env` · `.env.test` (테스트 DB). prod/CI: GitHub Repository **Secrets** (아래 표).

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
| `SALT_ROUNDS` | bcrypt cost |
| `ACCESS_TOKEN_SECRET` | JWT |
| `REFRESH_TOKEN_SECRET` | JWT |
| `AWS_ACCESS_KEY_ID` | CI → S3·EB |
| `AWS_SECRET_ACCESS_KEY` | CI → S3·EB |
| `AWS_REGION` | 예: `ap-northeast-2` |
| `AWS_S3_BUCKET` | deployment.zip 업로드 버킷 |

EB **환경 변수**에도 동일 DB·JWT·AWS 값을 설정해야 런타임 앱이 RDS에 붙습니다 (CI `.env`는 build/migration용).

---

## 로컬 Migration

```bash
npm run build
npm run migration:run
```

`.env`의 `DB_*`가 가리키는 DB에 migration이 적용됩니다. **prod RDS**에 직접 실행할 때는 SSL·접근 권한을 확인하세요.

---

## RDS 초기화 (데이터 없을 때)

스키마·migration 이력이 꼬였을 때 (데이터 **없을 때만**):

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

이후 `npm run migration:run` 또는 CI 재배포.

**주의**: RDS에 `synchronize`로 만든 테이블만 있고 `migrations` 기록이 없으면 충돌 → 빈 DB면 migration만, 기존 스키마 있으면 DROP 후 재실행 또는 baseline 필요.

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
