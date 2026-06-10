# Page Specification

## 01 Main Hub Page

### 목적

게스트는 국내 여행지 탐색으로 진입하고, 로그인 사용자는 여행 MBTI에
맞는 국내 여행지 TOP 10을 우선 추천받는 메인 허브 페이지.

### 화면 구성

- Sidebar
- Top Navbar
- MBTI 추천 여행지 TOP 10 슬라이더
- 여행지 상세정보 모달
- 여행지 더 찾아보기 버튼
- 북마크 버튼
- Quick Menu

### 주요 컴포넌트

- Sidebar
- SearchBar
- MbtiRecommendationSlider
- DestinationDetailModal
- QuickMenuCard
- PrimaryButton

### 사용자 액션

- Sidebar 여행 일정 클릭 → 내 여행 일정 페이지 이동
- 여행 일정 만들기 클릭 → 일정 생성 페이지 이동
- 추천 여행지 카드 클릭 → 해당 여행지 상세정보 모달 표시
- 북마크 클릭 → 로그인 사용자의 여행지 북마크 저장 또는 해제
- 이전/다음 또는 슬라이드 위치 선택 → TOP 10 추천을 한 장씩 확인
- 여행지 더 찾아보기 클릭 → 전체 추천 여행지 탐색 페이지 이동
- 로그아웃 상태에서 탐색하기 클릭 또는 메인 진입 → 여행지 더 찾아보기 페이지 이동
- 비로그인 상태에서 사용자 정보가 필요한 메뉴 클릭 → 로그인 페이지 이동
- 상세정보 하단의 단일 일정 만들기 버튼 클릭 → 선택 여행지를 저장하고 일정 생성 페이지 이동
- 성향 다시 분석 클릭 → 여행 MBTI 설문 페이지 이동
- 내 일정 확인 클릭 → 일정 확인 페이지 이동
- 마이페이지 클릭 → 마이페이지 이동

### 사용 API

- `GET /api/destinations/recommended`
- `GET /api/travel/list`

### 사용 DB

- `users`
- `travel_mbti_results`
- `destinations`
- `destination_keywords`
- `destination_mbti_scores`
- `trips`

### MVP 여부

포함

### 구현 메모

- 알림 기능은 MVP에서 제외 가능
- 커뮤니티 링크는 UI만 두고 실제 기능은 2차 구현 가능
- 로그인 사용자의 `travel_mbti_results.mbti_type`을 조회한다.
- 사용자 화면에는 `mbti_type` 코드 대신 여행가 칭호를 뱃지 형태로 우선 표시한다.
- 공통 헤더는 로그인 사용자 이름 위에 여행가 칭호 뱃지를 표시한다.
- 공통 헤더는 비로그인 상태에서 기본 유저 프로필 대신 로그인 버튼을 표시한다.
- 비로그인 사용자의 탐색하기 메뉴와 로그아웃 후 이동 경로는 여행지 더 찾아보기 페이지로 연결한다.
- 같은 MBTI 유형의 `destination_mbti_scores.score`를 내림차순 정렬한다.
- 점수가 같으면 `destination_id` 오름차순으로 정렬한다.
- 상위 10개 관광지를 큰 카드 슬라이더로 한 장씩 표시한다.
- 카드에는 순위, 점수, 지역, 키워드를 표시하고 설명과 추천 이유는 클릭 후 상세 모달에 표시한다.
- 북마크는 `user_bookmarks` 테이블에 저장한다.
- 비로그인 사용자가 북마크를 클릭하면 로그인 페이지로 안내한다.
- 마이페이지의 저장한 여행지 영역에서 최근 저장한 관광지 카드 최대 4개를 표시한다.
- 저장된 여행 MBTI 결과가 없으면 성향 분석 페이지로 안내한다.
- 관광지 이미지가 없거나 로딩에 실패하면 기본 이미지를 표시한다.
- 상단 인삿말 영역은 표시하지 않는다.

---

## 01-1 Recommended Destination Explore Page

### 목적

로그인 사용자의 여행 MBTI 점수 순으로 국내 관광지 전체를 탐색한다.
비로그인 사용자는 공개 기본 MBTI 기준의 관광지 목록을 먼저 둘러볼 수 있다.

### 화면 구성

