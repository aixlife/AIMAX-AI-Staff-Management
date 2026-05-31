# AIMAX R2 Worker Registry SSOT Plan

작성일: 2026-05-23 KST
작성자: Mac Codex
상태: 승인 대기

---

## 한 줄 결론

R0/R1이 모두 통과했으므로 다음 단계는 R2 Worker Registry SSOT다. 목표는 직원 정의, job kind, 권한, UI 표시 조건을 서버 catalog 중심으로 묶어 “버튼은 있는데 실행 안 됨”과 “서버/웹/로컬 정의 불일치”를 줄이는 것이다.

---

## R1 결과 반영

Windows Codex R1 smoke:

- Status: `PASS`
- R1 blocker: `none found`
- Windows agent: `v1.0.17`
- `storage.ok=true`
- `storage.issues=[]`
- Web login, agent status, AI/API connection, error report screen: pass
- No paid AI, no paid Apify, no Naver save/publish/draft-save

따라서 R2 진입 가능.

---

## 현재 확인된 R2 문제

### 1. 서버와 웹 job kind 불일치

서버 `JOB_KINDS`:

- `yeri_write`
- `hyunju_find`
- `yunmi_script`

웹 `jobKinds`:

- `yeri_write`
- `hyunju_find`
- `yunmi_script`
- `songi_research`

즉, `songi_research`는 웹에는 있지만 서버 `JOB_KINDS`에는 없다. 현재 Songi가 별도 research API로 작동하더라도 “작업/직원 catalog 기준”으로는 불일치다.

### 2. 직원 정의가 여러 곳에 남아 있음

- `server.js`의 `WORKERS`
- `server.js`의 `JOB_KINDS`
- `app.html`의 `employees`
- `app.html`의 `jobKinds`
- `admin.html`의 product/worker 표시 로직
- local agent readiness의 `workers`

### 3. planned 직원 노출 기준이 애매함

나경/현성/상수는 `planned`/`needs_setup` 상태로 정의돼 있지만, “실제 사용할 수 없는 직원은 핵심 UI에 보이지 않아야 한다”는 원칙과 충돌할 수 있다.

### 4. Windows handoff context 전달 부족

Windows Codex R1 결과에서 Mac maintenance/deploy docs가 Windows workspace에 없었다고 보고했다. R2부터는 handoff에 필요한 기준 문서 요약을 충분히 포함하거나, 필요한 문서 사본을 shared-bridge에 같이 둔다.

---

## R2 목표

1. 서버 catalog를 사용자-facing 직원 정의의 기준으로 만든다.
2. 웹 hardcoded employee/job kind 정의는 fallback 용도로만 남긴다.
3. 서버와 웹 job kind 불일치를 smoke로 잡는다.
4. web-first/local-agent-required/hybrid 구분을 catalog에 명확히 담는다.
5. planned 직원은 기본 작업 UI에서 숨기거나 명확히 “준비 중”으로만 취급한다.
6. Windows 실행기는 local-agent-required/hybrid worker readiness만 검증한다.

---

## 제안 작업 순서

### R2-A. Catalog Contract Smoke

목적:
- 당장 구조를 크게 바꾸기 전에 불일치를 테스트로 고정한다.

작업:
- `scripts/smoke_worker_catalog_contract.mjs` 추가
- 서버 `WORKERS`, `JOB_KINDS`, live `/api/workers`, 웹 fallback `jobKinds`의 불일치 검출
- 특히 runnable worker의 `jobKind`가 있으면 `JOB_KINDS` 또는 명시적 web-module route에 등록되어야 함

검증:
- `WORKER_CATALOG_CONTRACT_SMOKE_OK`

### R2-B. Server Catalog 보강

목적:
- `songi_research`를 서버 catalog 계약 안에 포함할지, 별도 `module_routes`로 명시할지 결정한다.

권장:
- `songi_research`를 `JOB_KINDS`에 등록하되 `execution=web_module`, `workerCode=songi_data_research`, `requiredProduct=songi`로 맞춘다.
- 작업 생성 API에서 Songi가 기존 research API를 사용한다면, route 충돌이 없도록 create job 처리만 별도 분기한다.

검증:
- `/api/workers`에 Songi job kind가 명확히 포함
- app.html fallback과 catalog가 같은 값으로 수렴

### R2-C. Web Fallback 축소

목적:
- app.html의 `employees`와 `jobKinds`를 서버 catalog 우선으로 사용하게 정리한다.

작업:
- `applyWorkerCatalog()`가 catalog job kind를 새로 추가할 수 있게 수정
- 웹 fallback에만 있는 job kind가 catalog에 없으면 경고/숨김 처리
- planned 직원이 기본 작업 카드에 노출되지 않도록 확정

검증:
- 로그인 후 `/api/workers` 기준 직원 카드 렌더링
- 예리/현주 local-agent-required
- 송이/윤미 web-first/beta
- 나경/현성/상수는 작업 시작 버튼 없음

### R2-D. Admin Catalog 정리

목적:
- admin 구매자/권한 화면과 사용자 작업 화면의 직원 기준을 맞춘다.

작업:
- admin catalog도 같은 public worker/job kind contract 기준으로 확인
- 윤미 allowlist/beta 표시와 Songi/bundle 권한 표시 정리

검증:
- admin smoke 또는 static marker check

### R2-E. Windows Smoke Handoff

목적:
- Windows에서 local-agent-required 직원과 web-first 직원 표시가 깨지지 않는지 확인한다.

작업:
- shared-bridge에 handoff/prompt 작성
- 이번부터 필요한 기준 문서 요약 또는 사본 포함

검증:
- Windows v1.0.17에서 web login/agent status/workers catalog/직원 카드 표시 확인
- installer 재빌드 필요 여부는 R2 구현 결과에 따라 판단

---

## AI Council 사용 기준

R2 중 아래가 나오면 AI Council을 사용한다.

- Songi를 `JOB_KINDS`에 넣을지 별도 module route로 둘지 판단이 애매할 때
- planned 직원을 완전히 숨길지 “준비 중”으로 보여줄지 비즈니스/UX 판단이 갈릴 때
- 서버 catalog 구조가 향후 SQLite migration과 충돌할 가능성이 보일 때

그 외 단순 코드 정리/테스트 추가는 Mac Codex가 직접 진행한다.

---

## 승인 후 첫 작업

승인되면 바로 R2-A부터 진행한다.

첫 산출물:

- `scripts/smoke_worker_catalog_contract.mjs`
- catalog 불일치 보고
- 최소 수정안

첫 gate:

- smoke가 현재 불일치를 정확히 잡는지 확인한 뒤 R2-B 구현으로 넘어간다.

