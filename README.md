# NESTJS-PROJECT-PIPELINE

NestJS로 **영화·감독·장르 도메인 REST API**를 설계·구현한 백엔드 포트폴리오입니다.TypeORM 관계 모델링, JWT 인증, RBAC 권한 제어, 커서 페이지네이션, 파일 업로드, 테스트, 로깅, AWS 배포까지 구현했습니다.

---

## 1. 프로젝트 소개

| 항목 | 내용 |
| --- | --- |
| **목적** | 실무에 가까운 API 설계(인증/인가·데이터 무결성·트랜잭션·캐시·업로드)를 NestJS로 구현 |
| **도메인** | Movie, Director, Genre, User, Auth |
| **DB** | PostgreSQL (로컬 Docker / prod: AWS RDS), TypeORM |
| **API** | URI 버저닝 `v1`, Swagger `/api` |
| **배포** | GitHub Actions → S3 → AWS Elastic Beanstalk (`main` push) |

---

## 2. 핵심 기능

- **도메인 CRUD**: Movie·Director·Genre 관계 모델링, FK 검증, Genre/ Director 삭제·중복 규칙
- **인증·인가**: Basic → JWT(access/refresh), Passport, 전역 Guard, RBAC(역할 계층)
- **목록 API**: 커서·offset 페이지네이션, `title` 필터
- **트랜잭션**: `TransactionInterceptor` + QueryRunner로 Movie 생성·관계 원자 처리
- **파일 업로드**: temp 업로드 → Movie 생성 시 `public/movie/{id}` 이동 (MP4 1~3개)
- **운영**: 토큰 블락·Rate limit, cron(temp 정리·like 집계), Winston 구조화 로깅
- **문서·버전**: URI `/v1`, Swagger Basic/Bearer 구분

---

## 3. 기술 스택

| 분류 | 기술 |
| --- | --- |
| **런타임** | NestJS, TypeScript |
| **DB** | TypeORM, PostgreSQL |
| **검증·설정** | class-validator, class-transformer, @nestjs/config, Joi |
| **인증** | bcrypt, @nestjs/jwt, Passport (local, jwt) |
| **캐시·보안** | @nestjs/cache-manager, @nestjs/throttler |
| **스케줄·로깅** | @nestjs/schedule, winston, nest-winston |
| **문서** | @nestjs/swagger |
| **파일** | multer, diskStorage |
| **인프라** | Docker Compose, AWS EB, RDS, S3, GitHub Actions |
| **테스트** | Jest, Supertest, @nestjs/testing |

---

## 4. 아키텍처

```
AppModule
├── ConfigModule (Joi) · TypeOrmModule
├── Movie / Director / Genre / User / Auth / Common
├── ScheduleModule · WinstonModule
├── APP_GUARD: Throttler → Auth → RBAC
├── APP_FILTER: Forbidden, QueryFailed
└── BearerTokenMiddleware (v1/auth/login·register 제외)

main.ts → URI v1 · Swagger /api · ValidationPipe
```

**Movie 생성 흐름**: `TransactionInterceptor` → `CreateMovieDto.files`(temp ref) → temp 검증 → `public/movie/{id}` 이동 + `MovieFile` 저장

**회원 생성**: `POST /v1/auth/register` · `POST /v1/user` → 공통 **`UserService.create`**

자세한 모듈·요청 순서는 [개발 과정](./docs/development-log.md)을 참고하세요.

---

## 5. ERD / 도메인 관계

```
Movie ──1:1── MovieDetail
Movie ──N:M── Genre
Movie ──N:1── Director
User (email, password, role)
```

### Role (숫자가 작을수록 높은 권한)

| 값 | 역할 |
| --- | --- |
| `0` | `admin` |
| `1` | `paidUser` |
| `2` | `user` (기본값) |

---

## 6. 인증/인가 흐름

1. **BearerTokenMiddleware** — JWT decode·verify, 토큰 블락 확인 → `req.user`
2. **AuthGuard** — `@Public`이 아니면 access 토큰·user 필수
3. **RBACGuard** — `@RBAC(Role)` 시 `user.role <= 요구 role`

| 진입 | 방식 |
| --- | --- |
| 회원가입 | `POST /v1/auth/register` (Basic) |
| 로그인 | Basic → access·refresh JWT |
| API 호출 | `Authorization: Bearer {accessToken}` |
| 로그아웃 | `POST /v1/auth/token/block` (캐시 블락) |

---

## 7. 주요 API

| 모듈 | 대표 엔드포인트 |
| --- | --- |
| Auth | `POST /v1/auth/register`, `login`, `GET /v1/auth/private`, `POST /v1/auth/token/access` |
| Movie | `GET /v1/movie` (커서), `POST /v1/movie`, like/unlike |
| Director / Genre | CRUD + RBAC |
| Common | `POST /v1/common/video` (temp 업로드) |

전체 목록·권한·Swagger 사용법: **[API 요약](./docs/api.md)**

---

## 8. 실행 방법

### 사전 요구

- Node.js, pnpm (또는 npm)
- Docker (PostgreSQL)

### 로컬 기동

```bash
# 1. 의존성
pnpm install

# 2. .env 설정 (DB_*, SALT_ROUNDS, JWT secrets 등)
```

# 3. PostgreSQL
docker compose up -d

# 4. 개발 서버 (포트 3001)
pnpm start:dev
```

- Swagger: `http://localhost:3001/api`
- 수동 테스트 UI: `http://localhost:3001/public/movie/index.html`

`ENV=dev`일 때 TypeORM `synchronize: true`로 스키마가 자동 반영됩니다. prod/migration은 [배포 문서](./docs/deployment.md)를 참고하세요.

---

## 9. 테스트

```bash
pnpm db:test:create    # .env.test 준비 후
pnpm test              # 단위
pnpm test:integration  # 통합 (--runInBand)
pnpm test:e2e          # E2E
```

상세 명령·시드 계정·E2E 시나리오: **[테스트 문서](./docs/testing.md)**

---

## 10. 배포

`main` 브랜치 push 시 GitHub Actions가 build → **migration:run** (RDS) → S3 → Elastic Beanstalk 배포합니다.

- 런타임: `node dist/main.js` (`Procfile`)
- prod: `synchronize: false`, RDS SSL

Secrets·RDS 초기화·배포 후 확인: **[배포 문서](./docs/deployment.md)**

---


