#!/usr/bin/env node
// 스모크: 생성 프롬프트에 '읽는 사람 기준' 규칙이 실려 나가는지 검증한다.
//
// 배경 (2026-08-26): 프롬프트에 글자 수·이미지 개수·키워드 지시는 있었는데 문단 길이·결론 위치·
// 볼드 지시가 하나도 없었다. 그래서 우리 원고 320편의 문단 길이 중앙값이 122자(최대 377)로
// 굳었고, 같은 잣대로 잰 네이버 상위 노출 글 46편의 11자와 11배 차이가 났다.
// 볼드는 상위글 46편 전부가 쓰는데 우리 글엔 0개였다.
//
// 실행: node scripts/smoke_yeri_readability_prompt.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.AIMAX_REPORT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-readability-"));
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { buildYeriGenerationPrompt } = server.__yeriHybridTest;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) { passed += 1; console.log(`  PASS  ${name}  (=${actual})`); }
  else { failed += 1; console.log(`  FAIL  ${name}  expected=${expected} actual=${actual}`); }
}

const prompt = buildYeriGenerationPrompt({ keywords: "전세 월세 차이", word_count: 1500, image_count: 3 });
const text = typeof prompt === "string" ? prompt : JSON.stringify(prompt);

console.log("[1] 문단·호흡 규칙");
check("문단 40자 상한", /한 문단은 40자를 넘기지 않는다/.test(text), true);
check("한 문단 한 가지", /한 문단에는 하나만 말한다/.test(text), true);
check("결론 세 번째 문단 안", /결론은 세 번째 문단 안에/.test(text), true);
check("소제목 간격", /소제목은 400~500자마다/.test(text), true);

console.log("[2] 볼드 규칙 (상위글 46/46 이 쓰는 것)");
check("볼드 지시 존재", /굵게/.test(text), true);
check("어절 단위 지시", /핵심 어절/.test(text), true);
check("문단당 최대 하나", /한 문단에 굵은 곳은 최대 하나/.test(text), true);

console.log("[3] 볼드 개수가 목표 분량에 비례하는가");
const p1000 = JSON.stringify(buildYeriGenerationPrompt({ keywords: "a", word_count: 1000, image_count: 0 }));
const p2000 = JSON.stringify(buildYeriGenerationPrompt({ keywords: "a", word_count: 2000, image_count: 0 }));
const n = (t) => Number((t.match(/글 전체에서 (\d+)곳/) || [])[1] || 0);
check("1000자 → 9곳", n(p1000), 9);
check("2000자 → 18곳", n(p2000), 18);
check("분량이 늘면 볼드도 는다", n(p2000) > n(p1000), true);

console.log("[4] 회귀 — 기존 지시가 살아 있는가");
check("목표 글자 수", /목표 노출 글자 수/.test(text), true);
check("이미지 개수", /\[이미지\] 줄은 정확히/.test(text), true);
check("이미지 위치 규칙", /설명한 문단이 끝난 바로 다음 줄/.test(text), true);

console.log(`\n결과: PASS ${passed} / FAIL ${failed}`);
process.exit(failed ? 1 : 0);