- 지역 다중 선택 필터 모달
- 키워드 다중 선택 필터 모달
- 필터 초기화 및 검색 버튼
- 관광지 카드 목록
- 페이지네이션
- 여행지 상세정보 모달
- 북마크 버튼

### 사용자 액션

- 지역 필터 클릭 → 지역 선택 모달에서 복수 지역 선택
- 키워드 필터 클릭 → 키워드 선택 모달에서 복수 키워드 선택
- 필터 모달 완료 클릭 → 선택값을 검색 조건에 반영하고 목록은 유지
- 필터 초기화 클릭 → 지역 및 키워드 검색 조건만 초기화
- 검색 클릭 → 적용된 조건에 맞는 첫 페이지 재조회
- 페이지 버튼 클릭 → 해당 페이지 조회
- 관광지 카드 클릭 → 상세정보 모달 표시
- 북마크 클릭 → 로그인 사용자의 여행지 북마크 저장 또는 해제
- 일정 만들기 클릭 → 선택 여행지를 저장하고 일정 생성 페이지 이동
- 비로그인 상태에서 북마크 클릭 → 로그인 페이지 이동
- 비로그인 상태에서 일정 만들기 클릭 → 로그인 페이지 이동

### 사용 API

- `GET /api/destinations/recommended`
- `GET /api/destinations/recommended/filters`
- `GET /api/user/bookmarks`
- `POST /api/user/bookmarks`
- `DELETE /api/user/bookmarks/:destinationId`

### 구현 메모

- 관광지는 로그인 사용자의 MBTI 적합도 점수 내림차순으로 정렬한다.
- 비로그인 상태에서는 `mbtiType=INFP` 공개 기준으로 조회한다.
- 비로그인 상태에서는 TOP 10으로 돌아가기 링크를 표시하지 않는다.
- 카드와 상세정보에는 랭킹 및 적합도 점수를 노출하지 않는다.
- 카드와 상세정보에는 하트 형태의 북마크 상태를 표시한다.
- 한 페이지에 12개 관광지를 표시한다.
- 필터 옵션은 해당 MBTI 추천 데이터에 존재하는 지역과 키워드로 구성한다.
- 같은 필터에서 복수 선택한 값은 OR, 지역과 키워드 사이는 AND 조건으로 조회한다.
- 필터 선택과 초기화만으로 목록을 갱신하지 않으며 검색 버튼을 눌러야 반영한다.

---

## 02 Signup Page

### 목적

신규 사용자의 회원가입을 진행한다.

회원가입 완료 후 성향 분석 페이지로 이동한다.

### 화면 구성

#### Left Hero Section

- 대표 여행 이미지
- 서비스 슬로건
- 서비스 소개 문구

#### Signup Form

입력 항목:

- 닉네임
- 이메일
- 비밀번호

체크 항목:

- 서비스 약관 동의

버튼:

- 계정 만들기

#### Social Login

- Google
- Kakao (추후)
- Naver (추후)

#### Login Link

- 로그인 페이지 이동

### 사용자 액션

#### 회원가입 입력

- 닉네임
- 이메일
- 비밀번호

#### 검증

- 이메일 형식 확인
- 비밀번호 길이 확인
- 약관 동의 여부 확인

#### 성공

- 성향 분석 페이지로 이동

#### 실패

- 에러 메시지 출력

### 사용 API

- `POST /api/auth/signup`

### 사용 DB

- `users`

### 주요 컴포넌트

- Input
- PasswordInput
- Checkbox
- PrimaryButton
- SocialLoginButton

### MVP 여부

포함

### 구현 메모

- 회원가입 성공 시 세션 정보를 저장하고 성향 분석 페이지로 자동 이동한다.

---

## 03 Login Page

### 목적

기존 사용자의 로그인을 진행한다.

로그인 성공 시 메인 허브 페이지로 이동한다.

### 화면 구성

#### Header

- Sidebar
- Top Navbar
- 서비스 환영 메시지

#### Login Form

입력 항목:

- 이메일
- 비밀번호

체크 항목:

- 로그인 상태 유지

버튼:

- 로그인

#### Password Recovery

- 비밀번호 찾기

#### Social Login

- Google
- Kakao (추후)
- Naver (추후)

#### Signup Link

- 회원가입 페이지 이동

### 사용자 액션

#### 로그인 입력

- 이메일
- 비밀번호

#### 검증

- 이메일 존재 여부
- 비밀번호 일치 여부

#### 성공

