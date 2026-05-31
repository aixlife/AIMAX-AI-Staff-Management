# Windows Handoff: R0 Release Reality Check

작성일: 2026-05-23 KST
작성자: Mac Codex
대상: Windows 환경의 Codex

---

## 목적

운영 서버에 반영된 AIMAX Phase 0~4가 Windows 실제 사용자 여정에서 막히지 않는지 확인한다.

이번 작업은 새 기능 구현이 아니라 **배포 후 현실 검증**이다.

---

## 중요한 용어

- "Windows AI"는 별도 AI가 아니라 **Windows PC에서 실행 중인 Codex**를 뜻한다.
- MacBook 환경에는 Codex, Claude Code, Antigravity가 있다.
- Windows Codex는 Windows 설치/실행기/업데이트/로컬 설정 흐름을 실제 환경에서 검증한다.

---

## 기준 문서

먼저 아래 문서를 읽는다.

1. `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
2. `docs/deployments/oracle-deploy-20260523-051021.md`
3. `docs/ai_staff_rephase_20260523.md`

Syncthing 공유 폴더 안에서 직접 빌드하지 말고, 필요한 경우 로컬 Windows 작업 폴더로 복사해서 확인한다.

---

## 운영 배포 기준

운영 배포는 완료된 상태로 본다.

- Windows latest/min version: `v1.0.17`
- macOS latest/min version: `v1.0.10`
- Live app markers:
  - `기존 실행기 키 가져오기`
  - `import_local_provider_secrets`
  - `웹 저장됨`
  - `local_settings_slow_after_delivered`
- No-paid smoke passed on Mac/server side:
  - `USER_SECRETS_SMOKE_OK`
  - `LOCAL_SECRET_IMPORT_SMOKE_OK`
  - `APIFY_LOCAL_READINESS_SMOKE_OK`
  - `YUNMI_ALPHA_SMOKE_OK`
  - `YUNMI_PAID_READY_SMOKE_OK`
  - `YUNMI_ACCESS_GATE_SMOKE_OK`

---

## 금지 사항

절대 하지 말 것:

- 실제 Naver 저장/발행/publish/save
- paid AI call
- paid Apify Actor run
- API key, cookie, .env, browser profile, signed URL, raw private log를 Shared-Bridge에 저장
- customer data 원문 복원 시도

필요하면 demo/test 계정과 redacted/synthetic 데이터만 사용한다.

---

## Windows 검증 체크리스트

### 1. 설치/업데이트

- Windows AIMAX 실행기가 `v1.0.17`로 업데이트되는지 확인
- `v1.0.16` 이하에서 접속 시 업데이트 필요 안내가 보이는지 확인
- 다운로드/설치 흐름이 멈춰 보이지 않는지 확인
- 설치 후 실행기 중복 실행/무한 재시작이 없는지 확인

### 2. 웹 로그인/실행기 연결

- `https://api.aimax.ai.kr/app` 접속
- 웹 로그인
- 실행기 연결
- 연결 후 dashboard status가 busy/loading에 영구 고정되지 않는지 확인
- 실패 시 오류 보고로 이어지는지 확인

### 3. 로컬 설정

- 웹 dashboard/settings에서 로컬 설정 열기
- 창이 빠르게 열리는지 확인
- 느리면 사용자가 현재 상태를 이해할 안내가 있는지 확인
- 저장 후 창이 다시 뜨거나 무한 로딩이 생기지 않는지 확인
- 빈 provider key 입력칸 저장으로 기존 key가 삭제되지 않는지 no-paid 방식으로 확인

### 4. AI/API 연결

- 웹 설정의 `AI/API 연결`에서 provider 상태가 보이는지 확인
- `기존 실행기 키 가져오기` 버튼이 보이는지 확인
- local agent가 지원하면 `import_local_provider_secrets` command가 처리되는지 확인
- raw key가 UI/log/report/stdout에 노출되지 않는지 확인
- Naver password/cookies/session은 가져오지 않는지 확인

### 5. 직원 카드/작업 흐름

- 예리/현주는 local-agent-required로 보이고, 실행기 필요성이 명확한지 확인
- 송이/윤미는 web-first/beta 정책에 맞게 local agent 없이 가능한 범위가 정확히 표시되는지 확인
- 미완성 직원이 실제 사용 가능한 직원처럼 노출되지 않는지 확인

### 6. 오류 보고

- 로컬 설정 timeout/실패/연결 실패가 오류 보고로 이어지는지 확인
- 보고 payload가 sanitized인지 확인
- 사용자가 영어 stack trace만 보지 않는지 확인

---

## 반환 파일

아래 파일을 같은 공유 폴더에 작성해서 반환한다.

`WINDOWS_RESULT_20260523_r0_release_reality_check.md`

반드시 포함:

- Windows OS/브라우저/실행기 버전
- 설치/업데이트 결과
- 웹 로그인/실행기 연결 결과
- 로컬 설정 열기/저장 결과
- AI/API 연결 및 기존 실행기 키 가져오기 결과
- 직원 카드/작업 흐름 확인 결과
- 오류 보고 확인 결과
- blocker 목록
- no-paid 원칙 준수 여부
- installer hash/size가 확인 가능하면 기록

---

## 완료 판정

완료로 표시하려면 아래가 모두 만족되어야 한다.

- Windows v1.0.17 설치/업데이트 흐름 확인
- 실행기 연결 후 무한 로딩 없음
- 로컬 설정 열기/저장 후 사용자 흐름이 막히지 않음
- AI/API 연결과 기존 실행기 키 가져오기 UX 확인
- no-paid/no-Naver-publish 원칙 준수
- blocker가 있으면 완료가 아니라 `blocked`로 반환

