# 페이지 명세

## 공통 레이아웃

- `public/components/header.html`
- `public/components/sidebar.html`
- `public/scripts/layout.js`

각 페이지는 공통 헤더와 사이드바를 동적으로 불러옵니다. 로그인
사용자는 여행가 칭호, 이름, 프로필 이미지를 표시하고 비로그인 사용자는
로그인 버튼을 표시합니다.

브라우저 기본 `alert`, `confirm` 대신 `PackingUI` 모달을 사용합니다.
단, 일부 레거시 입력 검증에는 기본 `alert`가 남아 있어 향후 통일이
필요합니다.

## 접근 정책

| 페이지 | 비로그인 | 로그인 |
| --- | --- | --- |
| 메인 추천 | 전체 탐색으로 이동 | MBTI TOP 10 |
| 여행지 전체 탐색 | INFP 공개 추천 | 내 MBTI 추천 |
| 로그인·회원가입 | 접근 가능 | 접근 가능 |
| 성향 분석 | 로그인으로 이동 | 접근 가능 |
| 여행 일정 생성 | 로그인으로 이동 | 접근 가능 |
| 여행 일정 확인 | 로그인으로 이동 | 접근 가능 |
| 마이페이지 | 로그인으로 이동 | 접근 가능 |
| 커뮤니티 | 로그인 필요 기능 | 접근 가능 |

## 01 메인 추천

파일:

- `public/index.html`
- `public/scripts/app.js`
- `public/styles/main.css`

목적:

로그인 사용자의 여행 MBTI에 적합한 관광지 TOP 10을 큰 카드 슬라이드로
보여줍니다.

주요 기능:

- 추천 카드 이전·다음 전환
- 연속 클릭 방지를 위한 430ms 버튼 잠금
- 여행가 칭호 배지
- 여행지 이미지·지역·설명·키워드
- 상세정보 모달
- 북마크 추가·해제
- 선택 관광지를 포함한 일정 생성 페이지 이동
- 여행지 더 찾아보기 이동

비로그인 사용자는 `/pages/destinations.html`로 이동합니다. 성향 결과가
없으면 설문 이동 안내를 표시합니다.

사용 API:

- `GET /api/destinations/recommended?limit=10`
- `GET|POST|DELETE /api/user/bookmarks`

## 02 여행지 더 찾아보기

파일:

- `public/pages/destinations.html`
- `public/scripts/destinations.js`
- `public/styles/destinations.css`

목적:

추천 점수와 순위를 직접 노출하지 않고 관광지 전체를 페이지 단위로
탐색합니다.

주요 기능:

- 12개 단위 페이지네이션
- 지역 복수 선택 모달
- 키워드 복수 선택 모달
- 검색 버튼을 눌렀을 때 필터 적용
- 필터 초기화
- 관광지 상세 모달
- 로그인 사용자의 북마크
- 일정 생성 이동

비로그인 사용자는 INFP 공개 추천 기준을 사용하고 TOP 10 돌아가기
버튼과 로그인 전용 문구를 숨깁니다.

사용 API:

- `GET /api/destinations/recommended`
- `GET /api/destinations/recommended/filters`
- `GET|POST|DELETE /api/user/bookmarks`

## 03 로그인과 회원가입

파일:

- `public/pages/login.html`
- `public/scripts/login.js`
- `public/styles/auth.css`

인증 방식:

- 이메일·비밀번호
- Google OAuth
- Kakao OAuth (`custom:kakao`)

회원가입:

- 이메일, 비밀번호, 닉네임 입력
- 이용약관·개인정보 처리방침 필수 체크
- 각 정책의 보기 모달
- 가입 완료 후 성향 분석 페이지 이동

소셜 로그인:

1. Supabase OAuth 완료
2. 약관 동의 이력 확인
3. 미동의 사용자는 필수 동의 모달 표시
4. `profile_completed=false`이면 프로필 설정 모달 표시
5. 한 번 완료한 프로필 설정은 다음 로그인부터 생략
6. 원래 요청한 페이지 또는 메인으로 이동

직접 사용하는 Supabase 기능:

- Auth REST API
- `user_agreements`
- `users`
- `avatars` Storage Bucket

## 04 여행 성향 분석

파일:

- `public/pages/survey.html`
- `public/scripts/survey.js`
- `public/styles/survey.css`

구성:

- 총 12문항
- MBTI 4축별 3문항
- 5점 리커트 척도
- 이전·다음 이동과 진행률
- 결과 칭호와 4개 양방향 점수 바
- 양방향 점수 바는 중앙을 기준으로 우세도에 비례해 길이를 구분

축 표현:

- E/I: 활동 vs 휴식
- S/N: 전통 vs 탐험
- T/F: 효율 vs 감성
- J/P: 계획 vs 즉흥

저장:

- `travel_mbti_results` upsert
- `user_preferences`의 `mbti_type`, `badge` upsert

결과 확인 후 메인 추천으로 이동합니다.

## 05 여행 일정 생성

파일:

- `public/pages/trip-create.html`
- `public/scripts/trip-create.js`
- `public/styles/trip-create.css`

입력:

- 시작일과 종료일
- 지역 17개 중 하나
- 동행 유형: 혼자, 연인, 친구, 가족
- 선택 키워드 0~3개
- 추천 화면에서 전달된 특정 관광지

검증:

- 종료일은 시작일보다 빠를 수 없음
- 최대 7일
- 지역과 동행 유형 필수
- 키워드는 선택 사항
- 4번째 키워드는 선택되지 않음

생성 결과:

- 입력 화면에서 결과 화면으로 전환
- DAY별 대표 이미지 카드
- DAY 카드 클릭 시 상세 모달
- 왼쪽 관광지 목록, 오른쪽 Kakao 지도
- 관광지 클릭 시 상세정보 확장과 지도 중심 이동
- 생성 일정 저장

일정 생성 로직:

- 이미지가 있는 실제 DB 관광지만 후보로 사용
- 키워드 별칭을 DB 키워드와 매칭
- 특정 관광지는 우선 포함
- 중복 관광지 제거
- 하루 최대 3개
- 좌표 기반 근거리 그룹화
- Gemini 실패 시 fallback 사용

사용 API:

- `POST /api/travel/plan`
- `GET /api/config`

## 06 여행 일정 확인

파일:

- `public/pages/saved-trips.html`
- `public/scripts/saved-trips.js`
- `public/styles/saved-trips.css`

상태 탭:

- 시작 전 (`planning`)
- 진행 중 (`in_progress`)
- 완료 (`completed`)

주요 기능:

- 상태별 일정 카드
- 일정 상세 모달
- 시작 전 일정의 여행 시작하기
- DAY별 큰 버튼과 상세 모달
- 관광지 이미지·이름·설명
- Kakao 지도와 관광지 마커
- 관광지별 여행 완료 표시
- 모든 관광지 완료 시 일정 상태 완료 처리
- 일정 삭제 확인 모달과 DB 삭제

관광지별 완료 여부는 현재 브라우저 저장소를 함께 사용하며, 일정 전체
상태는 `trip_plans.status`에 저장합니다.

사용 API:

- `GET /api/travel/list`
- `GET /api/travel/:planId`
- `PATCH /api/travel/:planId/status`
- `DELETE /api/travel/:planId`

## 07 마이페이지

파일:

- `public/pages/mypage.html`
- `public/scripts/mypage.js`
- `public/styles/mypage.css`

주요 기능:

- 프로필과 여행가 칭호
- 닉네임·프로필 이미지 수정
- 저장한 관광지 스크롤 목록
- 관광지 카드 클릭 상세 모달
- 최근 완료한 여행 최대 3개
- 비밀번호 변경
- 이용약관·개인정보 처리방침 모달
- 사용자 활동 데이터 초기화
- 회원 탈퇴

데이터 초기화는 프로필과 약관 동의를 유지합니다. 회원 탈퇴는 활동
데이터, 약관 동의, Auth 계정을 삭제합니다.

사용 API:

- `GET /api/user/bookmarks`
- `GET /api/travel/list`
- `DELETE /api/user/data`
- `DELETE /api/user/account`

## 08 커뮤니티

파일:

- `public/pages/community.html`
- `public/scripts/community.js`
- `public/styles/community.css`

주요 기능:

- 커뮤니티 피드 조회
- 게시글 작성·수정·삭제
- 이미지 업로드
- 댓글
- 게시글 및 댓글 좋아요
- 공유 URL 생성
- 인기 태그
- 작성자 여행가 칭호

현재 커뮤니티는 브라우저에서 Supabase REST·Storage 요청을 직접
사용합니다. 테이블과 Storage 정책이 올바르게 설정되어야 합니다.

사용 DB:

- `community_posts`
- `community_comments`
- `community_likes`
- `community_comment_likes`
- `community_shares`
- `community_feed`
- `community_tags_popular`

## 공통 빈 상태와 오류 처리

- 이미지가 없거나 로드에 실패하면 `이미지 없음` 표시
- 일정이 없으면 새 여행 만들기 버튼 제공
- API 오류는 Packing 안내 모달 또는 페이지 상태 영역에 표시
- 인증이 만료되면 세션을 정리하고 로그인 페이지로 이동
