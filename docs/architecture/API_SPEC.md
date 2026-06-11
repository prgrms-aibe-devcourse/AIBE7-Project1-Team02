# API 명세

## 공통

- Base URL: `/api`
- 인증 방식: `Authorization: Bearer <Supabase access token>`
- 응답 Content-Type: `application/json`

성공 응답:

```json
{
  "success": true,
  "data": {},
  "message": "요청 성공"
}
```

실패 응답:

```json
{
  "success": false,
  "message": "에러 내용"
}
```

## 구현 API 목록

| Method | URL | 인증 | 역할 |
| --- | --- | --- | --- |
| GET | `/api/health` | 없음 | 서버 상태 확인 |
| GET | `/api/config` | 없음 | 브라우저 공개 설정 조회 |
| GET | `/api/destinations/recommended` | 조건부 | MBTI 추천 또는 전체 목록 조회 |
| GET | `/api/destinations/recommended/filters` | 조건부 | 지역·키워드 필터 옵션 조회 |
| GET | `/api/user/preferences/batch` | 필요 | 여러 사용자의 여행가 칭호 조회 |
| GET | `/api/user/bookmarks` | 필요 | 내 북마크 조회 |
| POST | `/api/user/bookmarks` | 필요 | 북마크 추가 |
| DELETE | `/api/user/bookmarks/:destinationId` | 필요 | 북마크 해제 |
| DELETE | `/api/user/data` | 필요 | 사용자 활동 데이터 초기화 |
| DELETE | `/api/user/account` | 필요 | 사용자 데이터 및 Auth 계정 삭제 |
| POST | `/api/travel/plan` | 필요 | 여행 일정 생성 및 임시 저장 |
| GET | `/api/travel/list` | 필요 | 내 일정 목록 조회 |
| GET | `/api/travel/:planId` | 필요 | 일정 상세 조회 |
| PATCH | `/api/travel/:planId/status` | 필요 | 일정 상태 변경 |
| DELETE | `/api/travel/:planId` | 필요 | 일정 삭제 |

`/api/destinations/recommended`와 `/filters`는 로그인 토큰 대신 유효한
`mbtiType` 쿼리를 전달하면 공개 조회가 가능합니다. 현재 비로그인
여행지 탐색 화면은 `INFP`를 사용합니다.

## GET /api/health

