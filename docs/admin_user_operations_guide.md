# AIMAX Admin And Buyer Operations Guide

## 운영 URL

사용자 웹앱:

```text
https://api.aimax.ai.kr/app
```

관리자 기능은 현재 별도 브라우저 관리자 페이지가 아니라 관리자 API로 운영한다.

```text
https://api.aimax.ai.kr/admin
```

운영자는 관리자 비밀번호로 로그인한 뒤 브라우저에서 구매자를 등록한다.
서버에는 `AIMAX_ADMIN_PASSWORD`를 설정하는 것을 권장한다. 설정하지 않으면
기존 `AIMAX_ADMIN_TOKEN`이 관리자 로그인 비밀값으로 쓰인다.

2026-05-07 운영 서버에는 전용 `AIMAX_ADMIN_PASSWORD`가 설정되어 있다.
`AIMAX_ADMIN_TOKEN`도 API 운영 fallback/직접 API 호출용으로 남아 있다.

관리자 API도 계속 사용할 수 있다.

```text
POST https://api.aimax.ai.kr/api/admin/users/provision
GET  https://api.aimax.ai.kr/api/admin/users?query=<email>
```

관리자 API 토큰은 서버/운영자 도구에서만 사용하고, 사용자 웹앱 프론트엔드에는 절대 넣지 않는다.

## 현재 상품/권한 구조

상품 코드는 3개다.

| product | 열리는 직원 | 다운로드 | 가능한 작업 |
|---|---|---|---|
| `yeri` | 예리 | 예리 설치 파일 | `yeri_write` |
| `hyunju` | 현주 | 현주 설치 파일 | `hyunju_find` |
| `bundle` | 예리, 현주 | 통합 설치 파일 | `yeri_write`, `hyunju_find` |

서버는 `product`를 받아 `entitlements.products`를 만든다.

- `yeri` -> `["yeri"]`
- `hyunju` -> `["hyunju"]`
- `bundle` -> `["yeri", "hyunju", "bundle"]`

## 구매자 가입 운영 흐름

1. 구매 확인
   - 구매 이메일
   - 구매 상품: 예리, 현주, 통합
   - 만료일이 있으면 `expires_at`

2. 운영자가 `/admin`에서 구매자 등록
   - 이메일과 구매 상품을 입력한다.
   - 필요하면 이름, 만료일, 운영 메모를 넣는다.
   - 새 사용자를 만들거나 기존 사용자 권한을 갱신한다.
   - 신규 구매자는 임시 비밀번호가 자동 생성된다.
   - 기존 사용자도 `임시 비밀번호 재발급`을 체크하면 비밀번호가 다시 발급된다.
   - 임시 비밀번호는 등록 결과 화면에서 한 번만 복사해 전달한다.

3. 구매자에게 안내
   - 웹앱 URL
   - 로그인 이메일
   - 임시 비밀번호
   - 설치/권한 허용 가이드 링크
   - 구매 상품 이름

4. 구매자 첫 로그인
   - 웹앱에서 임시 비밀번호로 로그인
   - 첫 로그인 비밀번호 변경
   - 비밀번호 변경 전에는 `can_execute=false`라 작업 실행과 다운로드가 제한된다.

5. 구매자 설치
   - 자기 권한에 맞는 설치 파일만 보인다.
   - 최신 실행기를 한 번 설치한다.
   - 이후에는 업데이트가 있을 때만 다시 설치한다.

6. 구매자 로컬 연결
   - 웹앱에서 `실행기 연결`
   - 로컬 실행기가 없거나 오래된 설치 파일이면 설치 파일을 먼저 안내
   - 로컬 실행기에서 AIMAX 웹앱 로그인 세션을 OS 안전 저장소에 저장
   - 네이버/API 키는 로컬 PC 안전 저장소에만 저장

7. 구매자 로컬 보안 설정
   - 웹앱 대시보드의 `첫 사용자 가이드`가 현재 단계 하나씩 안내한다.
   - `로컬 설정 열기`를 누르면 사용자 PC의 `AIMAX 로컬 보안 설정` 창이 열린다.
   - 이 창에 네이버 ID/비밀번호와 선택 AI 모델에 맞는 API Key를 입력한다.
   - Gemini 모델은 Gemini API Key, GPT 모델은 OpenAI API Key, Claude 모델은 Claude API Key가 필요하다.
   - 이 값들은 웹앱 서버가 아니라 사용자 PC의 macOS Keychain 또는 Windows Credential Manager에 저장된다.

8. 작업 실행
   - 웹앱에서 버튼이 열린 직원에게 작업 지시
   - 서버는 job queue만 저장
   - 실제 네이버 자동화는 사용자 PC의 로컬 실행기가 수행

## 관리자 페이지 사용법

