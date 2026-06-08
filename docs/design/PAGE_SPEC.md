# Page Specification

## 01 Main Hub Page

### 목적

로그인한 사용자가 주요 기능으로 이동하는 메인 허브 페이지.

### 화면 구성

- Sidebar
- Top Navbar
- Hero Banner
- Quick Menu
- Popular Destinations

### 주요 컴포넌트

- Sidebar
- SearchBar
- HeroBanner
- QuickMenuCard
- DestinationCard
- PrimaryButton

### 사용자 액션

- 여행 계획하기 클릭 → 일정 생성 페이지 이동
- 추천 여행지 보기 클릭 → 추천 여행 리스트 페이지 이동
- 내 일정 확인 클릭 → 일정 확인 페이지 이동
- 마이페이지 클릭 → 마이페이지 이동

### 사용 API

- `GET /api/user/profile`
- `GET /api/destinations/popular`
- `GET /api/travel/list`

### 사용 DB

- `users`
- `destinations`
- `trips`

### MVP 여부

포함

### 구현 메모

- 알림 기능은 MVP에서 제외 가능
- 커뮤니티 링크는 UI만 두고 실제 기능은 2차 구현 가능

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

- 회원가입 성공 시 성향 분석 페이지로 자동 이동한다.

---

## 03 Login Page

### 목적

기존 사용자의 로그인을 진행한다.

로그인 성공 시 메인 허브 페이지로 이동한다.

### 화면 구성

#### Header

- 서비스 로고
- 서비스명
- 환영 메시지

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
- `user_preferences`

즐겨찾기 기능 구현 시 확장 예정인 `bookmarks` 테이블을 사용한다.

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
- 카테고리
- 전체 보기 링크

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
- 저장 여행지 클릭 → 여행지 상세 페이지 이동
- 저장 목록 전체 보기 클릭 → 저장한 여행지 목록 이동
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

저장 여행지 기능 구현 시 확장 예정인 `bookmarks` 테이블을 사용한다.

### MVP 여부

포함

### 구현 메모

- MVP에서는 프로필 정보, 성향 칭호, 최근 여행 목록을 우선 제공한다.
- 저장 여행지 기능은 `bookmarks` 테이블 추가 후 구현한다.
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

#### Travel Information Form

입력 항목:

- 출발 지역
- 여행 지역
- 시작일
- 종료일
- 동반자 유형

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
- 최대 3개 선택 안내
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
- 여행 지역 선택 → 광역시/도 및 시/군/구 조건 저장
- 시작일과 종료일 선택 → 여행 기간 계산
- 동반자 유형 선택 → 추천 조건에 반영
- 이동 방식 선택 → 일정 동선 생성 조건에 반영
- 키워드 클릭 → 선택 또는 선택 해제
- 키워드 3개 선택 후 추가 클릭 → 경고 툴팁 표시 및 선택 무효화
- AI 일정 생성하기 클릭 → 입력값 검증 후 여행지 추천 또는 일정 생성 단계 이동

### 입력 검증

- 여행 지역은 필수 입력이다.
- 시작일과 종료일은 필수 입력이다.
- 종료일은 시작일보다 빠를 수 없다.
- 동반자 유형은 필수 입력이다.
- 키워드는 최소 1개, 최대 3개까지 선택할 수 있다.
- 필수 입력이 완료되고 키워드가 1개 이상 선택된 경우에만 제출 버튼을 활성화한다.

### 사용 API

- `POST /api/travel/recommend`
- `POST /api/travel/plan`
- `GET /api/user/preference`

추천 결과 확인 후 일정을 생성하는 경우 `POST /api/travel/recommend`와 `POST /api/travel/plan`을 단계별로 호출한다.

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
- 분석 완료 후 칭호 결과를 표시하고 메인 허브 페이지로 이동한다.
- 진행률은 현재 문항 위치에 맞춰 즉시 갱신한다.
- 선택 카드 전체를 클릭 가능한 영역으로 제공하고 키보드로도 선택할 수 있어야 한다.
