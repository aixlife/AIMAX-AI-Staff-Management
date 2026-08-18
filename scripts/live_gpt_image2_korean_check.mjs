#!/usr/bin/env node
// 유료 실측: gpt-image-2 가 그림 안 한글을 정말 제대로 그리는지 확인한다.
//
// 왜 필요한가: 현재 배포된 규칙은 "gpt-image-2 면 [이미지]에 한글을 넣어도 된다"인데,
// 그 근거가 전언뿐이고 실측이 없었다. 방향도 위험한 쪽이다 — 다른 모델은 "글자를 만들지
// 마라"라서 틀려도 안전하지만, gpt-image-2 는 "한글을 넣어라"라서 틀리면 깨진 한글이
// 그대로 발행된다. 그래서 전제 자체를 직접 확인한다.
//
// 구성: (1) 실제 파이프라인이 gpt-image-2 로 만든 프롬프트 1장
//       (2) 짧은 한글이 반드시 들어가는 통제 프롬프트 2장 — 전제를 정면으로 시험
//
// 과금된다. AIMAX_LIVE_PAID_OK=1 없이는 거부. 실패 시 재시도 없이 종료코드 1.
// 실행: AIMAX_LIVE_PAID_OK=1 node scripts/live_gpt_image2_korean_check.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

if (process.env.AIMAX_LIVE_PAID_OK !== "1") {
  console.error("거부: 유료 API 를 호출합니다. AIMAX_LIVE_PAID_OK=1 로 명시 실행하세요.");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-img2-"));
fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");
process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { buildYeriGenerationPrompt, yeriImageModelRendersText } = server.__yeriHybridTest;

const readKeychain = (service, account) => {
  try {
    return childProcess
      .execFileSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], { encoding: "utf8" })
      .trim();
  } catch (_error) { return ""; }
};
const geminiKey = readKeychain("AIMAX", "gemini_api_key");
const openaiKey = readKeychain("AIMAX", "openai_api_key");
if (!geminiKey || !openaiKey) { console.error("거부: Keychain 회사 키를 찾지 못했습니다."); process.exit(2); }

const IMAGE_MODEL = "gpt-image-2";
const IMAGE_PRICE = 0.053;
const stop = (m) => { console.error(`실패: ${m} — 재시도하지 않고 멈춥니다.`); process.exit(1); };

const payload = {
  job_id: "live-img2-korean-1",
  style: "info",
  keywords: ["홈베이킹 주문 받는 법"],
  word_count: 1200,
  image_count: 1,
  image_model: IMAGE_MODEL,
  seo_research_enabled: false,
};

console.log(`이미지 모델: ${IMAGE_MODEL} / 규칙상 한글 허용: ${yeriImageModelRendersText(payload) ? "예" : "아니오"}`);
console.log(`예상 비용: 이미지 3장 $${(IMAGE_PRICE * 3).toFixed(3)} + 텍스트 약 $0.02`);
console.log("");

// ── 1) 실제 파이프라인 프롬프트 1장 ──────────────────────────────────────
let res;
try {
  res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildYeriGenerationPrompt(payload) }] }],
      generationConfig: {
        temperature: 0.45,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: { title: { type: "string" }, content_markdown: { type: "string" } },
          required: ["title", "content_markdown"],
        },
      },
    }),
  });
} catch (error) { stop(`텍스트 네트워크 ${error.message}`); }
if (!res.ok) stop(`텍스트 HTTP ${res.status}`);
const data = await res.json();
const usage = data.usageMetadata || {};
let article;
try {
  article = JSON.parse((data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""));
} catch (error) { stop(`텍스트 파싱 ${error.message}`); }

const pipelinePrompt = String(article.content_markdown || "")
  .split("\n").map((l) => l.trim()).find((l) => /^\[이미지\]/.test(l));
if (!pipelinePrompt) stop("파이프라인이 [이미지] 줄을 만들지 않았습니다");
const pipelineText = pipelinePrompt.replace(/^\[이미지\]\s*/, "");
console.log(`파이프라인 프롬프트: ${pipelineText}`);
console.log("");

// ── 2) 한글을 반드시 넣는 통제 프롬프트 2장 ──────────────────────────────
// 전제("gpt-image-2 는 한글을 제대로 그린다")를 정면으로 시험한다.
const cases = [
  { id: "pipeline", prompt: pipelineText, expect: null },
  { id: "sign", prompt: "카페 입구에 놓인 작은 나무 입간판. 흰 분필로 '오늘 쿠키 완판' 이라고 또렷하게 적혀 있다. 따뜻한 자연광, 다른 글자는 없음.", expect: "오늘 쿠키 완판" },
  { id: "memo", prompt: "주방 작업대 위 노트에 검은 펜으로 '주문 마감 6시' 라고 또박또박 적힌 메모. 위에서 내려다본 구도, 다른 글자는 없음.", expect: "주문 마감 6시" },
];

const outDir = path.join(repoRoot, "claudedocs", ".live", "gpt-image-2-korean");
fs.mkdirSync(outDir, { recursive: true });
for (const item of cases) {
  process.stdout.write(`${item.id} 생성 중... `);
  let r;
  try {
    r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt: item.prompt, n: 1, size: "1024x1024", quality: "medium", output_format: "png" }),
    });
  } catch (error) { stop(`${item.id} 네트워크 ${error.message}`); }
  if (!r.ok) stop(`${item.id} HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const b64 = d?.data?.[0]?.b64_json;
  if (!b64) stop(`${item.id} 응답에 b64_json 없음`);
  fs.writeFileSync(path.join(outDir, `${item.id}.png`), Buffer.from(b64, "base64"));
  console.log("완료");
}

const inTok = Number(usage.promptTokenCount || 0);
const outTok = Number(usage.candidatesTokenCount || 0) + Number(usage.thoughtsTokenCount || 0);
const textCost = (inTok * 1.5 + outTok * 7.5) / 1_000_000;
const total = textCost + cases.length * IMAGE_PRICE;

fs.writeFileSync(
  path.join(outDir, "cases.json"),
  JSON.stringify({ image_model: IMAGE_MODEL, cost_usd: Number(total.toFixed(4)), cases }, null, 2),
  "utf8",
);
console.log("");
console.log(`실비용: $${total.toFixed(4)} (약 ${Math.round(total * 1400)}원)`);
console.log(`결과: ${outDir}`);
console.log("");
console.log("판정 기준 — 아래 글자가 이미지에 정확히 그려졌는지 눈으로 확인해야 한다:");
cases.filter((c) => c.expect).forEach((c) => console.log(`  ${c.id}: "${c.expect}"`));
fs.rmSync(tmpDir, { recursive: true, force: true });