- 메인 허브 페이지로 이동

#### 실패

- 에러 메시지 출력

### 사용 API

- `POST /api/auth/login`

### 사용 DB

- `users`

### 주요 컴포넌트

- Input
- PasswordInput
- Checkbox
- PrimaryButton
- SocialLoginButton
- TextLink

### MVP 여부

포함

### 구현 메모

- 로그인 성공 시 사용자 세션 또는 토큰을 저장한다.
- 공통 Sidebar와 Top Navbar를 사용해 앱 전체 화면 톤과 일관되게 표시한다.
- 로그인 설정은 `/api/config`에서 Supabase URL과 Anon Key를 받아 사용한다.
- 로그인 상태 유지 옵션 선택 시 자동 로그인 기능을 지원할 수 있다.
- 소셜 로그인은 MVP에서는 UI만 제공하고 실제 연동은 추후 구현 가능하다.

---

## 04 Explore Destinations Page

### 목적

사용자가 대한민국 국내 여행지를 검색하고 조건별로 탐색한다.

여행지 카드를 통해 상세 정보를 확인하거나 여행 계획 생성 단계로 이동한다.

### 화면 구성

#### Top Navigation

- 서비스 로고 및 서비스명
- Destinations 메뉴
- Itineraries 메뉴
- My Trips 메뉴
- Local Stories 메뉴
- 로그인 또는 사용자 메뉴

#### Page Header

- 페이지 제목
- 여행지 탐색 안내 문구

#### Search and Filter

- 여행지 검색창
- 지역 필터
- 여행 스타일 필터
- 예산 필터

#### Destination Grid

- 여행지 카드 목록
- 여행지 이미지
- 지역 배지
- 여행지명
- 한 줄 설명
- 카테고리 태그
- 즐겨찾기 버튼

#### Featured Destination Card

- 대형 대표 이미지
- 추천 배지
- 여행지명
- 추천 설명
- 카테고리 태그
- 여행 계획하기 버튼

#### Pagination

- 이전 페이지 버튼
- 현재 페이지 표시
- 다음 페이지 버튼

#### Footer

- 서비스 정보
- 이용약관
- 개인정보처리방침
- 문의 링크

#### Floating Action

- 도움말 또는 AI 채팅 진입 버튼

### 주요 컴포넌트

- TopNavbar
- SearchBar
- FilterSelect
- DestinationCard
- FeaturedDestinationCard
- CategoryTag
- FavoriteButton
- PrimaryButton
- Pagination
- FloatingActionButton

### 사용자 액션

- 검색어 입력 → 여행지 목록 필터링
- 지역 선택 → 해당 광역시/도 또는 시/군/구 여행지 조회
- 여행 스타일 선택 → 선택한 스타일에 맞는 여행지 조회
- 예산 선택 → 예산 범위에 맞는 여행지 조회
- 여행지 카드 클릭 → 여행지 상세 페이지 이동
- 즐겨찾기 클릭 → 여행지 저장 또는 해제
- 여행 계획하기 클릭 → 선택한 여행지를 포함한 일정 생성 페이지 이동
- 페이지 이동 클릭 → 해당 페이지의 여행지 목록 조회

### 사용 API

- `GET /api/destinations`
- `GET /api/destinations/:id`
- `GET /api/destinations/popular`

즐겨찾기 API는 2차 구현 시 `docs/architecture/API_SPEC.md`에 추가한다.

### 사용 DB

- `destinations`
- `user_bookmarks`
- `user_preferences`

즐겨찾기 기능은 `user_bookmarks` 테이블을 사용한다.

### MVP 여부

포함

### 구현 메모

- MVP 여행 범위는 대한민국 국내 여행으로 제한한다.
- 지역 필터는 `province`(광역시/도), `city`(시/군/구) 기준을 따른다.
- 국내 관광지 데이터는 한국관광공사 TourAPI 4.0 활용을 우선 고려한다.
- 여행지 카드는 반응형 그리드로 구성한다.
- 이미지가 없을 때 사용할 기본 이미지를 제공한다.
- 즐겨찾기와 AI 채팅 버튼은 MVP에서 UI만 제공하고 실제 기능은 2차 구현 가능하다.

---

## 05 Community Feed Page

### 목적

사용자가 국내 여행 경험과 사진을 공유하고 다른 사용자의 여행 게시물을 탐색한다.

