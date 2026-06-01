# NESTJS-PROJECT-PIPELINE  — 영화·감독·장르 REST API (NestJS 포트폴리오)

## 한 줄 소개 

NestJS로 **영화·감독·장르 도메인 REST API**를 설계·구현하고, **TypeORM 관계 모델링·트랜잭션·JWT 인증·RBAC·URI 버저닝·커서 페이지네이션·파일 업로드·스케줄링·Winston 로깅·Swagger**까지 확장한 백엔드 포트폴리오 프로젝트입니다.

---

## 프로젝트 개요

| 항목 | 내용 |
| --- | --- |
| **목적** | 실무에 가까운 API 설계(인증/인가·데이터 무결성·트랜잭션·캐시·업로드)를 NestJS로 구현한 결과물을 포트폴리오로 정리 |
| **도메인** | 영화(Movie), 감독(Director), 장르(Genre), 사용자(User), 인증(Auth) |
| **DB** | PostgreSQL (Docker Compose), TypeORM `synchronize: true` (로컬 개발 편의) |
| **실행** | NestJS `3001`, PostgreSQL Docker `5556` |
| **API 버전** | URI 기반 `v1` (기본 버전) |
| **API 문서** | Swagger UI `http://localhost:3001/api` |

---

## 개발 스토리 (단계별)

### 1단계 — 기반 세팅 & 도메인 CRUD

- NestJS 프로젝트 구성, Hello World 제거, **Feature 모듈** 단위 분리 (`movie`, `director`, `genre`)
- **TypeORM** 연동, Entity 관계 설계
  - Movie ↔ MovieDetail (1:1)
  - Movie ↔ Genre (N:M)
  - Movie → Director (N:1)
- **ConfigModule + Joi**로 DB·JWT·`SALT_ROUNDS`(bcrypt cost) 환경변수 검증
- **Docker Compose**로 PostgreSQL 로컬 개발 환경 구성
- Director: `name + dob` **복합 Unique** (동명이인 허용, 동일 인물 중복 방지)
- Genre: 이름 중복 검증, **연결된 영화가 있으면 삭제 차단**
- Movie: 생성 시 `directorId`·`genreIds` 존재 검증, **QueryRunner 트랜잭션**으로 상세·관계 원자적 저장

### 2단계 — 검증·Pipe·데이터 품질

- 전역 **ValidationPipe** (`whitelist`, `forbidNonWhitelisted`, `transform`)
- `ParseIntPipe`, 커스텀 Pipe (`MovieTitleValidationPipe`)
- DTO + `class-validator` / `class-transformer` (`genreIds` `Type(Number)` 등)
- 감독 `dob`: `@IsDateString` → `@Type(() => Date)` + `@IsDate()`로 **transform과 검증 정합성** 맞춤

### 3단계 — 인증·인가 (Basic → JWT → Passport → RBAC)

- **User** 엔티티 (`email`, `password`, `Role`), bcrypt 해시 (`SALT_ROUNDS`)
- **Basic 인증** 기반 회원가입·로그인 → **access / refresh JWT** 발급
- 회원 생성은 **`UserService.create`** 한 곳에서 처리 (이메일 중복 검증 → 해시 → 저장)
- **Passport** Local·JWT Strategy, Bearer 토큰 검증 엔드포인트
- **전역 AuthGuard** + `@Public()` 데코레이터
- **BearerTokenMiddleware**: Authorization 헤더 파싱·검증 → `req.user` 주입 (login/register 제외)
- **RBAC**: `@RBAC(Role)` + `RBACGuard` — `user.role <= 요구 role` 계층 비교
- Movie/Genre/Director 엔드포인트별 **공개 조회 / 역할별 CUD** 분리

### 4단계 — 공통 인프라 & 목록 API 고도화

