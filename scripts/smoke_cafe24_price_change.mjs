// 카페24 판매가 개편(직원 전 상품 33,000/9,900/3,000 -> 30,000원)이 자동 안내 메일을 막지 않는지 검증한다.
// 회귀 배경: 2026-08-06 최민희 님의 "AI 블로그마케터 예리" 30,000원 결제가 amount_mismatch 로
// needs_review 에 12일간 묶여 권한도 안내 메일도 나가지 않았다. 같은 원인으로 8/18 문고은 님 주문도 묶였다.
// 주간 감사는 8/10·8/17 두 번 알렸지만 아무도 처리하지 않았다 — 그래서 "막고 알리기"를 "처리하고 경고하기"로 바꿨다.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __cafe24Test } = require("../oracle/aimax-reports-api/server.js");

const now = "2026-08-18T03:00:00.000Z";

// 1) 사고 주문 형태 그대로 — 상품명 + 총액만 오는 주문 메일 경로
const yeriOrder = __cafe24Test.buildCafe24Order({
  order: {
    email: "yeri-buyer@example.com",
    name: "예리 구매자",
    product_name: "AI 블로그마케터 예리",
    amount: "30,000",
    order_date: "2026-08-06",
  },
}, now);

assert.equal(yeriOrder.product, "yeri");
assert.equal(yeriOrder.issue, "");
assert.equal(yeriOrder.status, "pending");
assert.equal(yeriOrder.price_warnings.length, 0);
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(yeriOrder), true);

// 2) 카페24 관리자 API 경로 — 품목 배열(items)이 함께 오는 8/18 주문 형태
const yeriItemsOrder = __cafe24Test.buildCafe24Order({
  order: {
    email: "yeri-items@example.com",
    name: "문고은",
    product_name: "AI 블로그마케터 예리",
    amount: "30,000",
    order_id: "20260818-0000093",
    source: "cafe24_admin_api",
    items: [{ name: "AI 블로그마케터 예리", qty: 1, price: 30000, line_total: 30000 }],
  },
}, now);

assert.equal(yeriItemsOrder.product, "yeri");
assert.equal(yeriItemsOrder.issue, "");
assert.equal(yeriItemsOrder.status, "pending");
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(yeriItemsOrder), true);

// 3) 30,000원으로 바뀐 나머지 직원 상품도 전부 자동 처리된다
for (const [name, product] of [
  ["AI 자료조사 송이씨", "songi"],
  ["AI 숏폼작가 윤미씨", "yunmi"],
  ["AI 오피스 매니저 지은", "jieun"],
  ["AI 판서 나경씨", "nakyung"],
  ["AI 경리 상수", "sangsu"],
  ["PC 알람앱 맥스", "maxalert"],
]) {
  const order = __cafe24Test.buildCafe24Order({
    order: { email: `${product}@example.com`, name: "구매자", product_name: name, amount: "30,000" },
  }, now);
  assert.equal(order.product, product, `${name} -> ${product} 매칭 실패`);
  assert.equal(order.issue, "", `${name} 자동 처리 차단됨`);
  assert.equal(order.status, "pending", `${name} 상태 이상`);
}

// 4) 옛 가격(33,000원)으로 들어와도 막지 않고 경고만 남긴다 — 가격이 또 바뀌어도 고객은 기다리지 않는다
const oldPrice = __cafe24Test.buildCafe24Order({
  order: { email: "old-price@example.com", name: "구가격", product_name: "AI 블로그마케터 예리", amount: "33,000" },
}, now);

assert.equal(oldPrice.product, "yeri");
assert.equal(oldPrice.issue, "");
assert.equal(oldPrice.status, "pending");
assert.equal(oldPrice.price_warnings.length, 1);
assert.match(oldPrice.price_warnings[0], /33,000원/);
assert.match(oldPrice.price_warnings[0], /30,000원/);

// 5) 품목 경로에서도 동일 — 단가가 달라도 처리하고 경고만 남긴다
const oldPriceItems = __cafe24Test.buildCafe24Order({
  order: {
    email: "old-price-items@example.com",
    name: "구가격",
    product_name: "AI 숏폼작가 윤미씨",
    amount: "9,900",
    items: [{ name: "AI 숏폼작가 윤미씨", qty: 1, price: 9900, line_total: 9900 }],
  },
}, now);

assert.equal(oldPriceItems.product, "yunmi");
assert.equal(oldPriceItems.issue, "");
assert.equal(oldPriceItems.price_warnings.length, 1);

// 6) 등록가의 3배를 넘으면 오매칭 위험이 커서 계속 사람 검토로 보낸다 (넓은 패턴 보호)
const wayOff = __cafe24Test.buildCafe24Order({
  order: { email: "way-off@example.com", name: "고액", product_name: "PC 알람앱 맥스 마스터 클래스", amount: "1,990,000" },
}, now);

assert.equal(wayOff.product, "maxalert");
assert.equal(wayOff.issue, "amount_mismatch");
assert.equal(wayOff.status, "needs_review");
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(wayOff), false);

// 7) 비직원 상품 회귀 없음
assert.equal(__cafe24Test.buildCafe24Order({
  order: { email: "free@example.com", name: "무료", product_name: "팔로워 0에서 파는 스레드 (무료 배포판)", amount: "0" },
}, now).status, "ignored");

// 8) 미출시 직원은 금액이 달라도 계속 검토 대기 (경고 정책이 출시 게이트를 열지 않는다)
const hyojin = __cafe24Test.buildCafe24Order({
  order: { email: "hyojin@example.com", name: "효진", product_name: "영상제작 아나운서 효진씨", amount: "33,000" },
}, now);
assert.equal(hyojin.issue, "product_not_ready");
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(hyojin), false);

console.log("PASS smoke_cafe24_price_change");
