#!/usr/bin/env node
// 스모크: 예리 글 구조 팩이 "뼈대는 고정, 후크·본문·마무리는 잡마다 변주" 계약을 지키는지 검증한다.
//
// 배경 (2026-08-18): 예리는 글의 뼈대를 매번 모델이 새로 만들었다. 잘 나와도 재사용할 수 없었고
// 결과 편차를 검수할 수도 없었다. 반대로 구조를 통째로 고정하면 같은 사용자의 글이 전부 같은
// 모양이 되어 저품질 위험이 생긴다. 그래서 spine(무엇을 말할지)만 고정하고 후크·본문·마무리는
// 잡 단위 시드로 뽑는다. 이 스모크는 그 두 성질을 동시에 확인한다.
//
// 실행: node scripts/smoke_yeri_structure_packs.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-structure-smoke-"));
fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");

process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { buildYeriGenerationPrompt, buildYeriStructurePlan, loadYeriStructurePacks } = server.__yeriHybridTest;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
    console.log(`  PASS  ${name}  (=${actual})`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}  expected=${expected} actual=${actual}`);
  }
}

const packs = loadYeriStructurePacks();

console.log("[1] 팩 4종이 다 있고 참조하는 블록이 전부 정의돼 있다");
check("팩 로드", Boolean(packs), true);
const packIds = Object.keys(packs.packs);
check("팩 개수", packIds.length, 4);
for (const id of ["info", "review", "compare", "problem"]) {
  check(`팩 존재: ${id}`, Boolean(packs.packs[id]), true);
}
const missingBlocks = [];
for (const [packId, pack] of Object.entries(packs.packs)) {
  const ids = [
    ...(pack.spine || []).filter((entry) => !String(entry).startsWith("@")),
    ...((pack.body || {}).pool || []),
  ];
  for (const blockId of ids) {
    if (!packs.blocks[blockId]) missingBlocks.push(`${packId}:${blockId}`);
  }
}
for (const slotName of Object.keys(packs.slots || {})) {
  for (const blockId of packs.slots[slotName]) {
    if (!packs.blocks[blockId]) missingBlocks.push(`slot ${slotName}:${blockId}`);
  }
}
check("정의 안 된 블록 참조", missingBlocks.join(",") || "none", "none");

console.log("[2] 같은 잡이면 항상 같은 구조가 나온다 (재현 가능)");
const jobA = { job_id: "job-aaa", style: "info", keywords: ["홈베이킹 창업"] };
const first = buildYeriStructurePlan(jobA);
const second = buildYeriStructurePlan(jobA);
check("두 번 뽑아도 동일", JSON.stringify(first) === JSON.stringify(second), true);
check("팩 선택", first.pack_id, "info");

console.log("[3] 잡이 다르면 구조가 갈린다 (같은 모양 반복 방지)");
const shapes = new Set();
const hooks = new Set();
const closes = new Set();
for (let i = 0; i < 40; i += 1) {
  const plan = buildYeriStructurePlan({ job_id: `job-${i}`, style: "info", keywords: ["홈베이킹 창업"] });
  shapes.add(plan.blocks.map((b) => b.id).join(">"));
  hooks.add(plan.blocks[0].id);
  closes.add(plan.blocks[plan.blocks.length - 1].id);
}
check("서로 다른 구조가 2가지 이상", shapes.size >= 2, true);
check("후크가 2종 이상 등장", hooks.size >= 2, true);
check("마무리가 2종 이상 등장", closes.size >= 2, true);

console.log("[4] 뼈대는 어떤 잡에서도 빠지지 않는다 (고정 부분)");
const spineChecks = {
  info: ["core_explain"],
  review: ["review_context", "review_before_after", "review_detail"],
  compare: ["criteria", "compare_table"],
  problem: ["problem_symptom", "problem_cause", "problem_fix", "problem_verify"],
};
let spineViolations = 0;
for (const [packId, required] of Object.entries(spineChecks)) {
  for (let i = 0; i < 25; i += 1) {
    const plan = buildYeriStructurePlan({ job_id: `spine-${packId}-${i}`, structure_pack: packId, keywords: ["테스트"] });
    const ids = plan.blocks.map((b) => b.id);
    for (const blockId of required) {
      if (!ids.includes(blockId)) spineViolations += 1;
    }
    // 후크는 항상 맨 앞, 마무리는 항상 맨 끝
    if (!packs.slots.hook.includes(ids[0])) spineViolations += 1;
    if (!packs.slots.close.includes(ids[ids.length - 1])) spineViolations += 1;
  }
}
check("뼈대 위반 건수", spineViolations, 0);

console.log("[5] 스타일이 기본 팩을 정하고, 명시 지정이 이긴다");
check("style=buy → compare", buildYeriStructurePlan({ job_id: "s1", style: "buy" }).pack_id, "compare");
check("style=ad → review", buildYeriStructurePlan({ job_id: "s2", style: "ad" }).pack_id, "review");
check("명시 지정 우선", buildYeriStructurePlan({ job_id: "s3", style: "buy", structure_pack: "problem" }).pack_id, "problem");
check("알 수 없는 팩이면 스타일 기본값으로", buildYeriStructurePlan({ job_id: "s4", style: "info", structure_pack: "nope" }).pack_id, "info");

console.log("[6] 프롬프트에 구조 지시가 실제로 들어간다");
const prompt = buildYeriGenerationPrompt({ job_id: "p1", style: "info", keywords: ["홈베이킹 창업"], word_count: 1500 });
check("구조 섹션 포함", prompt.includes("글 구조("), true);
check("라벨 그대로 쓰지 말라는 지시 포함", prompt.includes("소제목 문구는 위 라벨을 그대로 쓰지 말고"), true);
check("항목 임의 증감 금지 포함", prompt.includes("항목을 임의로 추가하거나 빼지 않는다"), true);
check("기존 규칙 유지(이미지 배치)", prompt.includes("[이미지] 줄을 연속으로 몰아서 쓰지 않는다"), true);
check("글자 주인공 이미지 금지 규칙 포함", prompt.includes("글자가 주인공인 소재를 넣지 않는다"), true);
check("대체 묘사 지침 포함", prompt.includes("글자 없이 전달되는 장면"), true);

console.log("[6-1] 이미지 모델에 따라 글자 규칙이 갈린다 (gpt-image-2 만 한글 렌더 가능)");
const { yeriImageModelRendersText, yeriImageTextRiskLines } = server.__yeriHybridTest;
check("gpt-image-2 → 글자 가능", yeriImageModelRendersText({ image_model: "gpt-image-2" }), true);
check("gpt-image-1 → 글자 불가", yeriImageModelRendersText({ image_model: "gpt-image-1" }), false);
check("gemini image → 글자 불가", yeriImageModelRendersText({ image_model: "gemini-3.1-flash-image" }), false);
check("미지정 → 글자 불가(보수적)", yeriImageModelRendersText({}), false);

const promptText2 = buildYeriGenerationPrompt({ job_id: "p2", style: "info", keywords: ["홈베이킹"], image_model: "gpt-image-2", image_count: 2 });
check("gpt-image-2 는 금지 대신 허용 지시", promptText2.includes("글자가 주인공인 소재를 넣지 않는다"), false);
check("gpt-image-2 는 넣으라고 유도", promptText2.includes("짧은 한글 문구가 내용 전달에 도움이 되는 장면이면 넣는다"), true);
check("길이·개수 상한 명시", promptText2.includes("한 줄, 10자 안팎으로 짧게"), true);
check("억지로 넣지 말라는 제동", promptText2.includes("억지로 넣지 않는다"), true);
check("글자 많은 구도는 여전히 금지", promptText2.includes("채팅 로그, 앱 화면 전체처럼 글자가 많은 구도는 여전히 피한다"), true);

console.log("[6-2] 글자 주인공 프롬프트를 탐지한다 (실측 사례 재현)");
const risky = [
  "[이미지] 스마트폰 화면에 띄워진 디저트 주문 예약 양식과 카카오톡 오픈채팅 상담창",
  "[이미지] 정갈하게 진열된 수제 쿠키 상자와 주문 안내 카드가 놓인 작업대",
  "[이미지] 리본으로 예쁘게 포장된 디저트 선물 상자",
].join("\n\n");
const risks = yeriImageTextRiskLines(risky);
check("위험 줄 2건 탐지", risks.length, 2);
check("글자 없는 줄은 통과", risks.some((line) => line.includes("리본으로")), false);

console.log("[7] 팩 파일이 없으면 구조 지시만 빠지고 생성은 계속된다 (안전 degrade)");
const packPath = path.join(repoRoot, "oracle/aimax-reports-api/yeri-structure-packs.json");
const backup = fs.readFileSync(packPath, "utf8");
try {
  fs.writeFileSync(packPath, "{ broken json", "utf8");
  // 캐시를 비우기 위해 모듈 캐시를 지우고 다시 읽는다.
  delete require.cache[require.resolve(path.join(repoRoot, "oracle/aimax-reports-api/server.js"))];
  const reloaded = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
  const t = reloaded.__yeriHybridTest;
  check("깨진 팩 → plan null", t.buildYeriStructurePlan({ job_id: "x", style: "info" }), null);
  const fallbackPrompt = t.buildYeriGenerationPrompt({ job_id: "x", style: "info", keywords: ["테스트"] });
  check("구조 지시 없이도 프롬프트 생성", fallbackPrompt.includes("핵심 키워드: 테스트"), true);
  check("구조 섹션은 빠짐", fallbackPrompt.includes("글 구조("), false);
} finally {
  fs.writeFileSync(packPath, backup, "utf8");
}

console.log(`\n결과: PASS ${passed} / FAIL ${failed}`);
fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