- **CommonService**: offset 페이지네이션 + **커서 기반 페이지네이션** (`nextCursor`, base64 인코딩)
- Movie 목록: QueryBuilder + `title` LIKE 필터 + **커서 페이지네이션** (`data`, `count`, `nextCursor`)
- **TransactionInterceptor**: QueryRunner 생명주기(시작/커밋/롤백/해제)를 인터셉터로 이전, 서비스는 `req.queryRunner` 사용
- **전역 예외 필터** (`ForbiddenExceptionFilter`, `QueryFailedException`)로 응답 포맷 통일
- (학습용) ResponseTime·Cache 인터셉터 예제

### 5단계 — 파일 업로드 (Multer + Custom Pipe)

- **2-step 업로드 플로우**로 분리
  - `POST /common/video` (multipart/form-data): **임시 업로드** → `public/temp`에 저장 후 `fileName` 배열 반환
  - `POST /movie` (JSON): `CreateMovieDto.files`로 **temp 파일 참조(fileName/경로)** 전달 → `public/movie/{movieId}`로 이동 저장 + `MovieFile` 메타데이터 DB 저장
- `MulterModule` + `diskStorage`로 temp 저장소를 고정 (`public/temp`)
- **MovieFilesPipe**: **1~3개** MP4 검증(용량·mimetype·개수) + UUID 기반 파일명
- 업로드 파일은 `/public` — **`.gitignore`로 저장소 제외**

### 6단계 — 인증 안정화 (캐시/블락/Rate limit)

- **토큰 블락(로그아웃)**: 블락 토큰을 캐시에 저장하고, 인증 파이프라인에서 블락 여부를 먼저 확인
  - raw 토큰을 키로 쓰지 않고 **SHA-256 해시 기반 키(`auth:block:{tokenHash}`)** 로 저장해 노출 위험을 줄임
- **Rate limiting**: 로그인 엔드포인트에 `@Throttle` 적용 + 전역 `ThrottlerGuard` 설정

### 7단계 — 스케줄링 & 로깅

- **@nestjs/schedule**: `ScheduleModule.forRoot()` + `TasksService` cron 작업
  - `deleteExpiredTempFiles`: **매일 자정**(`0 0 0 * * *`), 파일명 `{uuid}_{timestamp}`의 timestamp 기준 **24시간 초과** temp 파일 삭제
  - `calculateMovieLikeCount`: `movie_user_like` 집계로 `Movie.likeCount` / `dislikeCount` 동기화
- **Winston 로깅** (`winston`, `nest-winston`)
  - 전역: Console + `logs/error.log` (API 예외 등)
  - cron 전용: `tasks.logger.ts` → `logs/tasks.log` (Nest 기동 로그와 분리)
  - `main.ts`: `app.useLogger(WINSTON_MODULE_NEST_PROVIDER)`
- 로그 디렉터리 `logs/`는 **`.gitignore`로 저장소 제외**

### 8단계 — API 버저닝 & Swagger

- **URI 버저닝**: `enableVersioning({ type: URI, defaultVersion: '1' })` → 경로 prefix `/v1`
- **BearerTokenMiddleware exclude**: 버저닝 적용 후 `v1/auth/login`, `v1/auth/register` 경로로 수정 (Basic 로그인 시 Bearer 미들웨어 충돌 방지)
- **Swagger** (`@nestjs/swagger`, `nest-cli` 플러그인)
  - `GET /api` — Swagger UI (Basic Auth + Bearer Auth)
  - 컨트롤러 `@ApiBearerAuth`, 로그인/회원가입 `@ApiBasicAuth`
  - DTO `@ApiProperty`, `UpdateMovieDto`는 `@nestjs/swagger`의 `PartialType`으로 스키마 상속
- **쿼리/배열 DTO 보완**: `order`, `files` 등 단일 문자열 쿼리/바디 값을 `@Transform`으로 배열 정규화 (`order must be an array` 등 검증 오류 방지)

### 9단계 — User 도메인 정리 & 단위 테스트

- **`UserService.create`로 회원 생성 로직 통합**
  - `CreateUserDto` (`@IsEmail`, `@IsString`) — `email`, `password` 검증
  - 이메일 중복 시 `ConflictException`, bcrypt 해시 후 저장
  - `AuthService.register`는 Basic 토큰 파싱 후 **`userService.create` 위임** (중복 로직 제거)
  - `UserModule`에서 `UserService` export → `AuthModule` import
