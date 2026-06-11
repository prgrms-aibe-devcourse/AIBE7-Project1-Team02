# 트러블 슈팅

## `EADDRINUSE: address already in use :::3000`

원인: 3000 포트를 사용하는 기존 Node 프로세스가 실행 중입니다.

```bash
lsof -i :3000
kill <PID>
npm start
```

## CSS 404

정적 파일은 `public`이 루트로 제공됩니다.

- `public/index.html`: `./styles/main.css`
- `public/pages/*.html`: `../styles/main.css`
- 공통 컴포넌트 요청: `/components/header.html`

`/public/styles/...`와 `/styles/...`가 혼용되지 않았는지 확인합니다.

## 추천 조회 401 또는 502

401:

- Supabase Access Token 만료
- 공개 조회인데 `mbtiType` 누락

502:

- `destination_mbti_scores` 권한 누락
- Supabase URL·Anon Key 오류
- 추천 테이블 또는 관계 조회 실패

`destinations`, `destination_keywords`, `destination_mbti_scores`의
`anon`, `authenticated` 읽기 권한과 RLS 정책을 확인합니다.

## 북마크 `permission denied`

로그인 사용자의 북마크는 Service Role Key 없이 동작해야 합니다.

- `authenticated`에 select·insert·delete grant
- `auth.uid() = user_id` RLS
- `user_id + destination_id` UNIQUE

Service Role Key를 브라우저에 넣어 해결하지 않습니다.

## 일정 저장 RLS 오류

오류 예시:

```text
new row violates row-level security policy for table trip_plans
```

확인 항목:

- 요청에 사용자 Access Token 포함
- insert row의 `user_id`가 `auth.uid()`와 일치
- `trip_plans`, `trip_plan_items`, `trips`의 authenticated grant
- own-row select·insert·update·delete 정책

## 일정 생성 관광지 데이터 없음

원인:

- 선택 지역 데이터 없음
- 이미지 있는 관광지가 없음
- 여행 일수보다 후보 관광지가 적음
- 키워드 필터 결과 부족

`destinations.image_url`, `province`, 좌표와 키워드 연결 상태를
확인합니다.

## Gemini quota 초과

Gemini 요청이 실패하면 서버는 규칙 기반 fallback 일정으로 전환합니다.
다만 현재 `/api/travel/plan` 시작 시 `GEMINI_API_KEY` 존재 여부를
검사하므로 키 자체는 등록되어 있어야 합니다.

## TourAPI 적재가 저장되지 않음

저장은 페이지 단위 검증과 상세 설명 조회가 끝난 뒤 일괄 실행됩니다.
주소, 이미지, 좌표, 설명이 없는 행은 제외됩니다.

429 오류는 일일 호출량 초과이며 같은 날 즉시 재실행해도 계속 실패할 수
있습니다. 지역과 페이지 수를 줄여 실행합니다.

```bash
TOUR_API_REGIONS=서울특별시 TOUR_API_MAX_PAGES=1 npm run import:tour
```

## OAuth `Database error saving new user`

Supabase Auth의 신규 사용자 trigger가 실패한 경우입니다.

- `public.users` 필수 컬럼 기본값
- Auth trigger 함수
- Security Definer와 search path
- Google·Kakao provider redirect URL

을 확인합니다.

## Google·Kakao 배포 로그인 실패

세 곳의 URL을 모두 맞춥니다.

1. Supabase Auth URL Configuration
2. Google 또는 Kakao 개발자 콘솔
3. Render 실제 도메인

콜백은 보통 다음 형식입니다.

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

애플리케이션 redirect URL에는 Render의
`https://<service>.onrender.com/pages/login.html`을 허용합니다.

## `permission denied for table user_agreements`

`authenticated`의 select·insert 권한과 자신의 `user_id`만 접근하는 RLS가
필요합니다. 이미 같은 이름의 policy가 있다면 새로 생성하지 말고
`drop policy if exists` 후 재생성합니다.

## 데이터 초기화 또는 회원 탈퇴 실패

두 API는 관리자 권한으로 여러 사용자 테이블을 순서대로 삭제합니다.
Render에 다음 값이 필요합니다.

```env
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

회원 탈퇴는 마지막에 `auth.admin.deleteUser()`를 호출합니다. 키는 서버
환경 변수에만 등록하고 프런트엔드로 전달하지 않습니다.

## Supabase 무료 Egress 증가

- 필터 옵션 조회에서 관광지 전체 행을 가져오지 않음
- 목록은 12개 단위 페이지네이션
- 필요한 컬럼만 select
- 이미지 URL과 파일 크기 최적화
- 같은 추천 요청 캐싱 검토
- 데이터 적재 스크립트와 사용자 조회 트래픽 분리
