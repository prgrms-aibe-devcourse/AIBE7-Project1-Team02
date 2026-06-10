# API_SPEC.md

## MVP 지원 범위

MVP 단계의 여행 추천 및 일정 생성 API는 대한민국 국내 여행만 지원한다. `province`는 광역시/도, `city`는 시/군/구를 의미하며, 국내 관광 데이터 조회는 한국관광공사 TourAPI 4.0 활용을 우선 고려한다. 해외 여행은 추후 확장한다.

## 구현 상태

2026년 6월 9일 기준 Express 서버에 구현된 API는 아래 네 개다.

- `GET /api/health`
- `GET /api/config`
- `GET /api/destinations/recommended`
- `GET /api/destinations/recommended/filters`
- `GET /api/user/bookmarks`
- `POST /api/user/bookmarks`
- `DELETE /api/user/bookmarks/:destinationId`
- `GET /api/travel/list` (임시 일정 테이블)
- `GET /api/travel/:id` (임시 일정 테이블)

인증은 현재 프런트엔드에서 Supabase Auth를 직접 사용한다. 아래 표에서
`PLANNED`로 표시한 API는 명세만 정의된 상태다.

## 공통 응답 형식

### 성공

```json
{
  "success": true,
  "data": {},
  "message": "요청 성공"
}
```

### 실패

```json
{
  "success": false,
  "message": "에러 내용"
}
```

## API 목록

| 상태 | Method | URL | Request Body | Response Body | Error Case | 담당자 |
| --- | --- | --- | --- | --- | --- | --- |
| DONE | GET | `/api/health` | 없음 | 서버 상태, 확인 시각 | 서버 미실행 | 백엔드 |
| DONE | GET | `/api/config` | 없음 | 브라우저용 Supabase URL, Anon Key | 없음, 환경 변수 검증 미구현 | 백엔드 |
| DONE | GET | `/api/destinations/recommended` | Authorization Bearer Token, 선택 Query `limit`, `page`, `pageSize`, `province`(복수), `keyword`(복수) | 사용자 MBTI와 점수순 관광지, 페이지 정보 | 로그인 만료, MBTI 미검사, Supabase 조회 실패 | 백엔드 |
| DONE | GET | `/api/destinations/recommended/filters` | Authorization Bearer Token | 추천 데이터의 지역, 키워드 옵션 | 로그인 만료, MBTI 미검사, Supabase 조회 실패 | 백엔드 |
| DONE | GET | `/api/user/bookmarks` | Authorization Bearer Token | 저장한 여행지 ID 목록 | 로그인 만료, Supabase 조회 실패 | 백엔드 |
| DONE | POST | `/api/user/bookmarks` | Authorization Bearer Token, `destinationId` | 북마크 저장 결과 | 로그인 만료, 유효하지 않은 여행지, Supabase 저장 실패 | 백엔드 |
| DONE | DELETE | `/api/user/bookmarks/:destinationId` | Authorization Bearer Token | 북마크 해제 결과 | 로그인 만료, 유효하지 않은 여행지, Supabase 삭제 실패 | 백엔드 |
| DONE | PATCH | `/api/travel/:id/status` | Authorization Bearer Token, `status` | 변경된 일정 상태 | 로그인 만료, 유효하지 않은 상태, 일정 없음 | 백엔드 |
| DONE | DELETE | `/api/travel/:id` | Authorization Bearer Token | 삭제된 일정 ID | 로그인 만료, 일정 없음, Supabase 삭제 실패 | 백엔드 |
| PLANNED | POST | `/api/auth/signup` | 아이디, 비밀번호, 닉네임 | 회원가입 결과 | 중복 아이디, 비밀번호 형식 오류 | 백엔드 |
| PLANNED | POST | `/api/user/preference` | MBTI, 여행 템포, F&B 민감도 | MBTI 기반 성향 정보, 저장 결과 | 로그인 정보 없음, 필수 선택값 누락 | 백엔드 |
| PLANNED | GET | `/api/user/preference` | 없음 | 저장된 사용자 성향 정보 | 로그인 정보 없음, 성향 정보 없음 | 백엔드 |
| PLANNED | POST | `/api/travel/recommend` | 광역시/도, 시/군/구, 날짜, 동반자 유형, 키워드 | 맞춤 여행지 추천 결과 | 필수 입력값 누락, 지원하지 않는 지역, 외부 API 호출 실패 | 백엔드 |
| PLANNED | POST | `/api/travel/plan` | 추천 여행지, 기간, 사용자 성향, 관광 데이터 | AI 여행 일정 | 관광 데이터 없음, AI 응답 실패 | 백엔드 |
| DONE | GET | `/api/travel/list` | Authorization Bearer Token | 임시 저장 일정 목록 | 로그인 정보 없음, 임시 테이블 조회 실패 | 백엔드 |
| DONE | GET | `/api/travel/:id` | Authorization Bearer Token | 임시 일정과 일차별 여행지 | 일정 없음, 로그인 정보 없음 | 백엔드 |
| PLANNED | PATCH | `/api/travel/:id` | 수정할 일정 정보 | 수정된 여행 일정 | 일정 없음, 권한 없음 | 백엔드 |

