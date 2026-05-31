# AIMAX Cross-Environment Phase Plan

작성일: 2026-05-23 KST
작성자: Mac Codex
목적: MacBook 환경의 Codex/Claude/Antigravity와 Windows 환경의 Codex가 같은 phase 기준으로 AIMAX 안정화와 리빌딩을 진행하기 위한 단일 역할/단계 문서

---

## 0. 용어 정정

이 문서에서는 AI를 제품명으로만 나누지 않는다. 같은 Codex라도 실행되는 물리 환경이 다르면 책임이 다르다.

| 이름 | 실제 의미 | 주 책임 |
|---|---|---|
| Mac Codex | 현재 MacBook 워크스페이스의 Codex | canonical repo 수정, 서버/웹 구현, Oracle 배포, Mac smoke, Windows handoff 작성 |
| Windows Codex | Windows PC 환경의 Codex | Windows 실행기/installer 빌드, Windows 전용 smoke, 설치/업데이트/실행기 검증 |
| Mac Claude Code | MacBook 환경의 Claude Code | UX/문구/운영 시나리오/기획/DB 설계 리뷰, 보조 구현 |
| Mac Antigravity | MacBook 환경의 Antigravity | 아키텍처/비즈니스 리스크/OS Bridge/Vision fallback 설계 검증 |
| AI Council | 외부 자문 워크플로 | sanitized context 기반 독립 의견, 최종 결정권 없음 |

최종 병합/배포 책임은 Mac Codex가 가진다. Windows 산출물은 Windows Codex가 만들고 검증하지만, 운영 서버 반영 전 Mac Codex가 산출물/해시/릴리스 메타데이터를 확인한다.

---

## 1. 현재 상태 기준

`docs/ai_staff_rephase_20260523.md`의 Phase 0~4는 구현과 Windows 빌드까지 완료되었고, 이후 `docs/deployments/oracle-deploy-20260523-051021.md` 기준으로 운영 서버 배포와 post-deploy verification도 완료되었다.

따라서 “Phase 0~4 배포 대기”는 현재 기준으로 오래된 표현이다.

정확한 상태:

| 구분 | 상태 | 근거 |
|---|---|---|
| Web/server 배포 | 완료 | `docs/deployments/oracle-deploy-20260523-051021.md` |
| Windows 최신 버전 정책 | v1.0.17 반영 | production version check: Windows latest/min `v1.0.17` |
| macOS 최신 버전 정책 | v1.0.10 유지 | production version check: macOS latest/min `v1.0.10` |
| No-paid smoke | 통과 | user secrets, local secret import, Apify readiness, Yunmi alpha/paid-ready/access gate |
| 실제 유료 AI/Apify/Naver 발행 테스트 | 미실행 | 비용/계정 안전 때문에 명시 승인 전 금지 |

남은 것은 “배포 여부”가 아니라 “실제 사용자 여정 기준 안정화 검증과 구조 리빌딩”이다.

---

## 2. 운영 원칙

1. Web app은 지휘 센터다.
2. Local agent는 웹이 안전하게 할 수 없는 일만 맡는다.
3. Blog Team의 Naver 브라우저 자동화는 local-agent-required다.
4. Songi/Yunmi처럼 서버/웹에서 안전하게 가능한 직원은 web-first다.
5. AI/API provider keys는 웹 보안 저장소가 기준이다.
6. Naver ID/password/session/cookies는 local-agent-only가 기본이다.
7. Mac/Windows는 같은 계약을 따라야 하며, OS 차이는 adapter에서만 처리한다.
8. 사용자 UI는 “지금 할 수 있는 핵심 버튼”만 보여준다.
9. 오류 보고는 코드/영어 원문보다 사용자 상황에 맞는 한국어 안내와 sanitized 진단을 우선한다.
10. 유료 API/Apify/Naver 저장/발행은 명시 승인 전 실행하지 않는다.

---

## 3. Phase Map

### Phase R0. Release Reality Check

목적:
- 현재 운영에 올라간 Phase 0~4가 실제 사용자 여정에서 동작하는지 Mac/Windows 양쪽에서 확인한다.

범위:
- 웹 로그인/대시보드/업데이트 탭
- AI/API 연결 저장/삭제/기존 실행기 키 가져오기
- 로컬 설정 열기/저장 후 무한 로딩 여부
- Windows v1.0.17 업데이트/설치/실행기 연결
- 오류 보고 자동/수동 제출 가능 여부

담당:
- Mac Codex: live API/HTML/version/no-paid smoke 재확인, Mac 사용자 여정 점검
- Windows Codex: Windows 설치/업데이트/실행기 연결/로컬 설정/키 가져오기 smoke
- Mac Claude Code: 사용자 안내 문구/혼동 지점 리뷰
- Mac Antigravity: 설치/업데이트 퍼널의 비즈니스 리스크 리뷰