- **환경변수 rename**: `HASH_ROUNDS` → **`SALT_ROUNDS`** (bcrypt cost factor 용어에 맞춤)
- **User 모듈 단위 테스트** (`user.service.spec.ts`, `user.controller.spec.ts`)
  - `findAll` / `findOne` / `remove` / `create` — TypeORM repository·`ConfigService` mock
  - `pnpm test:user` — user 모듈 coverage 수집
  - `pnpm test:user:watch` — watch 모드
  - coverage 제외: `*.module.ts`, `*.dto.ts`, `*.entity.ts`

### 10단계 — 테스트 확장 (단위 · 통합 · E2E)

- **Movie**
  - `MovieService` / `MovieController` 단위 테스트 보강 (create·update·파일 이동·like 등)
  - **`movie.service.integration.spec.ts`** — PostgreSQL `movie_test` DB, QueryRunner·캐시·like 검증
  - **`test/movie.e2e-spec.ts`** — Supertest HTTP E2E
    - 공개 `GET` (목록·recent·단건), **미존재 id → 404** (`findOne` `NotFoundException`)
    - RBAC·JWT: `POST`·`PATCH`·`DELETE`·like/unlike (admin / paidUser / user)
    - **2-step 업로드**: `POST /v1/common/video` → `files` → `POST /v1/movie`
- **Common**
  - `CommonService` 커서·offset 페이지네이션 단위 테스트 (복합 cursor·`addOrderBy` 등)
  - `CommonController` · **`MovieFilesPipe`** · **`MovieTitleValidationPipe`** 단위 테스트
  - **`test/common.e2e-spec.ts`** — `POST /v1/common/video` (403·mimetype 400·업로드 성공)
- **Auth**
  - **`test/auth.e2e-spec.ts`** — register, login(성공/실패), `GET /v1/auth/private` (403·access/refresh)
- **Genre · Director**
  - **`genre.service.integration.spec.ts`** — 이름 중복, 수정 충돌, **연결 영화 있을 때 삭제 차단**
  - **`director.service.integration.spec.ts`** — `name + dob` 중복, 수정·삭제
- **E2E 공통 인프라** (`test/`)
  - `load-integration-env.ts` — `.env` + `.env.test` 로드, **`DB_DATABASE`는 `*_test` 필수**
  - `integration-db.helpers.ts` — 통합 테스트용 TypeORM·엔티티 공통 설정
  - `e2e-app.helpers.ts` — 버저닝·`ValidationPipe` 포함 Nest 앱 부트스트랩
  - `e2e-auth.helpers.ts` — 시드 유저(admin/paidUser/user), JWT 발급·Basic 헤더
  - `e2e-upload.helpers.ts` — temp video 업로드 헬퍼
  - `jest-e2e.json` · `uuid.mock.ts` — E2E·단위에서 uuid ESM 이슈 회피
- **수동 API 확인 페이지**: `public/movie/index.html` (`GET` / `POST` 조회용, `/public/movie/`)

---

## 기술 스택

| 분류 | 기술 |
| --- | --- |
| **런타임** | NestJS, TypeScript |
| **DB** | TypeORM, PostgreSQL |
| **검증·설정** | class-validator, class-transformer, @nestjs/config, Joi |
| **인증** | bcrypt, @nestjs/jwt, Passport (local, jwt) |
| **캐시·보안** | @nestjs/cache-manager, cache-manager, @nestjs/throttler |
| **스케줄·로깅** | @nestjs/schedule, winston, nest-winston |
| **문서** | @nestjs/swagger |
| **파일** | @nestjs/platform-express, multer, diskStorage |
| **인프라** | Docker Compose, pnpm |
| **테스트** | Jest, ts-jest, Supertest, @nestjs/testing |

---

## 환경 변수 (요약)

