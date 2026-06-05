# AGENTS.md

## 프로젝트 개요

본 프로젝트는 사용자의 성향, 예산, 여행 스타일을 기반으로 AI가 여행지와 여행 일정을 추천하는 웹 서비스이다.

MVP 단계에서는 대한민국 국내 여행만 지원하며, 해외 여행은 추후 확장 범위로 둔다.

모든 AI Agent는 이 문서의 규칙을 최우선으로 따른다.

---

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

### AI

AI 모델은 아직 확정되지 않았다.

후보:

- OpenAI
- Google Gemini
- Groq
- 기타 LLM API

AI 관련 코드는 모델 교체가 가능하도록 작성한다.

---

## 핵심 원칙

- main 브랜치 직접 push 금지
- 기존 기능 삭제 금지
- API Key 하드코딩 금지
- 관련 없는 파일 수정 금지
- 대규모 리팩토링 금지
- 팀 승인 없는 폴더 구조 변경 금지
- 동작하는 코드를 임의로 갈아엎지 않기

---

## 브랜치 규칙

사용 가능한 브랜치명:

```text
feat/기능명
fix/수정명
docs/문서명
refactor/수정명
style/스타일명
```

예시:

```text
feat/travel-recommend
feat/user-survey
fix/api-error
docs/readme
style/main-page
```

금지:

```text
main 직접 작업
master 직접 작업
test
final
real-final
```

---

## Commit Convention

```text
feat: 기능 추가
fix: 버그 수정
docs: 문서 수정
style: CSS/UI 수정
refactor: 코드 구조 개선
chore: 설정 변경
```

예시:

```bash
git commit -m "feat: 여행 성향 입력 폼 구현"
git commit -m "fix: AI 추천 응답 오류 수정"
git commit -m "docs: API 명세 추가"
```

---

## 폴더 구조

기본 구조는 아래를 따른다.

```text
project-root/
├── public/
│   ├── index.html
│   ├── pages/
│   ├── styles/
│   ├── scripts/
│   └── assets/
├── src/
│   ├── routes/
│   ├── services/
│   │   ├── ai/
│   │   └── supabase/
│   ├── utils/
│   └── config/
├── docs/
│   ├── architecture/
│   │   ├── DB_SCHEMA.md
│   │   ├── API_SPEC.md
│   │   └── assets/
│   │       └── ERD.png
│   ├── design/
│   │   ├── DESIGN_SYSTEM.md
│   │   ├── PAGE_SPEC.md
│   │   └── assets/
│   └── management/
│       └── WBS.md
├── AGENTS.md
├── README.md
├── package.json
└── .gitignore
```

AI Agent는 팀 승인 없이 이 구조를 크게 변경하지 않는다.

---

## Frontend 규칙

### 파일 위치

- HTML: public/
- CSS: public/styles/
- JS: public/scripts/
- 이미지: public/assets/

### 네이밍 규칙

사용:

```js
const userInfo;
const travelResult;
const selectedBudget;
const travelStyle;
```

금지:

```js
const a;
const temp;
const data1;
const test123;
```

### 함수명

사용:

```js
getTravelRecommendation();
renderTravelResult();
saveUserPreference();
```

금지:

```js
go();
test();
abc();
```

---

## Backend 규칙

Express 서버는 src/ 내부에서 관리한다.

### 역할 분리

- routes/ : API 엔드포인트
- services/ : 비즈니스 로직
- services/ai/ : AI API 호출
- services/supabase/ : Supabase 관련 로직
- utils/ : 공통 함수
- config/ : 환경 설정

### 금지

- route 파일에 모든 로직 작성 금지
- API Key 직접 작성 금지
- AI SDK 호출 코드를 여러 파일에 중복 작성 금지

---

## API 규칙

API 경로는 /api로 시작한다.

사용:

```http
POST /api/travel/recommend
GET /api/travel/list
POST /api/user/preference
```

금지:

```http
POST /recommend
GET /data
POST /test
```

### 응답 형식

성공:

```json
{
  "success": true,
  "data": {},
  "message": "요청 성공"
}
```

실패:

```json
{
  "success": false,
  "message": "에러 내용"
}
```

---

## AI Service 규칙

AI 모델은 아직 미정이므로 교체 가능한 구조로 작성한다.

권장 구조:

```text
src/services/ai/
├── index.js
├── openai.js
├── gemini.js
└── groq.js
```

API Route에서는 직접 AI SDK를 호출하지 않는다.

사용:

```js
const result = await aiService.generateTravelPlan(prompt);
```

금지:

```js
const result = await openai.chat.completions.create(...);
```

AI Provider 교체 시 route 코드는 최대한 수정하지 않는다.

---

## Supabase 규칙

- Supabase URL과 Key는 .env에서 관리한다.
- 테이블 구조 변경 시 docs/architecture/DB_SCHEMA.md를 함께 갱신한다.
- 컬럼 삭제는 팀 승인 후 진행한다.
- Supabase 관련 코드는 src/services/supabase/에서 관리한다.
- DB 관련 코드나 Supabase 연동을 생성할 때 docs/architecture/DB_SCHEMA.md를 우선 참고한다.
- MVP 여행지 행정구역은 `province`를 광역시/도, `city`를 시/군/구 기준으로 관리한다.

---

## 국내 여행 데이터 규칙

