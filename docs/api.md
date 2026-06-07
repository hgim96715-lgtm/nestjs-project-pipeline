# API 요약

모든 API는 URI 버저닝 **`/v1`** prefix를 사용합니다. 상세 스키마는 Swagger UI **`/api`**에서 확인하세요.

---

## Swagger

| 항목 | 내용 |
| --- | --- |
| **URL (로컬)** | `http://localhost:3001/api` |
| **URL (배포)** | `http://{EB-환경-URL}/api` |
| **회원가입** | **Authorize → Basic Auth** (Username=이메일, Password=비밀번호) → `POST /v1/auth/register` Execute (body 비움) |
| **로그인** | Basic Auth 동일 → `POST /v1/auth/login` → 응답 `accessToken` 복사 |
| **인증 API** | **Authorize → Bearer** → `accessToken` 붙여넣기 (접두어 `Bearer ` 제외) |
| **access 만료** | 약 **5분** — 재로그인 또는 `POST /v1/auth/token/access` (refresh Bearer) |

---

## 도메인 API

| 영역 | 내용 |
| --- | --- |
| **Movie** | 커서 페이지네이션 목록·단건 조회(**없는 id → 404**), `prisma.$transaction` 기반 생성·수정·삭제, MP4 다중 업로드(1~3), like/unlike (likeCount 즉시 반영) |
| **Director** | CRUD, `name + dob` 중복 검증, RBAC (생성·삭제 admin, 수정 paidUser) |
| **Genre** | CRUD, 이름 중복·연결 영화 삭제 제한, 조회 Public |
| **User** | CRUD, `create` 시 이메일 중복·bcrypt 해시, password 응답 제외 (`ClassSerializerInterceptor`) |

### 엔드포인트별 권한

| 모듈 | 공개 (`@Public`) | RBAC |
| --- | --- | --- |
| Movie | `GET` 목록·단건 | `POST`·`DELETE` admin, `PATCH` paidUser |
| Genre | `GET` 목록·단건 | CUD 인증 필요 |
| Director | `GET` | `POST`·`DELETE` admin, `PATCH` paidUser |

---

## Auth API

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/v1/auth/register` | Basic | 회원가입 → `UserService.create` |
| POST | `/v1/auth/login` | Basic | 로그인, JWT 발급 |
| POST | `/v1/auth/login/passport` | Local | Passport 로그인 |
| GET | `/v1/auth/private` | Bearer access | JWT payload 확인 |
| POST | `/v1/auth/token/access` | Bearer refresh | access 재발급 |
| POST | `/v1/auth/token/block` | — | 토큰 블락(로그아웃) |

---

## User API

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/v1/user` | Bearer | 회원 생성 (`CreateUserDto`: email, password) |
| GET | `/v1/user` | Bearer | 전체 사용자 목록 |
| GET | `/v1/user/:id` | Bearer | 사용자 단건 조회 |
| PATCH | `/v1/user/:id` | Bearer | 사용자 수정 |
| DELETE | `/v1/user/:id` | Bearer | 사용자 삭제 |

---

## 공통·인프라 API

| 영역 | 내용 |
| --- | --- |
| 페이지네이션 | offset + **커서** (`parseCursorPagination` / `buildPrismaCursorWhere`) |
| 트랜잭션 | Movie·좋아요 — `prisma.$transaction` · Chat — `WsTransactionInterceptor` |
| 파일 업로드 | `POST /v1/common/video` — temp 업로드 후 `POST /v1/movie`에서 `files` 참조 |
| Cron | temp 만료 파일 삭제, 영화 like/dislike 집계 동기화 |

---

## Movie 목록 — 커서 페이지네이션 예시

```http
GET /v1/movie?order=id_ASC&take=5
GET /v1/movie?order=id_ASC&order=createAt_DESC&take=5
```

2-step 영화 생성:

1. `POST /v1/common/video` (multipart) → `fileName` 배열
2. `POST /v1/movie` (JSON) — `files`에 temp 참조 전달