여행 정보와 후기를 참고하고 관심 있는 게시물에 반응할 수 있다.

### 화면 구성

#### Top Navigation

- 서비스 로고 및 서비스명
- Destinations 메뉴
- Itineraries 메뉴
- My Trips 메뉴
- Local Stories 메뉴
- 로그인 또는 사용자 메뉴

#### Page Header

- 페이지 제목
- 커뮤니티 소개 문구
- 새 글 작성 버튼

#### Feed List

- 작성자 프로필 이미지
- 작성자 닉네임
- 작성 시각
- 여행 대표 이미지
- 게시물 제목
- 게시물 요약
- 지역 및 카테고리 태그
- 좋아요 수
- 댓글 수
- 공유 버튼

#### Popular Tags

- 인기 여행 태그 목록
- 태그별 게시물 수
- 전체 태그 보기 링크

#### Recommended Travelers

- 추천 사용자 프로필
- 닉네임
- 간단한 사용자 정보
- 팔로우 버튼

#### Featured Story

- 추천 여행 이야기 이미지
- 게시물 제목
- 게시물 상세 이동 링크

#### Footer

- 서비스 정보
- 이용약관
- 개인정보처리방침
- 문의 링크

### 주요 컴포넌트

- TopNavbar
- FeedCard
- UserProfile
- CategoryTag
- LikeButton
- CommentButton
- ShareButton
- WritePostButton
- PopularTagList
- RecommendedUserList
- FollowButton
- FeaturedStoryCard

### 사용자 액션

- 새 글 작성 클릭 → 게시물 작성 페이지 이동
- 게시물 클릭 → 게시물 상세 페이지 이동
- 좋아요 클릭 → 게시물 좋아요 상태 변경
- 댓글 클릭 → 게시물 상세의 댓글 영역 이동
- 공유 클릭 → 게시물 링크 공유
- 인기 태그 클릭 → 해당 태그의 게시물 필터링
- 추천 사용자 클릭 → 사용자 프로필 이동
- 팔로우 클릭 → 사용자 팔로우 상태 변경

### 사용 API

- `GET /api/community/posts`
- `GET /api/community/posts/:id`
- `POST /api/community/posts`
- `POST /api/community/posts/:id/likes`
- `GET /api/community/tags/popular`
- `GET /api/users/recommended`

커뮤니티 API는 구현 전 `docs/architecture/API_SPEC.md`에 요청 및 응답 형식을 추가한다.

### 사용 DB

- `users`

게시물, 댓글, 좋아요, 팔로우 기능에 필요한 테이블은 현재 MVP DB 구조에 포함되어 있지 않다. 실제 기능 구현 전 `docs/architecture/DB_SCHEMA.md`에 관련 테이블을 설계하고 추가한다.

### MVP 여부

부분 포함

### 구현 메모

- MVP에서는 피드 목록과 게시물 상세 이동을 우선 구현할 수 있다.
- 새 글 작성, 좋아요, 댓글, 공유, 팔로우 기능은 2차 구현 가능하다.
- 커뮤니티 기능을 UI만 제공하는 경우 비활성 상태 또는 준비 중 안내를 명확히 표시한다.
- 게시물 이미지는 고정된 비율로 표시하여 피드 레이아웃 변화를 방지한다.
- 여행 지역은 대한민국 국내 행정구역 기준으로 표시한다.

---

## 06 My Page

### 목적

로그인한 사용자의 프로필과 여행 활동을 한 화면에서 확인한다.

저장한 여행지, 최근 여행, AI 추천 내용을 확인하고 프로필 또는 여행 정보를 관리한다.

### 화면 구성

#### Sidebar Navigation

- 서비스 로고 및 서비스명
- 마이페이지 홈
- 내 여행
- 저장 목록
- 설정
- 로그아웃
- 사용자 정보 요약

#### Profile Header

- 프로필 이미지
- 사용자 닉네임
- 사용자 성향 칭호
- 간단한 사용자 정보
- 프로필 편집 버튼
- 새 여행 만들기 버튼

#### Saved Destinations

- 저장한 여행지 카드
- 여행지 대표 이미지
- 여행지명
- 지역
- 최근 저장한 여행지 최대 4개 표시
- 전체 보기 링크
- 저장 목록 전체 보기 팝업
- 팝업 내부 세로 스크롤 목록
- 저장 여행지 상세정보 전환 화면

