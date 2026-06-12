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

## Supabase 무료 한도 초과와 프로젝트 이전

문제:

Supabase 무료 사용량, 특히 Egress 사용량이 증가하면서 기존 프로젝트를
계속 사용하기 어려운 상황이 발생했습니다. 새 Supabase 프로젝트로
이전하려고 했지만, 저장소의 migration이 실제 운영 중인 테이블 구조를
완전히 반영하지 못하고 있었습니다.

증상:

- 새 프로젝트에 migration을 실행해도 필요한 테이블이나 컬럼이 누락됨
- `destinations`, `trip_plans`, `user_agreements` 등 현재 코드가 기대하는
  구조와 DB 구조가 어긋남
- RLS policy, grant, Auth trigger, Storage bucket 설정을 따로 다시 확인해야 함
- OAuth 로그인 과정에서 신규 사용자 저장 trigger가 실패함

대응:

초기에는 필요한 테이블과 정책을 Supabase SQL Editor에서 수기로 옮기며
프로젝트를 복구했습니다. 이후 현재 코드가 실제로 사용하는 스키마를
기준으로 기준 migration을 다시 작성하고, DB 문서와 ERD도 함께 최신화했습니다.

교훈:

Supabase처럼 관리형 DB를 사용하더라도, 실제 운영 스키마와 저장소의
migration이 어긋나면 프로젝트 이전이나 복구 시 비용이 크게 증가합니다.
테이블을 임시로 만들거나 SQL Editor에서 직접 수정한 경우에도, 작업이
끝난 뒤 반드시 migration과 DB 문서를 함께 갱신해야 합니다.

향후 개선:

- DB 변경은 SQL Editor에서 끝내지 않고 migration 파일로 남김
- 배포 전 새 프로젝트에 migration을 처음부터 실행해보는 검증 절차 추가
- RLS policy, grant, trigger, Storage bucket까지 migration에 포함
- TourAPI 데이터처럼 다시 적재 가능한 데이터와 사용자 데이터처럼
  보존해야 하는 데이터를 분리해 백업 전략 수립
