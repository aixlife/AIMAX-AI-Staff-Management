#!/usr/bin/env node
// 스모크: 예리 이미지를 서버가 사용자 웹 키로 만드는 경로 + 구글 무료 한도 오분류 수정.
//
// 배경 (2026-10-13): 키 입력은 웹으로 옮겨 갔는데 이미지는 실행기가 "로컬 키"로 만들었다.
// 웹에만 키를 넣은 사용자는 이미지가 한 장도 안 나오고(api_key_missing) 발행이 임시저장으로
// 바뀌었다. 또 구글 무료 한도 429 본문의 "billing" 한 단어 때문에 결제 고갈로 오분류돼
// 다음 무료 모델로 넘어가지 못했다.
//
// 실행: node scripts/smoke_yeri_server_images.mjs
// 실제 이미지 1장(유료, Gemini 3.1 Flash Image 1장 약 $0.067)까지 보려면:
//   AIMAX_LIVE_IMAGE_SMOKE=1 GEMINI_KEY_FOR_SMOKE=... node scripts/smoke_yeri_server_images.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.AIMAX_REPORT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-server-images-"));
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const t = server.__yeriHybridTest;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) { passed += 1; console.log(`  PASS  ${name}  (=${actual})`); }
  else { failed += 1; console.log(`  FAIL  ${name}  expected=${expected} actual=${actual}`); }
}

console.log("[1] 구글 무료 한도 429 는 결제 고갈이 아니다");
const freeTierDetail = 'external_http_error {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20"}}';
const freeTier = t.classifyYeriProviderError("gemini", { status: 429, detail: freeTierDetail });
check("free_tier → rate_limited", freeTier.code, "server_generation_rate_limited");
check("free_tier 는 같은 모델 재시도 안 함", freeTier.transient, false);
const billing = t.classifyYeriProviderError("openai", { status: 429, detail: "insufficient_quota: You exceeded your current quota, please check your plan and billing details." });
check("진짜 결제 고갈은 그대로 quota_exceeded", billing.code, "server_generation_quota_exceeded");

console.log("[2] [이미지] 줄에서 그림 지시만 뽑는다");
const md = [
  "# 제목",
  "본문",
  "[이미지] 와인잔을 드는 손 || 향을 먼저 맡아보세요",
  "문단",
  "[이미지]   오크통이 늘어선 저장고  ",
  "[이미지]",
].join("\n");
const prompts = t.yeriImagePromptsFromMarkdown(md);
check("개수", prompts.length, 3);
check("캡션 제거", prompts[0], "와인잔을 드는 손");
check("공백 정리", prompts[1], "오크통이 늘어선 저장고");
check("빈 지시도 자리 유지", prompts[2], "");

console.log("[3] 이미지 오류 분류");
const geminiFree = t.classifyYeriImageError("gemini", { status: 429, detail: "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image" });
check("Gemini 무료 키 → image_paid_required", geminiFree.code, "image_paid_required");
check("무료 키는 제공자 단위로 끊는다", geminiFree.fatalForProvider, true);
check("안내 문구에 결제 연결", /결제를 연결/.test(geminiFree.message), true);
check("401 → api_key_invalid", t.classifyYeriImageError("openai", { status: 401, detail: "invalid_api_key" }).code, "api_key_invalid");
check("타임아웃은 재시도 대상", t.classifyYeriImageError("gemini", { code: "external_timeout" }).fatalForProvider, false);

console.log("[4] 키가 없으면 이미지 단계는 손대지 않고 no_key 로 넘긴다");
const job = { id: "smoke-job-1", payload: { image_model: "gemini-3.1-flash-image", image_count: 1, keywords: ["와인"] } };
const artifact = { title: "와인", content_markdown: "# 와인\n본문\n[이미지] 와인잔 || 설명\n끝" };
const noKey = await t.generateYeriServerImages(artifact, job, "no-key-user");
check("no_key 상태", noKey.server_images?.status, "no_key");
check("본문 그대로", noKey.content_markdown, artifact.content_markdown);
check("이미지 0장 요청이면 그대로", (await t.generateYeriServerImages(artifact, { ...job, payload: { ...job.payload, image_count: 0 } }, "no-key-user")).server_images, undefined);

console.log("[5] 회사(서버) 저장 키로 고객 이미지를 만들지 않는다");
process.env.GEMINI_API_KEY = "server-stored-key-should-not-be-used";
check("사용자 키 없으면 계획 0개", t.yeriServerImagePlan(job, "no-key-user").length, 0);

console.log("[6] 아티팩트 저장 시 server_images 가 살아남는다");
const sanitized = t.sanitizeYeriServerImages({ status: "partial", requested: 2, ready: 1, items: [
  { index: 1, status: "ready", provider: "gemini", model: "gemini-3.1-flash-image", mime: "image/png", bytes: 2048, sha256: "a".repeat(64) },
  { index: 2, status: "failed", provider: "gemini", error_code: "image_paid_required", message: "x", sha256: "nothex" },
] });
check("상태 유지", sanitized.status, "partial");
check("잘못된 sha 제거", sanitized.items[1].sha256, "");

