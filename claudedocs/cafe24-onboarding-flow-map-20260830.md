> **정정 (2026-08-30 저녁 실측)**: 이 문서의 1번(메일→n8n 인입)은 리포 코드 기준 조사였고,
> 라이브 서버 실측 결과 **n8n은 2026-08-08 폐기**됐다(DB 8/7 정지, 프로세스 없음).
> 실제 인입 정본은 `mf-order-notifier.timer`(60초) → `mf_ops`가 **카페24 Admin API를 폴링**해
> `POST /api/integrations/cafe24/orders`로 보내는 경로다(external_id=주문번호).
> 나머지 절(서버 수신 이후 2~6번)은 그대로 유효하다. 상세: memory `cafe24_ingest_truth_20260830.md`

# 카페24 구매 → 온보딩 현행 흐름 지도 (읽기 전용 조사, 2026-08-30)

기준 코드: `oracle/aimax-reports-api/server.js` (19,852줄), `scripts/patch_n8n_cafe24_aimax.py`, `scripts/n8n_cafe24_parse_items.js`, `docs/admin_user_operations_guide.md`

## 1. 주문 인입 경로 (카페24 → cafe24-orders.json)

- 인입은 **웹훅이 아니라 "주문 알림 메일 → n8n 파싱 → 서버 POST"** 구조다.
  - 카페24 주문 메일을 n8n이 읽는다 — docs/admin_user_operations_guide.md:117-118
  - n8n workflow `카페24 주문 CRM 자동화` (ID `eXVG8GAQdtx8q8gm`, Oracle 호스트 `/home/ubuntu/.n8n/database.sqlite`) — scripts/patch_n8n_cafe24_aimax.py:20-24
  - 파싱 노드 `주문 정보 파싱`이 메일 HTML에서 주문번호·이름·이메일·상품·금액·주문일 추출 — scripts/n8n_cafe24_parse_items.js:16-20(셀 추출), 60-63(주문번호)
  - `AIMAX 주문 대기열 저장` HTTP Request 노드가 `POST https://api.aimax.ai.kr/api/integrations/cafe24/orders` + `X-AIMAX-Cafe24-Secret` 헤더로 전송 — scripts/patch_n8n_cafe24_aimax.py:53-89, docs/admin_user_operations_guide.md:137-139. `continueOnFail: True`(전송 실패해도 n8n은 계속) — patch_n8n_cafe24_aimax.py:88
- 서버 수신: 라우트 server.js:19453 → `handleCafe24OrderWebhook` server.js:14497. 시크릿 검증 `requireCafe24Webhook` server.js:1003-1008 (`AIMAX_CAFE24_WEBHOOK_SECRET`, server.js:86)
- 저장: `cafe24-orders.json` (server.js:215), `external_id`로 dedupe/merge — server.js:14504-14508, mergeCafe24Order server.js:8707. external_id는 n8n이 `email|product|amount|orderDate` 조합으로 만든다(주문번호 아님) — patch_n8n_cafe24_aimax.py:55-58
- **트리거 주기: 이 리포에서는 확인 불가** (n8n 워크플로 본체는 Oracle 호스트 DB에만 있음). 메일 수신 기반이므로 "카페24 메일 발송 + n8n 메일 체크 주기"가 첫 지연 구간. 실측하려면 서버에서 workflow trigger 노드 확인 필요.
- 안전망: 주간 전수 감사 — deploy/systemd/aimax-cafe24-entitlement-audit.timer(매주 월 10:00 KST) → scripts/audit_cafe24_entitlement_gap.mjs:1-11 (주문↔권한 대조, 읽기 전용, 텔레그램 보고)

## 2. 주문 → 계정 생성·권한 부여 (원칙: 자동)

- 수신 즉시 분류: `buildCafe24Order` server.js:8617-8705 — 상품 규칙 `CAFE24_STAFF_PRODUCT_RULES` server.js:7967, 다품목 금액 분해 `cafe24AmountCombos` server.js:8023, 항목 기반 추론 `inferCafe24ProductsFromItems` server.js:8590
- 분류 성공(pending, issue 없음) → **웹훅 응답과 동시에 자동 처리 큐잉**: `queueCafe24AutoProcess` server.js:14511 → 락 server.js:13650(`CAFE24_AUTO_PROCESS_LOCK_MS` 10분, server.js:94) → `autoProcessCafe24Order` server.js:13724
  - 게이트: `shouldAutoProcessCafe24Order` server.js:13634-13646, 스위치 `AIMAX_CAFE24_AUTO_SEND_ENABLED` 기본 ON — server.js:93
  - 계정 생성+권한: `provisionAdminUser` server.js:14058 — 신규면 계정 생성+entitlements 부여, 기존이면 `grantProductToUser` server.js:14159로 상품 추가. 임시비번 생성·해시 server.js:14084-14093
