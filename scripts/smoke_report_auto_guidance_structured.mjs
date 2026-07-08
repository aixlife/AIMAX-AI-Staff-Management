#!/usr/bin/env node
// P1 스모크: 자동 안내 분류가 연결 잡의 정형 코드(result.error/detail_code)를 1순위 신호로
// 쓰는지, 실제 오분류 3건(7/7·6/28) 시나리오가 올바르게 분류되는지, 그리고 보고 시각과
// 동떨어진 낡은 잡이 오귀속되지 않는지(recency 가드) 검증한다.
//
// 실행: node scripts/smoke_report_auto_guidance_structured.mjs
// 서버는 require.main 가드가 있어 import 만으로는 뜨지 않는다.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-guidance-smoke-"));

// 프로덕션 handleReport 는 분류 직전 server_received_at 을 항상 설정한다. 스모크도 동일하게
// 각 보고에 접수 시각을 넣고, 잡 타임스탬프를 그 시각 근처(정상) / 며칠 전(stale)으로 둔다.
const REPORT_TIME = "2026-07-07T05:00:00.000Z";
const JOB_RECENT = "2026-07-07T04:40:00.000Z"; // 보고 20분 전 — 창 안
const JOB_STALE = "2026-06-16T17:40:00.000Z"; // 3주 전 — 창 밖(오귀속 방지 대상)

// 정형 코드 스냅샷 조인(attachServerJobSnapshot → loadJobs) 검증용 jobs.json fixture.
const jobsFixture = {
  version: 1,
  jobs: [
    {
      id: "job-invalid-json-1",
      user_id: "user-A",
      kind: "yeri_write",
      worker_code: "yeri_writer",
      status: "failed",
      server_generation: "gemini",
      created_at: JOB_RECENT,
      updated_at: JOB_RECENT,
      finished_at: JOB_RECENT,
      failed_stage: "content_generation",
      failed_reason: "server_generation_invalid_response",
      result: {
        ok: false,
        stage: "content_generation",
        error: "server_generation_invalid_response",
        detail_code: "yeri_claude_invalid_json",
        visible_error: "AI 응답을 글 형식으로 해석하지 못했습니다. 모델을 바꾸거나 다시 시도해주세요.",
      },
      logs: [
        { at: JOB_RECENT, level: "info", message: "작업 요청이 생성되어 서버 글 생성 단계로 들어갔습니다." },
        { at: JOB_RECENT, level: "error", message: "서버 글 생성에 실패했습니다: AI 응답을 글 형식으로 해석하지 못했습니다." },
      ],
    },
    {
      id: "job-quota-1",
      user_id: "user-B",
      kind: "yeri_write",
      status: "failed",
      created_at: JOB_RECENT,
      updated_at: JOB_RECENT,
      finished_at: JOB_RECENT,
      result: {
        ok: false,
        stage: "content_generation",
        error: "server_generation_quota_exceeded",
        detail_code: "server_generation_quota_exceeded",
        visible_error: "결제/요금제 한도 초과입니다.",
      },
      logs: [],
    },
  ],
};

fs.writeFileSync(path.join(tmpDir, "jobs.json"), `${JSON.stringify(jobsFixture, null, 2)}\n`, "utf8");

process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const { classifyReportAutoGuidance, attachServerJobSnapshot } = server.__automationTest;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}  (=${actual})`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}  expected=${expected} actual=${actual}`);
  }
}

function guidanceKey(report) {
  const g = classifyReportAutoGuidance(report);
  return g ? g.key || null : null;
}
function guidanceTier(report) {
  const g = classifyReportAutoGuidance(report);
  return g ? g.signal_tier || null : null;
}

console.log("[1] 오분류 3건 재현 시나리오");

// 시나리오 A — AIMAX-RPT-20260707041852: 예리 "아예 실패", 연결 잡 result.error=
// server_generation_invalid_response. 과거 자유텍스트 룰은 chromedriver 문구로 오분류.
const reportA = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-A" },
  user_input: { work_context: "예리 실행", visible_error: "아예 실패", user_note: "" },
  system: {
    agent: {
      jobs_recent: [
        {
          id: "job-invalid-json-1",
          kind: "yeri_write",
          status: "failed",
          updated_at: JOB_RECENT,
          result: { error: "server_generation_invalid_response", detail_code: "yeri_claude_invalid_json" },
          last_log: { level: "error", message: "이전 작업에서 chromedriver 차단이 있었음" },
        },
      ],
    },
  },
};
check("A: 예리 실패 → ai_response_invalid (정형)", guidanceKey(reportA), "ai_response_invalid");
check("A: 신호 계층 = job_structured", guidanceTier(reportA), "job_structured");

// 시나리오 B — AIMAX-RPT-20260707035708: 맥 실행기 필수 업데이트, 잡 없음. 과거 naver 오분류.
const reportB = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-mac" },
  user_input: {
    work_context: "실행기 버전 업데이트",
    visible_error:
      "macOS 실행기 필수 업데이트\nmacOS 실행기 업데이트가 필요합니다. 현재 v1.0.2, 최신 v1.0.57 버전을 설치해주세요. 네이버 자동 로그인이 빨라지고 로그인 창 깜빡임과 페이지 왕복이 사라졌습니다.",
    user_note: "업데이트 설치 파일 다운로드를 받고 했는데도 여전히 1.0.2 버전이라고 뜸",
  },
};
check("B: 맥 필수 업데이트 → runner_update_required", guidanceKey(reportB), "runner_update_required");

