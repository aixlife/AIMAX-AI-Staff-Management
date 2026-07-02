당신은 AIMAX Windows 쪽 개발자입니다.

이번 작업의 목적은 Windows 관련 오류 보고가 올라왔을 때, Mac/Oracle 담당자를 기다리지 않고 운영 admin UI/API에서 오류 보고 상세를 직접 확인할 수 있는지 검증하고, 이후 Windows 오류 대응 루틴으로 사용할 방법을 정리하는 것입니다.

먼저 아래 두 파일을 읽고 그대로 진행하세요.

```text
20_Deploy-To-Windows/2026-06-01-windows-error-report-direct-check/WINDOWS_HANDOFF_20260601_error_report_direct_check.md
20_Deploy-To-Windows/2026-06-01-windows-error-report-direct-check/WINDOWS_AI_COPYPASTE_PROMPT_20260601_safe_error_report_inspection.md
```

핵심 규칙:

- Oracle SSH나 서버 파일 직접 접근은 하지 않습니다.
- `https://api.aimax.ai.kr/admin#reports`의 admin UI/API만 사용합니다.
- admin 로그인은 Minsoo가 직접 입력하거나 이미 승인된 admin 브라우저 세션만 사용합니다.
- 비밀번호, 쿠키, 세션 토큰, API 키, Naver ID/PW, auth header, signed URL은 어떤 파일/로그/스크린샷/결과 보고에도 남기지 않습니다.
- 오류 보고 상태 변경은 하지 않습니다. Minsoo가 특정 report_id와 변경할 status를 명시적으로 지시한 경우만 예외입니다.
- 유료 AI/API 생성, Apify, Naver 발행/예약은 실행하지 않습니다.

해야 할 일:

1. Windows에서 admin UI 접속이 가능한지 확인합니다.
2. `오류 보고` 탭에서 상태별 카운트와 Windows 관련 미완료 보고를 확인합니다.
3. 개별 report 상세 drawer 또는 `/api/admin/reports/:reportId`를 통해 redacted 상세 JSON을 확인할 수 있는지 검증합니다.
4. Windows 수정이 필요한 보고와 수정이 필요 없는 보고를 구분합니다.
5. admin UI/API만으로 부족한 정보가 있으면 SSH를 시도하지 말고 `read-only Oracle inspector 필요`라고 blocker로 남깁니다.

결과는 같은 Syncthing 폴더에 아래 파일명으로 작성하세요.

```text
WINDOWS_AI_RESULT_20260601_safe_error_report_inspection.md
```

결과 보고에는 다음만 포함하세요.

- Windows 버전과 브라우저
- admin UI/API 접근 가능 여부
- 개별 report 상세 JSON 확인 가능 여부
- 상태별 카운트
- 확인한 report_id 목록
- Windows 수정 필요/불필요 판단과 이유
- Mac/Oracle 추가 조치가 필요한 항목
- 비밀값을 저장하거나 복사하지 않았다는 확인

결과 보고에 admin 비밀번호, 쿠키, 세션 토큰, API 키, Naver ID/PW, auth header, signed URL, 고객 원문 비밀값은 절대 포함하지 마세요.