console.log("[6b] 무료 키 판정은 키 상태에 남고, 키를 바꾸면 지워진다");
t.setUserSecretForSmoke("cap-user", "gemini", "AIzaSy-test-key-free-tier-000000000000");
check("처음엔 unknown", t.publicUserSecretStatus("cap-user", "gemini").image_capability, "unknown");
t.recordUserSecretImageCapability("cap-user", "gemini", "free_tier_no_image");
check("무료 키 판정 기록", t.publicUserSecretStatus("cap-user", "gemini").image_capability, "free_tier_no_image");
t.setUserSecretForSmoke("cap-user", "gemini", "AIzaSy-test-key-paid-tier-111111111111");
check("키 교체 시 초기화", t.publicUserSecretStatus("cap-user", "gemini").image_capability, "unknown");

console.log("[6c] 긴 문단은 문장 경계에서 나눈다(내용 불변)");
const longPara = "첫 문장은 충분히 길게 써서 기준을 넘기도록 만든 설명입니다. 두 번째 문장도 **굵은 구절을 포함해** 길게 이어지는 설명입니다. 세 번째 문장으로 마무리합니다.";
const split = t.yeriSplitLongParagraphs(`## 소제목\n${longPara}\n- 목록 항목은 길어도 그대로입니다. 나누지 않습니다.`, 60);
check("문단이 나뉜다", split.split("\n\n").length >= 2, true);
check("글자는 그대로", split.replace(/\s/g, ""), `## 소제목\n${longPara}\n- 목록 항목은 길어도 그대로입니다. 나누지 않습니다.`.replace(/\s/g, ""));
check("목록은 안 나눈다", split.includes("- 목록 항목은 길어도 그대로입니다. 나누지 않습니다."), true);

console.log("[6d] 네이버·에디터 실패에 이미지 키 문구가 섞여도 키 안내로 오분류하지 않는다");
const imgFail = { failures: [{ stage: "image_generation", error_code: "api_key_missing", message: "이미지 생성용 API 키가 없어 이미지 없이 본문을 보존했습니다." }], image_skipped_no_key: true };
check("네이버 로그인 실패", t.jobFailureDiagnostic({ failed_stage: "naver_login", result: { stage: "naver_login", error: "네이버 로그인이 필요합니다.", images: imgFail } })?.code, "naver_login_required");
check("에디터 열기 실패", t.jobFailureDiagnostic({ failed_stage: "smart_editor_open", result: { stage: "smart_editor_open", failed_posts: [{ error: "NID 로그인 후에도 로그인 페이지에 머무릅니다." }], images: imgFail } })?.code, "naver_login_required");
check("이미지만 실패면 키 안내", t.jobFailureDiagnostic({ failed_stage: "image_completion", result: { images: imgFail } })?.code, "api_key_missing");

console.log("[6e] 자기소개 문장만 지운다");
check("자기소개 제거", t.yeriScrubToolMentions("안녕하세요! AIMAX 블로그 글쓰기 직원 예리입니다. 오늘은 중고차 고르는 법입니다."), "오늘은 중고차 고르는 법입니다.");
check("키워드 AIMAX 는 유지", t.yeriScrubToolMentions("AIMAX 실행기 설치 방법을 정리합니다."), "AIMAX 실행기 설치 방법을 정리합니다.");
check("'예리한' 같은 낱말 유지", t.yeriScrubToolMentions("예리한 칼날은 관리가 필요합니다."), "예리한 칼날은 관리가 필요합니다.");

if (process.env.AIMAX_LIVE_IMAGE_SMOKE === "1") {
  console.log("[7] 실제 Gemini 이미지 1장 (유료)");
  const key = String(process.env.GEMINI_KEY_FOR_SMOKE || "").trim();
  if (!key) {
    failed += 1;
    console.log("  FAIL  GEMINI_KEY_FOR_SMOKE 없음");
  } else {
    t.setUserSecretForSmoke("live-user", "gemini", key);
    const liveJob = { id: `live-${Date.now()}`, payload: { image_model: "gemini-3.1-flash-image", image_count: 1, keywords: ["와인"] } };
    const liveArtifact = { title: "와인", content_markdown: "# 와인\n본문\n[이미지] 나무 테이블 위 레드 와인 한 잔과 코르크, 자연광, 사진 || 설명\n끝" };
    const started = Date.now();
    const live = await t.generateYeriServerImages(liveArtifact, liveJob, "live-user");
    const item = live.server_images?.items?.[0] || {};
    console.log(`  info  ${Math.round((Date.now() - started) / 1000)}s status=${live.server_images?.status} code=${item.error_code} bytes=${item.bytes}`);
    check("live ready", live.server_images?.status, "ready");
    const filePath = t.yeriServerImagePath(liveJob.id, 1);
    check("파일 생성", fs.existsSync(filePath), true);
    if (fs.existsSync(filePath)) {
      const out = path.join(os.tmpdir(), `aimax-live-image-${liveJob.id}.png`);
      fs.copyFileSync(filePath, out);
      console.log(`  info  saved copy: ${out}`);
    }
  }
}

console.log(`\n결과: PASS ${passed} / FAIL ${failed}`);
process.exit(failed ? 1 : 0);
