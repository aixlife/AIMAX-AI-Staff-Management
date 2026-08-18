#!/usr/bin/env node
// 유료 실측 1회: 구조 팩이 붙은 프롬프트로 실제 모델이 구조를 지켜 글을 쓰는지 확인한다.
//
// 이 스크립트는 **과금된다.** 기본은 실행 거부이고, AIMAX_LIVE_PAID_OK=1 을 명시해야 돈다.
// 재시도하지 않는다 — 실패하면 그대로 멈추고 종료코드 1 을 낸다(2026-08-18 CEO 지시).
//
// 발행하지 않는다. 네이버에 접속하지 않는다. 텍스트 1건만 생성해 파일로 남긴다.
// 키는 macOS Keychain 에서 읽고 출력·로그에 절대 남기지 않는다.
//
// 실행: AIMAX_LIVE_PAID_OK=1 node scripts/live_yeri_structure_generation.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

if (process.env.AIMAX_LIVE_PAID_OK !== "1") {
  console.error("거부: 이 스크립트는 유료 API 를 호출합니다. AIMAX_LIVE_PAID_OK=1 로 명시 실행하세요.");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-live-struct-"));
fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");
process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { buildYeriGenerationPrompt, buildYeriStructurePlan } = server.__yeriHybridTest;

function readKeychain(service, account) {
  try {
    return childProcess
      .execFileSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], { encoding: "utf8" })
      .trim();
  } catch (_error) {
    return "";
  }
}

const apiKey = readKeychain("AIMAX", "gemini_api_key");
if (!apiKey) {
  console.error("거부: Keychain 에서 회사 Gemini 키(AIMAX/gemini_api_key)를 찾지 못했습니다.");
  process.exit(2);
}

const MODEL = process.env.AIMAX_LIVE_TEXT_MODEL || "gemini-3.6-flash";
const PRICE = { input: 1.5, output: 7.5 }; // USD per 1M tokens (app.py _AI_TEXT_PRICE_USD_PER_1M 기준)

const payload = {
  job_id: "live-structure-check-1",
  style: "info",
  keywords: ["홈베이킹 주문 받는 법"],
  word_count: 1500,
  image_count: 0,
  seo_research_enabled: false,
};

const plan = buildYeriStructurePlan(payload);
if (!plan) {
  console.error("거부: 구조 플랜이 만들어지지 않았습니다. 구조 팩 파일을 확인하세요.");
  process.exit(2);
}
const prompt = buildYeriGenerationPrompt(payload);

console.log(`모델: ${MODEL} / 제공자: Gemini / 호출: 1회 / 발행: 안 함`);
console.log(`구조 팩: ${plan.pack_label} (${plan.blocks.length}개 항목)`);
console.log(plan.blocks.map((b, i) => `  ${i + 1}. ${b.label}`).join("\n"));
console.log("");

const body = {
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.45,
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "object",
      properties: { title: { type: "string" }, content_markdown: { type: "string" } },
      required: ["title", "content_markdown"],
    },
  },
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
let response;
try {
  response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
} catch (error) {
  console.error(`실패(네트워크): ${error.message} — 재시도하지 않고 멈춥니다.`);
  process.exit(1);
}

if (!response.ok) {
  const text = await response.text();
  console.error(`실패(HTTP ${response.status}): ${text.slice(0, 300)} — 재시도하지 않고 멈춥니다.`);
  process.exit(1);
}

const data = await response.json();
const usage = data.usageMetadata || {};
const inTok = Number(usage.promptTokenCount || 0);
const outTok = Number(usage.candidatesTokenCount || 0) + Number(usage.thoughtsTokenCount || 0);
const costUsd = (inTok * PRICE.input + outTok * PRICE.output) / 1_000_000;

const raw = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
let article;
try {
  article = JSON.parse(raw);
} catch (error) {
  console.error(`실패(응답 파싱): ${error.message} — 재시도하지 않고 멈춥니다.`);
  console.error(raw.slice(0, 400));
  process.exit(1);
}

const markdown = String(article.content_markdown || "");
const headings = markdown.split("\n").filter((line) => /^##\s+\S/.test(line));
const outPath = path.join(repoRoot, "claudedocs", ".live", "yeri-structure-live-20260818.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `# 구조 팩 유료 실측 (${MODEL})\n\n` +
    `- 팩: ${plan.pack_label}\n- 계획 항목 수: ${plan.blocks.length}\n- 실제 소제목 수: ${headings.length}\n` +
    `- 토큰: 입력 ${inTok} / 출력 ${outTok}\n- 비용: $${costUsd.toFixed(4)}\n\n` +
    `## 계획한 구조\n${plan.blocks.map((b, i) => `${i + 1}. ${b.label}`).join("\n")}\n\n` +
    `## 실제 소제목\n${headings.map((h, i) => `${i + 1}. ${h.replace(/^##\s+/, "")}`).join("\n")}\n\n` +
    `---\n\n생성 제목: ${article.title}\n\n${markdown}\n`,
  "utf8",
);

console.log(`토큰: 입력 ${inTok} / 출력 ${outTok}`);
console.log(`실비용: $${costUsd.toFixed(4)} (약 ${Math.round(costUsd * 1400)}원)`);
console.log("");
console.log(`제목: ${article.title}`);
console.log(`계획 항목 ${plan.blocks.length}개 / 실제 소제목 ${headings.length}개`);
console.log("실제 소제목:");
headings.forEach((h, i) => console.log(`  ${i + 1}. ${h.replace(/^##\s+/, "")}`));

const labelLeak = plan.blocks.filter((b) => headings.some((h) => h.includes(b.label)));
console.log("");
let ok = true;
if (headings.length !== plan.blocks.length) {
  console.log(`판정: 항목 수 불일치 (계획 ${plan.blocks.length} / 실제 ${headings.length})`);
  ok = false;
} else {
  console.log("판정: 항목 수 일치");
}
if (labelLeak.length) {
  console.log(`판정: 블록 라벨이 소제목에 그대로 노출됨 — ${labelLeak.map((b) => b.label).join(", ")}`);
  ok = false;
} else {
  console.log("판정: 블록 라벨 그대로 노출 없음");
}
console.log(`\n결과 파일: ${outPath}`);
fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
