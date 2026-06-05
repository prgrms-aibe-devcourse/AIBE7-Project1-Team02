# API_SPEC.md

## MVP 지원 범위

MVP 단계의 여행 추천 및 일정 생성 API는 대한민국 국내 여행만 지원한다. `province`는 광역시/도, `city`는 시/군/구를 의미하며, 국내 관광 데이터 조회는 한국관광공사 TourAPI 4.0 활용을 우선 고려한다. 해외 여행은 추후 확장한다.

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

| Method | URL | Request Body | Response Body | Error Case | 담당자 |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/signup` | 아이디, 비밀번호, 닉네임 | 회원가입 결과 | 중복 아이디, 비밀번호 형식 오류 | 백엔드 |
| POST | `/api/user/preference` | 여행 템포, F&B 민감도 | 성향 칭호, 저장 결과 | 로그인 정보 없음, 필수 선택값 누락 | 백엔드 |
| GET | `/api/user/preference` | 없음 | 저장된 사용자 성향 정보 | 로그인 정보 없음, 성향 정보 없음 | 백엔드 |
| POST | `/api/travel/recommend` | 광역시/도, 시/군/구, 날짜, 동반자 유형, 예산, 키워드 | 맞춤 여행지 추천 결과 | 필수 입력값 누락, 지원하지 않는 지역, 외부 API 호출 실패 | 백엔드 |
| POST | `/api/travel/plan` | 추천 여행지, 기간, 사용자 성향, 관광 데이터 | AI 여행 일정 | 관광 데이터 없음, AI 응답 실패 | 백엔드 |
| GET | `/api/travel/list` | 없음 | 저장된 여행 일정 목록 | 로그인 정보 없음 | 백엔드 |
| GET | `/api/travel/:id` | 없음 | 특정 여행 일정 상세 | 일정 없음, 권한 없음 | 백엔드 |
| PATCH | `/api/travel/:id` | 수정할 일정 정보 | 수정된 여행 일정 | 일정 없음, 권한 없음 | 백엔드 |

## 상세 예시

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
  "travelTempo": "relaxed",
  "foodPreference": "local"
}
```

Response:

```json
{
  "success": true,
  "data": {
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
  "budget": 1000000,
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