| 변수 | 설명 |
| --- | --- |
| `ENV` | `dev` \| `prod` |
| `DB_*` | PostgreSQL 연결 (`TYPE`, `HOST`, `PORT`, `USER`, `PASSWORD`, `DATABASE`) |
| `SALT_ROUNDS` | bcrypt password hashing cost (숫자) |
| `ACCESS_TOKEN_SECRET` | access JWT 서명 키 |
| `REFRESH_TOKEN_SECRET` | refresh JWT 서명 키 |

---

## 도메인 모델 (ER 요약)

- Movie ↔ MovieDetail (1:1)
- Movie ↔ Genre (N:M)
- Movie → Director (N:1)
- User (`email`, `password`, `role`)

### Role (숫자가 작을수록 높은 권한)

| 값 | 역할 |
| --- | --- |
| `0` | `admin` |
| `1` | `paidUser` |
| `2` | `user` (기본값) |

---

## 구현 기능 요약

### 도메인 API

| 영역 | 내용 |
| --- | --- |
| **Movie** | 커서 페이지네이션 목록·단건 조회(**없는 id → 404**), 트랜잭션 기반 생성·수정·삭제, MP4 다중 업로드(1~3), like/unlike |
| **Director** | CRUD, `name + dob` 중복 검증, RBAC (생성·삭제 admin, 수정 paidUser) |
| **Genre** | CRUD, 이름 중복·연결 영화 삭제 제한, 조회 Public |
| **User** | CRUD, `create` 시 이메일 중복·bcrypt 해시, password 응답 제외 (`ClassSerializerInterceptor`) |

### 인증·인가

| 영역 | 내용 |
| --- | --- |
| 회원가입 | `POST /v1/auth/register` (Basic) 또는 `POST /v1/user` (JSON) → **`UserService.create`** |
| 로그인 | Basic → JWT access·refresh |
| Passport | Local / JWT Strategy |
| Middleware | BearerTokenMiddleware → `req.user` |
| Guard | AuthGuard (`@Public`, access 토큰), RBACGuard (`@RBAC`) |
| 토큰 재발급 | refresh로 access 재발급 (`POST /auth/token/access`) |

### 공통·인프라

| 영역 | 내용 |
| --- | --- |
| 페이지네이션 | offset + **커서** (`CommonService`) |
| 트랜잭션 | `TransactionInterceptor` + QueryRunner |
| 예외 처리 | 전역 Forbidden / QueryFailed 필터 |
| 파일 업로드 | `MovieFilePipe`(단일), `MovieFilesPipe`(복수) |
| Cron | temp 만료 파일 삭제, 영화 like/dislike 집계 동기화 (`TasksService`, 매일 자정) |
| 로깅 | 전역 Console + `error.log` / cron 전용 `tasks.log` |
| API 버저닝 | URI `v1` (기본) |
| API 문서 | Swagger UI `/api` (Basic·Bearer) |

### 엔드포인트별 권한 (요약)

| 모듈 | 공개 (`@Public`) | RBAC |
| --- | --- | --- |
| Movie | `GET` 목록·단건 | `POST`·`DELETE` admin, `PATCH` paidUser |
| Genre | `GET` 목록·단건 | CUD 인증 필요 |
| Director | `GET` | `POST`·`DELETE` admin, `PATCH` paidUser |

---

## 아키텍처

