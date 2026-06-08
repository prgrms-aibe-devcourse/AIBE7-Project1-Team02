# Tripadvisor AI Travel Planner

## 프로젝트 소개

사용자의 성향과 여행 스타일을 분석해 개인에게 최적화된 여행지와 여행 일정을 추천하는 AI 기반 여행 플랫폼입니다.

기존 여행 플랫폼처럼 사용자가 직접 많은 정보를 검색하는 방식이 아니라, 회원가입 단계에서 성향을 먼저 진단하고 사용자에게 가장 적합한 여행지를 먼저 제안하는 것이 핵심 가치입니다.

## MVP 서비스 범위

MVP 단계에서는 대한민국 국내 여행만 지원합니다. 국내 관광지 정보는 한국관광공사 TourAPI 4.0 활용을 우선 고려하며, 해외 여행 추천은 국내 여행 플로우가 안정화된 이후 확장할 예정입니다.

## 기술 스택

### Frontend

- HTML5
- CSS3
- JavaScript ES6+

### Backend

- Node.js
- Express.js

### Database

- Supabase

### Deployment

- Render

### AI 및 외부 API

- OpenAI API Platform
- Google Gemini 또는 Groq 등 대체 가능한 LLM API
- Google Maps API
- OpenWeather API
- 한국관광공사 TourAPI 4.0
- Unsplash Developers API

AI Provider는 아직 확정되지 않았으며, 교체 가능한 서비스 구조로 구현합니다.

## 주요 기능

### Flow A. 회원가입 및 사용자 성향 진단

1. 아이디, 비밀번호, 닉네임 등 최소 정보로 계정을 생성합니다.
2. 여행 체력/템포를 선택합니다.
   - 아침 7시부터 움직이는 갓생형
   - 여유롭게 일어나서 커피부터 찾는 힐링형
3. 식요소(F&B) 민감도를 선택합니다.
   - 1시간 웨이팅도 감수하는 핫플 탐험가
   - 웨이팅은 질색, 발길 닿는 로컬 식당 선호
4. 설문 결과에 따라 사용자 칭호를 부여하고 메인 대시보드로 이동합니다.

### Flow B. 여행 일정 생성

1. 여행 도시, 시작일, 종료일, 동반자 유형을 입력합니다.
2. 비주얼 키워드 칩을 렌더링합니다.
   - 예: `#오션뷰`, `#인생샷`, `#레포츠`, `#뚜벅이`, `#맛집탐방`, `#야경명소`, `#힐링`, `#전통문화`
3. 키워드는 최대 3개까지만 선택할 수 있습니다.
4. 4번째 키워드 선택 시 "최대 3개까지만 선택 가능합니다" 툴팁을 표시하고 선택을 무효화합니다.
5. 최소 1개 이상의 키워드가 선택되면 `내 맞춤 여행지 보기` 버튼을 활성화합니다.

## AI 추천 알고리즘

추천 점수는 아래 기준으로 계산합니다.

```text
추천 점수 = 성향 적합도 60% + 계절&날씨 적합도 20% + 동행자 적합도 20%
```

일정 생성 흐름은 아래 순서를 따릅니다.

```text
관광지 데이터 조회 -> 이동시간 계산 -> 동선 정렬 -> 마이페이지 저장 및 수정
```

AI 환각을 줄이기 위해 국내 관광 데이터는 TourAPI 등 신뢰 가능한 실제 데이터를 우선 조회하고, AI에는 실제 데이터와 사용자 조건을 함께 전달합니다.

## 팀원 역할

| 역할 | 담당 업무 |
| --- | --- |
| 기획 | 사용자 플로우, 요구사항, AI 프롬프트 방향 정의 |
| 프론트엔드 | 회원가입/설문 UI, 일정 생성 UI, 키워드 칩 선택 로직 |
| 백엔드 | Express API, Supabase 연동, 외부 API 통합 |
| 인프라 | Render 배포, 환경 변수 관리, 라이브 확인 |

## 실행 방법

아직 프로젝트 초기 단계이며, 서버 코드와 `package.json` 생성 후 아래 명령으로 실행합니다.

```bash
npm install
npm start
```

## 환경 변수

민감 정보는 `.env` 파일 또는 Render Environment Variables에서 관리합니다.

```env
PORT=3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
AI_PROVIDER=
AI_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
GOOGLE_MAPS_API_KEY=
OPENWEATHER_API_KEY=
TOURAPI_KEY=
UNSPLASH_ACCESS_KEY=
```

`.env` 파일은 GitHub에 올리지 않습니다.

## Documentation

### Architecture

- [DB Schema](./docs/architecture/DB_SCHEMA.md)
- [API Specification](./docs/architecture/API_SPEC.md)

### Design

- [Design System](./docs/design/DESIGN_SYSTEM.md)
- [Page Specification](./docs/design/PAGE_SPEC.md)

### Project Management

- [WBS](./docs/management/WBS.md)

MVP 단계에서는 `users`, `user_preferences`, `destinations`, `trips`, `itineraries` 5개 핵심 테이블을 기준으로 구현합니다. 자세한 구조와 관계는 [DB Schema](./docs/architecture/DB_SCHEMA.md)를 참고합니다.

## 트러블 슈팅

| 문제 | 원인 | 해결 방법 |
| --- | --- | --- |
| 외부 API 호출 실패 | API Key 누락 또는 환경 변수 오타 | `.env`와 Render Environment Variables 값을 확인 |
| AI가 없는 장소를 추천 | 실제 관광 데이터 없이 AI 단독 응답 사용 | TourAPI 조회 결과를 프롬프트에 주입 |
| 키워드 4개 이상 선택됨 | 프론트엔드 선택 제한 로직 누락 | Vanilla JS에서 선택 개수 검증 및 툴팁 표시 |

## 배포 주소

추후 Render 배포 완료 후 서비스 URL을 기재합니다.
