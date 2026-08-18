#!/usr/bin/env node
// 유료 실측: 구조 팩 + 이미지까지 포함한 완성 글 1건을 만들고 볼 수 있게 렌더한다.
//
// 이 스크립트는 **과금된다.** AIMAX_LIVE_PAID_OK=1 없이는 실행을 거부한다.
// 실패하면 재시도하지 않고 종료코드 1 로 멈춘다(2026-08-18 CEO 지시).
// 네이버에 접속하지 않고 발행하지 않는다. 결과는 로컬 HTML 로만 남는다.
//
// 실행: AIMAX_LIVE_PAID_OK=1 node scripts/live_yeri_structure_full_article.mjs

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
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-live-full-"));
fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");
process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { buildYeriGenerationPrompt, buildYeriStructurePlan } = server.__yeriHybridTest;

const readKeychain = (service, account) => {
  try {
    return childProcess
      .execFileSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], { encoding: "utf8" })
      .trim();
  } catch (_error) {
    return "";
  }
};

const geminiKey = readKeychain("AIMAX", "gemini_api_key");
const openaiKey = readKeychain("AIMAX", "openai_api_key");
if (!geminiKey || !openaiKey) {
  console.error("거부: Keychain 에서 회사 키를 찾지 못했습니다 (gemini/openai).");
  process.exit(2);
}

const TEXT_MODEL = "gemini-3.6-flash";
const IMAGE_MODEL = "gpt-image-1";
const IMAGE_COUNT = 3;
const TEXT_PRICE = { input: 1.5, output: 7.5 };   // USD / 1M tokens
const IMAGE_PRICE = 0.042;                        // USD / image

const payload = {
  job_id: "live-full-article-1",
  style: "info",
  keywords: ["홈베이킹 주문 받는 법"],
  word_count: 1500,
  image_count: IMAGE_COUNT,
  seo_research_enabled: false,
};

const plan = buildYeriStructurePlan(payload);
if (!plan) {
  console.error("거부: 구조 플랜 생성 실패.");
  process.exit(2);
}

console.log(`텍스트: Gemini ${TEXT_MODEL} 1회 / 이미지: OpenAI ${IMAGE_MODEL} ${IMAGE_COUNT}장`);
console.log(`예상 비용: 이미지 $${(IMAGE_PRICE * IMAGE_COUNT).toFixed(3)} + 텍스트 약 $0.023`);
console.log(`구조 팩: ${plan.pack_label} — ${plan.blocks.map((b) => b.label).join(" > ")}`);
console.log("");

const stop = (msg) => { console.error(`실패: ${msg} — 재시도하지 않고 멈춥니다.`); process.exit(1); };

// ── 1) 본문 생성 ──────────────────────────────────────────────────────────
let textRes;
try {
  textRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TEXT_MODEL)}:generateContent`,
    {
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
    },
  );
} catch (error) { stop(`텍스트 네트워크 ${error.message}`); }
if (!textRes.ok) stop(`텍스트 HTTP ${textRes.status} ${(await textRes.text()).slice(0, 200)}`);

const textData = await textRes.json();
const usage = textData.usageMetadata || {};
const inTok = Number(usage.promptTokenCount || 0);
const outTok = Number(usage.candidatesTokenCount || 0) + Number(usage.thoughtsTokenCount || 0);
let article;
try {
  article = JSON.parse((textData.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""));
} catch (error) { stop(`텍스트 파싱 ${error.message}`); }

const markdown = String(article.content_markdown || "");
const lines = markdown.split("\n");
const imageLines = lines.map((line, i) => ({ line, i })).filter(({ line }) => /^\[이미지\]/.test(line.trim()));
const headingIdx = lines.map((line, i) => ({ line, i })).filter(({ line }) => /^##\s+\S/.test(line));

console.log(`본문 완료 — 소제목 ${headingIdx.length}개 / [이미지] 줄 ${imageLines.length}개 (요청 ${IMAGE_COUNT})`);

if (imageLines.length !== IMAGE_COUNT) {
  stop(`[이미지] 줄이 ${imageLines.length}개 — 요청한 ${IMAGE_COUNT}개와 다릅니다`);
}

// 이미지가 한 곳에 몰렸는지: 각 이미지 앞의 소제목 인덱스가 서로 달라야 분산이다.
const sectionOf = (idx) => headingIdx.filter((h) => h.i < idx).length;
const sections = imageLines.map(({ i }) => sectionOf(i));
const distributed = new Set(sections).size === sections.length;
console.log(`이미지가 놓인 섹션 번호: ${sections.join(", ")} → ${distributed ? "분산됨" : "몰림"}`);

// ── 2) 이미지 생성 ────────────────────────────────────────────────────────
const outDir = path.join(repoRoot, "claudedocs", ".live", "full-article");
fs.mkdirSync(outDir, { recursive: true });
const images = [];
for (let n = 0; n < imageLines.length; n += 1) {
  const prompt = imageLines[n].line.replace(/^\s*\[이미지\]\s*/, "").trim();
  process.stdout.write(`이미지 ${n + 1}/${imageLines.length} 생성 중... `);
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: "1024x1024", quality: "medium", output_format: "png" }),
    });
  } catch (error) { stop(`이미지 네트워크 ${error.message}`); }
  if (!res.ok) stop(`이미지 HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) stop("이미지 응답에 b64_json 이 없습니다");
  const file = path.join(outDir, `image-${n + 1}.png`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  images.push({ file, prompt, lineIndex: imageLines[n].i });
  console.log("완료");
}

