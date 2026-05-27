# practice-nestjs — 영화·감독·장르 REST API (NestJS 학습·포트폴리오)

## 한 줄 소개 

NestJS로 **영화·감독·장르 도메인 REST API**를 설계·구현하고, **TypeORM 관계 모델링·트랜잭션·JWT 인증·RBAC·커서 페이지네이션·멀티파트 파일 업로드**까지 단계적으로 확장한 백엔드 학습 프로젝트입니다.

---

## 프로젝트 개요

| 항목 | 내용 |
| --- | --- |
| **목적** | NestJS 핵심 개념(Module/DI/Guard/Pipe/Interceptor)과 실무에 가까운 API 설계·인증·데이터 무결성을 코드로 익히기 |
| **도메인** | 영화(Movie), 감독(Director), 장르(Genre), 사용자(User), 인증(Auth) |
| **DB** | PostgreSQL (Docker Compose), TypeORM `synchronize: true` (학습 단계) |
| **실행** | NestJS `3001`, PostgreSQL Docker `5556` |

---

## 개발 스토리 (단계별)

### 1단계 — 기반 세팅 & 도메인 CRUD

- NestJS 프로젝트 구성, Hello World 제거, **Feature 모듈** 단위 분리 (`movie`, `director`, `genre`)
- **TypeORM** 연동, Entity 관계 설계
  - Movie ↔ MovieDetail (1:1)
  - Movie ↔ Genre (N:M)
  - Movie → Director (N:1)
- **ConfigModule + Joi**로 DB·JWT·bcrypt 환경변수 검증
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

- **User** 엔티티 (`email`, `password`, `Role`), bcrypt 해시
- **Basic 인증** 기반 회원가입·로그인 → **access / refresh JWT** 발급
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

- 영화 생성 API에 **multipart/form-data** 업로드 도입 (`MulterModule`, `diskStorage`)
- **MovieFilePipe**: 단일 MP4 — 용량·mimetype 검증, **UUID 파일명**으로 `rename`
- **MovieFilesPipe**: **1~3개** MP4 유연 업로드 (`FilesInterceptor` + `@UploadedFiles`)
  - 검증은 전 파일, 저장·rename은 **각 파일마다** `map` + `Promise.all`
- 업로드 파일은 `/public` — **`.gitignore`로 저장소 제외**

---

## 기술 스택

| 분류 | 기술 |
| --- | --- |
| **런타임** | NestJS, TypeScript |
| **DB** | TypeORM, PostgreSQL |
| **검증·설정** | class-validator, class-transformer, @nestjs/config, Joi |
| **인증** | bcrypt, @nestjs/jwt, Passport (local, jwt) |
| **파일** | @nestjs/platform-express, multer, diskStorage |
| **인프라** | Docker Compose, pnpm |

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
| **Movie** | 커서 페이지네이션 목록·단건 조회, 트랜잭션 기반 생성·수정·삭제, MP4 다중 업로드(1~3) |
| **Director** | CRUD, `name + dob` 중복 검증, RBAC (생성·삭제 admin, 수정 paidUser) |
| **Genre** | CRUD, 이름 중복·연결 영화 삭제 제한, 조회 Public |
| **User** | CRUD, password 응답 제외 (`ClassSerializerInterceptor`) |

### 인증·인가

| 영역 | 내용 |
| --- | --- |
| 회원가입·로그인 | Basic → JWT access·refresh |
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
├── ConfigModule (전역, Joi)
├── TypeOrmModule (async)
├── MovieModule / DirectorModule / GenreModule / UserModule / AuthModule / CommonModule
├── APP_GUARD: AuthGuard → RBACGuard
├── APP_FILTER: Forbidden, QueryFailed
├── APP_INTERCEPTOR: ResponseTime (예제)
└── Middleware: BearerTokenMiddleware (*, auth/login·register POST 제외)

Movie POST (생성)
├── TransactionInterceptor → req.queryRunner
├── FilesInterceptor('movies', max 3)
└── MovieFilesPipe → 검증·UUID rename → MovieService.create(dto, qr)
```

### 요청 처리 순서 (인증 필요 API)

1. **BearerTokenMiddleware** — JWT decode·verify → `req.user`
2. **AuthGuard** — `@Public` 아니면 access 토큰·user 필수
3. **RBACGuard** — `@RBAC` 있으면 role 비교
4. **Controller** — Interceptor / Pipe / Strategy

---

## 핵심 학습·설계 포인트

- **레이어 분리**: Controller(HTTP) ↔ Service(비즈니스) ↔ Repository/QueryBuilder(DB)
- **관계 무결성**: FK 존재 검증, N:M relation API, 삭제 시 연관 데이터 확인
- **트랜잭션 책임 분리**: 서비스 내부 try/catch → **인터셉터**에서 commit/rollback 일원화
- **인증 파이프라인**: Middleware(토큰 파싱) + Guard(접근 허용) + RBAC(역할)
- **페이지네이션 전략**: offset 학습 후 **커서 기반**으로 대용량·일관된 목록 조회 확장
- **업로드 파이프라인**: Multer(저장) + Custom Pipe(검증·파일명) — 단일/복수 Pipe 분리로 **유연한 개수** 대응

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

---

## Auth API 요약

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/auth/register` | Basic | 회원가입 |
| POST | `/auth/login` | Basic | 로그인, JWT 발급 |
| POST | `/auth/login/passport` | Local | Passport 로그인 |
| GET | `/auth/private` | Bearer access | JWT payload 확인 |
| POST | `/auth/token/access` | Bearer refresh | access 재발급 |


---

## 개발 메모·향후 개선

- 배포 시 TypeORM **Migration** 전환, `synchronize: false`
- 업로드 파일: 로컬 `public/` → S3 등 오브젝트 스토리지
- 회원가입 기본 `role: user`, 영화–업로드 파일 메타데이터 DB 연동
- Rate limiting, API 문서(Swagger) 추가 검토
