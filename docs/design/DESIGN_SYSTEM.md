# Design System

## Feedback Dialog

브라우저 기본 `alert`, `confirm` 대신 서비스 공통 피드백 다이얼로그를
사용한다.

- `info`: 일반 안내 및 입력 확인
- `success`: 저장, 수정, 복사 등 작업 완료
- `warning`: 필수 입력 누락 및 제한 안내
- `error`: API 또는 저장 처리 실패
- `danger`: 삭제, 초기화, 회원 탈퇴 등 복구 불가능한 작업 확인

위험 작업은 확인과 취소 버튼을 함께 제공한다. 성공 후 새로고침이나
페이지 이동이 필요한 경우 사용자가 확인 버튼을 누른 뒤 진행한다.

## Image Assets

- 서비스에서 사용하는 정적 이미지는 `public/assets/images`에서 관리한다.
- MBTI 아이콘은 `public/assets/icons/mbti`에서 관리한다.
- 사용하지 않는 이미지와 중복 fallback 이미지는 저장하지 않는다.