## 상세 예시

### GET /api/health

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-06-08T07:29:43.035Z"
  },
  "message": "서버가 정상 작동 중입니다."
}
```

### GET /api/config

Response:

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

이 API는 브라우저에서 사용 가능한 Supabase Anon Key와 카카오맵
JavaScript 키만 반환한다.
`SUPABASE_SERVICE_ROLE_KEY`는 절대 응답에 포함하지 않는다.

### GET /api/destinations/recommended

로그인 사용자의 `travel_mbti_results.mbti_type`을 조회하거나 공개 조회용
`mbtiType` 쿼리를 받은 뒤,
`destination_mbti_scores`에 저장된 해당 유형의 점수를 내림차순으로
정렬한다. 관광지 기본 정보는 `destinations`, 키워드는
`destination_keywords`에서 함께 조회한다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

공개 조회에서는 Authorization Header 없이 `mbtiType` 쿼리를 전달한다.

Query:

```text
mbtiType: 선택, 공개 조회용 MBTI 유형, 16개 유형만 허용
limit: 선택, 상위 추천용 기본 6, 최대 10
page: 선택, 전체 탐색용 페이지 번호, 기본 1
pageSize: 선택, 전체 탐색용 페이지 크기, 기본 12, 최대 24
province: 선택/반복 가능, 광역시/도 일치 필터
keyword: 선택/반복 가능, 여행지 키워드 일치 필터
```

복수 `province`는 지역 간 OR, 복수 `keyword`는 키워드 간 OR로 처리한다.
지역 필터와 키워드 필터를 함께 전달하면 두 분류 사이는 AND로 처리한다.

```http
GET /api/destinations/recommended?page=1&pageSize=12&province=서울특별시&province=부산광역시&keyword=힐링&keyword=자연
```

Response:

```json
{
  "success": true,
  "data": {
    "mbtiType": "INFP",
    "recommendations": [
      {
        "destinationId": 93,
        "destinationName": "가파도 소망전망대",
        "description": "제주 본 섬과 한라산, 바다를 조망할 수 있는 장소입니다.",
        "address": "제주특별자치도 서귀포시 대정읍 가파리 513",
        "province": "제주특별자치도",
        "city": "서귀포시",
        "imageUrl": "https://example.com/destination.jpg",
        "score": 74,
        "reason": "contentType:12, textRule:1, textRule:2",
        "keywords": ["자연", "명소", "오션뷰"]
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "totalCount": 600,
      "totalPages": 50
    }
  },
  "message": "MBTI 맞춤 여행지 추천 조회 성공"
}
```

동점인 경우 `destination_id` 오름차순으로 정렬한다.
`limit`만 전달한 상위 추천 조회에서는 `pagination`을 생략한다.

Error Case:

```json
{
  "success": false,
  "data": {
    "needsSurvey": true
  },
  "message": "저장된 여행 MBTI 결과가 없습니다."
}
```

### GET /api/destinations/recommended/filters

로그인 사용자의 여행 MBTI 추천 데이터 또는 공개 조회용 `mbtiType`에
존재하는 광역시/도와 키워드 목록을 반환한다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

공개 조회에서는 Authorization Header 없이 `mbtiType` 쿼리를 전달한다.

Response:

```json
{
  "success": true,
  "data": {
    "mbtiType": "INFP",
    "provinces": ["강원특별자치도", "제주특별자치도"],
    "keywords": ["자연", "힐링"]
  },
  "message": "추천 여행지 필터 조회 성공"
}
```

### GET /api/user/bookmarks

로그인 사용자가 북마크한 여행지 ID 목록을 조회한다.
서버는 사용자의 Supabase access token과 anon key로 RLS 정책을 적용해
조회하며, service role key에 의존하지 않는다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Response:

```json
{
  "success": true,
  "data": {
    "destinationIds": [93, 14],
    "bookmarks": [
      {
        "destinationId": 93,
        "createdAt": "2026-06-09T12:00:00Z",
        "destination": {
          "destinationId": 93,
          "destinationName": "가파도 소망전망대",
          "description": "제주 본 섬과 한라산, 바다를 조망할 수 있는 장소입니다.",
          "address": "제주특별자치도 서귀포시 대정읍 가파리 513",
          "province": "제주특별자치도",
          "city": "서귀포시",
          "imageUrl": "https://example.com/destination.jpg"
        }
      }
    ]
  },
  "message": "북마크 목록 조회 성공"
}
```

### POST /api/user/bookmarks

로그인 사용자의 여행지 북마크를 저장한다. 동일 여행지는 중복 저장하지
않는다. 이미 저장된 여행지를 다시 저장 요청해도 성공 응답으로 처리한다.
서버는 사용자의 Supabase access token과 anon key로 RLS 정책을 적용해
저장하며, service role key에 의존하지 않는다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Request:

```json
{
  "destinationId": 93
}
```

Response:

```json
{
  "success": true,
  "data": {
    "bookmark_id": 1,
    "user_id": "00000000-0000-0000-0000-000000000000",
    "destination_id": 93,
    "created_at": "2026-06-09T12:00:00Z"
  },
  "message": "북마크 저장 성공"
}
```

### DELETE /api/user/bookmarks/:destinationId

로그인 사용자의 여행지 북마크를 해제한다.
서버는 사용자의 Supabase access token과 anon key로 RLS 정책을 적용해
삭제하며, service role key에 의존하지 않는다.

Response:

```json
{
  "success": true,
  "data": {
    "destinationId": 93
  },
  "message": "북마크 해제 성공"
}
```

### POST /api/auth/signup

Request:

```json
{
  "userId": "traveler01",
  "password": "password1234",
  "nickname": "여행자"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "userId": "traveler01",
    "nickname": "여행자"
  },
  "message": "회원가입 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "이미 사용 중인 아이디입니다."
}
```

### POST /api/user/preference

Request:

```json
{
  "mbtiType": "INFP",
  "badge": "꿈꾸는 이야기 여행가",
  "travelTempo": "relaxed",
  "foodPreference": "local"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "mbtiType": "INFP",
    "badge": "꿈꾸는 이야기 여행가",
    "travelTempo": "relaxed",
    "foodPreference": "local"
  },
  "message": "성향 분석 완료"
}
```

프런트엔드 화면에서는 내부 추천 기준인 `mbtiType` 코드보다 `badge`
칭호를 우선 표시한다.

Error Case:

```json
{
  "success": false,
  "message": "필수 선택값이 누락되었습니다."
}
```

### POST /api/travel/recommend

Request:

```json
{
  "province": "제주특별자치도",
  "city": "제주시",
  "startDate": "2026-07-10",
  "endDate": "2026-07-12",
  "companionType": "friend",
  "keywords": ["오션뷰", "맛집탐방", "힐링"]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "destination": "제주 협재해수욕장",
        "score": 87,
        "matchedKeywords": ["오션뷰", "힐링"],
        "reason": "여유로운 일정과 오션뷰 선호에 적합합니다."
      }
    ]
  },
  "message": "추천 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "최소 1개 이상의 키워드를 선택해야 합니다."
}
```

MVP 범위를 벗어난 해외 지역 요청에는 아래와 같이 응답한다.

```json
{
  "success": false,
  "message": "현재는 대한민국 국내 여행만 지원합니다."
}
```

### POST /api/travel/plan

로그인 사용자의 입력값으로 임시 여행 일정을 생성해 `trip_plans`와
`trip_plan_items`에 저장한다. 현재 관광지 데이터 규모를 고려해 최대
7일 일정까지만 생성하며, 서버는 먼저 DB 관광지 후보를 선정한 뒤 fallback
일정 생성기로 DAY별 일정을 구성한다. fallback 일정은 후보가 충분하면 각 DAY에
최소 1개 관광지를 먼저 배치하고, 하루 최대 3개 관광지를 좌표 거리 기준으로
가까운 곳끼리 묶어 추가 배치한다. 추후 AI Provider를 연결할
때도 후보 관광지 목록 안에서만 일정이 생성되도록 이 후보 선정 계층을 재사용한다.
이미지가 없는 관광지는 일정 후보에서 제외한다.
선택 조건으로 조회된 후보 관광지 수가 여행 일수보다 적으면 일정을 생성하지
않고 데이터 부족 메시지를 반환한다.

Request:

```json
{
  "startDate": "2026-07-10",
  "endDate": "2026-07-12",
  "peopleCount": 2,
  "region": "제주특별자치도",
  "memo": "바다를 천천히 보고 싶어요.",
  "destinationId": 93
}
```

Response:

```json
{
  "success": true,
  "data": {
    "trip": {
      "planId": 1,
      "title": "제주특별자치도 여행",
      "summary": "제주특별자치도 중심으로 3일 동안 둘러보는 2명 여행 일정입니다.",
      "status": "planning"
    },
    "plan": {
      "days": [
        {
          "day": 1,
          "items": [
            {
              "placeName": "협재해수욕장",
              "description": "오션뷰를 즐기며 가볍게 산책합니다.",
              "destinationId": 93,
              "imageUrl": "https://example.com/hyeopjae.jpg",
              "address": "제주특별자치도 제주시 한림읍",
              "latitude": 33.3948,
              "longitude": 126.2395
            }
          ]
        }
      ]
    }
  },
  "message": "일정 생성 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "일정 생성에 사용할 관광지 데이터가 없습니다."
}
```

```json
{
  "success": false,
  "message": "여행 일정은 최대 7일까지만 생성할 수 있습니다."
}
```

```json
{
  "success": false,
  "message": "여행지 데이터가 부족하여 3일 일정을 생성할 수 없습니다. 현재 조건에서는 1개의 관광지만 사용할 수 있습니다."
}
```

### GET /api/travel/list

로그인 사용자가 일정 확인 페이지를 개발하는 동안 임시 `trip_plans`,
`trip_plan_items` 테이블의 테스트 데이터를 조회한다. 임시 테이블에는
`user_id`가 없으므로 인증된 사용자에게 테스트 일정 전체를 반환한다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Response:

```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "planId": 1,
        "title": "제주 힐링 여행",
        "mbtiType": "INFP",
        "region": "제주특별자치도",
        "totalDays": 2,
        "aiSummary": "자연 속에서 여유롭게 쉬는 일정입니다.",
        "status": "completed",
        "completedAt": "2026-06-10T10:00:00Z",
        "itemCount": 2,
        "items": []
      }
    ]
  },
  "message": "저장 일정 조회 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "로그인 정보가 없습니다."
}
```

### GET /api/travel/:id

임시 일정 ID에 해당하는 DAY별 관광지와 메모를 조회한다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Response:

```json
{
  "success": true,
  "data": {
    "plan": {
      "planId": 1,
      "title": "제주 힐링 여행",
      "mbtiType": "INFP",
      "region": "제주특별자치도",
      "totalDays": 2,
      "status": "completed",
      "completedAt": "2026-06-10T10:00:00Z",
      "items": [
        {
          "itemId": 1,
          "dayNumber": 1,
          "orderIndex": 1,
          "memo": "해변 산책",
          "destination": {
            "destinationId": 93,
            "destinationName": "협재해수욕장",
            "address": "제주특별자치도 제주시 한림읍",
            "latitude": 33.3947,
            "longitude": 126.2397
          }
        }
      ]
    }
  },
  "message": "일정 상세 조회 성공"
}
```

### PATCH /api/travel/:id/status

임시 일정의 상태를 변경한다. 일정은 `planning`, `in_progress`,
`completed` 세 상태를 가진다. 일정 확인 페이지에서 여행 시작 버튼을
누르면 `in_progress`로 변경하고, 모든 여행지를 완료하면 `completed`로
저장하며 `completedAt`을 기록한다. `planning` 또는 `in_progress`로
변경하면 `completedAt`은 `null`로 초기화한다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Request:

```json
{
  "status": "in_progress"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "plan": {
      "planId": 1,
      "title": "제주 힐링 여행",
      "status": "completed",
      "completedAt": "2026-06-10T10:00:00Z"
    }
  },
  "message": "일정 상태 변경 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "일정을 찾을 수 없습니다."
}
```

### DELETE /api/travel/:id

로그인 사용자가 저장한 임시 여행 일정을 삭제한다. `trip_plan_items`는
`trip_plans` 외래 키의 `ON DELETE CASCADE` 정책에 따라 함께 삭제된다.

Request Header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Response:

```json
{
  "success": true,
  "data": {
    "planId": 1
  },
  "message": "일정 삭제 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "일정을 찾을 수 없습니다."
}
```

임시 테이블은 정식 일정 스키마 병합 후 제거하며, API 응답 계약은 병합된
테이블 구조에 맞춰 다시 조정한다.