#### AI Recommendation Summary

- 사용자 성향 기반 추천 문구
- 추천 여행 스타일
- 추천 이유
- 추천 여행지 보기 버튼

#### Recent Trips

- 최근 여행 카드
- 여행 대표 이미지
- 여행 제목
- 여행 기간
- 여행 상태
- 간단한 일정 정보

#### Footer

- 서비스 정보
- 이용약관
- 개인정보처리방침
- 문의 링크

### 주요 컴포넌트

- Sidebar
- UserProfile
- ProfileImage
- Badge
- EditProfileButton
- PrimaryButton
- SavedDestinationCard
- AIRecommendationCard
- RecentTripCard
- StatusBadge
- TextLink

### 사용자 액션

- 프로필 편집 클릭 → 프로필 수정 화면 또는 모달 표시
- 새 여행 만들기 클릭 → 일정 생성 페이지 이동
- 저장 여행지 클릭 → 저장한 여행지 상세정보 모달 표시
- 저장 목록 전체 보기 클릭 → 저장한 여행지 팝업 표시
- 저장 목록 팝업의 여행지 카드 클릭 → 같은 팝업 안에서 상세정보로 전환
- 저장 여행지 상세정보 닫기 → 이전 목록 또는 마이페이지 상태로 복귀
- AI 추천 여행지 보기 클릭 → 추천 여행 리스트 페이지 이동
- 최근 여행 클릭 → 여행 일정 상세 페이지 이동
- 내 여행 클릭 → 전체 여행 목록 이동
- 설정 클릭 → 계정 설정 페이지 이동
- 로그아웃 클릭 → 세션 종료 후 로그인 페이지 이동

### 사용 API

- `GET /api/user/profile`
- `PATCH /api/user/profile`
- `GET /api/travel/list`
- `GET /api/travel/recommendations`
- `GET /api/user/bookmarks`

프로필, 추천 조회, 저장 목록 API는 구현 전 `docs/architecture/API_SPEC.md`에 요청 및 응답 형식을 추가한다.

### 사용 DB

- `users`
- `user_preferences`
- `trips`
- `destinations`

저장 여행지 기능은 `user_bookmarks` 테이블을 사용한다.

### MVP 여부

포함

### 구현 메모

- MVP에서는 프로필 정보, 성향 칭호, 최근 여행 목록을 우선 제공한다.
- 저장 여행지 기능은 `user_bookmarks` 테이블의 최근 저장 데이터를 표시한다.
- AI 추천 요약은 저장된 사용자 성향과 추천 결과를 사용하며 페이지 진입 시 AI를 직접 호출하지 않는다.
- 프로필 이미지가 없을 때 사용할 기본 이미지를 제공한다.
- 여행 데이터가 없으면 새 여행 만들기 행동을 강조한 빈 상태를 표시한다.

---

## 07 Travel Information Input Page

### 목적

맞춤 여행지 추천과 AI 일정 생성에 필요한 기본 여행 정보를 입력한다.

사용자가 입력한 국내 여행 조건과 키워드를 다음 추천 단계로 전달한다.

### 화면 구성

#### Top Navigation

- 서비스 로고 및 서비스명
- 주요 메뉴
- 사용자 메뉴

#### Page Header

- 페이지 제목
- 입력 안내 문구
- 메인 추천에서 선택한 여행지가 있으면 추가된 여행지 카드 표시

#### Travel Information Form

입력 항목:

- 출발 지역
- 여행 지역
- 시작일
- 종료일
- 동반자 유형
- 예산

현재 여행 일정 생성 화면은 초기화 버튼을 입력 패널 우측 상단에 배치한다.
동반자 유형은 혼자, 연인, 친구, 가족 중 하나를 모달 버튼 UI로 선택한다.
여행 지역은 메인 추천 탐색 페이지의 지역 필터와 같은 모달 버튼 선택 UI를
사용한다. 메모 입력 영역은 제거하고, 기존 키워드 목록을 음악 앱 취향 선택처럼
흩어진 키워드 칩으로 표시해 최대 3개까지 선택한다.
일정 생성 입력 섹션은 화면 중앙에 배치하며, 일정 생성 완료 후에는 입력 화면
하단에 결과를 이어 붙이지 않고 생성된 일정 결과 화면으로 전환한다.
생성된 일정 결과 화면은 여행 일정 확인 페이지의 일정 상세보기 모달을 페이지화한
구조로 표시한다. 결과 화면에는 DAY별 카드 그리드를 두고, DAY 선택 시 모달에서
왼쪽 여행지 카드 목록과 오른쪽 지도/마커 영역을 함께 표시한다. 각 DAY 카드에는 해당
날짜의 대표 관광지 이미지 1장을 표시한다.

