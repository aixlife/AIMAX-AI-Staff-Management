// 카페24 상품명이 직원 별명("경리 샘")으로 들어와도 상수(경리)로 자동 매칭되는지 검증한다.
// 회귀 배경: 2026-07-29 "경리 샘" 주문이 unknown_product 로 5일간 needs_review 에 묶여
// 구매자가 직원을 열지 못했다 (조명훈 건).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __cafe24Test } = require("../oracle/aimax-reports-api/server.js");

const now = "2026-08-03T00:00:00.000Z";

// 1) 실제 사고 주문 형태 (금액 미표기)
const aliasOrder = __cafe24Test.buildCafe24Order(
  {
    order: {
      email: "alias-buyer@example.com",
      name: "테스트 구매자",
      phone: "010-0000-0731",
      product_name: "경리 샘",
      order_date: "2026-07-29",
    },
  },
  now,
);
assert.equal(aliasOrder.product, "sangsu");
assert.equal(aliasOrder.product_confidence, "auto");
assert.equal(aliasOrder.issue, "");
assert.notEqual(aliasOrder.status, "needs_review");

// 2) 정가(9,900원)로 들어와도 동일하게 자동 매칭
const alias9900 = __cafe24Test.inferCafe24Product("경리 샘", "9,900");
assert.equal(alias9900.product, "sangsu");
assert.equal(alias9900.confidence, "auto");

// 3) 기존 정식 상품명 회귀 없음
for (const name of ["AI 경리 상수", "경리 상수씨", "견적서 작성"]) {
  const inferred = __cafe24Test.inferCafe24Product(name, "9,900");
  assert.equal(inferred.product, "sangsu", `${name} -> sangsu 매칭 실패`);
  assert.equal(inferred.confidence, "auto");
}

// 4) 다른 직원/비직원 상품이 경리로 오매칭되지 않음
assert.equal(__cafe24Test.inferCafe24Product("오피스매니저 존", "5,500").product, "jieun");
assert.equal(__cafe24Test.inferCafe24Product("자료조사원 조지", "3,300").product, "songi");
assert.equal(__cafe24Test.inferCafe24Product("판서쌤 나경", "9,900").product, "nakyung");
assert.equal(__cafe24Test.inferCafe24Product("회원가입을 하셨습니다", "0").status, "ignored");

console.log("PASS smoke_cafe24_sangsu_alias");