- 분류 실패 → `needs_review` + 텔레그램 알림(자동 계정 생성 보류) — 사유 라벨 server.js:13440-13451, 알림 server.js:13455-13469, queueCafe24ReviewAlert server.js:13525. **여기부터 수동**: admin이 `/admin#orders`에서 상품 지정(update server.js:14624, 지정 시 자동 처리 재큐잉 server.js:14676) 또는 선택 계정 생성(provision server.js:14751)+안내 발송(send-guides server.js:14853)
- 가격 불일치는 차단하지 않고 경고만(2026-08-18 개편) — server.js:13554-13556 주석, 차단은 등록가 대비 비율 초과 시 `amount_mismatch`만 — server.js:8606-8609
- 자동 처리 실패 시: `markCafe24AutoProcessFailure` server.js:13674 + 텔레그램 실패 알림. **자동 재시도 없음** — `queueCafe24AutoProcess` 호출처는 웹훅(14511)과 admin 주문 수정(14676) 두 곳뿐. 재시도는 admin retry 버튼(server.js:14690, `/api/admin/cafe24-orders/retry` 19513)

## 3. 온보딩 메일 (자동 경로 = 셋업 링크 방식)

- 자동 처리 본선: `cafe24GuideForProvision` server.js:13704-13721 — 신규 계정/비번 리셋이면 **임시비번 대신 1회용 셋업 링크 메일** 발송
  - 링크 생성 `createSetupLinkForUser` server.js:8860-8886 (기존 미사용 토큰 폐기, TTL 7일 `SETUP_TOKEN_TTL_DAYS` server.js:24)
  - 메일 본문 `onboardingSetupLinkText` server.js:8837-8858, 제목 server.js:8809
  - 사용자: `GET /setup?token=` (server.js:19229, setupUrl 1367-1368) → `POST /api/auth/setup-password` (server.js:19574 → handleSetupPassword 16062-16093, `must_change_password=false`) → 즉시 `/app` 로그인. 실고객 흐름 E2E PASS 기록 — docs/testing/cafe24_actual_customer_flow_e2e_20260527.md:14-22
- 발송: `sendAdminGuideEmail` server.js:12790-12792 → `sendTransactionalEmail` server.js:12738 → Resend API server.js:12766-12781. 발신 기본값 `AIMAX <naminsoo@aixlife.co.kr>` — server.js:84 (인증 도메인 aixlife.co.kr와 일치, memory 대조 OK)
- 발송 이력: `rememberUserEmailEvent` type `cafe24_onboarding_guide_auto`/`_retry`/`_resend` — server.js:13815-13823
- 미로그인 리마인드(main 434db59 계열): 서버 기동 시 `startOnboardingReminderSweep` server.js:19676 → 6시간 주기(server.js:13243), 대상 = active + `must_change_password` 유지 + 가이드 발송 3~21일 경과 + 리마인드 미시도 + 2026-07-26 이후 건 — server.js:13267-13284. **새 임시비번을 생성해 임시비번 방식 메일 1회 발송** — server.js:13298-13309, run당 8명 캡 server.js:13242
- 완전 수동 경로(별도): `/api/admin/users/provision` (19465 → 14251, 임시비번 1회 노출) + `/api/admin/users/send-guide` (19469) — docs/admin_user_operations_guide.md:100-108

## 4. 단계표 (구매 → 로그인 가능)

| # | 단계 | 자동/수동 | 지연 | 근거 |
|---|------|-----------|------|------|
| 1 | 카페24 결제 → 주문 알림 메일 | 자동(카페24) | 수분 내 | 외부 |
| 2 | 메일 → n8n 파싱 → 서버 POST | 자동 | **n8n 메일 체크 주기 의존(리포에서 미확인, 실측 필요)** | patch_n8n_cafe24_aimax.py:53-89 |
| 3 | 주문 저장·상품 분류 | 자동(즉시) | 0 | server.js:14497-14508 |
| 4a | 분류 성공 → 계정+권한+셋업링크+메일 | 자동(웹훅 처리 직후 비동기) | 수초 | server.js:14511, 13724-13830 |
| 4b | 분류 실패(needs_review) → admin 상품 지정 | **수동** (텔레그램 알림 후) | 사람 대기: 수시간~수일 | server.js:13455, 14624 |
| 4c | 자동 처리 실패(failed) → admin retry | **수동** (알림 후) | 사람 대기 | server.js:13674, 14690 |
| 5 | 사용자 비번 설정(링크 7일) → 로그인 | 사용자 셀프 | 사용자 행동 | server.js:16062 |
| 6 | 3일 미로그인 리마인드(1회) | 자동(6h 스윕) | — | server.js:13285-13345 |

