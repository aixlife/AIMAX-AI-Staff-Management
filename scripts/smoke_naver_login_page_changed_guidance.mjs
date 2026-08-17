#!/usr/bin/env node
// 스모크: 네이버 로그인 화면 개편으로 실행기가 로그인 버튼을 못 찾은 실패를
// naver_login_required(사용자가 직접 재로그인)가 아니라 naver_login_page_changed
// (AIMAX 조치 필요)로 분류하는지 검증한다.
//
// 배경 (2026-08-18): 네이버가 NID 로그인 화면을 개편(#log.login → #loginBtn_column/_row)해
// 8/15~8/17 예리 글쓰기 잡 6건이 "로그인 버튼을 찾을 수 없습니다"로 실패했다. 문구에
// "로그인"이 들어가 사용자 조치 안내로 분류됐지만, 사용자가 몇 번을 재로그인해도
// 실행기 선택자를 고치기 전엔 같은 실패로 되돌아온다(7/21 model_not_found 와 같은 교훈).
//
// 실행: node scripts/smoke_naver_login_page_changed_guidance.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-naver-login-smoke-"));

const REPORT_TIME = "2026-08-17T13:35:00.000Z";
const JOB_RECENT = "2026-08-17T13:30:38.787Z";

// 실제 실패 잡(8/17 493a3ddd)의 로그 문구를 그대로 쓴다.
const RUNNER_ERROR =
  "클로드사용법 완벽 가이드: 효율적인 AI 업무 활용 팁 처리 실패: 로그인 버튼을 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다.";
// 8/16 02:07 케이스: 수동 로그인 대기까지 갔다가 타임아웃 — 원인 문구가 감싸여 올라온다.
const RUNNER_ERROR_WRAPPED =
  "네이버 로그인이 필요합니다. 자동 로그인이 막혀 브라우저 창에서 수동 로그인을 기다렸지만 완료되지 않았습니다. (원인: 로그인 버튼을 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다.)";

const jobsFixture = {
  version: 1,
  jobs: [
    {
      id: "job-login-button-1",
      user_id: "user-yeri",
      kind: "yeri_write",
      worker_code: "yeri_writer",
      status: "failed",
      created_at: JOB_RECENT,
      updated_at: JOB_RECENT,
      finished_at: JOB_RECENT,
      failed_stage: "naver_login",
      result: { ok: false, stage: "naver_login", error: RUNNER_ERROR },
      logs: [{ at: JOB_RECENT, level: "error", message: RUNNER_ERROR }],
    },
  ],
};
fs.writeFileSync(path.join(tmpDir, "jobs.json"), `${JSON.stringify(jobsFixture, null, 2)}\n`, "utf8");

process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { classifyReportAutoGuidance, automationTicketCategory } = server.__automationTest;
const { buildFailureDiagnostic } = server.__yeriHybridTest;

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
const guidanceKey = (report) => classifyReportAutoGuidance(report)?.key ?? null;
const guidanceStatus = (report) => classifyReportAutoGuidance(report)?.status ?? null;

console.log("[1] 정형 신호(연결 잡 result.error) 분류");

const reportStructured = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-yeri" },
  user_input: { work_context: "예리 글쓰기", visible_error: "글쓰기가 안 됩니다", user_note: "" },
  system: {
    agent: {
      jobs_recent: [
        { id: "job-login-button-1", kind: "yeri_write", status: "failed", updated_at: JOB_RECENT, result: { error: RUNNER_ERROR } },
      ],
    },
  },
};
check("정형 → naver_login_page_changed", guidanceKey(reportStructured), "naver_login_page_changed");
check("상태 = reviewing(운영팀 확인)", guidanceStatus(reportStructured), "reviewing");
check("사용자 조치 안내로 새지 않음", guidanceKey(reportStructured) === "naver_login_required", false);

console.log("[2] 자유 텍스트(잡 없이 화면 문구만 붙여넣은 보고)");

const reportFreeText = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-yeri-2" },
  user_input: { work_context: "예리 글쓰기 중", visible_error: RUNNER_ERROR, user_note: "네이버 로그인은 잘 되어 있어요" },
};
check("자유텍스트 → naver_login_page_changed", guidanceKey(reportFreeText), "naver_login_page_changed");

console.log("[3] 수동 로그인 대기 타임아웃으로 감싸인 문구도 같은 분류");

const reportWrapped = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-yeri-3" },
  user_input: { work_context: "예리 글쓰기 중", visible_error: RUNNER_ERROR_WRAPPED, user_note: "" },
};
check("감싸인 문구 → naver_login_page_changed", guidanceKey(reportWrapped), "naver_login_page_changed");

console.log("[4] 진짜 네이버 로그인/보안 확인 건은 그대로 사용자 조치로 남는다 (회귀)");

const reportRealLogin = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-sec" },
  user_input: {
    work_context: "예리 글쓰기",
    visible_error: "네이버 로그인 2단계 인증 화면에서 새 기기 등록을 요구합니다",
    user_note: "",
  },
};
check("2단계 인증 → naver_login_required 유지", guidanceKey(reportRealLogin), "naver_login_required");

console.log("[5] 앱 화면 진단: 사용자 조치가 아니라 관리자 조치로 표기");

const diagnostic = buildFailureDiagnostic({ stage: "naver_login", error: RUNNER_ERROR });
check("진단 코드", diagnostic?.code, "naver_login_page_changed");
check("관리자 조치 플래그", diagnostic?.admin_action_required, true);
check("사용자 조치 아님", diagnostic?.user_actionable, false);
check("'네이버 재로그인' 액션을 권하지 않음", (diagnostic?.actions || []).includes("네이버 재로그인"), false);

console.log("[6] 자동화 티켓 분류: 우리 쪽 작업(naver_editor)으로 큐잉");

check(
  "티켓 카테고리",
  automationTicketCategory({ auto_guidance_category: "naver_login_page_changed" }, { support: { auto_guidance_category: "naver_login_page_changed" } }),
  "naver_editor",
);

console.log(`\n결과: PASS ${passed} / FAIL ${failed}`);
fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
