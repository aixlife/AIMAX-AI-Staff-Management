#!/usr/bin/env node
//
// 예리 글쓰기 기본 모델 교체 판단용 블라인드 비교 하네스.
//
// 무엇을 하나
//   같은 프롬프트·같은 키워드 20개를 세 모델에 똑같이 주고 60편을 만든 뒤,
//   모델 이름을 지운 A/B/C 시트로 사람이 고르게 한다. 고른 뒤에 이름을 붙인다.
//   이름을 먼저 보면 "새 모델이 낫겠지"라는 기대가 판정에 섞인다.
//
// 비교 대상 (3종)
//   gemini-3.5-flash  현행 실서비스 기본값 계열
//   gemini-3.7-flash  2026-08-13 출시 신형 (12/31까지 인트로가)
//   claude-sonnet-5   서버 생성 경로의 claude 기본값
//
// 돈
//   기본은 --dry-run 이다. API 를 호출하지 않고 요청 payload·예상 토큰·예상 비용만 낸다.
//   --live 는 유료다. AIMAX_LIVE_PAID_OK=1 과 모델별 API 키가 환경변수에 다 있어야 돈다.
//   재시도하지 않는다. 실패하면 그대로 멈춘다(2026-08-18 CEO 지시).
//   키는 출력·로그·산출물에 절대 남기지 않는다.
//
// 프롬프트는 새로 쓰지 않는다
//   oracle/aimax-reports-api/server.js 의 buildYeriGenerationPrompt 를 그대로 require 해서 쓴다.
//   복사하면 실서비스 프롬프트가 바뀔 때 이 하네스만 옛 프롬프트로 재는 일이 생긴다.
//   그 함수 안에 2026-08-26 커밋 767f7db 의 읽기 규칙(문단 40자·결론 세 번째 문단·볼드 밀도)이
//   들어 있으므로, 이 하네스는 그 규칙이 적용된 상태를 잰다.
//
// 실행
//   node scripts/blind_model_test.mjs                      # 드라이런(기본). 60건 payload + 비용표
//   node scripts/blind_model_test.mjs --sheet-fixture      # 픽스처 3편으로 평가 시트 동작 확인
//   node scripts/blind_model_test.mjs --criteria           # 평가 기준 문서만 다시 쓰기
//   AIMAX_LIVE_PAID_OK=1 node scripts/blind_model_test.mjs --live
//   node scripts/blind_model_test.mjs --sheet <articles.json>
//   node scripts/blind_model_test.mjs --unblind <selections.json> --key <blind_key.json>

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. 비교 대상 모델과 단가                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

// 환율·단가 정본: apps/aimax-console-preview/src/data/taskOptions.ts (커밋 3d0bec2).
// 세 모델 단가가 한 표에 같이 있는 곳은 거기뿐이라 그 표를 기준으로 삼는다.
// gemini-3.5-flash 값은 server.js 의 YUNMI_AI_MODEL_PRICES 와 일치한다($1.50/$9.00).
// claude 는 두 값이 공존한다 — static/app.html 은 인트로가 $2/$10(~2026-08-31),
// taskOptions.ts 는 인트로 종료 후 정가 $3/$15. 교체 판단은 앞으로 낼 돈으로 해야 하므로
// 정가를 기준으로 잡고, 인트로가 환산액은 표에 따로 병기한다.
const USD_KRW_RATE = 1476;
const USD_KRW_RATE_NOTE = "2026-08 글쓰기 모델 단가표 기준 (taskOptions.ts USD_KRW_RATE)";

const MODELS = [
  {
    id: "gemini-3.5-flash",
    provider: "gemini",
    label: "Gemini 3.5 Flash",
    role: "현행",
    inputUsdPer1m: 1.5,
    outputUsdPer1m: 9.0,
    note: "server.js YUNMI_AI_MODEL_PRICES 와 동일",
  },
  {
    id: "gemini-3.7-flash",
    provider: "gemini",
    label: "Gemini 3.7 Flash",
    role: "신형 후보",
    inputUsdPer1m: 0.75,
    outputUsdPer1m: 3.75,
    note: "2026-08-13 출시, 12/31까지 인트로가",
  },
  {
    id: "claude-sonnet-5",
    provider: "claude",
    label: "Claude Sonnet 5",
    role: "문체 후보",
    inputUsdPer1m: 3.0,
    outputUsdPer1m: 15.0,
    note: "정가. 인트로가($2/$10)는 2026-08-31 종료",
    altPrice: { inputUsdPer1m: 2.0, outputUsdPer1m: 10.0, label: "인트로가" },
  },
];

// 모델별 환경변수 키 이름. 값은 읽기만 하고 어디에도 쓰지 않는다.
const PROVIDER_KEY_ENV = {
  gemini: ["GEMINI_API_KEY", "AIMAX_GEMINI_API_KEY", "GOOGLE_API_KEY"],
  claude: ["ANTHROPIC_API_KEY", "AIMAX_CLAUDE_API_KEY", "CLAUDE_API_KEY"],
};

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. 키워드 20개                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

// 근거: 커밋 69bfe5b("예리 글쓰기 스타일 3종") 의 실사용 키워드 1,085개 분류 실측.
//   지역+업종 19% (중고차 56 · 부동산 52 · 장기렌트 · 인테리어 · 정책자금)
//   추천·비교   5%
//   방법·가이드 5%
//
// 20편 배분:
//   세 카테고리 비율 19 : 5 : 5 를 셋만 놓고 정규화하면 65.5 : 17.2 : 17.2 다.
//   20편에 곱하면 13.1 : 3.4 : 3.4. 뒤 두 카테고리는 실측에서 정확히 같은 값(5%)이라
//   동률을 인위로 깨지 않고 3편씩 같게 주고, 반올림 잔여 1편을 최대 카테고리에 얹는다.
//   → 지역+업종 14 · 추천·비교 3 · 방법·가이드 3 (70% / 15% / 15%)
//
// 지역+업종 14편의 업종 배분은 커밋에 수치가 적힌 중고차(56)·부동산(52)을 가장 크게 두고,
// 수치 없이 이름만 나온 세 업종을 같게 준다 → 중고차 4 · 부동산 4 · 장기렌트 2 · 인테리어 2 · 정책자금 2.
//
// 지역명은 공개된 행정구역명만 쓴다. 실고객 키워드·가상 업체명은 한 건도 넣지 않았다.
//
// 스타일 매핑도 같은 커밋을 따른다:
//   지역+업종 → consult(상담 유도형) / 추천·비교 → review(후기·추천형) / 방법·가이드 → info(정보 정리형)
const KEYWORD_PLAN = {
  measured: { "지역+업종": 19, "추천·비교": 5, "방법·가이드": 5 },
  allocated: { "지역+업종": 14, "추천·비교": 3, "방법·가이드": 3 },
};