행복 경로(분류 성공)의 병목은 2번 단계 하나. 나머지 수동 개입은 전부 예외 경로(4b/4c).

## 5. 최단 개선 후보 (카페24 유지 전제)

1. **인입 지연·취약성 해소**: 메일 파싱이 유일한 비결정 구간 — 카페24 메일 템플릿 변경에 취약하고, external_id가 주문번호가 아닌 `email|product|amount|orderDate` 조합(동일인 동일상품 재구매 dedupe 위험). 서버에 이미 카페24 Admin API OAuth·주문 조회가 있으므로(`cafe24AdminAccessToken` server.js:8342, 주문 조회 server.js:8357-8391) 메일 경로를 Admin API 주문 폴링으로 보완/대체 가능. 우선은 n8n 트리거 주기 실측·단축이 0원 개선.
2. **needs_review 자체를 없애기**: 서버는 이미 명시 상품 코드(`aimax_product`/`product_code`)를 받으면 추론 없이 확정 처리한다(server.js:8644-8646, confidence "explicit"). 새 공개 랜딩의 구매 버튼을 상품별 단일 링크로 만들고 n8n payload에 상품 코드를 실으면 모호 분류 대기가 구조적으로 사라진다.
3. **실패 자동 재시도 스윕 추가**: 현재 failed는 admin retry 전용. 일시 오류(Resend 순단 등)용 재시도 스윕(예: 10분 간격 N회)을 붙이면 4c 수동 대기가 줄어든다. `autoProcessCafe24Order`에 options가 이미 있어 소규모 변경.

## 6. PG 직접결제 접합점 (앞단 교체 재료)

- **최소 변경안**: PG 웹훅 수신부(신규)가 payload를 변환해 기존 `POST /api/integrations/cafe24/orders` (server.js:19453)로 POST. `source` 자유 필드(server.js:8661), `external_id` 임의 지정 가능(server.js:8091) → PG 주문번호를 external_id로 쓰면 dedupe도 견고해짐. 명시 상품 코드를 실으면 즉시 자동 처리 → **결제 완료 수초 내 셋업 링크 메일**. 뒷단 무변경.
- **재사용 함수 목록** (PG 전용 라우트를 새로 팔 경우):
  - 주문 정규화/병합: `buildCafe24Order` server.js:8617, `mergeCafe24Order` server.js:8707
  - 자동 처리: `queueCafe24AutoProcess` server.js:13839, `autoProcessCafe24Order` server.js:13724
  - 계정+권한: `provisionAdminUser` server.js:14058, `grantProductToUser` server.js:14159
  - 온보딩: `createSetupLinkForUser` server.js:8860, `cafe24GuideForProvision` server.js:13704, `onboardingSetupLinkText` server.js:8837
  - 메일: `sendAdminGuideEmail` server.js:12790, `sendTransactionalEmail` server.js:12738 (Resend, 발신 server.js:84)
  - 리마인드: `sweepOnboardingReminders` server.js:13285 (신규 유저 자동 포함, 추가 작업 불필요)
  - 인증 패턴: 헤더 시크릿 timingSafeEqual server.js:915-1008 — PG 서명 검증으로 교체만
- CEO 지시(memory pg_direct_purchase_prep)의 "구매→즉시 임시비번 메일→로그인" 요건은 현행 자동 파이프라인이 이미 충족(셋업 링크 방식). PG 웹훅 → 이 파이프라인 연결이 곧 완성형.

## 미확인·잔여
- n8n 메일 트리거 종류·폴링 주기: Oracle 호스트 n8n DB에서만 확인 가능 (읽기 전용 제약으로 서버 미접속)
- 운영 env 실값(AUTO_SEND on 여부, MAIL_FROM override)은 서버 `.env` 확인 필요 — 코드 기본값 기준으로 기술
