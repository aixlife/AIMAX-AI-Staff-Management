# AIMAX 온보딩 설정 링크 진행 현황 - 2026-05-08

## 현재 상태

- 146명 계정 생성 완료
  - 통합: 137명
  - 예리: 9명
- 운영 서버에 비밀번호 설정 링크 기능 배포 완료
  - 공개 페이지: `https://api.aimax.ai.kr/setup`
  - 웹앱: `https://api.aimax.ai.kr/app`
- Caddy 공개 라우팅에 `/setup*` 추가 완료
- 146명용 1회용 비밀번호 설정 링크 생성 완료
- 설정 링크 만료: 2026-05-15 22:46 KST

## 중요한 변경

- 설정 링크 발급 과정에서 기존 임시 비밀번호는 사용자 안내용으로 쓰지 않는 상태가 됐다.
- 앞으로 사용자에게는 임시 비밀번호를 보내지 않고, 본인이 설정 링크에서 새 비밀번호를 정한 뒤 로그인하게 하는 방식이 맞다.

## 자동 메일 발송 결과

- Gmail 커넥터가 1회용 설정 링크를 계정 접근권한과 같은 민감정보로 판단해 발송을 차단했다.
- AI가 Gmail을 우회해서 같은 링크를 발송하는 방식은 진행하지 않는다.
- 현재 필요한 것은 사람 또는 승인된 메일 발송 시스템이 private CSV를 검토하고 발송하는 절차다.

## private 파일 위치

민감정보가 포함된 파일은 공유 문서에 붙여넣지 않는다.

- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoff/private/aimax_setup_links_20260508.json`
- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoff/private/aimax_setup_email_messages_20260508.csv`
- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoff/private/aimax_setup_email_messages_20260508.json`

## 즉시 가능한 다음 선택지

1. 수동 메일 머지 발송
   - 위 private CSV를 사람이 직접 열어 검토한 뒤 Gmail/메일머지 도구로 발송한다.
   - CSV에는 각 사용자별 1회용 설정 링크가 포함되어 있으므로 외부 공유 금지.

2. 운영 메일 발송 시스템 구축
   - Resend, AWS SES, Postmark 같은 트랜잭션 메일 서비스를 붙인다.
   - 설정 링크는 서버에서 생성하고 서버가 바로 발송하게 만든다.
   - 발송 로그, 실패 재시도, 만료/재발급, 도메인 인증까지 같이 넣는 것이 좋다.

3. 이번 건은 수동 발송, 다음 업데이트에서 트랜잭션 메일화
   - 지금은 146명 안내가 우선이므로 private CSV로 수동 처리한다.
   - 다음 phase에서 온보딩 메일 시스템을 정식 기능으로 만든다.

## 검증 완료

- `https://api.aimax.ai.kr/setup` 공개 200 응답 확인
- 임의의 생성 링크 1건에 대해 `/api/auth/setup-token` 공개 API 200 응답 확인
- 안내 메일 생성 파일에 임시 비밀번호 문구가 들어가지 않는 것 확인
