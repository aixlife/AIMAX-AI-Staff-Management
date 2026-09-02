// server.js의 실제 소스에서 매핑 로직만 잘라 그대로 평가한다 (복붙 사본이 아니라 원본 검증)
import fs from "node:fs";

const SRC = "/Users/aixlife/Projects/AIMAX-AI-Staff-Management/oracle/aimax-reports-api/server.js";
const src = fs.readFileSync(SRC, "utf8");

function slice(startMarker, endMarker) {
    const s = src.indexOf(startMarker);
    if (s < 0) throw new Error(`not found: ${startMarker}`);
    const e = src.indexOf(endMarker, s);
    if (e < 0) throw new Error(`end not found for: ${startMarker}`);
    return src.slice(s, e + endMarker.length);
}

const code = [
    slice("function parseCafe24Amount(value) {", "\n}"),
    slice("function normalizeCafe24ProductText(value) {", "\n}"),
    slice("const CAFE24_STAFF_PRODUCT_RULES = [", "\n];"),
    slice("const CAFE24_NON_STAFF_PRODUCT_PATTERNS = [", "\n];"),
    slice("function inferCafe24Product(productName, amountValue) {", "\n}"),
    "return { inferCafe24Product, normalizeCafe24ProductText };",
].join("\n\n");

const { inferCafe24Product } = new Function(code)();

const CASES = [
    // [상품명, 금액, 기대 status/confidence, 기대 product, 설명]
    ["팔로워 0에서 완판까지 · 스레드 가이드북 PREMIUM (전자책 PDF)", "108,000원", "ignored", "", "전자책 — 계정 불필요, 알림 꺼져야 함"],
    ["팔로워 0에서 완판까지 · 스레드 가이드북 PREMIUM (전자책 PDF)", "53,000원", "ignored", "", "전자책 가격 변동해도 동일"],
    ["(8월/9월) AIMAX 창업 프로그램 4기", 1790000, "ignored", "", "창업 4기 — 기수 일반화 확인"],
    ["AIMAX 창업 프로그램 2기", 1790000, "ignored", "", "기존 2기 회귀 확인"],

    ["블로그마케터 소피아", 33000, "auto", "yeri", "신규 영문명"],
    ["자료조사원 조지", 3300, "auto", "songi", "신규 영문명"],
    ["스크립트 작가 엠마", 9900, "auto", "yunmi", "신규 영문명"],
    ["오피스매니저 존", 5500, "auto", "jieun", "신규 영문명(짧은 토큰)"],
    ["판서쌤 에밀리", 9900, "auto", "nakyung", "신규 영문명"],
    ["경리 샘", 0, "auto", "sangsu", "신규 영문명(짧은 토큰)"],
    ["PC 알람앱 맥스", 3000, "auto", "maxalert", "변경 없음"],

    ["블로그마케터 예리", 33000, "auto", "yeri", "구 한국명 회귀"],
    ["자료조사원 송이", 3300, "auto", "songi", "구 한국명 회귀"],
    ["오피스매니저 지은", 5500, "auto", "jieun", "구 한국명 회귀"],
    ["블로그마케팅 팀(예리x현주)", 66000, "auto", "blog_team", "팀 상품 회귀"],
    ["제2의 뇌: 나같이 생각하는 AI 비서", 330000, "ignored", "", "비직원 상품 회귀"],
];

let pass = 0, fail = 0;
for (const [name, amount, wantConf, wantProduct, note] of CASES) {
    const r = inferCafe24Product(name, amount);
    const conf = r.status === "ignored" ? "ignored" : r.confidence;
    const ok = conf === wantConf && (r.product || "") === wantProduct;
    if (ok) { pass++; } else { fail++; }
    console.log(
        `${ok ? "PASS" : "FAIL"}  ${name}\n      기대=${wantConf}/${wantProduct || "-"}  실제=${conf}/${r.product || "-"}${r.issue ? ` issue=${r.issue}` : ""}  (${note})`
    );
}
console.log(`\n총 ${CASES.length}건 — PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
