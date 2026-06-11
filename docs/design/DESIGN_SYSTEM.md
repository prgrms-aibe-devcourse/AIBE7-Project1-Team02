# 디자인 시스템

## 방향

Packing은 짙은 녹색 계열을 중심으로 카드, 둥근 버튼, 여행가 칭호
배지를 사용하는 여행 서비스 UI입니다. 페이지별 CSS는 유지하되 공통
레이아웃과 피드백 UI를 우선 재사용합니다.

## 공통 구성

| 구성 | 파일 |
| --- | --- |
| 기본 레이아웃·공통 토큰 | `public/styles/main.css` |
| 헤더·사이드바 로더 | `public/scripts/layout.js` |
| 공통 안내 모달 | `public/styles/ui-feedback.css` |
| 공통 안내 동작 | `public/scripts/ui-feedback.js` |
| 여행가 칭호 배지 | `public/scripts/traveler-profile.js` |

## 피드백 모달

브라우저 기본 `alert`, `confirm` 대신 `window.PackingUI`를 사용합니다.

- `info`: 일반 안내
- `success`: 저장·수정 완료
- `warning`: 입력 누락과 제한
- `error`: API·DB 오류
- `danger`: 삭제·초기화·회원 탈퇴

복구 불가능한 작업은 확인과 취소 버튼을 함께 제공합니다.

## 여행가 칭호 배지

MBTI 문자열을 직접 강조하기보다 유형별 여행가 칭호와 아이콘을
표시합니다.

- 헤더: 작은 compact 배지
- 추천·성향 결과: 일반 배지
- 프로필 아바타 크기와 배지 크기는 독립적으로 관리

## 카드와 이미지

- 여행지 카드는 레이아웃이 흔들리지 않도록 고정 비율 사용
- 이미지는 `object-fit: cover`
- 잘못된 fallback 이미지를 반복하지 않음
- 이미지가 없으면 아이콘과 `이미지 없음` 문구 표시
- 일정 생성 후보와 주요 추천 화면은 이미지 없는 관광지를 제외

## 모달

- 상세정보, 필터, 정책, 일정 DAY 정보에 사용
- 화면 최상단 레이어에 표시
- 배경 클릭, 닫기 버튼, 가능한 경우 Escape로 닫기
- 본문이 길면 모달 내부 스크롤 사용
- 닫은 뒤 이전 목록·모달 상태 복원

## 아이콘과 에셋

- 아이콘: Lucide CDN
- 정적 이미지: `public/assets/images`
- 원격 관광지 이미지: Supabase의 `destinations.image_url`
- 사용하지 않는 중복 이미지는 추가하지 않음

## 접근성 기준

- 버튼은 `button` 요소와 명확한 텍스트 또는 `aria-label` 사용
- 모달은 `aria-hidden` 상태 갱신
- 키보드 Escape 닫기 지원
- 비활성 버튼은 클릭만 차단하고 금지 커서를 노출하지 않음
- 색상만으로 상태를 구분하지 않고 텍스트 배지를 함께 사용
