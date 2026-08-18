import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __cafe24Test } = require("../oracle/aimax-reports-api/server.js");

const now = "2026-05-27T00:00:00.000Z";

const ignoredNonStaff = __cafe24Test.buildCafe24Order({
  order: {
    email: "buyer@example.com",
    name: "테스트 구매자",
    phone: "010-1234-5678",
    product_name: "공동구매 수익화 A TO Z",
    amount: "550,000",
    order_date: "2026-05-27",
  },
}, now);

assert.equal(ignoredNonStaff.status, "ignored");
assert.equal(ignoredNonStaff.issue, "non_staff_product");
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(ignoredNonStaff), false);

const ignoredCourseAtBundlePrice = __cafe24Test.buildCafe24Order({
  order: {
    email: "course-buyer@example.com",
    name: "강의 구매자",
    product_name: "[6월/7월 오프라인] AI로 직원 만드는 법",
    amount: "60,000",
  },
}, now);

assert.equal(ignoredCourseAtBundlePrice.status, "ignored");
assert.equal(ignoredCourseAtBundlePrice.product, "");
assert.equal(ignoredCourseAtBundlePrice.issue, "non_staff_product");

const unknownStaffLikeAmount = __cafe24Test.buildCafe24Order({
  order: {
    email: "unknown@example.com",
    name: "미확인 구매자",
    product_name: "확인 필요한 상품명",
    amount: "33,000",
  },
}, now);

assert.equal(unknownStaffLikeAmount.status, "needs_review");
assert.equal(unknownStaffLikeAmount.issue, "unknown_product");
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(unknownStaffLikeAmount), true);

const alertText = __cafe24Test.telegramCafe24ReviewAlertText(unknownStaffLikeAmount);
assert.match(alertText, /AIMAX 카페24 주문 확인 필요/);
assert.match(alertText, /자동 계정 생성 보류/);
assert.match(alertText, /AIMAX 상품 아님\/매핑 불가/);
assert.match(alertText, /unknown@example\.com/);
assert.match(alertText, /33,000원/);
assert.match(alertText, /\/admin#orders/);
assert.doesNotMatch(alertText, /010-1234-5678/);

unknownStaffLikeAmount.review_alert_sent_at = now;
assert.equal(__cafe24Test.shouldSendCafe24ReviewAlert(unknownStaffLikeAmount), false);

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

const jieun = __cafe24Test.buildCafe24Order({
  order: {
    email: "jieun-buyer@example.com",
    name: "지은 구매자",
    product_name: "오피스매니저 지은씨",
    amount: "5,500",
  },
}, now);

assert.equal(jieun.status, "pending");
assert.equal(jieun.product, "jieun");
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(jieun), true);

const yunmi = __cafe24Test.buildCafe24Order({
  order: {
    email: "yunmi-buyer@example.com",
    name: "윤미 구매자",
    product_name: "스크립트 작가 윤미씨",
    amount: "9,900",
  },
}, now);

assert.equal(yunmi.status, "pending");
assert.equal(yunmi.product, "yunmi");
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(yunmi), true);

// 2026-08-18 정책 변경: 등록가와 결제 금액이 어긋나도 주문을 막지 않고 경고만 남긴다.
// (판매가 개편 33,000 -> 30,000 이 반영 안 돼 유료 주문이 12일 묶였던 사고)
const wrongAmount = __cafe24Test.buildCafe24Order({
  order: {
    email: "wrong-amount@example.com",
    name: "금액 오류",
    product_name: "자료조사원 송이씨",
    amount: "33,000",
  },
}, now);

assert.equal(wrongAmount.status, "pending");
assert.equal(wrongAmount.product, "songi");
assert.equal(wrongAmount.issue, "");
assert.equal(wrongAmount.price_warnings.length, 1);
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(wrongAmount), true);

// 등록가의 3배를 넘는 금액은 오매칭 위험이 커서 그대로 사람 검토로 남는다.
const wayOffAmount = __cafe24Test.buildCafe24Order({
  order: {
    email: "way-off@example.com",
    name: "금액 과다",
    product_name: "자료조사원 송이씨",
    amount: "1,990,000",
  },
}, now);

assert.equal(wayOffAmount.status, "needs_review");
assert.equal(wayOffAmount.issue, "amount_mismatch");

const hyojin = __cafe24Test.buildCafe24Order({
  order: {
    email: "hyojin-buyer@example.com",
    name: "효진 구매자",
    product_name: "영상제작 아나운서 효진씨",
    amount: "33,000",
  },
}, now);

assert.equal(hyojin.status, "needs_review");
assert.equal(hyojin.product, "hyojin");
assert.equal(hyojin.issue, "product_not_ready");
assert.equal(__cafe24Test.shouldAutoProcessCafe24Order(hyojin), false);

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