산출물:
- `docs/maintenance_reports/aimax_release_reality_check_YYYYMMDD.md`
- 필요 시 Windows handoff/result 문서

검증 기준:
- Mac/Windows 모두 “설치 -> 로그인 -> 연결 -> 설정 -> AI/API 상태 확인”이 막히지 않는다.
- 기존 provider key가 빈 저장으로 삭제되지 않는다.
- 느린/무한 로딩은 오류 보고 또는 명확한 상태 안내로 잡힌다.
- no-paid 범위에서만 검증한다.

Gate:
- R0가 끝나기 전에는 큰 구조 리빌딩을 운영에 섞지 않는다.

### Phase R1. Data Safety Hotfix

목적:
- JSON 저장소의 silent read/write 실패와 동시 쓰기 위험을 줄여 계정/작업/오류보고 데이터 유실을 막는다.

범위:
- `readJsonFile` silent fallback 점검
- write lock/backup/atomic write/restore 경로 정리
- corruption 감지 시 운영자가 알 수 있는 로그/헬스체크 추가

담당:
- Mac Codex: 서버 구현/테스트/배포
- Mac Claude Code: 데이터 손실 사용자 영향/운영 문구 리뷰
- Mac Antigravity: 대량 유입/비즈니스 퍼널 리스크 검토
- Windows Codex: 직접 구현 없음, Windows 클라이언트 영향 smoke만 수행

검증 기준:
- 깨진 JSON이 조용히 빈 데이터로 대체되지 않는다.
- write 실패 시 기존 정상 파일이 보존된다.
- 서버 재시작 후 기존 사용자/작업/오류보고가 유지된다.

### Phase R2. Worker Registry SSOT

목적:
- 직원 정의, job kind, 접근 권한, 표시 조건을 한 계약으로 묶어 “버튼은 있는데 실행 안 됨”을 제거한다.

범위:
- server-side worker registry
- `/api/workers` 또는 catalog 응답 기준 정리
- app/admin/local agent가 같은 worker contract를 보게 변경
- 미완성 직원은 숨김 또는 allowlist 제한

담당:
- Mac Codex: registry 구현/웹/admin 반영
- Mac Claude Code: 직원별 UX/권한 문구 리뷰
- Mac Antigravity: “실제 직원처럼 보이는가” 관점 검증
- Windows Codex: local-agent-required/hybrid worker contract smoke

검증 기준:
- worker/job kind 불일치가 테스트로 잡힌다.
- Songi/Yunmi web-first는 local agent 없이 가능한 상태로 보인다.
- Yeri/Hyunju는 local agent 필요성이 명확하게 표시된다.

### Phase R3. OS Abstraction Bridge

목적:
- Mac/Windows 실행기 차이를 adapter로 고립하고, 같은 core contract로 로컬 실행기를 안정화한다.

범위:
- credentials adapter: macOS Keychain, Windows DPAPI, 안전한 fallback
- hardware identity adapter: macOS IOPlatformUUID, Windows MachineGuid
- browser/driver adapter: Chrome/Whale/Edge 버전 및 driver resolver
- local command state machine: queued/delivered/running/done/failed/timeout

담당:
- Mac Antigravity: bridge 설계 검증과 edge-case red-team
- Mac Codex: shared core/adapter interface 구현, Mac adapter 구현
- Windows Codex: Windows adapter 구현/DPAPI/installer smoke
- Mac Claude Code: 사용자 설정 UX와 오류 안내 리뷰

검증 기준:
- 같은 command contract가 Mac/Windows에서 통과한다.
- keychain을 못 쓰는 환경에서도 평문 저장 없이 안전한 fallback 또는 명확한 사용 불가 안내가 나온다.
- local settings 저장 후 재시작/재연결이 안정적이다.

### Phase R4. Yeri Hybrid Reliability

목적:
- 예리 실패율을 낮추고, AI 비용 재발생 없이 Naver 입력만 재시도할 수 있게 한다.

범위:
- 서버에서 글/이미지 생성 artifact 저장
- 로컬은 artifact를 받아 Naver Smart Editor 입력만 수행
- editor stage별 재시도/복구
- Vision fallback 설계 검증

담당:
- Mac Codex: server artifact/job contract 구현, Mac 로컬 입력 경로 정리
- Windows Codex: Windows Naver editor smoke, DPI/IME/driver 회귀 점검
- Mac Antigravity: Vision fallback/self-healing 설계
- Mac Claude Code: 실패 시 한국어 안내/고객 대응 문구

