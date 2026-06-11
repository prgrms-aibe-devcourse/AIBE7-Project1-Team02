# TourAPI 여행지 데이터 가공

## 목적

TourAPI 원본을 추천 화면에서 즉시 사용할 수 있는 관광지 정보, 통제
키워드, MBTI 16유형 적합도 점수로 변환합니다. 외부 API를 사용자 요청마다
호출하지 않고 사전 가공 데이터를 조회해 응답 속도와 추천 기준의
일관성을 확보합니다.

## 현재 데이터와 향후 적재 방식

현재 서비스는 초기 방식으로 수집·가공한 관광지 DB를 사용합니다.
이후 수집 로직은 특정 글자로 시작하는 데이터나 앞쪽 페이지만 편중되지
않도록 17개 지역과 관광 유형별 페이지를 분산 조회하는 방식으로
개선했습니다.

향후에는 개선된 스크립트를 주기적으로 실행해 지역·유형 편중을 줄이고
변경된 설명과 이미지를 갱신할 예정입니다.

## 지역별 목표

지원 지역은 대한민국 17개 광역시·도입니다. 각 지역은 최대 100개를
목표로 다음 비율을 적용합니다.

| TourAPI 콘텐츠 유형 | 코드 | 지역별 목표 |
| --- | ---: | ---: |
| 관광지 | 12 | 40 |
| 문화시설 | 14 | 25 |
| 음식점 | 39 | 25 |
| 레포츠 | 28 | 10 |

실제 저장 수는 TourAPI 원본 수량과 필수 필드 검증 결과에 따라 목표보다
적을 수 있습니다.

## 처리 흐름

```text
지역·콘텐츠 유형 선택
-> totalCount로 전체 페이지 계산
-> 앞·중간·뒤 구간의 페이지 분산 선택
-> 목록 필수 필드 검증
-> contentId 중복 제거
-> 상세 설명 조회
-> 필드 정규화
-> 키워드 규칙 적용
-> MBTI 축 및 16유형 점수 계산
-> Supabase 일괄 upsert
```

## 저장 조건

다음 값이 모두 있는 관광지만 저장합니다.

- 주소
- 대표 이미지
- 위도와 경도
- 상세 설명
- TourAPI `contentid`

`tour_content_id`를 upsert 기준으로 사용해 재실행 시 같은 관광지가
중복 생성되지 않도록 합니다.

## 페이지 분산 조회

- 기본 페이지 크기: 50
- 기본 유형별 최대 선택 페이지: 3
- 전체 페이지 수는 TourAPI `totalCount`로 계산
- 선택 페이지는 전체 구간에 균등하게 분산
- `TOUR_API_MAX_PAGES=0`이면 모든 페이지 조회
- HTTP 429는 일일 호출량 초과로 판단해 전체 실행 중단
- 5xx 응답은 최대 3회 재시도

## 입력 필드

| TourAPI 필드 | 저장 및 가공 목적 |
| --- | --- |
| `contentid` | 중복 제거와 upsert 식별자 |
| `contenttypeid` | 관광 유형 규칙 |
| `title` | 여행지명과 텍스트 규칙 |
| `overview` | 설명과 키워드 규칙 |
| `cat1`, `cat2`, `cat3` | 분류 코드 |
| `addr1`, `addr2` | `province`, `city`, 주소 |
| `mapx`, `mapy` | 경도, 위도 |
| `firstimage`, `firstimage2` | 대표 이미지 |

## 키워드와 MBTI 점수

콘텐츠 유형, 여행지명, 설명, 주소를 규칙과 비교해 허용된 키워드만
생성합니다. 각 축은 50점에서 시작해 일치 규칙에 따라 가감하고 0~100
범위로 제한합니다.

```text
INFP = (I + N + F + P) / 4
ESTJ = (E + S + T + J) / 4
```

- 키워드: `destination_keywords`
- 유형별 점수: `destination_mbti_scores`
- 현재 출처: `RULE`
- 현재 규칙 버전: `mbti-rule-v1`
- 같은 여행지·키워드와 여행지·MBTI 조합은 upsert

## 실행

```bash
npm run import:tour
```

선택 환경 변수:

```env
TOUR_API_REGIONS=서울특별시,부산광역시
TOUR_API_PAGE_SIZE=50
TOUR_API_MAX_PAGES=3
TOUR_API_REQUEST_DELAY_MS=150
```

필수 환경 변수:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TOUR_API_KEY=
```

## 코드 위치

```text
src/scripts/importTourData.js
src/scripts/fillDescriptions.js
src/scripts/recalculateMbti.js
src/services/destination-processing/
```

규칙 변경 시 테스트와 `rule_version`을 함께 갱신합니다.
