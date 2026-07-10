# Spec: 세무 직원(팝빌 전자세금계산서) web-first 구현 → gpt-5.6-sol, effort xhigh

승인된 설계안(D1~D5, 2026-07-10 CEO 게이트 통과) 기반 구현 스펙. 판단·설계 변경은 이 스펙 범위 밖이며, 구현 중 설계 모순을 발견하면 임의 해석하지 말고 해당 항목을 구현 보류로 표시하고 보고한다.

## 목표

AIMAX 웹앱에 세무 직원을 추가한다. 사용자가 사업자번호를 등록하면 전자세금계산서 초안 작성 → 비용 확인 → 명시 승인 발행(팝빌 테스트베드) → 이력 조회를 웹에서만 수행할 수 있다. 로컬 러너 불필요(web_module).

## 컨텍스트 (읽어야 할 파일·기존 패턴)

- `oracle/aimax-reports-api/server.js` (순수 Node stdlib 단일 파일 서버, 약 17000줄)
  - WORKERS 직원 카탈로그: 약 282~606행 (yeri_writer, songi_data_research 참고)
  - JOB_KINDS: 약 607~638행 — 송이 패턴 `songi_research: { apiMode: "research_api", queue: false }` 참고
  - PRODUCT_ORDER: 약 199행
  - USER_SECRET_PROVIDERS: 244~250행 — 참고만 할 것. 팝빌 파트너 키는 여기 넣지 않는다
  - confirm_paid 402 게이트 패턴: 약 15891행 (yeri_paid_confirmation_required)
  - 송이 module API 엔드포인트 구현 패턴: 약 14214~14540행 (/api/research/*)
  - user secrets 핸들러: 13736~13793행
  - 잡 실패 가드: 3275~3336행
  - DATA_DIR 기반 JSON 영속화 패턴 (research.json 등)
- `oracle/aimax-reports-api/static/app.html` (약 14000줄)
  - 직원 카드 클라이언트 설정: 약 5231행 (songi 항목)
  - 직원 잡 폼: 약 4031행 (songiJobForm)
  - 시크릿/설정 UI와 /api/user/secrets 호출: 약 11265행
- vendored SDK (이식·로드 검증 완료, 수정 금지): `oracle/aimax-reports-api/vendor/popbill-sdk/node_modules/{popbill,linkhub,xmlhttprequest}`
  - 사용법: `require(path.join(__dirname, "vendor/popbill-sdk/node_modules/popbill"))` → `popbill.config({LinkID, SecretKey, IsTest: true, UseLocalTimeYN: true, IPRestrictOnOff: true, defaultErrorHandler: ...})` → `popbill.TaxinvoiceService()`
  - SDK는 콜백(success, error) 스타일이고 전역 싱글턴 설정이다. 그래서 메인 서버 프로세스에서 직접 require 하지 않는다 (아래 bridge 격리 필수)
- `scripts/deploy_oracle.sh` — web 모드 배포 파일 목록(약 112~182행), 카탈로그 마커 검증(약 83~106행)
- `scripts/smoke_songi_discovery_server_fallback.mjs` — 임시 포트 서버 구동 스모크 테스트 패턴

## 구현 항목

### 1. Bridge 프로세스 격리: `oracle/aimax-reports-api/popbill-bridge.js`

- 독립 실행 Node 스크립트. 메인 서버가 호출마다 child_process.spawn으로 실행하고 stdin으로 JSON 요청 1건을 전달, stdout으로 JSON 응답 1건을 받는다. SDK의 전역 싱글턴·미보호 예외·타임아웃 미종료 문제를 프로세스 경계로 격리한다.
- 요청 형식: `{ "method": string, "corpNum": string, "args": object, "isTest": boolean }`
- 파트너 키는 env `POPBILL_LINK_ID` / `POPBILL_SECRET_KEY`로만 받는다. stdin/응답/로그에 키가 나타나면 안 된다.
- 메서드 화이트리스트 (이 외 전부 거부): `checkIsMember`, `joinMember`, `getUnitCost`, `getBalance`, `registInvoice`(임시저장), `issueInvoice`(발행), `getInfo`. SDK 실제 메서드명에 맞게 어댑터로 매핑하되 노출 범위는 이 7개 의미로 제한. sendToNTS·delete·cancel·회원탈퇴·범용 call 프록시는 만들지 않는다.
- 발행 어댑터에서 ForceIssue 인자는 입력과 무관하게 false 고정.
- `isTest: false` 요청은 env `POPBILL_ALLOW_PRODUCTION=1`이 없으면 즉시 거부 (`production_locked` 에러).
- once-settlement: success/error 콜백 중 최초 1회만 응답 출력 후 exit. 자체 deadline 45초 — 초과 시 `{ok:false, error:"bridge_timeout", outcome:"unknown"}` 출력 후 exit 1. `process.on("uncaughtException")`으로 SDK 내부 예외를 JSON 에러로 변환.
- env `POPBILL_BRIDGE_PATH`로 메인 서버가 bridge 경로를 오버라이드할 수 있게 한다 (스모크 테스트에서 가짜 bridge 주입용). 기본값은 `__dirname` 기준 상대 경로 (머신 절대경로 하드코딩 금지).

### 2. server.js 확장

- WORKERS에 세무 직원 추가: `staffCode: "semu"`, `product: "semu"`, `execution: "web_module"`, `type: "web_module"`, 이름 라벨 "세무 직원" (정식 이름·프로필 이미지는 TODO 주석 — CEO 결정 대기, placeholder 아바타 사용). 역할: "전자세금계산서 발행 직원".
- JOB_KINDS에 `semu_tax_invoice: { label, requiredProduct: "semu", workerCode: <세무 워커 code>, apiMode: "tax_api", queue: false }`.
- PRODUCT_ORDER에 "semu" 추가 (jieun 뒤 권장).
- 신규 엔드포인트 (기존 인증 미들웨어·auth.user 패턴 그대로 재사용):
  - `GET /api/tax/settings` — 사용자의 사업자번호 등록 상태, 연동회원 여부, 서버 구성 여부 반환
  - `PUT /api/tax/settings` — body: 사업자번호(숫자 10자리 검증)·상호·대표자명. bridge `checkIsMember` → 미가입이면 `joinMember`(테스트베드). 성공 시 DATA_DIR의 `tax-settings.json`에 user_id↔corpNum 매핑 저장. **불변식: 한 user_id는 자기 corpNum으로만 발행 가능 — 이후 모든 invoice 경로에서 저장된 corpNum만 사용하고 요청 body의 corpNum을 공급자로 쓰지 않는다**
  - `POST /api/tax/invoices` — 초안 생성. 입력: 거래처(공급받는자) 사업자번호·상호·대표자·이메일(선택), 품목 리스트(품명·수량·단가·공급가액·세액), 작성일자, 청구/영수. 서버가 합계(공급가액계·세액계·총액) 재계산·검증(불일치 400). MgtKey는 서버가 생성: `AX{userId 축약}{yyyymmdd}{일련번호}` 형태, 24자 이내 ASCII, DATA_DIR `tax-invoices.json`에 저장. status: `draft`
  - `GET /api/tax/invoices` / `GET /api/tax/invoices/{id}` — 본인 것만 조회
  - `POST /api/tax/invoices/{id}/preflight` — bridge `getUnitCost`+`getBalance`+회원상태 조회 결과(발행 단가, 잔여 포인트)를 반환. 조회 실패 시 발행 진행 불가 상태로 응답
  - `POST /api/tax/invoices/{id}/issue` — 게이트: `body.confirm_paid !== true`이면 402 (기존 패턴 재사용). status가 `draft`가 아니면 409. corpNum별 발행 잠금(파일 영속 — submitting 상태 자체가 잠금 역할, 재시작에도 유지). 전이: `draft → submitting`(저장) → bridge `registInvoice`+`issueInvoice` → 성공 `issued` / 명시 실패 `failed`(사유 저장) / 타임아웃·불명 `unknown`(재시도 금지 안내 포함). **어떤 실패에서도 자동 재시도 금지**
  - `POST /api/tax/invoices/{id}/sync` — `submitting`/`unknown` 상태를 bridge `getInfo`(동일 MgtKey)로 실상태 조회해 복구. 이 경로가 유일한 복구 수단 (재발행 아님)
- 파트너 키 env 부재 시: `/api/tax/*` 전부 503 `{error: "tax_not_configured"}` (서버 기동과 다른 직원 기능은 정상 유지).
- 실패 시 응답 에러 코드는 정형 코드(`tax_not_configured`, `production_locked`, `member_join_failed`, `invoice_validation_failed`, `issue_unknown` 등)로 통일 — 기존 오류보고 파이프라인이 정형 코드를 1순위로 분류하므로.

### 3. app.html UI

- 직원 카드: 세무 직원 추가 (web_module, moduleKey "tax", requiredSettings 개념상 사업자번호 등록). 서버가 tax_not_configured면 카드에 "준비 중" 상태 표시.
- 상세/설정 화면: 사업자번호·상호·대표자 입력 → PUT /api/tax/settings. 등록 상태 표시.
- 작성 플로우: 초안 폼(거래처 정보 + 품목 행 추가/삭제 + 합계 자동계산) → 미리보기(필드 요약) → "발행 준비" 버튼이 preflight 호출해 **발행 단가와 잔여 포인트를 사용자에게 표시** → 확인 체크박스 + "발행" 버튼(confirm_paid: true 전송). 테스트베드 라벨을 발행 버튼 근처에 항상 표시("테스트베드 — 실제 국세청 전송 아님").
- 이력 목록: 상태 뱃지(초안/발행중/발행됨/불명/실패), `unknown`/`submitting` 항목에는 "상태 확인" 버튼(sync 호출). 실패 사유 표시.
- 이모지 사용 금지 (모든 신규 UI 문구).

### 4. 배포 스크립트

- `scripts/deploy_oracle.sh` web 모드 파일 목록에 `popbill-bridge.js`와 `vendor/popbill-sdk/` 디렉토리 추가.
- 카탈로그 마커 검증에 세무 워커 존재 확인 1건 추가 (기존 마커 패턴과 동일 형식).

### 5. 스모크 테스트: `scripts/smoke_tax_invoice_flow.mjs`

- 기존 songi 스모크 패턴(임시 포트 서버 구동) 재사용. 가짜 bridge 스크립트를 생성해 `POPBILL_BRIDGE_PATH`로 주입 (가짜는 요청 method별 정해진 JSON 응답 반환, 실 팝빌 호출 없음).
- 검증 시나리오 (전부 통과해야 함):
  1. 사업자번호 등록 → 초안 생성 → preflight(단가 노출) → confirm_paid:true 발행 → issued → 이력 조회
  2. confirm_paid 없이 발행 → 402
  3. 파트너 키 env 없이 서버 구동 → /api/tax/* 503, 서버 자체는 기동 정상
  4. 발행 응답 타임아웃 시나리오(가짜 bridge가 timeout 모사) → unknown 저장 → sync로 issued 복구
  5. 같은 초안 이중 발행 시도(submitting/issued 상태에서 issue 재호출) → 409
  6. isTest:false 요청 강제 시도 → production_locked (POPBILL_ALLOW_PRODUCTION 부재)
  7. 합계 불일치 초안 → 400
  8. 다른 사용자의 invoice 접근 → 403 또는 404

## 제약 (하지 말 것)

- 스코프 밖 수정 금지: 기존 직원·잡·메일·오류보고 로직 변경 금지. 이번 변경은 추가 위주.
- 신규 npm 의존성 금지 — vendored 3종 외 어떤 패키지도 추가하지 않는다. vendor/popbill-sdk 내부 파일 수정 금지.
- 파트너 키(LinkID/SecretKey)를 user secrets, API 응답, 로그, 클라이언트 코드 어디에도 넣지 않는다.
- 자동 발행 경로·자동 재시도 경로를 만들지 않는다.
- sendToNTS(국세청 즉시전송)·삭제·취소·회원탈퇴·범용 SDK 프록시 미구현.
- 이모지 금지. "마법" 표현 금지.

## 불변식 (깨지면 안 되는 것)

- `node --check oracle/aimax-reports-api/server.js` 통과. 기존 `/api/workers` 카탈로그 계약(기존 필드·기존 직원) 불변.
- 기존 직원 플로우(예리·송이·지은·맥스 등) 코드 경로 무영향.
- 발행은 confirm_paid 명시 승인 없이 어떤 경로로도 발생하지 않는다.
- 같은 MgtKey 이중 발행 불가. user_id↔corpNum 교차 발행 불가.
- 실운영(isTest:false)은 서버 env 없이 어떤 요청으로도 불가.

## 검증 기준 (통과 판정)

```
node --check oracle/aimax-reports-api/server.js
node --check oracle/aimax-reports-api/popbill-bridge.js
node scripts/smoke_tax_invoice_flow.mjs   # 시나리오 1~8 전부 PASS 출력
bash -n scripts/deploy_oracle.sh
```

- app.html: 기존 HTML 스크립트 파싱 검증 방식(프로젝트 기존 검증 스크립트 있으면 그것) 통과.
- `grep -rn "POPBILL_SECRET" oracle/aimax-reports-api/static/` 결과 0건 (클라이언트에 키 참조 없음).
- 완료 보고에 변경 파일 목록과 스모크 실행 로그를 포함할 것.
