#!/usr/bin/env node
// 2026-10-15 오류 전수조사 잔여 항목 스모크(서버 쪽):
//  #8 오래 아무도 가져가지 않은 ready_for_publish → 실패 + 안내, 만든 글은 보존(다시 시도로 이어 감)
//  #5 키워드 묶음: 첫 편이 키·결제 문제로 실패하면 나머지는 호출 없이 같은 사유로 멈춤, 일시 오류면 이어 씀
//  Y5 글 구조 검사(소제목 부족·표 자리표시·긴 표 칸)와 보정 프롬프트
//  발행 주소·임시저장 확인 방법이 서버 결과에 남는지
// 네트워크·유료 호출 없음.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-audit-rest-"));
process.env.AIMAX_REPORT_DATA_DIR = tmpRoot;
process.env.AIMAX_REPORT_TOKEN = "smoke-token";
process.env.AIMAX_ADMIN_SECRET = "smoke-admin-secret";
process.env.AIMAX_YERI_READY_UNCLAIMED_HOURS = "72";

const require = createRequire(import.meta.url);
const { __yeriHybridTest: t } = require("../oracle/aimax-reports-api/server.js");

const HOUR = 3600 * 1000;
const now = Date.parse("2026-10-15T09:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

// ── #8 ──────────────────────────────────────────────────────────────
t.saveAgentsForSmoke({
  agents: [
    { user_id: "u-alive", platform: "windows", device_label: "PC (Windows)", last_seen_at: iso(now - 5 * 60 * 1000) },
  ],
});
const jobs8 = {
  jobs: [
    // 맥 대상인데 맥 실행기 기록 없음, 57일 대기 → 실패
    { id: "r-old", user_id: "u-gone", kind: "yeri_write", status: "ready_for_publish", target_platform: "macos", created_at: iso(now - 57 * 24 * HOUR), updated_at: iso(now - 57 * 24 * HOUR), result: { artifact: { artifact_id: "keep-me" } } },
    // 10시간 대기 → 유지
    { id: "r-fresh", user_id: "u-gone", kind: "yeri_write", status: "ready_for_publish", target_platform: "macos", created_at: iso(now - 10 * HOUR), updated_at: iso(now - 10 * HOUR) },
    // 실행기는 살아 있는데 80시간 동안 안 가져감 → 실패(다른 사유)
    { id: "r-alive", user_id: "u-alive", kind: "yeri_write", status: "ready_for_publish", target_platform: "windows", target_device_label: "PC (Windows)", created_at: iso(now - 80 * HOUR), updated_at: iso(now - 80 * HOUR) },
    // 진행 중 잡은 건드리지 않음
    { id: "running", user_id: "u-gone", kind: "yeri_write", status: "running", created_at: iso(now - 90 * HOUR), updated_at: iso(now - 90 * HOUR) },
  ],
};
const expired = t.expireUnclaimedReadyJobs(jobs8, { referenceMs: now });
assert.equal(expired, 2, "오래된 ready_for_publish 2건만 만료");
const byId = Object.fromEntries(jobs8.jobs.map((job) => [job.id, job]));
assert.equal(byId["r-old"].status, "failed");
assert.equal(byId["r-old"].failed_reason, "runner_not_available_for_target");
assert.equal(byId["r-old"].result.artifact.artifact_id, "keep-me", "만든 글 정보 보존");
assert.match(byId["r-old"].logs.at(-1).message, /맥\)의 실행기가 57일 동안/);
assert.match(byId["r-old"].logs.at(-1).message, /만든 글로 다시 올리기/);
assert.equal(byId["r-fresh"].status, "ready_for_publish");
assert.equal(byId["r-alive"].failed_reason, "ready_job_not_claimed");
assert.match(byId["r-alive"].logs.at(-1).message, /업데이트/);
assert.equal(byId.running.status, "running");
// 사용자 범위 옵션
const scoped = { jobs: [{ ...jobs8.jobs[1], id: "s1", user_id: "x", updated_at: iso(now - 100 * HOUR) }] };
assert.equal(t.expireUnclaimedReadyJobs(scoped, { referenceMs: now, userId: "other" }), 0);
const diag = t.jobFailureDiagnostic(byId["r-old"]);
assert.equal(diag.code, "runner_not_available", `진단 코드: ${diag.code}`);
assert.equal(diag.user_actionable, true);
console.log("#8 ok");

