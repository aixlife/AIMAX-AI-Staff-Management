#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __yeriHybridTest } = require("../oracle/aimax-reports-api/server.js");

const {
  buildYeriGenerationPrompt,
  normalizeYeriDuplicateNumberPrefixes,
  sanitizeYeriGeneratedArtifact,
} = __yeriHybridTest;

const duplicated = [
  "# 1. 1. 제목",
  "",
  "## 1. 1. 절약 습관 만들기",
  "1단계: 1단계: 돈이 새는 곳 막기",
  "2) 2) 자동 이체 설정하기",
  "3년 안에 3천만 원 모으기",
].join("\n");

const normalized = normalizeYeriDuplicateNumberPrefixes(duplicated);
assert.equal(normalized.includes("# 1. 제목"), true);
assert.equal(normalized.includes("## 1. 절약 습관 만들기"), true);
assert.equal(normalized.includes("1단계: 돈이 새는 곳 막기"), true);
assert.equal(normalized.includes("2) 자동 이체 설정하기"), true);
assert.equal(normalized.includes("3년 안에 3천만 원 모으기"), true);

const artifact = sanitizeYeriGeneratedArtifact(
  {
    title: "재테크 정리",
    content_markdown: duplicated,
  },
  { keywords: ["재테크"], image_count: 0, word_count: 1500 },
  "smoke-model",
);
assert.equal(artifact.content_markdown.includes("1. 1."), false);
assert.equal(artifact.content_markdown.includes("1단계: 1단계"), false);
assert.equal(artifact.content_markdown.includes("2) 2)"), false);

const prompt = buildYeriGenerationPrompt({ keywords: ["재테크"], image_count: 0, word_count: 1500 });
assert.match(prompt, /같은 숫자 머리말을 반복하지 않는다/);
assert.match(prompt, /숫자 나열보다 자연어 제목을 우선/);

console.log("YERI_NUMBER_PREFIX_SANITIZE_SMOKE_OK");
