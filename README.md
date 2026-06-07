# NESTJS-PROJECT-PIPELINE

NestJS 로 **영화·감독·장르 도메인 REST API** 를 설계·구현한 백엔드 포트폴리오입니다.
JWT 인증, RBAC, 커서 페이지네이션, 파일 업로드, 실시간 채팅, 테스트, AWS 배포까지 직접 구현했으며,
TypeORM 으로 구현한 핵심 도메인을 **Prisma 로 점진적 전환 (User·Auth·Genre·Director·Movie 완료)** 했습니다.

> 상세 문서는 [`docs/`](docs/) 를 참고하세요.

---

## 1. 프로젝트 소개

| 항목 | 내용 |
|------|------|
| **목적** | 영화 서비스 API 를 설계하며 인증·트랜잭션·캐싱·파일 업로드·배포 전 과정을 직접 구현 |
| **도메인** | Movie, Director, Genre, User, Auth, Chat |
| **DB** | PostgreSQL (로컬 Docker / 운영: AWS RDS) |
| **ORM** | Prisma (핵심 도메인 전환 완료) + TypeORM (점진적 전환 중) |
| **API** | URI 버저닝 `v1`, Swagger `/api` |
| **배포** | GitHub Actions → S3 → AWS Elastic Beanstalk |

---

## 2. 기술적 의사결정

### TypeORM → Prisma 전환

```
이유:
  TypeORM 의 암묵적 관계 관리 → 예상치 못한 쿼리 발생
  Prisma 의 타입 안전한 쿼리 빌더 + 자동완성으로 개발 생산성 향상
  select / omit / include 등 명시적 API 로 N+1 문제 방지

전환 완료:  User / Auth / Genre / Director / Movie
전환 중:    Chat (WebSocket 트랜잭션 QueryRunner 의존)
```

### 커서 페이지네이션 채택

```
이유:
  offset 방식은 대량 데이터에서 OFFSET N 이 앞 데이터를 전부 스캔
  커서 방식은 마지막 ID 기준으로 WHERE id < cursor 인덱스 탐색
  → 데이터 양에 관계없이 일정한 응답 속도 유지
```

### Prisma + TypeORM 공존 전략

```
두 ORM 이 같은 DB 를 바라볼 때 마이그레이션 충돌 발생
→ Prisma 전용 DB 분리 (CREATE DATABASE prisma)
  TypeORM migration:run (로컬)
  Prisma migration:deploy (CI/운영)
```

---

## 3. 핵심 기능 구현

| 기능 | 구현 내용 |
|------|----------|
| **인증·인가** | Basic Token → JWT (Access/Refresh 분리), 토큰 블랙리스트 캐싱으로 즉시 만료 처리 |
| **RBAC** | admin(0) · paidUser(1) · user(2) 역할 계층, `@RBAC()` 데코레이터 + APP_GUARD |
| **트랜잭션** | Movie — `prisma.$transaction` / Chat — `WsTransactionInterceptor` + QueryRunner |
| **파일 업로드** | temp 업로드 → Movie 생성 시 `public/movie/{id}` 이동 (MP4 1~3개) |
| **실시간 채팅** | Socket.IO Gateway, Namespace/Room, handleConnection 에서 JWT 검증·연결 차단 |
| **캐싱** | JWT 검증 결과 캐싱으로 재검증 스킵, 토큰 블랙리스트, Rate Limiting |
| **로깅** | Winston 구조화 로깅, 요청/응답 Interceptor 로 전 구간 기록 |
| **스케줄링** | Cron 으로 temp 폴더 자동 정리 · 좋아요 집계 주기 실행 |

---

## 4. 아키텍처

```
AppModule
├── ConfigModule (Joi 검증) · TypeOrmModule (잔여) · PrismaModule (전환 도메인)
├── Movie / Director / Genre / User / Auth / Common / Chat
├── ScheduleModule · WinstonModule
├── APP_GUARD: Throttler → AuthGuard → RBACGuard  ← 순서 중요
├── APP_FILTER: ForbiddenException, QueryFailedError
└── BearerTokenMiddleware  (v1/auth/login·register 제외 전 구간 적용)

main.ts → URI v1 · Swagger /api · ValidationPipe · CORS · Session (Redis)
```