// ── #5 ──────────────────────────────────────────────────────────────
function seedBatch(headFailure) {
  const created = iso(Date.now());
  const head = {
    id: "b-0", user_id: "u5", kind: "yeri_write", status: headFailure ? "failed" : "ready_for_publish",
    batch_id: "B", batch_index: 0, batch_total: 3, created_at: created, updated_at: created, logs: [],
    ...(headFailure || {}),
  };
  const followers = [1, 2].map((i) => ({
    id: `b-${i}`, user_id: "u5", kind: "yeri_write", status: "generating", server_generation: "mock",
    batch_id: "B", batch_index: i, batch_total: 3, created_at: created, updated_at: created, logs: [], payload: { keywords: [`k${i}`] },
  }));
  t.saveJobs({ jobs: [head, ...followers] });
  return head;
}
// 키·결제 실패 → 나머지 멈춤
const billingHead = seedBatch({
  failed_stage: "content_generation",
  failed_reason: "server_generation_quota_exceeded",
  result: { ok: false, error: "server_generation_quota_exceeded", visible_error: "크레딧이 부족합니다" },
});
t.continueYeriBatchAfterHead(billingHead, { id: "u5" }, "mock", { ok: false, error: "server_generation_quota_exceeded" });
let after = t.loadJobs().jobs;
for (const id of ["b-1", "b-2"]) {
  const job = after.find((item) => item.id === id);
  assert.equal(job.status, "failed", `${id} 멈춤`);
  assert.equal(job.failed_reason, "server_generation_quota_exceeded");
  assert.equal(job.result.batch_stopped_by, "b-0");
  assert.match(job.logs.at(-1).message, /요금 0원/);
}
// 일시 오류 → 나머지 이어 씀(mock 생성으로 ready_for_publish)
const transientHead = seedBatch({
  failed_stage: "content_generation",
  failed_reason: "server_generation_rate_limited",
  result: { ok: false, error: "server_generation_rate_limited" },
});
t.continueYeriBatchAfterHead(transientHead, { id: "u5" }, "mock", { ok: false, error: "server_generation_rate_limited" });
for (let i = 0; i < 50; i += 1) {
  after = t.loadJobs().jobs;
  if (after.filter((item) => item.batch_index > 0).every((item) => item.status === "ready_for_publish")) break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}
assert.ok(after.filter((item) => item.batch_index > 0).every((item) => item.status === "ready_for_publish"), "일시 오류면 나머지 생성");
// 첫 편 성공 → 나머지 이어 씀
const okHead = seedBatch(null);
t.continueYeriBatchAfterHead(okHead, { id: "u5" }, "mock", { ok: true });
for (let i = 0; i < 50; i += 1) {
  after = t.loadJobs().jobs;
  if (after.filter((item) => item.batch_index > 0).every((item) => item.status === "ready_for_publish")) break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}
assert.ok(after.filter((item) => item.batch_index > 0).every((item) => item.status === "ready_for_publish"), "성공이면 나머지 생성");
console.log("#5 batch ok");

// ── Y5 ──────────────────────────────────────────────────────────────
const good = "# 제목\n\n## 하나\n본문\n\n## 둘\n본문\n\n## 셋\n본문\n\n| 구분 | 내용 |\n|---|---|\n| 기간 | 2주 |\n";
assert.deepEqual(t.yeriStructureIssues(good), []);
const noHeadings = "# 제목\n\n본문만 길게 이어지는 글\n\n## 하나\n본문";
assert.equal(t.yeriStructureIssues(noHeadings).length, 1);
const placeholder = `${good}| A타입 | OO 업체 |\n`;
assert.ok(t.yeriStructureIssues(placeholder).some((item) => item.includes("자리표시")));
const longCell = `${good}| 기간 | ${"가".repeat(45)} |\n`;
assert.ok(t.yeriStructureIssues(longCell).some((item) => item.includes("40자")));
const health = `${good}| B형 간염 | 1,000원 |\n`;
assert.deepEqual(t.yeriStructureIssues(health), [], "정상 표기는 자리표시로 보지 않음");
const prompt = t.buildYeriLengthRevisionPrompt({
  keywords: ["강남 필라테스"], word_count: 300, image_count: 0,
  __length_revision: { markdown: noHeadings, attempt: 1, structure_issues: t.yeriStructureIssues(noHeadings) },
});
assert.match(prompt, /구조 보정:/);
assert.match(prompt, /소제목이 1개뿐/);
console.log("Y5 ok");

// ── 발행 주소·임시저장 확인 방법 ─────────────────────────────────────
const post = t.sanitizePostResult({
  title: "t", mode: "publish", url: "https://blog.naver.com/likimartin/224012345678", log_no: "224012345678",
  draft_save_confirmed: true, draft_confirm_method: "toast",
});
assert.equal(post.url, "https://blog.naver.com/likimartin/224012345678");
assert.equal(post.log_no, "224012345678");
assert.equal(post.draft_confirm_method, "toast");
assert.equal(post.draft_save_confirmed, true);
assert.equal(t.sanitizePostResult({ url: "https://evil.example/x" }).url, "");
assert.equal("draft_save_confirmed" in t.sanitizePostResult({}), false, "구버전 실행기 결과에는 필드를 만들지 않음");
console.log("post url ok");

fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log("AUDIT_REST_20261015_SMOKE_OK");