// ── 3) 볼 수 있게 렌더 ────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const bodyHtml = [];
let imgCursor = 0;
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (/^\[이미지\]/.test(line.trim())) {
    const img = images[imgCursor];
    imgCursor += 1;
    const b64 = fs.readFileSync(img.file).toString("base64");
    bodyHtml.push(`<figure><img src="data:image/png;base64,${b64}" alt=""><figcaption>${esc(img.prompt)}</figcaption></figure>`);
    continue;
  }
  if (/^#\s+/.test(line)) { bodyHtml.push(`<h1>${esc(line.replace(/^#\s+/, ""))}</h1>`); continue; }
  if (/^##\s+/.test(line)) { bodyHtml.push(`<h2>${esc(line.replace(/^##\s+/, ""))}</h2>`); continue; }
  if (/^\s*$/.test(line)) continue;
  bodyHtml.push(`<p>${esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`);
}

const textCost = (inTok * TEXT_PRICE.input + outTok * TEXT_PRICE.output) / 1_000_000;
const imageCost = images.length * IMAGE_PRICE;
const total = textCost + imageCost;

const html = `<!doctype html><meta charset="utf-8"><title>예리 구조 팩 완성 글</title>
<style>
body{margin:0;background:#0f1115;color:#e7e9ee;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;line-height:1.75}
.wrap{max-width:760px;margin:0 auto;padding:48px 24px 80px}
.meta{background:#171a21;border:1px solid #262b36;border-radius:12px;padding:18px 20px;margin-bottom:36px;font-size:14px}
.meta b{color:#8ab4ff}
.meta table{width:100%;border-collapse:collapse}
.meta td{padding:4px 0;vertical-align:top}
.meta td:first-child{color:#96a0b5;width:150px}
h1{font-size:30px;line-height:1.35;margin:0 0 28px}
h2{font-size:21px;margin:44px 0 14px;padding-top:18px;border-top:1px solid #262b36;color:#cdd5e6}
p{margin:0 0 16px;color:#c6ccd8}
figure{margin:26px 0}
figure img{width:100%;border-radius:10px;display:block}
figcaption{font-size:12px;color:#78829a;margin-top:8px}
strong{color:#fff}
</style>
<div class="wrap">
<div class="meta"><table>
<tr><td>구조 팩</td><td><b>${esc(plan.pack_label)}</b> — ${esc(plan.blocks.map((b) => b.label).join(" &gt; "))}</td></tr>
<tr><td>소제목</td><td>계획 ${plan.blocks.length}개 / 실제 ${headingIdx.length}개</td></tr>
<tr><td>이미지</td><td>요청 ${IMAGE_COUNT}장 / 생성 ${images.length}장 · 섹션 ${sections.join(", ")}번에 ${distributed ? "분산" : "몰림"}</td></tr>
<tr><td>모델</td><td>${esc(TEXT_MODEL)} + ${esc(IMAGE_MODEL)}</td></tr>
<tr><td>실비용</td><td><b>$${total.toFixed(4)}</b> (텍스트 $${textCost.toFixed(4)} + 이미지 $${imageCost.toFixed(3)}) · 약 ${Math.round(total * 1400)}원</td></tr>
</table></div>
${bodyHtml.join("\n")}
</div>`;

const htmlPath = path.join(outDir, "yeri-structure-full-article.html");
fs.writeFileSync(htmlPath, html, "utf8");

console.log("");
console.log(`실비용: $${total.toFixed(4)} (텍스트 $${textCost.toFixed(4)} + 이미지 $${imageCost.toFixed(3)}) 약 ${Math.round(total * 1400)}원`);
console.log(`제목: ${article.title}`);
console.log(`완성 글: ${htmlPath}`);
fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(distributed && headingIdx.length === plan.blocks.length ? 0 : 1);