const KEYWORDS = [
  // ── 지역+업종 14편 (consult) ──
  { id: "k01", keyword: "강남 중고차 매입 시세", category: "지역+업종", industry: "중고차", style_id: "consult" },
  { id: "k02", keyword: "수원 중고차 딜러 고르는 기준", category: "지역+업종", industry: "중고차", style_id: "consult" },
  { id: "k03", keyword: "부산 해운대 중고차 직거래 주의점", category: "지역+업종", industry: "중고차", style_id: "consult" },
  { id: "k04", keyword: "대전 중고차 성능점검기록부 확인", category: "지역+업종", industry: "중고차", style_id: "consult" },
  { id: "k05", keyword: "동탄 아파트 전세 매물 보는 법", category: "지역+업종", industry: "부동산", style_id: "consult" },
  { id: "k06", keyword: "인천 부평 상가 임대 시세", category: "지역+업종", industry: "부동산", style_id: "consult" },
  { id: "k07", keyword: "청주 원룸 월세 계약 확인사항", category: "지역+업종", industry: "부동산", style_id: "consult" },
  { id: "k08", keyword: "천안 재개발 구역 투자 판단", category: "지역+업종", industry: "부동산", style_id: "consult" },
  { id: "k09", keyword: "창원 장기렌트 조건 비교", category: "지역+업종", industry: "장기렌트", style_id: "consult" },
  { id: "k10", keyword: "김해 법인 장기렌트 절차", category: "지역+업종", industry: "장기렌트", style_id: "consult" },
  { id: "k11", keyword: "광주 북구 아파트 인테리어 견적", category: "지역+업종", industry: "인테리어", style_id: "consult" },
  { id: "k12", keyword: "안산 상가 인테리어 공사 기간", category: "지역+업종", industry: "인테리어", style_id: "consult" },
  { id: "k13", keyword: "전주 소상공인 정책자금 신청 조건", category: "지역+업종", industry: "정책자금", style_id: "consult" },
  { id: "k14", keyword: "울산 남구 창업 정책자금 한도", category: "지역+업종", industry: "정책자금", style_id: "consult" },

  // ── 추천·비교 3편 (review) ──
  { id: "k15", keyword: "경차 장기렌트 vs 리스 뭐가 나을까", category: "추천·비교", industry: "", style_id: "review" },
  { id: "k16", keyword: "소형 아파트 붙박이장 브랜드 비교", category: "추천·비교", industry: "", style_id: "review" },
  { id: "k17", keyword: "1인 사업자 세무 대행 추천 기준", category: "추천·비교", industry: "", style_id: "review" },

  // ── 방법·가이드 3편 (info) ──
  { id: "k18", keyword: "자동차 명의이전 셀프로 하는 법", category: "방법·가이드", industry: "", style_id: "info" },
  { id: "k19", keyword: "전세보증금 반환보증 가입 절차", category: "방법·가이드", industry: "", style_id: "info" },
  { id: "k20", keyword: "사업자등록증 온라인 발급 방법", category: "방법·가이드", industry: "", style_id: "info" },
];

// 모든 모델·모든 키워드에 똑같이 주는 작업 조건. 하나라도 다르면 비교가 성립하지 않는다.
// 값은 실서비스 기본값 그대로다 (server.js yeriPayloadWordCount 1500, yeriPayloadImageCount 3).
const JOB_DEFAULTS = {
  word_count: 1500,
  image_count: 3,
  image_model: "gemini-3.1-flash-image",
  keyword_emphasis_enabled: false,
  seo_research_enabled: false,
};

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. 평가 기준                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

