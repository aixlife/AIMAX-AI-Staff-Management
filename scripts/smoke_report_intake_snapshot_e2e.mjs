#!/usr/bin/env node
// P1 e2e: 실제 HTTP intake 경로(POST /api/reports → handleReport → attachServerJobSnapshot →
// classifyReportAutoGuidance)를 그대로 태워, (1) 서버가 jobs.json 에서 연결 잡 스냅샷을
// 보고에 동봉하는지 (2) 정형 코드로 응답 분류가 나오는지 검증한다.

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-intake-e2e-"));
const port = 21800 + Math.floor(Math.random() * 400);
const token = "intake-smoke-token";
const userId = "intake-smoke-user";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 보고 접수 시각 근처(recency 창 안)의 실패 잡 — invalid_json 정형 코드.
const nowIso = new Date().toISOString();
fs.writeFileSync(
  path.join(tmpDir, "jobs.json"),
  `${JSON.stringify({
    version: 1,
    jobs: [
      {
        id: "intake-job-1",
        user_id: userId,
        kind: "yeri_write",
        worker_code: "yeri_writer",
        status: "failed",
        server_generation: "gemini",
        created_at: nowIso,
        updated_at: nowIso,
        finished_at: nowIso,
        failed_stage: "content_generation",
        failed_reason: "server_generation_invalid_response",
        result: {
          ok: false,
          stage: "content_generation",
          error: "server_generation_invalid_response",
          detail_code: "yeri_claude_invalid_json",
          detail: "stop_reason=max_tokens text_len=12000",
          visible_error: "AI 응답을 글 형식으로 해석하지 못했습니다.",
        },
        logs: [{ at: nowIso, level: "error", message: "서버 글 생성에 실패했습니다." }],
      },
    ],
  }, null, 2)}\n`,
  "utf8",
);

const child = childProcess.spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AIMAX_REPORT_HOST: "127.0.0.1",
    AIMAX_REPORT_PORT: String(port),
    AIMAX_REPORT_DATA_DIR: tmpDir,
    AIMAX_RESEARCH_DATA_DIR: path.join(tmpDir, "research"),
    AIMAX_DOWNLOAD_DIR: path.join(tmpDir, "downloads"),
    AIMAX_REPORT_TOKEN: token,
    AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (d) => { stderr += d.toString(); });

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      fetch(`http://127.0.0.1:${port}/health`).then((r) => {
        if (r.ok) resolve();
        else retry();
      }).catch(retry);
    };
    const retry = () => {
      if (Date.now() - started > 8000) reject(new Error(`server did not start; stderr:\n${stderr}`));
      else setTimeout(tick, 150);
    };
    tick();
  });
}

async function main() {
  await waitForServer();

  const body = {
    report_id: "AIMAX-RPT-intake-e2e-1",
    source: "aimax-webapp",
    account: { user_id: userId, email: "intake@example.test", product: "bundle" },
    user_input: {
      work_context: "예리 실행",
      // 자유 텍스트에는 오분류 유발 문구(chromedriver)를 일부러 넣어, 정형 코드가 이긴다는 것을 확인.
      visible_error: "아예 실패 chromedriver 같은 게 뜬 것 같기도",
      user_note: "",
    },
    system: { agent: { jobs_recent: [{ id: "intake-job-1", status: "failed", updated_at: nowIso }] } },
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/reports`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-aimax-report-token": token },
    body: JSON.stringify(body),
  });
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const json = await res.json();
  console.log("  response auto_guidance_category:", json.auto_guidance_category);
  assert(json.ok === true, "response not ok");
  assert(
    json.auto_guidance_category === "ai_response_invalid",
    `expected ai_response_invalid, got ${json.auto_guidance_category}`,
  );

  // 저장된 보고 JSON 에 서버 잡 스냅샷이 동봉됐는지 확인.
  const dateKey = String(json.stored_at).slice(0, 10);
  const stored = JSON.parse(
    fs.readFileSync(path.join(tmpDir, "reports", dateKey, `${json.report_id}.json`), "utf8"),
  );
  const snap = stored.server_job_snapshot;
  assert(snap, "server_job_snapshot missing on stored report");
  assert(snap.matched_by === "job_ids", `snapshot matched_by=${snap.matched_by}`);
  assert(snap.jobs?.[0]?.result?.detail_code === "yeri_claude_invalid_json", "snapshot detail_code missing");
  assert(stored.support.auto_guidance_signal === "job_structured", `signal=${stored.support.auto_guidance_signal}`);
  console.log("  snapshot matched_by:", snap.matched_by, "| detail_code:", snap.jobs[0].result.detail_code);
  console.log("  signal tier:", stored.support.auto_guidance_signal);

  // 인덱스 행에도 정형 코드가 남았는지(재분류 경로 지원).
  const indexRows = fs.readFileSync(path.join(tmpDir, "reports-index.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const row = indexRows.find((r) => r.report_id === json.report_id);
  assert(row?.auto_guidance_category === "ai_response_invalid", `index cat=${row?.auto_guidance_category}`);
  assert(row?.job_detail_code === "yeri_claude_invalid_json", `index job_detail_code=${row?.job_detail_code}`);
  console.log("  index auto_guidance_category:", row.auto_guidance_category, "| job_detail_code:", row.job_detail_code);

  console.log("\nREPORT_INTAKE_SNAPSHOT_E2E_OK");
}

main()
  .then(() => { child.kill("SIGKILL"); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) {} process.exit(0); })
  .catch((err) => { child.kill("SIGKILL"); console.error("FAIL:", err.message); try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) {} process.exit(1); });
