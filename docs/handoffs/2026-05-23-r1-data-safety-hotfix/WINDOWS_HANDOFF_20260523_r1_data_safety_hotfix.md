# Windows Handoff: R1 Data Safety Hotfix Smoke

작성일: 2026-05-23 KST
작성자: Mac Codex
대상: Windows 환경의 Codex

---

## 목적

R1 Data Safety Hotfix가 운영 서버에 배포된 뒤 Windows 사용자 흐름이 그대로 정상인지 확인한다.

이번 작업은 **Windows installer 재빌드가 아니다**. 서버 저장 안정화 후 Windows 웹/실행기 smoke만 수행한다.

---

## 먼저 읽을 문서

1. `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
2. `docs/maintenance_reports/aimax_release_reality_check_20260523.md`
3. `docs/maintenance_reports/aimax_r1_data_safety_hotfix_20260523.md`
4. `docs/deployments/oracle-deploy-20260523-173412.md`

---

## 운영 배포 기준

- R1 server.js SHA: `02123745e7e380bf5b9ba33cbff6d13a23e48f1666407e70795857b5924399fa`
- 운영 health expected:
  - `ok: true`
  - `storage.ok: true`
  - `storage.issues: []`
- Windows latest/min version remains `v1.0.17`.

---

## 금지 사항

- 실제 Naver 저장/발행/임시저장 금지
- paid AI call 금지
- paid Apify Actor run 금지
- API key, cookie, `.env`, browser profile, signed URL, raw private log 공유 금지

---

## Windows 확인 항목

1. `https://api.aimax.ai.kr/api/reports/health`
   - `storage.ok=true`
   - `storage.issues=[]`
2. `https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.17`
   - update required false
3. 웹 로그인 상태 확인
4. Windows 실행기 연결 상태 확인
5. AI/API 연결 상태 화면 접근
6. 오류 보고 화면 접근
7. dashboard/agent status가 무한 loading/busy에 빠지지 않는지 확인

---

## 반환 파일

같은 공유 폴더에 아래 파일을 작성한다.

`WINDOWS_RESULT_20260523_r1_data_safety_hotfix.md`

포함:

- Windows OS/브라우저/실행기 버전
- health/storage 확인 결과
- version API 확인 결과
- 웹 로그인/agent status 결과
- AI/API 연결 화면 결과
- 오류 보고 화면 결과
- blocker 목록
- no-paid/no-Naver-publish 원칙 준수 여부

---

## 완료 판정

완료 조건:

- `storage.ok=true`
- Windows v1.0.17 update not required
- 웹/실행기 기본 흐름 유지
- no-paid/no-Naver-publish 원칙 준수

blocker가 있으면 `blocked`로 반환한다.