1. `https://api.aimax.ai.kr/admin`으로 접속한다.
2. 관리자 비밀번호를 입력한다.
3. `구매자 등록`에서 이메일을 입력한다.
4. 구매 상품을 `예리`, `현주`, `통합` 중 하나로 선택한다.
5. 기간제 운영이면 만료일을 넣고, 아니면 비워둔다.
6. `계정 등록`을 누른다.
7. 결과 박스에 나온 안내문을 복사하거나 `Gmail로 안내문 보내기`로 구매자에게 발송한다.
8. 구매자가 비밀번호를 바꾸면 관리자 목록의 `실행 가능` 상태가 켜진다.

## 카페24 주문 대기열 운영

카페24 주문 메일 자동화는 텔레그램 알림과 별개로 AIMAX 서버에도 주문을 저장한다.
관리자는 `/admin#orders`의 `카페24 주문` 탭에서 대기 주문을 확인하고 한 번에 처리한다.

운영 흐름:

1. 카페24 주문 메일을 n8n이 읽는다.
2. n8n이 이름, 이메일, 상품명, 금액, 주문일을 AIMAX 서버로 보낸다.
3. AIMAX 서버는 `cafe24-orders.json`에 주문을 저장한다.
4. `60,000원` 또는 상품명에 `전체 통합/통합/패키지`가 있으면 `bundle`로 자동 분류한다.
5. 상품명에 `블로그팀/블로그마케팅팀/마케팅팀/예리+현주`가 있으면 `blog_team`으로 자동 분류한다.
6. 상품명에 `예리`가 있으면 `yeri`, `현주`가 있으면 `hyunju`, `송이/자료조사`가 있으면 `songi`로 자동 분류한다.
7. `33,000원`인데 상품명으로 예리/현주/송이를 구분하지 못하면 `확인 필요`로 남긴다.
8. 관리자는 주문을 체크하고, 필요하면 AIMAX 상품을 직접 고른 뒤 `선택 계정 생성`을 누른다.
9. 생성 직후 안내문이 만들어진다. 임시 비밀번호는 저장하지 않으므로 이 화면에서 바로 확인한다.
10. 안내문 확인 후 `생성 안내문 발송`을 누르면 각 구매자에게 발송되고 주문 상태가 `발송 완료`로 바뀐다.

운영 서버에는 아래 환경변수가 추가로 필요하다.

```text
AIMAX_CAFE24_WEBHOOK_SECRET=<long random secret>
```

n8n HTTP Request 노드는 아래처럼 AIMAX 서버로 POST한다.

```text
POST https://api.aimax.ai.kr/api/integrations/cafe24/orders
Header: X-AIMAX-Cafe24-Secret: <AIMAX_CAFE24_WEBHOOK_SECRET>
Content-Type: application/json
```

권장 payload:

```json
{
  "source": "cafe24_order_email",
  "external_id": "{{$json.messageId || $json.orderId}}",
  "name": "{{$json.name}}",
  "email": "{{$json.email}}",
  "phone": "{{$json.phone}}",
  "product": "{{$json.product}}",
  "amount": "{{$json.amount}}",
  "orderDate": "{{$json.orderDate}}"
}
```

주의:

- 텔레그램 메시지에는 이메일이 없어도 된다. AIMAX 서버로 보내는 payload에는 이메일이 반드시 들어와야 한다.
- 이메일이 없거나 상품을 판별하지 못한 주문은 `확인 필요`로 남긴다.
- 임시 비밀번호와 안내문 본문은 주문 대기열 파일에 저장하지 않는다.
- 실제 메일 발송은 `AIMAX_MAIL_WEBHOOK_URL` 또는 `AIMAX_RESEND_API_KEY`가 설정된 서버에서만 동작한다.

기존 구매자 상품 변경:

1. 목록에서 이메일을 찾는다.
2. `예리`, `현주`, `통합` 버튼 중 구매 상품에 맞는 버튼을 누른다.
3. 이 작업은 비밀번호를 바꾸지 않고 권한만 갱신한다.

기존 구매자 비밀번호 재발급:

1. 목록에서 이메일을 찾는다.
2. `비번 재발급`을 누른다.
3. 새 임시 비밀번호를 구매자에게 전달한다.
4. 구매자는 다시 로그인 후 비밀번호를 변경해야 실행 권한이 열린다.

## 여러 구매자 한 번에 등록

초기 구매자가 50명 정도라면 `여러 구매자 등록`을 사용한다.

1. 기본 구매 상품을 선택한다.
2. 공통 만료일이 있으면 넣는다.
3. 구매자 목록에 한 줄에 한 명씩 붙여넣는다.
4. `여러 계정 등록`을 누른다.
5. 결과에 나온 이메일별 임시 비밀번호를 확인한다.
6. `전체 안내문 복사`를 눌러 전달 문구를 복사한다.

입력 형식:

```text
buyer1@example.com, 홍길동
buyer2@example.com, 김민수
buyer3@example.com, 이예리, yeri
buyer4@example.com, 박현주, hyunju, 2026-06-30
```

각 줄의 순서는 아래와 같다.