// 시나리오 C — AIMAX-RPT-20260628085501: "지은 채용이 안 보임". 잡 없음. 과거 mac_gatekeeper 오분류.
const reportC = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-jieun" },
  system: { runtime: { system: "macOS 14.5" }, agent: {} },
  web_context: { platform: "macOS" },
  user_input: {
    work_context: "지은 직원 채용이 안 보입니다.",
    visible_error: "설정 필요한 직원이 있다고 나오지만, 실제로는 지은 직원이 나오지 않습니다.",
    user_note: "윤자동님 유튜브 라이브 보고 이벤트로 지원 직원 받는 메일은 받고 비밀번호 설정은 했습니다.",
  },
};
check("C: 지은 채용 안 보임 → mac_gatekeeper 아님", guidanceKey(reportC) === "mac_gatekeeper", false);

console.log("[2] 정형 코드가 자유텍스트 오탐을 이긴다");

const reportD = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-B" },
  user_input: {
    work_context: "예리 실행",
    visible_error: "chromedriver 차단된 것 같아요 브라우저 시작이 안 됩니다",
    user_note: "",
  },
  system: {
    agent: {
      jobs_recent: [
        { id: "job-quota-1", kind: "yeri_write", status: "failed", updated_at: JOB_RECENT, result: { error: "server_generation_quota_exceeded", detail_code: "server_generation_quota_exceeded" } },
      ],
    },
  },
};
check("D: 잡=quota, 텍스트=chromedriver → quota_exceeded", guidanceKey(reportD), "quota_exceeded");
check("D: 신호 계층 = job_structured", guidanceTier(reportD), "job_structured");

console.log("[3] 잡 없는 자유텍스트는 여전히 폴백 분류");

const reportE = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-win" },
  user_input: { work_context: "예리 실행", visible_error: "chromedriver 차단, 브라우저 시작 실패", user_note: "" },
};
check("E: 잡 없음 + chromedriver → browser_driver_policy_blocked", guidanceKey(reportE), "browser_driver_policy_blocked");
check("E: 신호 계층 = free_text", guidanceTier(reportE), "free_text");

console.log("[4] attachServerJobSnapshot: 서버 jobs.json 조인");

const reportF = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-A" },
  user_input: { work_context: "예리 실행", visible_error: "안 돼요", user_note: "" },
  system: { agent: { jobs_recent: [{ id: "job-invalid-json-1", status: "failed", updated_at: JOB_RECENT }] } },
};
attachServerJobSnapshot(reportF);
const snap = reportF.server_job_snapshot;
check("F: 스냅샷 매칭 방식 = job_ids", snap?.matched_by, "job_ids");
check("F: 스냅샷 잡 수", snap?.jobs?.length, 1);
check("F: 스냅샷 detail_code 채워짐", snap?.jobs?.[0]?.result?.detail_code, "yeri_claude_invalid_json");
check("F: 스냅샷 기반 분류 = ai_response_invalid", guidanceKey(reportF), "ai_response_invalid");
check("F: 신호 계층 = job_structured", guidanceTier(reportF), "job_structured");

const reportG = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-B" },
  user_input: { work_context: "글쓰기가 안 돼요", visible_error: "그냥 안 됨", user_note: "" },
};
attachServerJobSnapshot(reportG);
check("G: 잡 id 없이 계정 최근 조인 = account_recent", reportG.server_job_snapshot?.matched_by, "account_recent");
check("G: account_recent 는 정형 분류에 미사용 → null", guidanceKey(reportG), null);

console.log("[5] recency 가드: 낡은 잡은 최신 보고에 오귀속되지 않는다");

// 시나리오 H — AIMAX-RPT-20260703180651 재현: "실행기 연결 안 됨"(최신 보고)인데
// jobs_recent 에 3주 전 api-key 인증실패 잡이 섞임. 낡은 잡은 정형 신호에서 제외돼야 하고,
// 자유 텍스트("연결 안 됨")로만 판단 → api_key_invalid 로 오분류되지 않아야 한다.
const reportH = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-H" },
  user_input: {
    work_context: "예리 실행",
    visible_error: "업데이트 설치까지 문제 없는데 대시보드에는 실행기 연결이 계속 안된다고 나옴",
    user_note: "",
  },
  system: {
    agent: {
      jobs_recent: [
        { id: "old-auth-1", kind: "yeri_write", status: "failed", updated_at: JOB_STALE, finished_at: JOB_STALE, result: { error: "server_generation_auth_failed", detail_code: "server_generation_auth_failed" } },
      ],
    },
  },
};
check("H: 낡은 api-key 잡 → api_key_invalid 아님", guidanceKey(reportH) === "api_key_invalid", false);
check("H: 정형(job_structured) 로 분류되지 않음", guidanceTier(reportH) === "job_structured", false);

// 시나리오 I — 같은 잡이 최근(창 안)이면 정형 신호로 정상 사용된다(가드가 과하지 않음 확인).
const reportI = {
  source: "web",
  server_received_at: REPORT_TIME,
  account: { user_id: "user-I" },
  user_input: { work_context: "예리 실행", visible_error: "연결 안 됨", user_note: "" },
  system: {
    agent: {
      jobs_recent: [
        { id: "fresh-auth-1", kind: "yeri_write", status: "failed", updated_at: JOB_RECENT, finished_at: JOB_RECENT, result: { error: "server_generation_auth_failed", detail_code: "server_generation_auth_failed" } },
      ],
    },
  },
};
check("I: 최근 api-key 잡 → api_key_invalid (정형)", guidanceKey(reportI), "api_key_invalid");
check("I: 신호 계층 = job_structured", guidanceTier(reportI), "job_structured");

console.log("");
console.log(`총 ${passed + failed}건 · PASS ${passed} · FAIL ${failed}`);
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (_e) {
  /* best effort */
}
process.exit(failed === 0 ? 0 : 1);
