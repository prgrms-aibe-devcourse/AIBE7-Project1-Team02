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
| DONE | GET | `/api/destinations/recommended` | Authorization Bearer Token, 선택 Query `limit`, `page`, `pageSize`, `province`, `keyword` | 사용자 MBTI와 점수순 관광지, 페이지 정보 | 로그인 만료, MBTI 미검사, Supabase 조회 실패 | 백엔드 |
| DONE | GET | `/api/destinations/recommended/filters` | Authorization Bearer Token | 추천 데이터의 지역, 키워드 옵션 | 로그인 만료, MBTI 미검사, Supabase 조회 실패 | 백엔드 |
| DONE | GET | `/api/user/bookmarks` | Authorization Bearer Token | 저장한 여행지 ID 목록 | 로그인 만료, Supabase 조회 실패 | 백엔드 |
| DONE | POST | `/api/user/bookmarks` | Authorization Bearer Token, `destinationId` | 북마크 저장 결과 | 로그인 만료, 유효하지 않은 여행지, Supabase 저장 실패 | 백엔드 |
| DONE | DELETE | `/api/user/bookmarks/:destinationId` | Authorization Bearer Token | 북마크 해제 결과 | 로그인 만료, 유효하지 않은 여행지, Supabase 삭제 실패 | 백엔드 |
| PLANNED | POST | `/api/auth/signup` | 아이디, 비밀번호, 닉네임 | 회원가입 결과 | 중복 아이디, 비밀번호 형식 오류 | 백엔드 |
| PLANNED | POST | `/api/user/preference` | MBTI, 여행 템포, F&B 민감도 | MBTI 기반 성향 정보, 저장 결과 | 로그인 정보 없음, 필수 선택값 누락 | 백엔드 |
| PLANNED | GET | `/api/user/preference` | 없음 | 저장된 사용자 성향 정보 | 로그인 정보 없음, 성향 정보 없음 | 백엔드 |
| PLANNED | POST | `/api/travel/recommend` | 광역시/도, 시/군/구, 날짜, 동반자 유형, 키워드 | 맞춤 여행지 추천 결과 | 필수 입력값 누락, 지원하지 않는 지역, 외부 API 호출 실패 | 백엔드 |
| PLANNED | POST | `/api/travel/plan` | 추천 여행지, 기간, 사용자 성향, 관광 데이터 | AI 여행 일정 | 관광 데이터 없음, AI 응답 실패 | 백엔드 |
| PLANNED | GET | `/api/travel/list` | 없음 | 저장된 여행 일정 목록 | 로그인 정보 없음 | 백엔드 |
| PLANNED | GET | `/api/travel/:id` | 없음 | 특정 여행 일정 상세 | 일정 없음, 권한 없음 | 백엔드 |
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
    "supabaseAnonKey": "public-anon-key"
  },
  "message": "설정 정보 조회 성공"
}
```

이 API는 브라우저에서 사용 가능한 Supabase Anon Key만 반환한다.
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
province: 선택, 광역시/도 일치 필터
keyword: 선택, 여행지 키워드 일치 필터
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
않는다.

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
    "badge": "여유를 즐기는 로컬 탐험가",
    "travelTempo": "relaxed",
    "foodPreference": "local"
  },
  "message": "성향 분석 완료"
}
```

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

Request:

```json
{
  "destination": "제주 협재해수욕장",
  "startDate": "2026-07-10",
  "endDate": "2026-07-12",
  "userPreference": {
    "travelTempo": "relaxed",
    "foodPreference": "local"
  },
  "places": [
    {
      "name": "협재해수욕장",
      "type": "tourist_spot",
      "address": "제주특별자치도 제주시 한림읍"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "planId": "plan_001",
    "days": [
      {
        "day": 1,
        "items": [
          {
            "time": "10:00",
            "placeName": "협재해수욕장",
            "description": "오션뷰를 즐기며 가볍게 산책합니다."
          }
        ]
      }
    ]
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

### GET /api/travel/list

Response:

```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "tripId": 1,
        "title": "제주 힐링 여행",
        "destinationName": "제주도",
        "imageUrl": "https://example.com/jeju.jpg",
        "startDate": "2026-07-10",
        "endDate": "2026-07-12",
        "companionType": "친구",
        "status": "planning",
        "itineraryCount": 6
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

Response:

```json
{
  "success": true,
  "data": {
    "trip": {
      "tripId": 1,
      "title": "제주 힐링 여행",
      "destinationName": "제주도",
      "startDate": "2026-07-10",
      "endDate": "2026-07-12",
      "status": "planning",
      "itineraries": [
        {
          "dayNumber": 1,
          "startTime": "10:00",
          "locationName": "협재해수욕장",
          "description": "해변 산책",
          "sortOrder": 1
        }
      ]
    }
  },
  "message": "일정 상세 조회 성공"
}
```

Error Case:

```json
{
  "success": false,
  "message": "일정을 찾을 수 없거나 조회 권한이 없습니다."
}
```