```
AppModule
├── ConfigModule (전역, Joi — SALT_ROUNDS 등)
├── TypeOrmModule (async)
├── MovieModule / DirectorModule / GenreModule / UserModule / AuthModule / CommonModule
│   └── AuthModule → UserModule (UserService 재사용)
├── ScheduleModule.forRoot()
├── WinstonModule.forRoot (Console + logs/error.log)
├── APP_GUARD: ThrottlerGuard → AuthGuard → RBACGuard
├── APP_FILTER: Forbidden, QueryFailed
├── APP_INTERCEPTOR: ResponseTime (예제)
└── Middleware: BearerTokenMiddleware (*, v1/auth/login·register POST 제외)

main.ts
├── enableVersioning (URI, default v1)
├── SwaggerModule.setup('/api')
└── ValidationPipe (whitelist, transform)

CommonModule
└── TasksService → tasksLogger (logs/tasks.log)
    ├── @Cron deleteExpiredTempFiles — temp 24h 초과분 삭제 (매일 자정)
    └── @Cron calculateMovieLikeCount — likeCount/dislikeCount 집계 동기화

Movie POST (생성) — POST /v1/movie
├── TransactionInterceptor → req.queryRunner
├── CreateMovieDto.files (temp fileName/경로 배열)
└── MovieService.create(dto, files, qr)
    ├── temp 파일 존재 검증(stat)
    ├── public/movie/{movieId} 디렉토리 생성
    └── rename(이동) + MovieFile DB 저장

User POST (회원 생성) — 두 진입점, 동일 서비스
├── POST /v1/auth/register — AuthService.register → parseBasicToken → UserService.create
└── POST /v1/user — UserController.create → UserService.create
    ├── email 중복 검증
    ├── bcrypt.hash(password, SALT_ROUNDS)
    └── User 저장 후 findOne 반환
```

### 요청 처리 순서 (인증 필요 API)

1. **BearerTokenMiddleware** — JWT decode·verify → `req.user`
2. **AuthGuard** — `@Public` 아니면 access 토큰·user 필수
3. **RBACGuard** — `@RBAC` 있으면 role 비교
4. **Controller** — Interceptor / Pipe / Strategy

---

## 핵심 설계 포인트

- **레이어 분리**: Controller(HTTP) ↔ Service(비즈니스) ↔ Repository/QueryBuilder(DB)
- **회원 생성 단일화**: Auth·User 진입점이 달라도 **`UserService.create`** 한 곳에서 중복 검증·해시·저장 (DRY)
- **관계 무결성**: FK 존재 검증, N:M relation API, 삭제 시 연관 데이터 확인
- **트랜잭션 책임 분리**: 서비스 내부 try/catch → **인터셉터**에서 commit/rollback 일원화
- **인증 파이프라인**: Middleware(토큰 파싱/블락 확인) + Guard(접근 허용) + RBAC(역할)
- **페이지네이션 전략**: offset 학습 후 **커서 기반**으로 대용량·일관된 목록 조회 확장
- **업로드 파이프라인**: Multer(저장) + Custom Pipe(검증·파일명) — 단일/복수 Pipe 분리로 **유연한 개수** 대응
- **배치·유지보수**: cron으로 temp 정리·집계 컬럼 동기화 — API 요청과 분리된 **백그라운드 작업**
- **구조화 로깅**: 전역(콘솔·error)과 cron(tasks.log) 분리 — 파일 로그 범위를 운영 목적별로 구분
- **API 버저닝·문서화**: `/v1` prefix + Swagger로 인증 방식(Basic/Bearer)과 DTO를 클라이언트에 명시

---

## Swagger 사용 (요약)

| 항목 | 내용 |
| --- | --- |
| **URL** | `http://localhost:3001/api` |
| **회원가입·로그인** | Authorize → **Basic Auth** (email:password Base64) |
| **그 외 API** | Authorize → **Bearer** (access JWT) |
| **경로** | 모든 API는 `/v1/...` prefix (예: `GET /v1/movie`) |

Movie 목록 커서 페이지네이션 쿼리 예:

```http
GET /v1/movie?order=id_ASC&take=5
GET /v1/movie?order=id_ASC&order=createAt_DESC&take=5
```

---

## 트러블슈팅