```text
이메일, 이름, 상품, 만료일, 운영 메모
```

상품을 비워두면 화면에서 선택한 기본 구매 상품이 적용된다.
상품은 `bundle`, `yeri`, `hyunju` 또는 `통합`, `예리`, `현주`로 입력할 수 있다.
관리자 API의 JSON `provision-batch`는 buyer 항목에 `temporary_password` 필드를 받으면 서버 자동 생성 비밀번호 대신 해당 값을 첫 로그인 임시 비밀번호로 저장한다.

대량 등록은 서버에서 먼저 전체 입력을 검증한다.
잘못된 이메일, 잘못된 상품, 같은 목록 안의 중복 이메일이 있으면 저장하지 않고 오류 줄을 보여준다.

## 계정 만료와 삭제

구매자 목록의 `만료`와 `삭제` 버튼은 관리자 화면에서만 사용할 수 있다.

- `만료`: 계정 상태를 만료로 바꾸고 현재 세션과 미사용 셋업 링크를 즉시 끊는다. 만료된 구매자는 로그인할 수 없고 작업 실행도 막힌다. 다시 열려면 관리자에서 상품 버튼이나 계정 등록으로 권한을 갱신한다.
- `삭제`: 계정, 세션, 미사용 셋업 링크, 실행기 상태, 대기/완료 작업 기록을 제거한다. 실수 방지를 위해 삭제 전 이메일을 그대로 입력해야 한다.

## 관리자 API 예시

새 통합 구매자 등록:

```bash
curl -sS https://api.aimax.ai.kr/api/admin/users/provision \
  -H "content-type: application/json" \
  -H "X-AIMAX-Admin-Token: $AIMAX_ADMIN_TOKEN" \
  -d '{
    "email": "buyer@example.com",
    "name": "구매자 이름",
    "product": "bundle",
    "source": "manual_purchase",
    "admin_note": "2026-05-06 통합 구매"
  }'
```

기존 사용자 상품 변경 또는 비밀번호 재발급:

```bash
curl -sS https://api.aimax.ai.kr/api/admin/users/provision \
  -H "content-type: application/json" \
  -H "X-AIMAX-Admin-Token: $AIMAX_ADMIN_TOKEN" \
  -d '{
    "email": "buyer@example.com",
    "product": "yeri",
    "reset_password": true,
    "source": "support_reset"
  }'
```

사용자 조회:

```bash
curl -sS "https://api.aimax.ai.kr/api/admin/users?query=buyer@example.com" \
  -H "X-AIMAX-Admin-Token: $AIMAX_ADMIN_TOKEN"
```

여러 구매자 등록:

```bash
curl -sS https://api.aimax.ai.kr/api/admin/users/provision-batch \
  -H "content-type: application/json" \
  -H "X-AIMAX-Admin-Token: $AIMAX_ADMIN_TOKEN" \
  -d '{
    "product": "bundle",
    "source": "manual_batch_purchase",
    "buyers": [
      {"email": "buyer1@example.com", "name": "구매자 1"},
      {"email": "buyer2@example.com", "name": "구매자 2", "product": "yeri"}
    ]
  }'
```

## 웹앱 버튼이 열리는 기준

사용자 웹앱은 `/api/auth/me`에서 내려오는 `can_execute`와 `user.entitlements.products`를 본다.

- `can_execute=false`
  - 비밀번호 변경 필요 또는 권한 만료/비활성
  - 작업 버튼 제한
  - 다운로드 제한

- `can_execute=true`, product=`yeri`
  - 예리 직원 사용 가능
  - 예리 작업 버튼 활성화
  - 예리 설치 파일 다운로드 가능

- `can_execute=true`, product=`hyunju`
  - 현주 직원 사용 가능
  - 현주 작업 버튼 활성화
  - 현주 설치 파일 다운로드 가능

- `can_execute=true`, product=`bundle`
  - 예리/현주 둘 다 사용 가능
  - 통합 설치 파일 다운로드 가능

서버도 동일한 권한을 다시 검사한다.

- `/api/downloads/options`
- `/api/downloads/agent`
- `/api/jobs`
- `/api/agent/next-job`

그래서 프론트엔드 버튼을 조작해도 권한 없는 작업은 서버에서 막힌다.

## 중요한 설계 원칙

- 관리자 토큰은 브라우저 프론트엔드에 직접 넣지 않는다.
- `/admin`은 운영자 로그인 뒤 HTTP-only 세션 쿠키로 동작한다.
- 사용자는 자기 계정의 상품 권한만 볼 수 있다.
- 결제 자동화가 붙으면 결제 webhook이 `provision`과 같은 내부 로직을 호출하게 만든다.
- 임시 비밀번호는 저장된 원문을 다시 볼 수 없으므로 생성 직후에만 복사한다.
- 네이버 계정과 사용자 API 키는 웹앱 서버가 아니라 사용자 PC의 OS 안전 저장소에 보관한다.