#### Transportation Selection

- 자가용
- 대중교통
- 도보
- 자전거

선택한 이동 방식은 아이콘과 활성 상태로 구분한다.

#### Travel Preference

- 여행 일정 밀도 또는 선호 템포 선택
- 사용자 성향 진단 결과 표시 또는 기본값 적용

#### Keyword Selection

- 여행 키워드 칩 목록
- 선택된 키워드 활성 상태
- 선택 사항 및 최대 3개 선택 안내
- 제한 초과 시 경고 툴팁

키워드 예시:

- 오션뷰
- 인생샷
- 레포츠
- 뚜벅이
- 맛집탐방
- 야경명소
- 힐링
- 전통문화

#### Recommendation Preview

- 국내 여행 대표 이미지
- 추천 지역 또는 여행 분위기
- 간단한 소개 문구
- 관련 태그

#### Submit Action

- AI 일정 생성하기 버튼

#### Footer

- 서비스 정보
- 이용약관
- 개인정보처리방침
- 문의 링크

### 주요 컴포넌트

- TopNavbar
- Select
- DatePicker
- BudgetInput
- TransportationOption
- RadioGroup
- KeywordChip
- Tooltip
- RecommendationPreviewCard
- PrimaryButton

### 사용자 액션

- 출발 지역 선택 → 국내 출발 지역 저장
- 여행 지역 선택 → 지역 선택 모달에서 광역시/도 조건 저장
- 동반자 유형 선택 → 혼자, 연인, 친구, 가족 중 하나를 인원수 조건으로 변환
- 시작일과 종료일 선택 → 여행 기간 계산
- 동반자 유형 선택 → 추천 조건에 반영
- 예산 입력 → 예산 적합도 계산 조건에 반영
- 이동 방식 선택 → 일정 동선 생성 조건에 반영
- 키워드 클릭 → 선택 또는 선택 해제
- 키워드 3개 선택 후 추가 클릭 → 경고 툴팁 표시 및 선택 무효화
- AI 일정 생성하기 클릭 → 입력값 검증 후 생성된 일정 결과 화면으로 전환

### 입력 검증

- 여행 지역은 필수 입력이다.
- 시작일과 종료일은 필수 입력이다.
- 종료일은 시작일보다 빠를 수 없다.
- 현재 관광지 데이터 규모를 고려해 일정 생성 기간은 최대 7일까지만 허용한다.
- 기본 일정 생성은 각 DAY에 최소 1개 관광지를 먼저 배치하고, 하루 최대 3개 관광지를 거리 기준으로 묶어 배치한다.
- 이미지가 없는 관광지는 일정 생성 후보에서 제외한다.
- 검색된 후보 관광지 수가 선택한 여행 일수보다 적으면 데이터 부족 안내를 표시한다.
- 동반자 유형은 혼자, 연인, 친구, 가족 중 하나를 선택한다.
- 키워드는 선택 사항이며 최대 3개까지 선택할 수 있다.

### 사용 API

- `POST /api/travel/recommend`
- `POST /api/travel/plan`
- `GET /api/user/preference`

추천 결과 확인 후 일정을 생성하는 경우 `POST /api/travel/recommend`와 `POST /api/travel/plan`을 단계별로 호출한다.

---

## 08 Saved Trips Page

### 목적

사용자가 저장한 여행 일정 목록과 날짜별 세부 일정을 확인한다.

### 화면 구성

- 공통 Sidebar
- 공통 Header
- 페이지 제목 및 새 여행 만들기 버튼
- 여행 제목 또는 여행지 검색
- 저장 일정 카드 목록
- 큰 DAY 버튼 목록이 포함된 일정 상세 모달
- DAY별 일정과 루트를 보여주는 보조 모달
- 선택 DAY 여행지 카드 목록
- 여행지 위치 카카오맵
- 저장 일정이 없거나 목록 API가 아직 제공되지 않는 경우 새 여행 만들기 빈 상태

### 주요 컴포넌트

