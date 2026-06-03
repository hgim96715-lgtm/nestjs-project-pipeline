# 트러블슈팅

개발·테스트·배포 중 자주 마주친 문제와 해결 방법입니다.

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
| CI `npm run build` TS 오류 | deploy 워크플로에서 `ncu -u` 등 **의존성 자동 업그레이드 금지** — lock/install 재현 가능하게 유지 |
| CI `Missing script: typeorm` | `npm run migration:run` 사용 (`package.json` scripts) |
| CI migration `DB_TYPE undefined` | GitHub Secrets에 `DB_*` 설정, job `env`로 주입 |
| CI/RDS `no encryption` | RDS는 **SSL 필수** — `data-source.ts` 원격 host SSL, `app.module` prod SSL |
| migration `already exists` | `synchronize`로 만든 테이블 + 빈 `migrations` → **빈 RDS**면 DROP SCHEMA 후 `migration:run` |
| S3 deploy `AccessDenied` | IAM user에 `s3:PutObject`(버킷 ARN), EB API 권한 — placeholder 버킷명 아닌 **실제 버킷명** |
| Swagger register `authorization required` | Try it out **전에** Authorize → **Basic** (이메일/비밀번호). body JSON 아님 |
