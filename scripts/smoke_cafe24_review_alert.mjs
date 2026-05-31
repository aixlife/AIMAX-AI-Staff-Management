import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __cafe24Test } = require("../oracle/aimax-reports-api/server.js");

const now = "2026-05-27T00:00:00.000Z";

const ambiguous = __cafe24Test.buildCafe24Order({
  order: {
    email: "buyer@example.com",
    name: "테스트 구매자",
    phone: "010-1234-5678",
    product_name: "공동구매 수익화 A TO Z",
    amount: "550,000",
    order_date: "2026-05-27",
  },
}, now);

assert.equal(ambiguous.status, "needs_review");
assert.equal(ambiguous.issue, "unknown_product");
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(ambiguous), true);

const alertText = __cafe24Test.telegramCafe24ReviewAlertText(ambiguous);
assert.match(alertText, /AIMAX 카페24 주문 확인 필요/);
assert.match(alertText, /자동 계정 생성 보류/);
assert.match(alertText, /AIMAX 상품 아님\/매핑 불가/);
assert.match(alertText, /buyer@example\.com/);
assert.match(alertText, /550,000원/);
assert.match(alertText, /\/admin#orders/);
assert.doesNotMatch(alertText, /010-1234-5678/);

ambiguous.review_alert_sent_at = now;
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(ambiguous), false);

const yeri = __cafe24Test.buildCafe24Order({
  order: {
    email: "yeri-buyer@example.com",
    name: "예리 구매자",
    product_name: "블로그마케터 예리씨",
    amount: "33,000",
  },
}, now);

assert.equal(yeri.status, "pending");
assert.equal(yeri.product, "yeri");
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(yeri), false);
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(yeri), true);

const invalidEmail = __cafe24Test.buildCafe24Order({
  order: {
    name: "이메일 없음",
    product_name: "블로그팀",
    amount: "33,000",
  },
}, now);

assert.equal(invalidEmail.status, "needs_review");
assert.equal(invalidEmail.issue, "invalid_email");
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(invalidEmail), true);
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(invalidEmail), false);
assert.match(__cafe24Test.telegramCafe24ReviewAlertText(invalidEmail), /이메일 확인 필요/);

const setupText = __cafe24Test.onboardingSetupLinkText(
  { email: "setup-buyer@example.com", name: "설정 구매자" },
  "https://api.aimax.ai.kr/setup?token=example",
  "yeri",
  "2026-06-03T00:00:00.000Z",
);
assert.match(setupText, /비밀번호를 설정/);
assert.match(setupText, /https:\/\/api\.aimax\.ai\.kr\/setup\?token=example/);
assert.doesNotMatch(setupText, /임시 비밀번호/);

console.log("smoke_cafe24_review_alert: PASS");