- Sidebar
- Header
- TripSearch
- TripStatusFilter
- SavedTripCard
- TripDetailModal
- EmptyState

### 사용자 액션

- 검색어 입력 → 여행 제목 및 대표 여행지 기준 목록 필터링
- 일정 상세 보기 클릭 → 큰 DAY 버튼 목록을 포함한 상세 모달 표시
- DAY 버튼 클릭 → DAY별 일정과 루트 모달 표시
- 여행지 카드 클릭 → 카드를 확장하고 주소, 설명, 일정 메모 표시
- 지도 마커 클릭 → 연결된 여행지 카드 선택
- 상세 모달의 여행 삭제하기 클릭 → 삭제 경고 확인 후 DB 일정 삭제 및 목록 갱신
- 새 여행 만들기 클릭 → 일정 생성 페이지 이동
- DAY 루트 모달 닫기 또는 ESC 입력 → DAY 루트 모달 닫기
- 상세 모달 닫기 또는 ESC 입력 → 상세 모달과 하위 DAY 루트 모달 닫기
- 저장 일정 목록 API가 `404`를 반환하면 빈 일정 상태와 새 여행 만들기 버튼 표시

### 사용 API

- `GET /api/travel/list`
- `GET /api/travel/:id`
- `PATCH /api/travel/:id/status`
- `DELETE /api/travel/:id`

### 사용 DB

- 임시 `trip_plans`
- 임시 `trip_plan_items`
- `destinations`

### MVP 여부

포함

### 구현 메모

- `public/components/header.html`, `public/components/sidebar.html`과
  `public/scripts/layout.js`가 병합된 환경을 기준으로 공통 레이아웃을 주입한다.
- 목데이터를 사용하지 않고 저장 일정 API 응답만 표시한다.
- 임시 일정 테이블을 사용하는 동안 제목과 지역 검색, DAY별 관광지 및 메모 확인만 제공한다.
- 일정 상세 모달에서는 DAY 버튼을 크게 표시하고, 실제 일정과 루트는 DAY 버튼 클릭 후 별도 모달에서 표시한다.
- DAY 루트 모달은 왼쪽 여행지 카드, 오른쪽 지도 영역의 2단 구조로 표시한다.
- 일정은 `시작 전`, `여행 진행중`, `완료한 여행` 세 상태로 표시한다.
- `시작 전` 상태에서는 일정 상세 모달의 여행지/기간 정보 라인에 `여행 시작하기` 버튼을 표시한다.
- `여행 시작하기`를 누르면 `trip_plans.status`를 `in_progress`로 변경하고 진행중 탭으로 이동한 뒤 시작 버튼을 숨긴다.
- `여행 진행중` 상태가 아닐 때는 여행지 상세의 `여행 완료` 버튼을 숨긴다.
- DAY 루트 모달에서 여행지 상세 카드를 펼친 뒤 `여행 완료` 버튼으로 방문 완료 표시를 할 수 있다.
- 모든 여행지를 완료하면 `trip_plans.status`를 `completed`로 변경하고 `completed_at`을 기록한 뒤 완료 탭으로 이동한다.
- 시작 전, 여행 진행중, 완료한 여행 상태의 일정 상세 모달에는 `여행 삭제하기` 버튼을 제공하고, 확인 후 `trip_plans` 행을 삭제한다.
- 저장 일정 목록 렌더링 후 `여행 진행중` 상태이면서 로컬 완료 기록이 남아 있는 일정은 백그라운드에서 `completed` 상태로 동기화한다.
- 일정 카드와 상세 모달, 마이페이지 최근 다녀온 여행 영역은 `완료한 여행` 상태를 표시한다.
- 임시 일정 테이블을 사용하는 동안 여행지별 완료 상태는 사용자별 로컬 저장소에 보관하고, 여행 전체 완료 상태는 `trip_plans`에 저장한다.
- 지도는 `destinations.latitude`, `destinations.longitude`를 사용하며 좌표가 없는 여행지는 마커에서 제외한다.
- 정식 일정 테이블 병합 시 `src/services/supabase/tripPlan.js`의 조회 계층을 교체한다.
- 이미지가 없거나 로딩에 실패하면 기본 여행 이미지를 표시한다.

### 사용 DB

- `users`
- `user_preferences`
- `destinations`
- `trips`
- `itineraries`

### MVP 여부

포함

### 구현 메모

