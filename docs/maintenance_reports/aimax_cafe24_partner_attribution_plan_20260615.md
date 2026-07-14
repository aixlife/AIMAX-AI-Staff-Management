# AIMAX Cafe24 파트너 결제 알림 안정 셋팅 계획

## 결정

- 기존 n8n Cafe24 주문 메일 흐름은 유지한다.
- 결제 알림은 항상 기존처럼 발송한다.
- Notion 파트너 매칭에 성공했을 때만 기존 Telegram 주문 알림 본문에 `성함 페이지에서 결제` 한 줄을 추가한다.
- 매칭 실패, Notion 장애, AIMAX API 장애, n8n 변수 누락은 결제 알림을 막지 않는다.

## 로컬 변경

- `oracle/aimax-reports-api/server.js`
  - `POST /api/integrations/cafe24/partner-attribution` 추가.
  - Cafe24 주문 payload의 `partnerUrl`, `partnerRef`, `ref`, `coupon`, `utm_source`, `utm_campaign` 후보를 수집한다.
  - Notion 파트너 DB의 `성함`, `URL`, `비고`를 읽어 URL/query/code 기준으로 매칭한다.
  - 매칭되면 `김도연대표님 페이지에서 결제` 형식의 `partner_line`만 반환한다.
  - 매칭 안 되거나 조회 실패 시 HTTP 200과 빈 `partner_line`을 반환한다.
- `scripts/smoke_cafe24_partner_attribution.mjs`
  - URL/ref/coupon 매칭, Notion row 파싱, 미매칭 fallback을 검증한다.

## 운영 n8n 변경안

- 대상 workflow: `카페24 주문 CRM 자동화`
- 변경 노드:
  - `주문 정보 파싱`: 기존 이름/연락처/이메일/상품/금액/주문일 파싱은 유지하고, 이메일 본문에서 `partnerUrl`, `partnerRef` 후보만 추가 추출한다.
  - `노션 페이로드 빌드`: Telegram 본문 생성 직전에 AIMAX 보조 API를 호출한다. `partner_line`이 있으면 기존 주문 알림의 주문자 줄 위에 한 줄만 삽입한다.
- 기존 Telegram 목적지, thread, Notion CRM DB 값은 현재 workflow 값에서 읽어 그대로 재사용한다.
- 적용 스크립트: `scripts/patch_n8n_cafe24_partner_attribution.py`
- 운영 적용 전 백업:
  - n8n SQLite DB 전체 백업
  - 기존 workflow JSON 백업

## 운영 전제

- AIMAX 운영 서버에 `AIMAX_CAFE24_PARTNER_NOTION_TOKEN` 또는 `NOTION_MAKEFAMILY_API_KEY`가 있어야 실제 Notion 조회가 된다.
- `AIMAX_CAFE24_PARTNER_NOTION_DATABASE_ID` 기본값은 사용자 제공 Notion 페이지 ID다.
- 현재 확인한 Cafe24 주문 메일에는 파트너 URL/ref/coupon 값이 없었다. 이런 주문은 기존과 동일한 알림으로 발송된다.
- 향후 결제 데이터에 파트너 링크, ref, coupon, utm 값이 들어오면 그때 Notion DB와 매칭되어 한 줄이 추가된다.

## 검증

- `node --check oracle/aimax-reports-api/server.js`: PASS
- `node scripts/smoke_cafe24_partner_attribution.mjs`: PASS
- `node scripts/smoke_cafe24_review_alert.mjs`: PASS
- `node scripts/smoke_cafe24_auto_send.mjs`: PASS

## 운영 반영 기록

- 2026-06-15 12:30 KST: Oracle `.env`에 파트너 Notion 조회 설정을 추가했다. 토큰 값은 출력하지 않았고, 기존 n8n Notion CRM 노드의 인증값을 Oracle 내부에서만 재사용했다.
  - env backup: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/.env.before-partner-attribution-20260615-123040`
- 2026-06-15 12:33 KST: 운영 `server.js`에 `/api/integrations/cafe24/partner-attribution` endpoint만 격리 패치했다. 전체 web bundle 배포는 하지 않았다.
  - server backup: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/server.js.before-partner-attribution-20260615-123310`
  - temp checked file: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/server.partner-attribution-20260615-123310.tmp.js`
- 2026-06-15 12:35 KST: n8n `카페24 주문 CRM 자동화` workflow의 `주문 정보 파싱`, `노션 페이로드 빌드` Code 노드를 패치했다. SQLite DB는 컨테이너를 잠시 정지한 상태에서 백업 후 수정했고, 소유권을 `opc:opc`로 복구한 뒤 n8n을 재시작했다.
  - first n8n backup: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/n8n-root/database-before-cafe24-partner-attribution-20260615-123546.sqlite`
  - first workflow backup: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/n8n-root/workflow-eXVG8GAQdtx8q8gm-before-cafe24-partner-attribution-20260615-123546.json`
  - final n8n backup: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/n8n-root/database-before-cafe24-partner-attribution-20260615-123725.sqlite`
  - final workflow backup: `/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution/n8n-root/workflow-eXVG8GAQdtx8q8gm-before-cafe24-partner-attribution-20260615-123725.json`
- 운영 endpoint verification:
  - `no_hint`: `ok=True`, `matched=False`, `reason=no_partner_hint`
  - `fake_ref`: `ok=True`, `matched=False`, `reason=no_match`
- n8n DB marker verification:
  - `active=True`
  - `parse_partner_hint=True`
  - `payload_partner_request=True`
  - `payload_fetch_fallback=True`
  - `payload_catch=True`
- 서비스 상태:
  - `aimax-reports-api.service`: active
  - `n8n`: Up after restart
- 테스트 Telegram:
  - 기존 n8n 회사비서 Telegram 설정과 기존 payment topic destination을 사용했다.
  - sent text matched the existing order-alert format and included `상수 페이지에서 결제`.
  - Telegram API result: `telegram_ok=True`, `message_id=4693`

## 롤백

- n8n 문제 발생 시 백업된 workflow JSON 또는 DB 백업으로 즉시 되돌린다.
- AIMAX API가 실패하더라도 n8n 변경 자체는 partner line을 빈 값으로 처리하므로 결제 알림은 계속 발송된다.