- MVP 여행 추천 및 일정 생성 범위는 대한민국 국내 여행으로 제한한다.
- 국내 관광지 데이터는 한국관광공사 TourAPI 4.0 활용을 우선 고려한다.
- AI가 실제 데이터에 없는 국내 장소를 임의로 생성하지 않도록 신뢰 가능한 관광 데이터를 먼저 조회한다.
- 해외 여행 관련 국가, 행정구역, 통화, 시간대 구조는 팀 승인 후 확장한다.
- docs/architecture/API_SPEC.md 및 docs/architecture/DB_SCHEMA.md에서 국내 행정구역은 `province`(광역시/도), `city`(시/군/구)로 일관되게 표현한다.

---

## Environment Variables

민감 정보는 절대 코드에 직접 작성하지 않는다.

.env 예시:

```env
PORT=3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
AI_PROVIDER=
AI_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
```

금지:

```js
const apiKey = "실제 API KEY";
```

---

## Render 배포 규칙

- 배포 플랫폼은 Render를 사용한다.
- Render Environment Variables에 환경 변수를 등록한다.
- .env 파일은 GitHub에 올리지 않는다.
- 배포 전 로컬 실행을 확인한다.
- main 브랜치 기준으로 배포한다.

배포 전 확인:

```bash
npm install
npm start
```

---

## .gitignore 필수 항목

```gitignore
.env
.env.local
node_modules/
dist/
build/
.DS_Store
```

---

## README 필수 항목

README에는 아래 내용을 포함한다.

- 프로젝트 소개
- 기술 스택
- 팀원 역할
- 주요 기능
- 실행 방법
- 환경 변수 설명
- API 명세 링크
- DB 스키마 링크
- 디자인 시스템 링크
- 페이지 명세 링크
- WBS 링크
- 트러블 슈팅
- 배포 주소

---

## docs/architecture/DB_SCHEMA.md 필수 항목

DB 구조 문서에는 아래 내용을 포함한다.

```text
테이블 목록
테이블별 역할
컬럼 정의
테이블 관계
DBML
추후 확장 예정 테이블
```

DB 관련 코드나 Supabase 연동 작업 전 docs/architecture/DB_SCHEMA.md를 확인하고, 구현과 문서의 구조가 다르면 같은 작업에서 함께 갱신한다.

---

## docs/architecture/API_SPEC.md 필수 항목

API 명세에는 아래 내용을 포함한다.

```text
Method
URL
Request Body
Response Body
Error Case
담당자
```

예시:

```text
POST /api/travel/recommend

Request:
{
  "travelStyle": "힐링",
  "budget": "100만원",
  "days": 3
}

Response:
{
  "success": true,
  "data": {
    "destination": "제주도",
    "plan": []
  },
  "message": "추천 성공"
}
```

---

## docs/management/WBS.md 필수 항목

WBS에는 아래 내용을 포함한다.

```text
작업명
담당자
시작일
마감일
진행상태
비고
```

진행상태:

```text
TODO
IN_PROGRESS
DONE
BLOCKED
```

---

## 문서 우선순위

AI Agent는 아래 순서로 문서를 참고한다.

1. AGENTS.md
2. docs/design/PAGE_SPEC.md
3. docs/architecture/DB_SCHEMA.md
4. docs/architecture/API_SPEC.md
5. README.md

문서 간 충돌 시 상위 문서를 우선한다.

---

## UI 구현 규칙

새 페이지 구현 전 아래 순서로 문서를 확인한다.

1. docs/design/PAGE_SPEC.md 확인
2. docs/architecture/DB_SCHEMA.md 확인
3. docs/architecture/API_SPEC.md 확인
4. 구현 진행

docs/design/PAGE_SPEC.md에 없는 기능은 임의로 추가하지 않는다.

---

## 문서 관리 규칙

- DB 변경 시 docs/architecture/DB_SCHEMA.md를 갱신한다.
- API 변경 시 docs/architecture/API_SPEC.md를 갱신한다.
- 화면 변경 시 docs/design/PAGE_SPEC.md를 갱신한다.
- 디자인 시스템 변경 시 docs/design/DESIGN_SYSTEM.md를 갱신한다.

---

## AI Agent 작업 순서

AI Agent는 작업 시 아래 순서를 따른다.

1. 현재 코드 구조 확인
2. 수정 대상 파일 파악
3. DB 또는 Supabase 작업인 경우 docs/architecture/DB_SCHEMA.md 확인
4. 변경 계획 설명
5. 최소 범위로 코드 수정
6. 변경 내용 요약
7. 실행 또는 테스트 방법 안내

---

## AI Agent 금지 사항

AI Agent는 다음 행동을 하지 않는다.

- 기존 기능 삭제
- 임의로 전체 코드 재작성
- 폴더 구조 대규모 변경
- 사용하지 않는 패키지 설치
- API Key 하드코딩
- 다른 팀원 담당 파일 대량 수정
- CSS 전체 초기화
- main 브랜치 직접 수정
- 의미 없는 변수명 사용
- 테스트용 console.log 방치

---

## 협업 원칙

- 작업 시작 전 담당 기능을 명확히 한다.
- 같은 파일을 여러 명이 동시에 수정하지 않는다.
- PR 전 충돌 여부를 확인한다.
- 기능 완성 후 README 또는 API_SPEC를 갱신한다.
- 문제가 생기면 코드보다 원인을 먼저 공유한다.

---

## 최종 목표

이 프로젝트의 목표는 단순히 기능을 완성하는 것이 아니라,
AI를 활용하면서도 협업 가능한 구조와 유지보수 가능한 코드를 만드는 것이다.