**Movie 생성 흐름**

```
POST /v1/movie
  → CreateMovieDto (파일 ref 포함)
  → temp 파일 존재 검증
  → prisma.$transaction (movie · detail · genre M:N · file 저장 원자성 보장)
  → public/movie/{id} 폴더로 파일 이동
```

**인증 흐름**

```
회원가입 / 로그인  →  Basic {base64("email:password")}
API 호출          →  Bearer {accessToken}  →  BearerTokenMiddleware 검증
토큰 재발급        →  Bearer {refreshToken}
로그아웃           →  토큰 블랙리스트 캐시 등록  →  이후 요청 즉시 차단
```

---

## 5. ERD

```
Movie ──1:1── MovieDetail
Movie ──N:M── Genre   (movie_genres_genre)
Movie ──N:1── Director
MovieUserLike ── userId + movieId (복합 PK)
User (email, password, role)
```

---

## 6. 기술 스택

| 분류 | 기술 |
|------|------|
| **런타임** | NestJS, TypeScript |
| **DB** | PostgreSQL, Prisma, TypeORM |
| **검증·설정** | class-validator, class-transformer, @nestjs/config, Joi |
| **인증** | bcrypt, @nestjs/jwt, Passport (local, jwt) |
| **캐시·보안** | @nestjs/cache-manager (keyv/Redis), @nestjs/throttler |
| **실시간** | Socket.IO, @nestjs/websockets |
| **스케줄·로깅** | @nestjs/schedule, winston, nest-winston |
| **파일** | multer, diskStorage, fluent-ffmpeg |
| **문서** | @nestjs/swagger |
| **인프라** | Docker Compose, AWS EB, RDS, S3, ElastiCache (Redis), GitHub Actions |
| **테스트** | Jest, Supertest, @nestjs/testing |

---

## 7. 실행 방법

```bash
# 1. 의존성
pnpm install

# 2. .env 설정
# DB_*, DATABASE_URL, SALT_ROUNDS, JWT secrets, REDIS_*, SESSION_SECRET 등

# 3. PostgreSQL + Redis
docker compose up -d

# 4. 개발 서버 (포트 3001)
pnpm start:dev
```

- Swagger: `http://localhost:3001/api`
- 수동 테스트 UI: `http://localhost:3001/public/movie/index.html`

`ENV=dev` 일 때 TypeORM `synchronize: true` 로 스키마 자동 반영
Prisma 스키마는 `prisma/schema.prisma` 기준

---

## 8. 테스트

```bash
pnpm test                # 단위 테스트
pnpm test:integration    # 통합 테스트 (--runInBand)
pnpm test:e2e            # E2E 테스트
```

---

## 9. 배포

`main` 브랜치 push → GitHub Actions 자동 실행

```
Install (npm ci) → Build (prisma generate + nest build)
  → Prisma migration:deploy (RDS)
  → Zip → S3 → Elastic Beanstalk
```

- **RDS SSL**: `sslmode=no-verify` + `PrismaPg ssl.rejectUnauthorized: false`
- **Redis**: ElastiCache Primary Endpoint (localhost 아님)
- **Procfile**: `web: node dist/src/main.js`
- prod: `synchronize: false`, `DATABASE_URL` · `SESSION_SECRET` · Redis Secrets 주입

---

## 10. 배포 중 해결한 주요 이슈

| 이슈 | 원인 | 해결 |
|------|------|------|
| EB 502 Bad Gateway | 앱 기동 전 크래시 | `eb.stdout.log` 로 원인 추적 |
| `reply-utils` MODULE_NOT_FOUND | redis/keyv 버전 충돌 | `package.json` overrides + `npm ci` |
| Prisma P1011 SSL | RDS 자체 서명 인증서 | `sslmode=no-verify` + `rejectUnauthorized: false` |
| Prisma P3005 | TypeORM 기존 스키마 충돌 | `migrate resolve --applied` baseline |
| DB_PASSWORD 특수문자 | URL 파싱 오류 P1013 | `printf` 로 .env 안전 생성 |
| TS5011 재발 | Prisma generated/ 가 src 바깥 | `rootDir: "."` 로 변경 |