- MVP 여행 범위는 대한민국 국내 여행으로 제한한다.
- 여행 지역은 `province`(광역시/도), `city`(시/군/구) 기준으로 관리한다.
- 키워드 선택 제한은 Vanilla JavaScript로 구현한다.
- 키워드 제한 경고는 툴팁으로 표시하며 4번째 키워드는 선택하지 않는다.
- TourAPI 실제 관광 데이터를 우선 사용하고 AI는 검증된 데이터 안에서 추천 및 일정을 생성한다.
- 오른쪽 추천 미리보기는 입력값에 따라 변경할 수 있으며, MVP에서는 기본 이미지와 문구를 제공할 수 있다.

---

## 08 Travel Preference Test Page

### 목적

사용자의 여행 템포와 음식 선호도를 질문 형식으로 진단한다.

응답 결과를 저장하고 사용자에게 여행 성향 칭호를 부여한다.

### 화면 구성

#### Top Navigation

- 서비스 로고 및 서비스명
- 닫기 또는 나가기 버튼

#### Progress Indicator

- 현재 질문 번호
- 전체 질문 수
- 진행률 바

#### Question Section

- 질문 제목
- MBTI 축 문자를 제외한 여행 취향 비교 배지
- 질문 안내 문구
- 질문과 관련된 대표 여행 이미지

#### Answer Options

- 첫 번째 선택지 카드
- 두 번째 선택지 카드
- 선택지 아이콘
- 선택지 제목
- 선택지 설명
- 선택 상태 표시

질문 예시:

- 여행지에서 나는?
  - 아침 7시부터 움직이는 갓생형
  - 여유롭게 일어나서 커피부터 찾는 힐링형
- 밥을 먹을 때 나는?
  - 1시간 웨이팅도 감수하는 핫플 탐험가
  - 웨이팅은 질색, 발길 닿는 로컬 식당 선호

#### Navigation Actions

- 이전 버튼
- 다음 질문 버튼
- 마지막 질문의 분석 완료 버튼

#### Benefit Summary

- 취향에 맞는 여행지 추천
- 맞춤 일정 생성
- 여행 성향 칭호 제공

#### Footer

- 서비스 정보
- 이용약관
- 개인정보처리방침

### 주요 컴포넌트

- ProgressBar
- QuestionCard
- QuestionImage
- AnswerOptionCard
- Icon
- PreviousButton
- PrimaryButton
- BenefitItem

### 사용자 액션

- 선택지 클릭 → 현재 질문의 답변 선택
- 다른 선택지 클릭 → 기존 선택 해제 후 새 답변 선택
- 이전 클릭 → 이전 질문과 저장된 답변 표시
- 다음 질문 클릭 → 현재 답변 저장 후 다음 질문 표시
- 분석 완료 클릭 → 전체 답변 제출 및 성향 분석
- 나가기 클릭 → 테스트 종료 확인 후 이전 페이지 이동

### 입력 검증

- 각 질문은 하나의 선택지만 선택할 수 있다.
- 답변을 선택하기 전에는 다음 질문 또는 분석 완료 버튼을 비활성화한다.
- 마지막 질문 제출 전 모든 필수 문항의 응답 여부를 확인한다.

### 사용 API

- `GET /api/user/preference`
- `POST /api/user/preference`

질문을 서버에서 동적으로 관리하는 경우 질문 조회 API는 구현 전 `docs/architecture/API_SPEC.md`에 추가한다.

### 사용 DB

- `users`
- `user_preferences`

질문과 답변 이력을 동적으로 관리할 경우 확장 예정인 `personality_questions`, `personality_answers` 테이블을 사용한다.

### MVP 여부

포함

### 구현 메모

- MVP에서는 여행 템포와 음식 선호도 문항을 정적으로 제공할 수 있다.
- 응답 조합에 따라 사용자 칭호를 결정하고 `user_preferences.badge`에 저장한다.
- 결과 화면과 추천 화면에는 코드형 유형명 대신 `완벽한 일정 설계 여행가` 같은 칭호를 뱃지 형태로 표시한다.
- 분석 완료 후 칭호 결과를 표시하고 메인 허브 페이지로 이동한다.
- 진행률은 현재 문항 위치에 맞춰 즉시 갱신한다.
- 선택 카드 전체를 클릭 가능한 영역으로 제공하고 키보드로도 선택할 수 있어야 한다.
