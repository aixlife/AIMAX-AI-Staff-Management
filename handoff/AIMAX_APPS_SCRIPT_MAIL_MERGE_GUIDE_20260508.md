# AIMAX Apps Script 발송 가이드 - 2026-05-08

## 결론

구글 주소록에 없어도 발송할 수 있다. Google Sheets에 CSV를 올리고 Apps Script가 `to`, `subject`, `body` 열을 읽어 Gmail에서 한 명씩 보내는 방식이다.

## 준비 파일

- 발송 CSV: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoff/private/aimax_setup_email_messages_20260508.csv`
- Apps Script 코드: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoff/aimax_mail_merge_apps_script_20260508.gs`

주의: CSV의 `setup_url`과 `body`에는 1회용 비밀번호 설정 링크가 들어 있다. 외부 공유 금지.

## 진행 순서

1. Google Drive에서 새 Google Sheets를 만든다.
2. `aimax_setup_email_messages_20260508.csv`를 첫 번째 시트에 가져온다.
3. 1행에 아래 열이 있는지 확인한다.
   - `to`
   - `subject`
   - `body`
4. Google Sheets 메뉴에서 `확장 프로그램` -> `Apps Script`를 연다.
5. 기본 코드를 모두 지우고 `aimax_mail_merge_apps_script_20260508.gs` 내용을 붙여넣는다.
6. 저장한다.
7. Google Sheets를 새로고침한다.
8. 상단 메뉴에 `AIMAX 발송`이 생기면 `3. 발송 상태 열 만들기`를 먼저 실행한다.
9. `1. 첫 행 테스트를 내 메일로 보내기`를 실행한다.
10. 본인 메일로 받은 테스트 내용을 확인한다.
11. 문제가 없으면 `2. 미발송 안내 메일 보내기`를 실행한다.

## 발송 단위

스크립트는 한 번에 최대 40건씩 보낸다.

146명 전체 발송은 메뉴를 약 4번 실행하면 된다.

- 1회차: 40건
- 2회차: 40건
- 3회차: 40건
- 4회차: 남은 26건

이미 발송된 행은 `send_status=sent`, `sent_at` 값이 기록되어 다시 보내지 않는다.

## 실패 처리

실패한 행은 아래 열에 기록된다.

- `send_status`: `failed`
- `send_error`: 실패 메시지

실패 원인을 확인한 뒤 해당 행의 `send_status`, `sent_at`, `send_error`를 비우고 다시 실행하면 재시도할 수 있다.

## Gmail 한도

Gmail 일반 계정은 보통 하루 500건, Google Workspace 계정은 더 높은 한도가 적용될 수 있다. 이번 146건은 일반 계정 기준으로도 보통 한도 안이다. 단, 해당 계정이 이미 당일 발송을 많이 했다면 제한될 수 있다.

## 추천 운영

이번 146건은 이 Apps Script 방식으로 처리하고, 다음 phase에서 Resend/AWS SES/Postmark 같은 트랜잭션 메일 서비스를 붙이는 것을 추천한다. 그러면 서버가 설정 링크 생성, 발송, 실패 로그, 재발급까지 직접 관리할 수 있다.
