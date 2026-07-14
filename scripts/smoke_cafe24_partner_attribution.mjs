import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __cafe24Test } = require("../oracle/aimax-reports-api/server.js");

const rows = [
  {
    name: "김도연대표님",
    url: "https://makefamily.kr/partners/kim?ref=kimdoyeon",
    note: "kim-doyeon",
  },
  {
    name: "상수",
    url: "https://makefamily.kr/partners/sangsu?coupon=SANGSU2026",
    note: "",
  },
  {
    name: "민재대표님",
    url: "https://makefamily.kr/product/detail.html?product_no=133",
    note: "",
  },
];

const noHint = __cafe24Test.collectCafe24PartnerCandidates({
  order: {
    name: "박지안",
    product_name: "구독제 일본구매대행 사이트",
    amount: "100,000",
  },
});
assert.deepEqual(noHint, []);

const exactMatch = __cafe24Test.matchCafe24PartnerRows({
  order: {
    partnerUrl: "https://makefamily.kr/partners/kim?ref=kimdoyeon",
  },
}, rows);
assert.equal(exactMatch.matched, true);
assert.equal(exactMatch.partner.name, "김도연대표님");
assert.equal(__cafe24Test.cafe24PartnerLine(exactMatch.partner), "김도연대표님 페이지에서 결제");

const queryTokenMatch = __cafe24Test.matchCafe24PartnerRows({
  order: {
    ref: "kimdoyeon",
  },
}, rows);
assert.equal(queryTokenMatch.matched, true);
assert.equal(queryTokenMatch.partner.name, "김도연대표님");

const couponMatch = __cafe24Test.matchCafe24PartnerRows({
  coupon_code: "sangsu2026",
}, rows);
assert.equal(couponMatch.matched, true);
assert.equal(couponMatch.partner.name, "상수");
assert.equal(__cafe24Test.cafe24PartnerLine(couponMatch.partner), "상수 페이지에서 결제");

const productNoMatch = __cafe24Test.matchCafe24PartnerRows({
  productUrl: "https://makehobby0707.cafe24.com/product/detail.html?product_no=133",
}, rows);
assert.equal(productNoMatch.matched, true);
assert.equal(productNoMatch.reason, "product_no");
assert.equal(productNoMatch.partner.name, "민재대표님");
assert.equal(__cafe24Test.cafe24PartnerLine(productNoMatch.partner), "파트너: 민재대표님 (product_no=133)");

const productNoFieldMatch = __cafe24Test.matchCafe24PartnerRows({
  product_no: "133",
}, rows);
assert.equal(productNoFieldMatch.matched, true);
assert.equal(productNoFieldMatch.reason, "product_no");
assert.equal(productNoFieldMatch.partner.name, "민재대표님");

const productNoPrecedence = __cafe24Test.matchCafe24PartnerRows({
  product_no: "999999",
  partner_ref: "kimdoyeon",
}, rows);
assert.equal(productNoPrecedence.matched, false);
assert.equal(productNoPrecedence.reason, "no_match");

assert.equal(__cafe24Test.cafe24AdminOrderId({
  source: "cafe24_order_email",
  order_id: "20260624-000001",
}), "20260624-000001");

assert.deepEqual(__cafe24Test.cafe24AdminExtractProductNos({
  order: {
    items: [
      { product_no: 133 },
      { product_no: "228" },
      { product_no: "133" },
    ],
  },
}), ["133", "228"]);

const productDetailWithoutNumber = __cafe24Test.matchCafe24PartnerRows({
  productUrl: "https://makefamily.kr/product/detail.html",
}, rows);
assert.equal(productDetailWithoutNumber.matched, false);
assert.equal(productDetailWithoutNumber.reason, "no_match");

const missingMatch = __cafe24Test.matchCafe24PartnerRows({
  partner_ref: "unknown-partner",
}, rows);
assert.equal(missingMatch.matched, false);
assert.equal(missingMatch.reason, "no_match");

const parsedRows = __cafe24Test.partnerRowsFromNotionResults([
  {
    properties: {
      "성함": {
        type: "rich_text",
        rich_text: [{ plain_text: "이한나대표님" }],
      },
      "URL": {
        type: "url",
        url: "https://makefamily.kr/partners/ihanna?ref=ihanna",
      },
      "비고": {
        type: "title",
        title: [{ plain_text: "IHANNA" }],
      },
    },
  },
]);
assert.deepEqual(parsedRows, [
  {
    name: "이한나대표님",
    url: "https://makefamily.kr/partners/ihanna?ref=ihanna",
    note: "IHANNA",
    product_no: "",
  },
]);

console.log("cafe24 partner attribution smoke passed");
