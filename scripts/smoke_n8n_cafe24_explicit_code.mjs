#!/usr/bin/env node
// n8n 카페24 파스 노드(명시 상품 코드 주입) 격리 검증.
// 픽스처는 전부 가상 이름·이메일 — 실고객 데이터 없음.
// 실행: node scripts/smoke_n8n_cafe24_explicit_code.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const parseCode = readFileSync(path.join(here, 'n8n_cafe24_parse_items.js'), 'utf8');

function runParse(inputJson) {
  const fn = new Function('$input', parseCode);
  const out = fn({ first: () => ({ json: inputJson }) });
  return out[0].json;
}

function orderHtml({ orderId, name, phone, email, rows, total, date }) {
  const rowHtml = rows
    .map((r) => `<tr><td>${r.name}</td><td>${r.qty}</td><td>${r.price}원</td><td>${r.total}원</td></tr>`)
    .join('\n    ');
  return `
<table>
  <tr><th>주문번호</th><td>${orderId}</td></tr>
  <tr><th>받으시는분</th><td>${name}</td></tr>
  <tr><th>휴대전화</th><td>${phone}</td></tr>
</table>
<p><span style="font-family:'Noto Sans KR',sans-serif;">${email}</span></p>
<table>
  <thead>
    <tr><th>상품명</th><th>수량</th><th>판매가</th><th>상품구매금액</th></tr>
  </thead>
  <tbody>
    ${rowHtml}
  </tbody>
</table>
<table>
  <tr><th>총 결제금액</th><td><strong>${total}</strong>원</td></tr>
</table>
<p>주문일시: ${date} 12:34:56</p>
`;
}

let pass = 0;
let fail = 0;
function check(label, cond, actual) {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label} — actual: ${JSON.stringify(actual)}`);
  }
}

// (a) 단품목 — 알려진 상품(예리) → 품목·top-level 모두 코드 부여
const single = runParse({
  subject: '[테스트몰] 주문이 접수되었습니다',
  textHtml: orderHtml({
    orderId: '20260830-0000001',
    name: '홍길동',
    phone: '010-0000-1234',
    email: 'gildong.test@example.com',
    rows: [{ name: 'AI 직원 - 블로그 마케터 예리', qty: 1, price: '30,000', total: '30,000' }],
    total: '30,000',
    date: '2026-08-30',
  }),
});
check('(a) 단품목: items 1건 파싱', single.items.length === 1, single.items);
check('(a) 단품목: 품목 코드 yeri', single.items[0].aimax_product === 'yeri', single.items[0]);
check('(a) 단품목: top-level aimax_product=yeri', single.aimax_product === 'yeri', single.aimax_product);
check('(a) 단품목: 기존 필드 보존(email/amount)', single.email === 'gildong.test@example.com' && single.amount === 30000, { email: single.email, amount: single.amount });

// (b) 모르는 상품 → 필드 자체가 없어야 한다 (서버 추론 폴백 유지)
const unknown = runParse({
  subject: '[테스트몰] 주문이 접수되었습니다',
  textHtml: orderHtml({
    orderId: '20260830-0000002',
    name: '김테스트',
    phone: '010-0000-5678',
    email: 'kim.test@example.com',
    rows: [{ name: '미스터리 신상품 패키지', qty: 1, price: '55,000', total: '55,000' }],
    total: '55,000',
    date: '2026-08-30',
  }),
});
check('(b) 미지 상품: 품목에 aimax_product 없음', !('aimax_product' in unknown.items[0]), unknown.items[0]);
check('(b) 미지 상품: top-level aimax_product 없음', !('aimax_product' in unknown), Object.keys(unknown));

// (c) 다품목 — 품목별 각각 코드, top-level 은 복수 코드라 생략
const multi = runParse({
  subject: '[테스트몰] 주문이 접수되었습니다',
  textHtml: orderHtml({
    orderId: '20260830-0000003',
    name: '이가상',
    phone: '010-0000-9999',
    email: 'lee.virtual@example.com',
    rows: [
      { name: 'AI 직원 - 블로그 마케터 예리', qty: 1, price: '30,000', total: '30,000' },
      { name: 'AI 경리 상수', qty: 1, price: '30,000', total: '30,000' },
    ],
    total: '60,000',
    date: '2026-08-30',
  }),
});
check('(c) 다품목: items 2건 파싱', multi.items.length === 2, multi.items);
check('(c) 다품목: 1번 품목 yeri', multi.items[0].aimax_product === 'yeri', multi.items[0]);
check('(c) 다품목: 2번 품목 sangsu', multi.items[1].aimax_product === 'sangsu', multi.items[1]);
check('(c) 다품목: top-level 생략(products 붕괴 방지)', !('aimax_product' in multi), multi.aimax_product);

// (d) 보너스 — 비직원 상품(전자책)은 직원 패턴에 스쳐도 코드 금지
const nonStaff = runParse({
  subject: '[테스트몰] 주문이 접수되었습니다',
  textHtml: orderHtml({
    orderId: '20260830-0000004',
    name: '박가공',
    phone: '010-0000-4321',
    email: 'park.fake@example.com',
    rows: [{ name: '컨셉의 정석 전자책', qty: 1, price: '9,900', total: '9,900' }],
    total: '9,900',
    date: '2026-08-30',
  }),
});
check('(d) 비직원 상품: 코드 미부여', !('aimax_product' in nonStaff.items[0]) && !('aimax_product' in nonStaff), nonStaff.items[0]);

// (e) 보너스 — 규칙 순서: 블로그마케팅팀(예리+현주)은 blog_team 이 먼저 잡혀야 한다
const team = runParse({
  subject: '[테스트몰] 주문이 접수되었습니다',
  textHtml: orderHtml({
    orderId: '20260830-0000005',
    name: '최더미',
    phone: '010-0000-7777',
    email: 'choi.dummy@example.com',
    rows: [{ name: '블로그 마케팅팀 (예리+현주)', qty: 1, price: '60,000', total: '60,000' }],
    total: '60,000',
    date: '2026-08-30',
  }),
});
check('(e) 규칙 순서: blog_team 우선', team.items[0].aimax_product === 'blog_team' && team.aimax_product === 'blog_team', team.items[0]);

console.log(`\nresult: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
