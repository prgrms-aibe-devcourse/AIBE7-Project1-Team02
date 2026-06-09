# TourAPI MBTI 데이터 가공 규칙

## 목적

TourAPI의 실제 국내 관광지 데이터를 통제된 키워드와 MBTI 16유형
적합도 점수로 변환한다. MBTI는 심리 진단이 아니라 여행 취향 추천을
위한 분류 기준으로 사용한다.

## 현재 데이터 현황

2026년 6월 8일 `feature/destination-data` 브랜치 기준으로 TourAPI 콘텐츠
유형 6종에서 유형별 100개씩 총 600개 관광지를 수집하고 Supabase에
적재했다.

- 콘텐츠 유형: 관광지(12), 문화시설(14), 축제공연행사(15),
  여행코스(25), 레포츠(28), 음식점(39)
- 기본 정보 저장: `destinations`
- 통제 키워드 저장: `destination_keywords`
- MBTI 16유형 적합도 저장: `destination_mbti_scores`
- 설명이 없는 관광지는 TourAPI 상세 조회로 보강한 뒤 전체 점수를 재계산

현재 키워드의 `confidence`는 규칙 일치 결과로 모두 `1`을 저장한다.
키워드별 차등 가중 점수는 아직 없으며, 0~100 범위의 차등 점수는
MBTI 16유형 적합도에 적용한다.

## 처리 흐름

```text
TourAPI 유형별 원본 수집
-> 필드 정규화
-> destinations upsert
-> 누락된 overview 상세 조회 및 설명 보강
-> 콘텐츠 유형 규칙 적용
-> 명칭·소개·주소 텍스트 규칙 적용
-> E/I, S/N, T/F, J/P 축 점수 계산
-> MBTI 16유형 적합도 계산
-> 허용 키워드와 MBTI 점수를 Supabase에 upsert
```

## 입력 필드

| TourAPI 필드 | 사용 목적 |
| --- | --- |
| `contentid` | 여행지 중복 방지 및 upsert 식별자 |
| `contenttypeid` | 관광지, 문화시설, 축제, 레포츠, 음식점 등 1차 분류 |
| `title` | 여행지명과 텍스트 규칙 입력 |
| `overview` | 여행지 특징을 찾는 텍스트 규칙 입력 |
| `cat1`, `cat2`, `cat3` | 관광 분류 보조 입력 |
| `addr1`, `addr2` | 지역 및 텍스트 규칙 입력 |
| `mapx`, `mapy` | 경도와 위도 |
| `firstimage`, `firstimage2` | 대표 이미지 |

## MBTI 축 규칙

각 축은 50점에서 시작한다. 특정 특징이 한쪽 축에 가중치를 더하면
반대쪽 축에서는 같은 값을 뺀다. 최종 점수는 0~100 범위로 제한한다.

| 여행지 특징 | 주요 반영 축 |
| --- | --- |
| 축제, 공연, 번화가, 단체 체험 | E |
| 자연, 휴양, 산책, 조용한 관람 | I |
| 전통문화, 음식, 실물 체험, 명확한 정보 | S |
| 예술, 독특한 공간, 풍경, 새로운 경험 | N |
| 이동 효율, 운영 정보, 체계적인 시설 | T |
| 감성, 풍경, 낭만, 의미 있는 장소 | F |
| 예약, 해설, 정해진 코스와 운영시간 | J |
| 자유 관람, 레포츠, 즉흥 탐방 | P |

MBTI 유형별 최종 적합도는 해당 유형을 구성하는 네 축 점수의 평균이다.

```text
INFP 점수 = (I + N + F + P) / 4
ESTJ 점수 = (E + S + T + J) / 4
```

## 저장 규칙

- 키워드는 코드에 정의한 허용 목록에서만 생성한다.
- 여행지 하나에 동일 키워드를 중복 저장하지 않는다.
- 여행지 하나에 MBTI 유형별 점수를 하나씩 저장한다.
- 재가공 시 키워드와 점수는 upsert한다.
- 모든 결과에 `source`, `rule_version`을 기록한다.
- 현재 규칙 버전은 `mbti-rule-v1`이다.
- AI 분류 결과는 `source = AI`로 구분하며 규칙 결과를 임의로 덮어쓰지 않는다.

## 실행 스크립트

| 스크립트 | 역할 |
| --- | --- |
| `src/scripts/importTourData.js` | TourAPI 유형별 데이터 수집, 정규화, 최초 분류 및 Supabase 적재 |
| `src/scripts/fillDescriptions.js` | 설명이 비어 있는 관광지의 TourAPI 상세 설명 보강 |
| `src/scripts/recalculateMbti.js` | 저장된 설명을 포함해 키워드와 MBTI 점수 전체 재계산 |

세 스크립트는 `.env`의 `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `TOUR_API_KEY`를 사용한다.

## 서비스 코드 위치

```text
src/services/destination-processing/
├── index.js
├── tourDataNormalizer.js
├── mbtiRules.js
└── mbtiScorer.js
```

규칙을 변경하면 단위 테스트와 `rule_version`을 함께 갱신한다.