검증 기준:
- content generation 성공 후 editor 입력 실패 시 AI 재생성 없이 재시도 가능하다.
- 실패 stage가 `content_generation`, `editor_open`, `editor_input`, `image_insert`, `save/publish` 등으로 분리된다.
- 실제 Naver 저장/발행은 승인 전 수행하지 않는다.

### Phase R5. Web-First Staff Completion

목적:
- Songi/Yunmi가 local agent 없이 “진짜 직원”처럼 작동하도록 web-first 구조를 완성한다.

범위:
- Songi: Apify/Gemini/수집 승인/결과 카드/브리프/오류보고
- Yunmi: allowlist, paid-ready, 결과 저장/복사/수정, 비용 안내
- provider secret 상태를 웹 기준으로 통일

담당:
- Mac Codex: web/server 구현과 no-paid smoke
- Mac Claude Code: 작업 지시/결과물 UX와 안내 문구
- Mac Antigravity: 비즈니스 가치/혼동 지점 red-team
- Windows Codex: Windows 브라우저에서 web-first 직원 사용성 smoke

검증 기준:
- Songi/Yunmi는 local agent disconnected 상태에서도 가능한 범위가 정확히 작동한다.
- paid action은 확인 전 실행되지 않는다.
- 오류 보고에 직원/단계/job id/provider 상태가 sanitized로 들어간다.

### Phase R6. SQLite WAL Migration

목적:
- JSON 저장소의 확장성/동시성 한계를 줄이고, 대량 유입 전에 운영 데이터를 안전하게 이전한다.

범위:
- users/jobs/error reports/secrets metadata 우선순위 결정
- migration dry-run
- backup/rollback
- WAL mode 및 검증 스크립트

담당:
- Mac Codex: migration 구현/검증/배포
- Mac Antigravity: 비즈니스 퍼널 타이밍과 데이터 손실 리스크 검토
- Mac Claude Code: 운영자 절차/공지 문서
- Windows Codex: 클라이언트 API 호환 smoke

검증 기준:
- dry-run과 실제 migration 결과 row count/checksum이 맞는다.
- rollback 경로가 있다.
- 운영 배포 전 백업과 복구 시나리오가 확인된다.

### Phase R7. Observability And Realtime

목적:
- 사용자가 기다리는지, 막힌 건지, 완료된 건지 알 수 있게 상태 전달과 관측성을 개선한다.

범위:
- local command timeout/error report 자동화
- job progress status
- SSE/WebSocket 검토
- admin 운영 현황과 고객 안내 연결

담당:
- Mac Codex: server/web 구현
- Mac Claude Code: 사용자 안내/운영자 메시지
- Mac Antigravity: 퍼널 이탈/응답속도 리스크 검토
- Windows Codex: Windows long-running job/status smoke

검증 기준:
- 느린 작업은 “진행 중/대기/실패/조치 필요”가 명확히 보인다.
- 무한 로딩은 timeout과 오류 보고로 전환된다.
- 고객이 영어 stack trace만 보지 않는다.

---

## 4. 즉시 실행 순서

1. Phase R0를 먼저 수행한다.
2. R0에서 실제 사용자 여정이 막히는 지점을 모두 기록한다.
3. R0가 통과하거나 blocker가 분리되면 R1 데이터 안전 hotfix로 간다.
4. R1 이후 R2/R3/R4를 병렬 설계하되, 운영 배포는 하나씩 한다.
5. Windows가 필요한 변경은 항상 Syncthing handoff와 Windows Codex completion report를 남긴다.

---

## 5. Windows Codex 전달 기준

Windows Codex는 “Windows AI”가 아니라 Windows 환경의 Codex다. 전달 문서에는 항상 다음을 적는다.

- Mac/server/web에서 변경된 contract
- Windows가 수정해야 할 파일/기능
- 설치본 재빌드 필요 여부
- no-paid 검증 명령
- 실제 Naver save/publish, paid AI, paid Apify 금지
- 결과물: completion report, installer hash/size, smoke output, blocker

---

## 6. 현재 다음 액션

다음 작업은 Phase R0이다.

Mac Codex:
- live version/health/app markers 재확인
- Mac 로컬 설정/AI API 연결 flow를 no-paid 범위에서 점검
- R0 체크리스트 문서 생성

Windows Codex:
- v1.0.17 설치/업데이트 확인
- 로그인/실행기 연결/로컬 설정/키 가져오기/대시보드 상태 점검
- 결과를 Shared-Bridge에 반환

Mac Claude Code:
- R0에서 발견된 사용자 혼동 문구를 한국어 UX로 정리

Mac Antigravity:
- R0 결과를 보고 설치/업데이트/직원 사용 퍼널의 이탈 리스크를 검토

