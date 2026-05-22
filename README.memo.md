## NestJS

다시한번 스스로 흐름도를 해 나가는 작업 메모 하면서


Node.js는 한마디로 말하면 브라우저 밖에서 JavaScript를 실행하게 해주는 런타임 환경

Node.js는 백엔드 프레임워크가 아니다.
Node.js는 JavaScript 실행 환경이다.
Express, NestJS 같은 프레임워크가 Node.js 위에서 동작한다.

---

여기서 port는 3001 로 변경 , 기존의 nestjs가 3000번 사용중

---
AppModule은 전체 앱을 조립하는 루트 모듈이고,
각 기능은 FeatureModule 단위로 분리된다.

각 FeatureModule은 보통 Controller와 Service를 가진다.
Controller는 요청을 받고,
Service는 실제 비즈니스 로직을 처리한다.


nest g resource 폴더명
module + controller + service + DTO 등 한 번에 생성

---
Controller는 요청의 입구 역할을 한다.
URL 경로와 HTTP Method를 기준으로 어떤 메서드를 실행할지 결정하고,
@Param, @Query, @Body를 통해 요청 데이터를 꺼낸 뒤 Service에 전달한다.

Controller는 비즈니스 로직을 직접 처리하지 않고,
실제 로직은 Service에게 위임한다.

---

Service = 실제 일하는 애
Provider = Nest IoC Container가 관리하는 애
@Injectable() = Provider로 등록해달라는 표시

---

DTO = 요청 데이터의 모양을 정의하는 클래스
ValidationPipe = DTO 규칙대로 실제 검증을 실행하는 장치
class-validator = @IsString(), @IsNotEmpty() 같은 검증 데코레이터 제공
Create DTO = POST 요청용
Update DTO = PATCH 요청용, @IsOptional() 중요