| 문제 | 해결 |
| --- | --- |
| PostgreSQL 연결 실패 | Docker Compose, 포트·환경변수 매핑 |
| Entity metadata 오류 | `@Entity()` 및 TypeORM 등록 확인 |
| 영화 생성 시 관계 누락 | `directorId`, `genreIds` 사전 검증 |
| 장르·감독 중복·삭제 | Unique·relation 조회 후 삭제 차단 |
| 전역 AuthGuard + LocalAuthGuard 충돌 | `APP_GUARD`가 먼저 실행 → `@Public()` 또는 Guard 순서 조정 |
| access 재발급 실패 | refresh 토큰을 Authorization에 전달 |
| 감독 `dob` 검증 오류 | `@Type(() => Date)` + `@IsDate()` |
| 페이지네이션 미적용 | `qb`에 skip/take 후 **`getManyAndCount()`로 반환** (repository.find() 혼용 금지) |
| 파일 업로드 `undefined` | `fileFilter`에서 `callback(null, true)` — `false`는 거절 |
| `@UploadedFile` + `FilesInterceptor` | 복수는 **`@UploadedFiles()`** 와 필드명 `movies` 일치 |
| 파일 1개만 저장 | `MovieFilesPipe`가 `values[0]`만 rename → **전체 `map` 처리** |
| `file too large` | multer `limits.fileSize`가 pipe보다 먼저 적용 — 한도를 MB 단위로 맞춤 |
| `MovieFilesPipe` `join(value.destination, ...)` 실패 (`ERR_INVALID_ARG_TYPE`) | `FilesInterceptor`에 `storage: diskStorage(...)`를 명시하지 않으면 Multer가 memory storage를 써서 `destination/path`가 undefined가 될 수 있음. `FilesInterceptor('movies', 3, { storage })`로 diskStorage 연결 |
| Movie 생성 시 파일이 누락/경로가 제각각 | `POST /v1/movie`는 파일 자체가 아니라 `files`(temp ref)를 받도록 변경. `files`는 공백 제거·빈 값 제거 후 처리하고, ref가 상대/절대경로인지에 따라 `public/temp` 기준으로 해석 |
| `order must be an array` | 쿼리 `?order=id_ASC`는 문자열로 들어옴 → DTO `@Transform`으로 `['id_ASC']` 정규화. 복수는 `?order=a&order=b` |
| `property order[] should not exist` | `order[]` 키는 DTO 필드명과 불일치 → `?order=id_ASC` 또는 `?order=a&order=b` 사용 |
| 로그인 400 (토큰 포맷) + Basic 헤더 | URI 버저닝 후 middleware exclude가 `auth/login`만 있으면 `/v1/auth/login`에 Bearer 미들웨어가 Basic 헤더를 검사함 → exclude를 `v1/auth/login`으로 수정 |
| `combined.log` 과다 누적 | 전역 File transport가 Nest 기동 로그까지 기록 → `combined.log` 제거, cron은 `tasks.log`만 사용 |
| cron이 매시간 실행됨 | 6칸 cron `0 0 * * * *`는 매시 정각 → 매일 자정은 `0 0 0 * * *` |
| Authorization 헤더 `split` undefined | `@Authorization()` 데코레이터 사용 시 헤더 미전송 → `parseBasicToken`에서 400 처리 |
| 앱 기동 시 Config Joi 검증 실패 | `.env`에 `HASH_ROUNDS` 대신 **`SALT_ROUNDS`** 사용 (rename 반영) |
| 통합·E2E DB 오류 | `.env.test`의 `DB_DATABASE`가 `movie_test` 등 **`*_test` 접미사**인지 확인, `pnpm db:test:create` |
| 통합 테스트 간헐 실패 | 동일 DB TRUNCATE 충돌 → `pnpm test:integration`은 **`--runInBand`** 로 순차 실행 |
| E2E uuid ESM 오류 | Jest `moduleNameMapper`로 `test/uuid.mock.ts` 사용 (`package.json`·`test/jest-e2e.json`) |
| E2E login 429 | login 엔드포인트 `@Throttle`(분당 5회) — E2E는 JWT 직접 발급, login은 auth 스펙에서만 제한적으로 호출 |

---