서버 실행 상태와 현재 시각을 반환합니다.

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-06-11T00:00:00.000Z"
  },
  "message": "서버가 정상 작동 중입니다."
}
```

담당: Backend

## GET /api/config

브라우저에서 사용 가능한 공개 설정을 반환합니다.

```json
{
  "success": true,
  "data": {
    "supabaseUrl": "https://example.supabase.co",
    "supabaseAnonKey": "public-anon-key",
    "kakaoJavascriptKey": "public-javascript-key"
  },
  "message": "설정 정보 조회 성공"
}
```

`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TOUR_API_KEY`는 반환하지
않습니다.

담당: Backend

## GET /api/destinations/recommended

로그인 사용자의 `travel_mbti_results.mbti_type` 또는 공개 조회의
`mbtiType`을 기준으로 `destination_mbti_scores.score` 내림차순 결과를
반환합니다.

Query:

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `mbtiType` | 공개 조회 시 | MBTI 16유형 |
| `limit` | 선택 | TOP 추천 수, 최대 10 |
| `page` | 선택 | 목록 페이지, 기본 1 |
| `pageSize` | 선택 | 페이지 크기, 기본 12, 최대 24 |
| `province` | 선택 | 복수 전달 가능한 광역시·도 |
| `keyword` | 선택 | 복수 전달 가능한 키워드 |

복수 지역과 복수 키워드는 각 그룹 내부에서 OR, 지역과 키워드 그룹
사이에서는 AND로 처리합니다.

```http
GET /api/destinations/recommended?page=1&pageSize=12&province=서울특별시&keyword=힐링
```

Response data:

```json
{
  "mbtiType": "INFP",
  "recommendations": [
    {
      "destinationId": 93,
      "destinationName": "관광지명",
      "description": "관광지 설명",
      "address": "서울특별시 ...",
      "province": "서울특별시",
      "city": "종로구",
      "imageUrl": "https://...",
      "score": 74,
      "reason": "규칙 적용 결과",
      "keywords": ["문화", "힐링"]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "totalCount": 120,
    "totalPages": 10
  }
}
```

Error cases:

- `400`: MBTI 또는 페이지 파라미터 오류
- `401`: 로그인 토큰 없음·만료
- `404`: 로그인 사용자의 성향 분석 결과 없음
- `502`: Supabase 추천 조회 실패

담당: Backend

## GET /api/destinations/recommended/filters

추천 데이터에 사용할 지역과 키워드 목록을 반환합니다.

Request:

```http
GET /api/destinations/recommended/filters?mbtiType=INFP
```

Response data:

```json
{
  "mbtiType": "INFP",
  "provinces": ["서울특별시", "부산광역시"],
  "keywords": ["문화", "자연", "힐링"]
}
```

담당: Backend

## GET /api/user/preferences/batch

커뮤니티 작성자 표시를 위해 여러 사용자의 `mbti_type`, `badge`를
조회합니다.

```http
GET /api/user/preferences/batch?userIds=<uuid>,<uuid>
Authorization: Bearer <token>
```

현재 RLS 우회를 위해 서버의 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다.

담당: Backend

## GET /api/user/bookmarks

로그인 사용자의 북마크 ID와 관광지 정보를 반환합니다.

```http
GET /api/user/bookmarks
Authorization: Bearer <token>
```

Response data:

```json
{
  "destinationIds": [1, 2],
  "bookmarks": [
    {
      "destinationId": 1,
      "createdAt": "2026-06-11T00:00:00.000Z",
      "destination": {
        "destinationName": "관광지명",
        "description": "설명",
        "imageUrl": "https://..."
      }
    }
  ]
}
```

담당: Backend

## POST /api/user/bookmarks

```http
POST /api/user/bookmarks
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "destinationId": 1
}
```

동일 북마크가 이미 있으면 성공으로 처리합니다.

담당: Backend

## DELETE /api/user/bookmarks/:destinationId

로그인 사용자의 해당 북마크를 삭제합니다.

```http
DELETE /api/user/bookmarks/1
Authorization: Bearer <token>
```

담당: Backend

## DELETE /api/user/data

프로필과 약관 동의 이력은 유지하고 다음 활동 데이터를 삭제합니다.

- 성향 분석과 여행가 칭호
- 북마크
- `trips`, `trip_plans`, `trip_plan_items`
- 커뮤니티 게시글·댓글·좋아요·공유

```http
DELETE /api/user/data
Authorization: Bearer <token>
```

서버의 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다.

담당: Backend

## DELETE /api/user/account

사용자 활동과 약관 이력을 자식 테이블부터 삭제한 후 Supabase Auth
사용자를 삭제합니다.

```http
DELETE /api/user/account
Authorization: Bearer <token>
```

서버의 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다.

담당: Backend

## POST /api/travel/plan

DB의 실제 관광지를 후보로 조회하고 Gemini 또는 규칙 기반 fallback으로
최대 7일 일정을 생성합니다.

```http
POST /api/travel/plan
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "startDate": "2026-07-01",
  "endDate": "2026-07-03",
  "region": "서울특별시",
  "peopleCount": 2,
  "keywords": ["오션뷰", "인생샷"],
  "memo": "오션뷰, 인생샷",
  "destinationId": 10,
  "userId": "<uuid>",
  "accessToken": "<Supabase access token>"
}
```

현재 구현상 `GEMINI_API_KEY`가 서버에 설정되어 있어야 요청을 시작할 수
있습니다. Gemini 호출이 할당량 초과 또는 응답 오류로 실패하면, 이미
조회한 관광지를 대상으로 규칙 기반 fallback 일정을 반환합니다.

생성 규칙:

- 최대 7일
- 이미지가 있는 관광지만 사용
- 같은 관광지 중복 사용 금지
- 후보가 충분하면 DAY별 최소 1개
- DAY별 최대 3개
- 좌표가 있으면 가까운 관광지 우선 그룹화
- 요청 일수보다 후보가 적으면 생성 실패

담당: Backend

## GET /api/travel/list

내 `trip_plans`와 `trip_plan_items`, 연결된 관광지 정보를 최신순으로
반환합니다.

```http
GET /api/travel/list
Authorization: Bearer <token>
```

담당: Backend

## GET /api/travel/:planId

소유자와 일정 ID가 일치하는 일정 상세를 반환합니다.

Error cases:

- `400`: 잘못된 ID
- `401`: 인증 실패
- `404`: 일정 없음 또는 다른 사용자의 일정
- `500`: Supabase 조회·권한 실패

담당: Backend

## PATCH /api/travel/:planId/status

지원 상태:

- `planning`: 시작 전
- `in_progress`: 진행 중
- `completed`: 완료

```json
{
  "status": "in_progress"
}
```

`completed`로 변경하면 `completed_at`을 기록하고 다른 상태로 변경하면
초기화합니다.

담당: Backend

## DELETE /api/travel/:planId

소유권을 확인한 뒤 일정을 삭제합니다. `trip_plan_items`는 DB의 cascade
정책 또는 사용자 데이터 정리 순서에 따라 함께 삭제되어야 합니다.

담당: Backend

## 프런트엔드 직접 Supabase 요청

다음 기능은 현재 Express API가 아니라 브라우저에서 Supabase Auth·REST·
Storage API를 직접 사용합니다.

- 이메일 회원가입·로그인
- Google·Kakao OAuth
- 약관 동의 저장
- 프로필 조회·수정 및 아바타 업로드
- 성향 분석 결과 upsert
- 커뮤니티 CRUD
- 일정 생성 화면의 일부 저장 흐름

모든 직접 요청은 Anon Key와 사용자 Access Token을 사용하며, 해당
테이블과 Storage Bucket의 RLS 정책이 필요합니다.