// 767f7db(2026-08-26) 이 프롬프트에 넣은 읽기 규칙과 같은 잣대로 재게 만든다.
// 그 커밋이 실측으로 잡아낸 실패는 "문단이 길고 결론이 늦다" 였다. 여기서도 그걸 먼저 본다.
const CRITERIA = [
  {
    key: "natural",
    label: "자연스러움",
    question: "사람이 쓴 글로 읽히는가",
    checks: [
      "문단이 짧게 끊기는가 (한 문단 40자, 길어도 60자 — 767f7db 규칙)",
      "결론이 세 번째 문단 안에 이미 나와 있는가",
      "번역투가 없는가 (…에 대해, …을 통해, …라고 할 수 있다, 피동형 남발)",
      "같은 문장 구조가 반복되지 않는가",
      "굵게 표시가 숫자·기준·판단에만 붙어 있는가 (문장 전체 볼드는 실패)",
    ],
    type: "choice",
  },
  {
    key: "factual",
    label: "사실 오류",
    question: "지어낸 사실이 있는가",
    checks: [
      "확인되지 않은 통계·가격·순위·후기를 만들어 쓰지 않았는가",
      "법·제도·절차를 단정해서 틀리게 쓰지 않았는가",
      "겪지 않은 경험을 겪은 것처럼 쓰지 않았는가",
      "지역·업종 사실이 실제와 어긋나지 않는가",
    ],
    type: "choice",
    note: "오류가 하나라도 있으면 그 글은 '바로 발행 가능'에서 자동 탈락이다.",
  },
  {
    key: "fixMinutes",
    label: "수정 필요 시간",
    question: "이 글을 발행 가능한 상태로 만드는 데 몇 분 걸리는가",
    checks: [
      "0분 = 손 안 대고 발행",
      "5분 = 문장 몇 개 다듬기",
      "15분 = 문단 재배치·사실 확인 필요",
      "30분+ = 사실상 다시 쓰기",
    ],
    type: "minutes",
    options: [0, 5, 15, 30],
  },
  {
    key: "publishable",
    label: "바로 발행 가능성",
    question: "지금 이대로 네이버에 올릴 수 있는가",
    checks: [
      "예 / 아니오 만 고른다. 애매하면 아니오다.",
      "이 항목이 최종 결정 지표다 — 20편 중 '예' 비율이 높은 모델을 고른다.",
    ],
    type: "yesno",
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. 서버 코드 재사용                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

// server.js 는 require 시점에 데이터 디렉토리와 암호화 키를 요구한다.
// 실데이터를 건드리지 않도록 빈 임시 디렉토리와 1회용 키를 준다. 서버는 뜨지 않는다.
function loadServerModule() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-blind-"));
  fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");
  process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
  process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;
  const require_ = createRequire(import.meta.url);
  const server = require_(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
  const api = server.__yeriHybridTest;
  if (!api || typeof api.buildYeriGenerationPrompt !== "function") {
    throw new Error("server.js 에서 buildYeriGenerationPrompt 를 찾지 못했습니다.");
  }
  return { api, tmpDir };
}

function buildPayload(entry) {
  return {
    ...JOB_DEFAULTS,
    keywords: [entry.keyword],
    style_id: entry.style_id,
  };
}

// 스타일 라벨은 상수를 베끼지 않고 실제 프롬프트에서 읽어 온다.
// server.js 의 YERI_STYLE_PACKS 라벨이 바뀌면 여기 표시도 같이 바뀐다.
function styleLabelFromPrompt(prompt) {
  const line = String(prompt).split("\n").find((row) => row.startsWith("- 글 스타일: "));
  return line ? line.replace("- 글 스타일: ", "").trim() : "";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. 토큰·비용 추정                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

// 추정식 정본: apps/aimax-console-preview/src/data/taskOptions.ts estimateTokens (커밋 3d0bec2).
// 콘솔이 사용자에게 보여주는 예상 비용과 같은 식이어야 이 실측 결과를 그대로 콘솔 판단에 쓸 수 있다.
//   입력 2,200 토큰 고정 · 출력 = 목표 글자수 × 0.8
// 입력 상수 2,200 은 이 하네스가 실제로 만든 프롬프트 길이(약 2,700자)와 대조해 검산한다.
function estimateTokens(charCount) {
  const chars = Math.max(300, Math.min(6000, Number(charCount) || 1500));
  return { inputTokens: 2200, outputTokens: Math.ceil(chars * 0.8) };
}

function wonFromUsd(usd) {
  return Math.ceil((Number(usd) || 0) * USD_KRW_RATE);
}

function usdFor(price, tokens) {
  return (tokens.inputTokens / 1_000_000) * price.inputUsdPer1m
    + (tokens.outputTokens / 1_000_000) * price.outputUsdPer1m;
}

function won(value) {
  return `${Math.ceil(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. 요청 payload 생성 (모델별 실제 호출 형태 그대로)                          */
/* ────────────────────────────────────────────────────────────────────────── */

// server.js generateYeriGeminiArtifact / generateYeriClaudeArtifact 의 body 와 같은 모양이다.
// --live 는 이 body 를 그대로 보낸다. 드라이런은 이 body 를 파일로 남기고 끝낸다.
function geminiRequest(model, prompt) {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    method: "POST",
    headers: { "x-goog-api-key": "<GEMINI_API_KEY>" },
    body: {
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
    },
  };
}

function claudeRequest(model, prompt) {
  return {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: { "x-api-key": "<ANTHROPIC_API_KEY>", "anthropic-version": "2023-06-01" },
    body: {
      model,
      max_tokens: 16000,
      tools: [{
        name: "emit_blog_post",
        description: "작성 완료한 네이버 블로그 글을 제출한다. title과 content_markdown을 채워 정확히 한 번 호출한다.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "블로그 글 제목" },
            content_markdown: {
              type: "string",
              description: "'# 제목'으로 시작하는 한국어 마크다운 본문. [이미지] 줄 포함 규칙은 지시를 따른다.",
            },
          },
          required: ["title", "content_markdown"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_blog_post" },
      messages: [{ role: "user", content: prompt }],
    },
  };
}

function buildRequest(model, prompt) {
  return model.provider === "claude" ? claudeRequest(model.id, prompt) : geminiRequest(model.id, prompt);
}

function buildAllRequests(api) {
  const rows = [];
  for (const entry of KEYWORDS) {
    const payload = buildPayload(entry);
    const prompt = api.buildYeriGenerationPrompt(payload);
    for (const model of MODELS) {
      rows.push({
        run_id: `${entry.id}__${model.id}`,
        keyword_id: entry.id,
        keyword: entry.keyword,
        category: entry.category,
        industry: entry.industry,
        style_id: entry.style_id,
        style_label: styleLabelFromPrompt(prompt),
        model_id: model.id,
        model_label: model.label,
        provider: model.provider,
        prompt_chars: prompt.length,
        request: buildRequest(model, prompt),
      });
    }
  }
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 7. 드라이런 출력                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function pad(text, width) {
  const value = String(text);
  // 한글은 터미널에서 두 칸을 먹는다. 표가 어긋나지 않게 실제 폭으로 센다.
  const displayWidth = [...value].reduce((sum, ch) => sum + (/[ᄀ-ᇿ㄰-㆏가-힣　-〿＀-￯]/.test(ch) ? 2 : 1), 0);
  return value + " ".repeat(Math.max(0, width - displayWidth));
}

function printCostTable(rows) {
  const tokens = estimateTokens(JOB_DEFAULTS.word_count);
  const promptChars = rows[0]?.prompt_chars || 0;
  const perModel = MODELS.map((model) => {
    const count = rows.filter((row) => row.model_id === model.id).length;
    const perArticleUsd = usdFor(model, tokens);
    return {
      model,
      count,
      perArticleUsd,
      perArticleWon: wonFromUsd(perArticleUsd),
      totalUsd: perArticleUsd * count,
      totalWon: wonFromUsd(perArticleUsd * count),
    };
  });

  console.log("");
  console.log("=== 예상 비용 (드라이런 추정, 실제 과금 아님) ===");
  console.log(`추정식: 입력 ${tokens.inputTokens.toLocaleString("ko-KR")}토큰 고정 · 출력 ${tokens.outputTokens.toLocaleString("ko-KR")}토큰(${JOB_DEFAULTS.word_count}자 × 0.8)`);
  console.log(`검산: 실제 생성된 프롬프트 ${promptChars.toLocaleString("ko-KR")}자 → 입력 상수 2,200토큰은 자당 ${(2200 / Math.max(1, promptChars)).toFixed(2)}토큰 가정`);
  console.log(`환율: 1 USD = ${USD_KRW_RATE.toLocaleString("ko-KR")}원 (${USD_KRW_RATE_NOTE})`);
  console.log("");
  console.log(`${pad("모델", 22)}${pad("역할", 12)}${pad("단가 in/out /1M", 20)}${pad("글 1편", 10)}${pad("편수", 6)}${pad("합계", 12)}`);
  console.log("-".repeat(82));
  for (const row of perModel) {
    console.log(
      pad(row.model.label, 22)
      + pad(row.model.role, 12)
      + pad(`$${row.model.inputUsdPer1m.toFixed(2)} / $${row.model.outputUsdPer1m.toFixed(2)}`, 20)
      + pad(won(row.perArticleWon), 10)
      + pad(String(row.count), 6)
      + pad(won(row.totalWon), 12),
    );
  }
  console.log("-".repeat(82));
  const grandWon = perModel.reduce((sum, row) => sum + row.totalWon, 0);
  const grandUsd = perModel.reduce((sum, row) => sum + row.totalUsd, 0);
  console.log(`${pad("총계", 70)}${pad(won(grandWon), 12)}`);
  console.log(`(USD $${grandUsd.toFixed(4)} · 글 ${rows.length}편)`);

  const alt = MODELS.find((model) => model.altPrice);
  if (alt) {
    const altUsd = usdFor(alt.altPrice, tokens);
    const altCount = rows.filter((row) => row.model_id === alt.id).length;
    console.log("");
    console.log(`참고: ${alt.label} ${alt.altPrice.label}($${alt.altPrice.inputUsdPer1m.toFixed(2)}/$${alt.altPrice.outputUsdPer1m.toFixed(2)}) 적용 시`
      + ` 1편 ${won(wonFromUsd(altUsd))} · ${altCount}편 ${won(wonFromUsd(altUsd * altCount))}`);
    console.log(`         ${alt.note}`);
  }

  console.log("");
  console.log("주의: 위 숫자는 1회 생성 기준이다. 실서비스는 분량이 어긋나면 같은 모델로 최대 2회 재작성한다");
  console.log("      (server.js YERI_LENGTH_MAX_REWRITES). 최악의 경우 실제 과금은 위 합계의 3배까지 갈 수 있다.");
  console.log(`      최악 상정 총액: ${won(grandWon * 3)}`);
  return { perModel, grandWon, grandUsd, tokens };
}

function printKeywordTable(rows) {
  console.log("=== 키워드 20개 ===");
  console.log("분포 근거: 커밋 69bfe5b 실사용 키워드 1,085개 실측");
  const measured = Object.entries(KEYWORD_PLAN.measured).map(([k, v]) => `${k} ${v}%`).join(" · ");
  const allocated = Object.entries(KEYWORD_PLAN.allocated)
    .map(([k, v]) => `${k} ${v}편(${Math.round(v / KEYWORDS.length * 100)}%)`).join(" · ");
  console.log(`실측 분포: ${measured}`);
  console.log(`20편 배분: ${allocated}`);
  console.log("");
  console.log(`${pad("ID", 6)}${pad("키워드", 34)}${pad("카테고리", 14)}${pad("업종", 12)}${pad("스타일", 14)}`);
  console.log("-".repeat(80));
  for (const entry of KEYWORDS) {
    const style = rows.find((row) => row.keyword_id === entry.id)?.style_label || entry.style_id;
    console.log(pad(entry.id, 6) + pad(entry.keyword, 34) + pad(entry.category, 14) + pad(entry.industry || "-", 12) + pad(style, 14));
  }
  console.log("");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 8. 블라인드 셔플                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

// 시드 고정 셔플. Math.random 을 쓰면 시트를 다시 만들 때마다 배치가 바뀌어
// 이미 매긴 평가를 되짚을 수 없다. 키워드 ID + 시드로 결정된다.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text) {
  return crypto.createHash("sha256").update(String(text)).digest().readUInt32BE(0);
}

function shuffled(items, seedText) {
  const rand = mulberry32(seedFrom(seedText));
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SLOTS = ["A", "B", "C"];

// 순열 6가지를 한 번 섞은 뒤 키워드 순서대로 돌려 쓴다.
// 키워드마다 독립적으로 섞으면 우연히 한 모델이 A 칸에 몰린다(실측: 20편에서 9 대 4).
// 사람은 왼쪽 칸을 먼저·자세히 읽으므로 그 쏠림이 그대로 점수 차이로 새어 든다.
// 돌려 쓰면 각 모델이 각 칸에 6~7번씩 고르게 들어간다.
function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

// articles: [{ keyword_id, keyword, category, style_label, model_id, title, content_markdown }]
// 반환: { sheet(모델명 없음), key(정답표) }
function blindPairs(articles, seed) {
  const byKeyword = new Map();
  for (const article of articles) {
    if (!byKeyword.has(article.keyword_id)) byKeyword.set(article.keyword_id, []);
    byKeyword.get(article.keyword_id).push(article);
  }
  const modelOrder = MODELS.map((model) => model.id);
  const rotation = shuffled(permutations(modelOrder), `${seed}::rotation`);

  const sheet = [];
  const key = [];
  let position = 0;
  for (const entry of KEYWORDS) {
    const group = byKeyword.get(entry.id);
    if (!group || !group.length) continue;
    if (group.length > SLOTS.length) {
      throw new Error(`${entry.id}: 한 키워드에 글이 ${group.length}편이라 A/B/C 슬롯을 넘습니다.`);
    }
    const wanted = rotation[position % rotation.length];
    position += 1;
    // 순열이 정한 모델 순서대로 세운다. 그 키워드에 없는 모델은 건너뛴다.
    const order = wanted
      .map((modelId) => group.find((article) => article.model_id === modelId))
      .filter(Boolean);
    for (const article of group) {
      if (!order.includes(article)) order.push(article);
    }
    sheet.push({
      keyword_id: entry.id,
      keyword: entry.keyword,
      category: entry.category,
      style_label: order[0].style_label || "",
      slots: order.map((article, index) => ({
        slot: SLOTS[index],
        title: article.title || "",
        content_markdown: article.content_markdown || "",
        chars: String(article.content_markdown || "").replace(/[#*\-|]/g, "").length,
      })),
    });
    key.push({
      keyword_id: entry.id,
      keyword: entry.keyword,
      mapping: Object.fromEntries(order.map((article, index) => [SLOTS[index], article.model_id])),
    });
  }
  return { sheet, key };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 9. HTML 평가 시트                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// 마크다운을 그대로 보여준다. 렌더링하면 문단 길이·볼드 밀도가 눈에 안 보이는데
// 그 두 가지가 767f7db 이후 평가의 핵심이라 원문을 봐야 한다. 볼드만 표시한다.
function renderArticle(markdown) {
  return escapeHtml(markdown).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

function criteriaHtml() {
  return CRITERIA.map((item) => `
      <section class="crit">
        <h3>${escapeHtml(item.label)} <span class="q">${escapeHtml(item.question)}</span></h3>
        <ul>${item.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul>
        ${item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : ""}
      </section>`).join("");
}

function buildSheetHtml(sheet, meta) {
  const data = JSON.stringify(sheet).replace(/</g, "\\u003c");
  const criteriaData = JSON.stringify(CRITERIA).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>예리 글쓰기 모델 블라인드 평가</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #12141a; color: #e6e8ee;
         font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
         line-height: 1.7; word-break: keep-all; }
  /* 고정/스티키 막대를 두지 않는다. 화면에 붙어 있는 막대는 그 아래로 스크롤된 버튼의
     클릭을 조용히 가로챈다 — 눌러도 아무 일이 없고 점수만 빠진다. 20편 × 12버튼을
     사람이 훑는 시트에서 이건 결과를 통째로 망가뜨린다. 항상 보여야 하는 진행률만
     pointer-events:none 배지로 띄운다. */
  header { padding: 24px 28px; border-bottom: 1px solid #262a35; background: #12141a; }
  header h1 { margin: 0 0 6px; font-size: 19px; }
  header p { margin: 0; color: #9aa1b1; font-size: 13px; }
  #progress { position: fixed; right: 16px; bottom: 16px; pointer-events: none; z-index: 5;
              background: #1d2a22; border: 1px solid #2f6f4e; color: #7dd3a0;
              padding: 6px 12px; border-radius: 999px; font-size: 13px; }
  main { padding: 0 28px 40px; max-width: 1600px; }
  details.guide { margin: 20px 0; border: 1px solid #262a35; border-radius: 8px; padding: 12px 16px; background: #171a22; }
  details.guide summary { cursor: pointer; font-weight: 600; }
  .crit h3 { margin: 14px 0 4px; font-size: 14px; }
  .crit .q { font-weight: 400; color: #9aa1b1; font-size: 13px; }
  .crit ul { margin: 4px 0 0 18px; padding: 0; color: #c3c9d6; font-size: 13px; }
  .crit .note { color: #e8b86b; font-size: 13px; margin: 6px 0 0; }
  .item { border-top: 1px solid #262a35; padding: 26px 0; }
  .item h2 { font-size: 17px; margin: 0 0 4px; }
  .item .tags { color: #9aa1b1; font-size: 13px; margin-bottom: 16px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  /* 글은 항상 3편이다. auto-fit 은 넓은 화면에서 빈 칸을 하나 더 만들어 칸을 괜히 좁힌다. */
  @media (min-width: 1000px) { .cols { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .col { border: 1px solid #262a35; border-radius: 8px; background: #171a22; display: flex; flex-direction: column; }
  .col.picked { border-color: #7dd3a0; }
  .col header { position: static; border: 0; background: transparent; padding: 12px 14px 8px; }
  .slot { font-size: 20px; font-weight: 700; color: #7aa2f7; }
  .col h4 { margin: 4px 0 0; font-size: 14px; }
  .col .meta { color: #737a8c; font-size: 12px; }
  /* flex:1 — 글 길이가 달라도 세 칸의 채점 줄이 같은 높이에 오게. 눈이 좌우로 오가며 매긴다. */
  .body { flex: 1; padding: 0 14px; max-height: 480px; overflow: auto; white-space: pre-wrap;
          font-size: 13px; color: #c9cfdc; border-top: 1px solid #262a35; padding-top: 12px; }
  .body b { color: #f2c14e; }
  .marks { padding: 12px 14px; border-top: 1px solid #262a35; display: grid; gap: 8px; }
  .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .row span.lab { font-size: 12px; color: #9aa1b1; min-width: 96px; }
  button.opt { background: #21252f; border: 1px solid #333949; color: #c9cfdc; border-radius: 6px;
               padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
  button.opt[aria-pressed="true"] { background: #2f6f4e; border-color: #7dd3a0; color: #eafff2; }
  button.pick { width: 100%; padding: 10px; font-size: 14px; font-weight: 600; margin-top: 4px;
                background: #21252f; border: 1px solid #333949; color: #c9cfdc; border-radius: 6px; cursor: pointer; font-family: inherit; }
  button.pick[aria-pressed="true"] { background: #2f6f4e; border-color: #7dd3a0; color: #eafff2; }
  footer.bar { margin-top: 28px; background: #171a22; border-top: 1px solid #262a35;
               padding: 16px 0; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  footer.bar button { background: #2f6f4e; border: 0; color: #eafff2; padding: 9px 16px; border-radius: 6px;
                      font-size: 14px; cursor: pointer; font-family: inherit; }
  footer.bar button.ghost { background: #21252f; border: 1px solid #333949; color: #c9cfdc; }
  #out { position: fixed; inset: 8% 8%; background: #0d0f14; border: 1px solid #333949; border-radius: 10px;
         padding: 16px; display: none; flex-direction: column; gap: 10px; z-index: 20; }
  #out textarea { flex: 1; width: 100%; background: #12141a; color: #c9cfdc; border: 1px solid #262a35;
                  border-radius: 6px; padding: 10px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>예리 글쓰기 모델 블라인드 평가</h1>
  <p>${escapeHtml(meta.subtitle)}</p>
  <p>어느 칸이 어느 모델인지 이 화면에는 없습니다. 다 고른 뒤 결과 JSON을 내려받아 <code>--unblind</code> 로 이름을 붙입니다.</p>
  <div id="progress">0 / 0 완료</div>
</header>
<main>
  <details class="guide" open>
    <summary>평가 기준</summary>
    ${criteriaHtml()}
  </details>
  <div id="items"></div>
  <footer class="bar">
    <button id="save">결과 JSON 내려받기</button>
    <button id="show" class="ghost">JSON 보기 / 복사</button>
    <button id="reset" class="ghost">전부 지우기</button>
    <span id="hint" style="color:#9aa1b1;font-size:13px"></span>
  </footer>
</main>
<div id="out">
  <textarea id="outText" readonly></textarea>
  <div><button id="closeOut" class="ghost" style="background:#21252f;border:1px solid #333949;color:#c9cfdc;padding:8px 14px;border-radius:6px;cursor:pointer">닫기</button></div>
</div>
<script>
const SHEET = ${data};
const CRITERIA = ${criteriaData};
const SHEET_ID = ${JSON.stringify(meta.sheetId)};
const STORE_KEY = "yeri_blind_" + SHEET_ID;

let state = {};
try { state = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (_e) { state = {}; }

function save() {
  // 저장이 막히면(시크릿 창, 사이트 데이터 차단) 조용히 넘어가지 않는다.
  // 20편을 다 매긴 뒤 새로고침 한 번에 날리는 것이 이 시트의 가장 큰 사고다.
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (_e) {
    document.getElementById("hint").textContent =
      "경고: 브라우저에 저장할 수 없습니다. 새로고침하면 평가가 사라집니다. 끝나면 반드시 JSON을 내려받으세요.";
  }
  renderProgress();
}

function cell(keywordId, slot) {
  const row = state[keywordId] || (state[keywordId] = {});
  return row[slot] || (row[slot] = {});
}

function renderProgress() {
  // 한 키워드는 "가장 나은 글 1개 선택"이 끝나야 완료로 센다.
  const done = SHEET.filter((item) => (state[item.keyword_id] || {}).__best).length;
  document.getElementById("progress").textContent = done + " / " + SHEET.length + " 완료";
  document.querySelectorAll(".col").forEach((col) => {
    const best = (state[col.dataset.keyword] || {}).__best;
    col.classList.toggle("picked", best === col.dataset.slot);
  });
}

function optionButtons(crit) {
  if (crit.type === "choice") return ["좋음", "보통", "나쁨"];
  if (crit.type === "yesno") return ["예", "아니오"];
  if (crit.type === "minutes") return crit.options.map((m) => m + "분");
  return [];
}

function build() {
  const root = document.getElementById("items");
  root.innerHTML = "";
  for (const item of SHEET) {
    const wrap = document.createElement("div");
    wrap.className = "item";
    const h2 = document.createElement("h2");
    h2.textContent = item.keyword;
    const tags = document.createElement("div");
    tags.className = "tags";
    tags.textContent = [item.keyword_id, item.category, item.style_label].filter(Boolean).join(" · ");
    const cols = document.createElement("div");
    cols.className = "cols";

    for (const s of item.slots) {
      const col = document.createElement("div");
      col.className = "col";
      col.dataset.keyword = item.keyword_id;
      col.dataset.slot = s.slot;

      const head = document.createElement("header");
      head.innerHTML = '<div class="slot">' + s.slot + '</div>'
        + '<h4></h4><div class="meta">' + s.chars + '자</div>';
      head.querySelector("h4").textContent = s.title;

      const body = document.createElement("div");
      body.className = "body";
      body.innerHTML = s.body_html;

      const marks = document.createElement("div");
      marks.className = "marks";
      for (const crit of CRITERIA) {
        const row = document.createElement("div");
        row.className = "row";
        const lab = document.createElement("span");
        lab.className = "lab";
        lab.textContent = crit.label;
        row.appendChild(lab);
        optionButtons(crit).forEach((text, index) => {
          const b = document.createElement("button");
          b.className = "opt";
          b.type = "button";
          b.textContent = text;
          b.dataset.crit = crit.key;
          b.dataset.value = crit.type === "minutes" ? String(crit.options[index]) : text;
          b.setAttribute("aria-pressed", String(cell(item.keyword_id, s.slot)[crit.key] === b.dataset.value));
          b.addEventListener("click", () => {
            const c = cell(item.keyword_id, s.slot);
            c[crit.key] = c[crit.key] === b.dataset.value ? "" : b.dataset.value;
            row.querySelectorAll("button.opt").forEach((other) => {
              other.setAttribute("aria-pressed", String(c[crit.key] === other.dataset.value && c[crit.key] !== ""));
            });
            save();
          });
          row.appendChild(b);
        });
        marks.appendChild(row);
      }

      const pick = document.createElement("button");
      pick.className = "pick";
      pick.type = "button";
      pick.textContent = "이 글이 가장 낫다";
      pick.dataset.keyword = item.keyword_id;
      pick.dataset.slot = s.slot;
      pick.setAttribute("aria-pressed", String((state[item.keyword_id] || {}).__best === s.slot));
      pick.addEventListener("click", () => {
        const row = state[item.keyword_id] || (state[item.keyword_id] = {});
        row.__best = row.__best === s.slot ? "" : s.slot;
        cols.querySelectorAll("button.pick").forEach((other) => {
          other.setAttribute("aria-pressed", String(row.__best === other.dataset.slot && row.__best !== ""));
        });
        save();
      });
      marks.appendChild(pick);

      col.appendChild(head);
      col.appendChild(body);
      col.appendChild(marks);
      cols.appendChild(col);
    }
    wrap.appendChild(h2);
    wrap.appendChild(tags);
    wrap.appendChild(cols);
    root.appendChild(wrap);
  }
  renderProgress();
}

function resultJson() {
  return JSON.stringify({
    sheet_id: SHEET_ID,
    saved_at: new Date().toISOString(),
    selections: SHEET.map((item) => ({
      keyword_id: item.keyword_id,
      keyword: item.keyword,
      best_slot: (state[item.keyword_id] || {}).__best || "",
      slots: item.slots.map((s) => Object.assign({ slot: s.slot }, state[item.keyword_id]?.[s.slot] || {})),
    })),
  }, null, 2);
}

document.getElementById("save").addEventListener("click", () => {
  const blob = new Blob([resultJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "blind_selections_" + SHEET_ID + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  document.getElementById("hint").textContent = "내려받았습니다. --unblind 로 이름을 붙이세요.";
});
document.getElementById("show").addEventListener("click", () => {
  document.getElementById("outText").value = resultJson();
  document.getElementById("out").style.display = "flex";
});
document.getElementById("closeOut").addEventListener("click", () => {
  document.getElementById("out").style.display = "none";
});
document.getElementById("reset").addEventListener("click", () => {
  if (!confirm("이 시트의 평가를 전부 지웁니다.")) return;
  state = {};
  save();
  build();
});

// 헤드리스 검증용 진입점. 사람이 쓰는 경로와 같은 함수를 부른다.
window.__blind = { get state() { return state; }, resultJson, build, SHEET };
build();
</script>
</body>
</html>`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 10. 평가 기준 문서                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function criteriaMarkdown() {
  const lines = [
    "# 예리 글쓰기 모델 블라인드 평가 기준",
    "",
    "생성: `scripts/blind_model_test.mjs --criteria`. 이 파일을 손으로 고치지 말고 스크립트의 `CRITERIA` 를 고친다.",
    "HTML 평가 시트에 박히는 기준과 같은 상수에서 나오므로 둘이 어긋날 수 없다.",
    "",
    "## 왜 이 네 가지인가",
    "",
    "커밋 767f7db(2026-08-26)가 우리 원고 320편과 네이버 상위 노출 글 46편을 같은 잣대로 재서",
    "찾아낸 실패는 분량이 아니라 읽는 호흡이었다. 문단 길이 중앙값이 122자 대 11자, 볼드가 0개 대 14개였다.",
    "그 커밋이 프롬프트에 넣은 규칙(문단 40자·결론 세 번째 문단 안·1,000자당 볼드 8~10곳)을",
    "여기서도 그대로 채점 항목으로 쓴다. 프롬프트가 지시한 것을 모델이 실제로 지키는지가 이번 비교의 절반이다.",
    "",
    "## 채점 항목",
    "",
  ];
  for (const item of CRITERIA) {
    lines.push(`### ${item.label} — ${item.question}`);
    lines.push("");
    for (const check of item.checks) lines.push(`- ${check}`);
    if (item.note) {
      lines.push("");
      lines.push(`> ${item.note}`);
    }
    lines.push("");
  }
  lines.push("## 판정 규칙");
  lines.push("");
  lines.push("- 키워드 20개마다 세 글 중 가장 나은 것 하나를 고른다. 고르지 않고 넘기면 그 키워드는 미완료다.");
  lines.push("- 최종 결정 지표는 '바로 발행 가능'이 '예'인 비율이다. 20편 중 몇 편인지로 모델을 고른다.");
  lines.push("- 동률이면 '수정 필요 시간' 합계가 작은 쪽을 고른다.");
  lines.push("- 사실 오류가 있는 글은 다른 항목이 아무리 좋아도 '바로 발행 가능'에서 탈락이다.");
  lines.push("- 평가 중에는 모델 이름을 보지 않는다. 다 고른 뒤 `--unblind` 로 붙인다.");
  lines.push("");
  lines.push("## 비교 조건");
  lines.push("");
  lines.push("세 모델에 완전히 같은 것을 준다. 하나라도 다르면 비교가 성립하지 않는다.");
  lines.push("");
  lines.push("| 항목 | 값 |");
  lines.push("| --- | --- |");
  lines.push("| 프롬프트 | `server.js buildYeriGenerationPrompt` (복사 아닌 require) |");
  lines.push(`| 목표 글자 수 | ${JOB_DEFAULTS.word_count}자 |`);
  lines.push(`| 이미지 줄 | ${JOB_DEFAULTS.image_count}개 |`);
  lines.push("| 온도 | Gemini 0.45 (실서비스 값) |");
  lines.push("| 출력 강제 | Gemini responseJsonSchema · Claude 강제 도구 호출 |");
  lines.push("");
  return lines.join("\n");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 11. --live                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function readProviderKey(provider) {
  for (const name of PROVIDER_KEY_ENV[provider] || []) {
    const value = String(process.env[name] || "").trim();
    if (value) return { name, value };
  }
  return null;
}

async function runLive(rows, outDir) {
  if (process.env.AIMAX_LIVE_PAID_OK !== "1") {
    console.error("거부: --live 는 유료 API 를 호출합니다. AIMAX_LIVE_PAID_OK=1 로 명시 실행하세요.");
    console.error("      먼저 드라이런으로 예상 비용을 확인하고 승인을 받으세요.");
    process.exit(2);
  }
  const providers = [...new Set(MODELS.map((model) => model.provider))];
  const keys = {};
  const missing = [];
  for (const provider of providers) {
    const found = readProviderKey(provider);
    if (!found) missing.push(`${provider} (${(PROVIDER_KEY_ENV[provider] || []).join(" 또는 ")})`);
    else keys[provider] = found;
  }
  if (missing.length) {
    console.error("중단: API 키가 환경변수에 없습니다.");
    for (const row of missing) console.error(`  - ${row}`);
    process.exit(2);
  }
  for (const provider of providers) console.log(`키 확인: ${provider} <- ${keys[provider].name} (값은 출력하지 않습니다)`);

  const articles = [];
  for (const row of rows) {
    const request = row.request;
    const headers = { "content-type": "application/json" };
    if (row.provider === "claude") {
      headers["x-api-key"] = keys.claude.value;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["x-goog-api-key"] = keys.gemini.value;
    }
    process.stdout.write(`생성 ${row.run_id} ... `);
    const response = await fetch(request.url, { method: "POST", headers, body: JSON.stringify(request.body) });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      // 재시도하지 않는다. 이미 과금됐을 수 있으므로 응답을 남기고 멈춘다.
      const failPath = path.join(outDir, `live_fail_${row.run_id}.json`);
      fs.writeFileSync(failPath, JSON.stringify({ status: response.status, json }, null, 2), "utf8");
      console.error(`실패 (HTTP ${response.status}). 응답 저장: ${failPath}`);
      process.exit(1);
    }
    let parsed;
    if (row.provider === "claude") {
      const block = (json?.content || []).find((item) => item.type === "tool_use" && item.name === "emit_blog_post");
      parsed = block?.input || null;
    } else {
      const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";
      parsed = JSON.parse(text);
    }
    if (!parsed?.content_markdown) {
      console.error(`실패: ${row.run_id} 응답에 content_markdown 이 없습니다.`);
      process.exit(1);
    }
    articles.push({
      run_id: row.run_id,
      keyword_id: row.keyword_id,
      keyword: row.keyword,
      category: row.category,
      style_label: row.style_label,
      model_id: row.model_id,
      title: String(parsed.title || ""),
      content_markdown: String(parsed.content_markdown || ""),
      usage: json?.usageMetadata || json?.usage || null,
    });
    console.log("완료");
  }
  const articlesPath = path.join(outDir, "articles.json");
  fs.writeFileSync(articlesPath, JSON.stringify(articles, null, 2), "utf8");
  console.log(`\n생성 결과: ${articlesPath}`);
  return articlesPath;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 12. --unblind                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function unblind(selectionsPath, keyPath) {
  const selections = JSON.parse(fs.readFileSync(selectionsPath, "utf8"));
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const mapping = new Map(key.map((row) => [row.keyword_id, row.mapping]));
  const tally = new Map(MODELS.map((model) => [model.id, { best: 0, publishable: 0, fixMinutes: 0, scored: 0 }]));

  for (const row of selections.selections || []) {
    const map = mapping.get(row.keyword_id);
    if (!map) continue;
    if (row.best_slot && map[row.best_slot]) tally.get(map[row.best_slot]).best += 1;
    for (const slot of row.slots || []) {
      const modelId = map[slot.slot];
      if (!modelId || !tally.has(modelId)) continue;
      const bucket = tally.get(modelId);
      if (slot.publishable) bucket.scored += 1;
      if (slot.publishable === "예") bucket.publishable += 1;
      if (slot.fixMinutes) bucket.fixMinutes += Number(slot.fixMinutes) || 0;
    }
  }

  console.log("=== 블라인드 해제 결과 ===");
  console.log(`${pad("모델", 22)}${pad("최고 선택", 12)}${pad("바로 발행 가능", 18)}${pad("수정 시간 합", 14)}`);
  console.log("-".repeat(66));
  for (const model of MODELS) {
    const bucket = tally.get(model.id);
    console.log(
      pad(model.label, 22)
      + pad(`${bucket.best}/${KEYWORDS.length}`, 12)
      + pad(`${bucket.publishable}/${bucket.scored || 0}`, 18)
      + pad(`${bucket.fixMinutes}분`, 14),
    );
  }
  console.log("");
  console.log("결정 규칙: '바로 발행 가능' 비율이 높은 모델. 동률이면 수정 시간 합이 작은 쪽.");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 13. 픽스처                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

// 시트가 도는지 확인하려고 만든 가짜 글 3편이다. 모델 출력이 아니다.
// 일부러 서로 다르게 만들었다 — 짧은 문단, 긴 문단, 볼드 없는 글.
function fixtureArticles() {
  const entry = KEYWORDS[0];
  const bodies = {
    "gemini-3.5-flash": [
      "# 강남 중고차 매입 시세, 무엇부터 보나",
      "",
      "중고차를 넘기기 전에 시세부터 봅니다.",
      "",
      "결론부터 말하면 **주행거리**와 사고 이력 두 가지가 값을 가릅니다.",
      "",
      "## 시세를 가르는 것",
      "",
      "연식이 같아도 주행거리가 **2만km** 차이 나면 값이 달라집니다.",
      "",
      "[이미지] 계기판을 확인하는 손 || 주행거리는 눈으로 먼저 확인합니다",
      "",
      "성능점검기록부를 먼저 떼어 보는 편이 낫습니다.",
    ].join("\n"),
    "gemini-3.7-flash": [
      "# 강남 중고차 매입 시세 정리",
      "",
      "강남 지역에서 중고차를 매입할 때 시세를 확인하는 방법에 대해서 알아보고자 하며 이때 여러 가지 고려해야 할 사항들이 존재하기 때문에 이를 하나씩 살펴보는 것이 필요하다고 할 수 있습니다.",
      "",
      "## 확인 사항",
      "",
      "주행거리와 사고 이력 그리고 옵션 구성 등을 종합적으로 검토하여야 하며 이러한 요소들이 최종 매입가에 영향을 미치게 됩니다.",
      "",
      "[이미지] 중고차 매장 전경",
    ].join("\n"),
    "claude-sonnet-5": [
      "# 강남 중고차 매입 시세 확인하는 법",
      "",
      "값을 먼저 알고 가야 손해를 안 봅니다.",
      "",
      "**주행거리**와 **사고 이력**이 시세의 8할입니다.",
      "",
      "## 무엇을 확인하나",
      "",
      "성능점검기록부에 사고 기록이 남습니다.",
      "",
      "| 항목 | 영향 | 확인처 |",
      "| --- | --- | --- |",
      "| 주행거리 | 큼 | 계기판 |",
      "| 사고 이력 | 큼 | 점검기록부 |",
      "",
      "[이미지] 점검기록부를 넘겨보는 장면 || 기록부에 사고 이력이 남습니다",
      "",
      "매입 전에 두 곳 이상 견적을 받아 보세요.",
    ].join("\n"),
  };
  return MODELS.map((model) => ({
    run_id: `${entry.id}__${model.id}`,
    keyword_id: entry.id,
    keyword: entry.keyword,
    category: entry.category,
    style_label: "상담 유도형",
    model_id: model.id,
    title: bodies[model.id].split("\n")[0].replace(/^#\s*/, ""),
    content_markdown: bodies[model.id],
  }));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 14. 진입점                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function writeSheet(articles, outDir, seed, subtitle) {
  const { sheet, key } = blindPairs(articles, seed);
  // 본문 HTML 은 여기서 만들어 넣는다. 브라우저에서 마크다운을 다시 파싱하지 않게 한다.
  for (const item of sheet) {
    for (const slot of item.slots) {
      slot.body_html = renderArticle(slot.content_markdown);
      delete slot.content_markdown;
    }
  }
  const sheetId = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 10);
  const html = buildSheetHtml(sheet, { sheetId, subtitle });
  const htmlPath = path.join(outDir, "blind_sheet.html");
  const keyPath = path.join(outDir, "blind_key.json");
  fs.writeFileSync(htmlPath, html, "utf8");
  fs.writeFileSync(keyPath, JSON.stringify(key, null, 2), "utf8");
  return { htmlPath, keyPath, sheetId, sheet, key };
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : "";
}

async function main() {
  const argv = process.argv.slice(2);
  const outDir = path.resolve(argValue(argv, "--out") || path.join(repoRoot, "claudedocs/blind-model-test"));
  fs.mkdirSync(outDir, { recursive: true });
  const seed = argValue(argv, "--seed") || "yeri-blind-20260831";

  if (argv.includes("--criteria")) {
    const target = path.join(repoRoot, "claudedocs/yeri-model-blind-test-criteria-20260831.md");
    fs.writeFileSync(target, criteriaMarkdown(), "utf8");
    console.log(`평가 기준 문서: ${target}`);
    return;
  }

  if (argv.includes("--unblind")) {
    const selections = argValue(argv, "--unblind");
    const keyPath = argValue(argv, "--key") || path.join(outDir, "blind_key.json");
    if (!selections) {
      console.error("사용법: --unblind <selections.json> [--key <blind_key.json>]");
      process.exit(2);
    }
    unblind(path.resolve(selections), path.resolve(keyPath));
    return;
  }

  if (argv.includes("--sheet-fixture")) {
    const fixtureDir = path.join(outDir, "fixture");
    fs.mkdirSync(fixtureDir, { recursive: true });
    const built = writeSheet(fixtureArticles(), fixtureDir, `${seed}-fixture`, "픽스처 3편 — 시트 동작 확인용. 실제 모델 출력이 아닙니다.");
    console.log("=== 픽스처 시트 ===");
    console.log(`키워드: ${built.sheet.length}건 · 슬롯: ${built.sheet[0].slots.map((s) => s.slot).join("/")}`);
    console.log(`배치(정답표): ${JSON.stringify(built.key[0].mapping)}`);
    console.log(`시트: ${built.htmlPath}`);
    console.log(`정답표: ${built.keyPath}`);
    const html = fs.readFileSync(built.htmlPath, "utf8");
    for (const model of MODELS) {
      if (html.includes(model.id) || html.includes(model.label)) {
        console.error(`실패: 시트 HTML 에 모델 이름 "${model.label}" 이 남아 있습니다. 블라인드가 깨집니다.`);
        process.exit(1);
      }
    }
    console.log("확인: 시트 HTML 에 모델 이름이 없습니다 (블라인드 유지).");
    return;
  }

  if (argv.includes("--sheet")) {
    const articlesPath = path.resolve(argValue(argv, "--sheet"));
    const articles = JSON.parse(fs.readFileSync(articlesPath, "utf8"));
    const built = writeSheet(articles, outDir, seed, `${articles.length}편 · ${path.basename(articlesPath)}`);
    console.log(`시트: ${built.htmlPath}`);
    console.log(`정답표: ${built.keyPath}`);
    return;
  }

  // 기본: 드라이런
  const { api } = loadServerModule();
  const rows = buildAllRequests(api);
  printKeywordTable(rows);
  const cost = printCostTable(rows);

  const payloadPath = path.join(outDir, "requests.json");
  fs.writeFileSync(payloadPath, JSON.stringify(rows, null, 2), "utf8");
  const criteriaPath = path.join(repoRoot, "claudedocs/yeri-model-blind-test-criteria-20260831.md");
  fs.writeFileSync(criteriaPath, criteriaMarkdown(), "utf8");

  console.log("");
  console.log(`요청 payload ${rows.length}건: ${payloadPath}`);
  console.log(`평가 기준 문서: ${criteriaPath}`);
  console.log(`프롬프트 출처: server.js buildYeriGenerationPrompt (require, 복사 아님)`);

  if (argv.includes("--live")) {
    console.log("");
    console.log("=== LIVE 모드 ===");
    const articlesPath = await runLive(rows, outDir);
    const articles = JSON.parse(fs.readFileSync(articlesPath, "utf8"));
    const built = writeSheet(articles, outDir, seed, `${articles.length}편 · 실제 생성 결과`);
    console.log(`시트: ${built.htmlPath}`);
    console.log(`정답표: ${built.keyPath}`);
  } else {
    console.log("");
    console.log("드라이런입니다. API 를 호출하지 않았고 과금도 없습니다.");
    console.log(`실행하려면: AIMAX_LIVE_PAID_OK=1 GEMINI_API_KEY=... ANTHROPIC_API_KEY=... node scripts/blind_model_test.mjs --live`);
    console.log(`예상 총액 ${won(cost.grandWon)} (재작성 포함 최악 ${won(cost.grandWon * 3)}) — 실행 전 승인 필요.`);
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