## Auth API 요약

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/v1/auth/register` | Basic | 회원가입 → `UserService.create` |
| POST | `/v1/auth/login` | Basic | 로그인, JWT 발급 |
| POST | `/v1/auth/login/passport` | Local | Passport 로그인 |
| GET | `/v1/auth/private` | Bearer access | JWT payload 확인 |
| POST | `/v1/auth/token/access` | Bearer refresh | access 재발급 |
| POST | `/v1/auth/token/block` | — | 토큰 블락(로그아웃) |

---

## User API 요약

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/v1/user` | Bearer | 회원 생성 (`CreateUserDto`: email, password) |
| GET | `/v1/user` | Bearer | 전체 사용자 목록 |
| GET | `/v1/user/:id` | Bearer | 사용자 단건 조회 |
| PATCH | `/v1/user/:id` | Bearer | 사용자 수정 |
| DELETE | `/v1/user/:id` | Bearer | 사용자 삭제 |

---

## 테스트

### 사전 준비 (통합 · E2E)

1. PostgreSQL 실행 (Docker Compose 등)
2. `.env.test.example` → **`.env.test`** 복사 후 `DB_DATABASE=movie_test` 설정 (`*_test` 접미사 필수)
3. 테스트 DB 생성: `pnpm db:test:create`

통합·E2E는 `test/load-integration-env.ts`가 `.env`를 읽은 뒤 `.env.test`로 덮어씁니다. **개발 DB와 분리**해서 사용하세요.

### 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm test` | 전체 단위 테스트 (`src/**/*.spec.ts`, integration·e2e 제외) |
| `pnpm test:cov` | 전체 coverage |
| `pnpm test:integration` | 통합 테스트 (`*.integration.spec.ts`, **`--runInBand`**) |
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

### 테스트 구조 (요약)

| 구분 | 위치 | 내용 |
| --- | --- | --- |
| **단위** | `src/**/*.spec.ts` | Service·Controller·Pipe mock 테스트 |
| **통합** | `src/**/*.integration.spec.ts` | 실 DB (Movie, Genre, Director) |
| **E2E** | `test/*.e2e-spec.ts` | HTTP Supertest (`AppModule` 전체) |
| **헬퍼** | `test/*-helpers.ts`, `test/load-integration-env.ts` | DB·앱·인증·업로드 공통 설정 |

### E2E 시나리오 (요약)

| 스펙 | 검증 |
| --- | --- |
| `movie.e2e-spec.ts` | 목록·recent·단건(404), RBAC CUD, like, 2-step 업로드, 로그인 스모크 |
| `common.e2e-spec.ts` | `POST /v1/common/video` — 403, 잘못된 mimetype 400, mp4 업로드 |
| `auth.e2e-spec.ts` | register, login 401/성공, private 403·access/refresh |
| `app.e2e-spec.ts` | `GET /v1/movie` 공개 조회 스모크 |

### 통합 테스트 시드·권한 (E2E)

E2E 인증 테스트용 계정 (`test/e2e-auth.helpers.ts`, 비밀번호 `E2eTest1!`):

| 이메일 | Role |
| --- | --- |
| `e2e-admin@test.com` | admin (`0`) |
| `e2e-paid@test.com` | paidUser (`1`) |
| `e2e-user@test.com` | user (`2`) |

JWT는 대부분 `AuthService.issueToken`으로 발급합니다 (login `@Throttle` 회피). login HTTP 검증은 `auth.e2e-spec.ts`에서 별도 수행합니다.

### 브라우저 수동 확인

서버 기동 후: **`http://localhost:3001/public/movie/index.html`**

- Movie `GET` 목록·recent·단건
- Bearer 토큰 입력 시 인증 API 호출 가능

---


## 개발 메모·향후 개선

- `.env`의 `HASH_ROUNDS` → **`SALT_ROUNDS`** 로 마이그레이션 (기존 키 사용 시 Joi 검증 실패)
- 배포 시 TypeORM **Migration** 전환, `synchronize: false`
- 업로드 파일: 로컬 `public/` → S3 등 오브젝트 스토리지
- Swagger: DTO·응답 스키마 보강, 환경별 서버 URL 설정
- 로그: `tasks.log` / `error.log` 로테이션·보관 정책
- CI: `pnpm test` · `pnpm test:integration` · `pnpm test:e2e` + test DB 파이프라인
- 테스트: `MovieFilePipe` 단위, `tasks.service` cron, Genre/Director E2E (선택)
