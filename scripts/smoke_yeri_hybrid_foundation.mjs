import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-hybrid-smoke-"));
process.env.AIMAX_REPORT_DATA_DIR = tmpRoot;
process.env.AIMAX_REPORT_TOKEN = "smoke-token";
process.env.AIMAX_ADMIN_SECRET = "smoke-admin-secret";

const require = createRequire(import.meta.url);
const { __yeriHybridTest } = require("../oracle/aimax-reports-api/server.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

try {
  assert(__yeriHybridTest.JOB_STATUSES.has("generating"), "generating_status_missing");
  assert(__yeriHybridTest.JOB_STATUSES.has("ready_for_publish"), "ready_for_publish_status_missing");
  assert(__yeriHybridTest.sanitizeFailedStage("Smart Editor Open!") === "smart_editor_open", "failed_stage_sanitize_failed");

  const job = {
    id: "job-yeri-hybrid-1",
    user_id: "user-1",
    kind: "yeri_write",
    worker_code: "yeri_writer",
    status: "ready_for_publish",
    retry_count: 1,
    created_at: "2026-05-25T00:00:00.000Z",
    updated_at: "2026-05-25T00:00:01.000Z",
    logs: [],
  };
  const meta = __yeriHybridTest.attachYeriArtifactToJob(job, {
    title: "테스트 글",
    content_markdown: "본문입니다.\napi_key=AIza123456789012345678901234567890",
    text_model: "mock-no-paid",
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    generated_at: "2026-05-25T00:00:02.000Z",
  });
  const artifactPath = path.join(tmpRoot, "artifacts", "job-yeri-hybrid-1.json");
  assert(fs.existsSync(artifactPath), "artifact_file_not_created");
  assert(meta.artifact_id === "job-yeri-hybrid-1", "artifact_id_mismatch");

  const stored = readJson(artifactPath);
  assert(stored.kind === "yeri_write", "artifact_kind_mismatch");
  assert(!stored.artifact.content_markdown.includes("AIza123"), "artifact_secret_not_redacted");

  const publicJob = __yeriHybridTest.publicJob(job);
  assert(publicJob.artifact.ready === true, "public_artifact_meta_missing");
  assert(!Object.prototype.hasOwnProperty.call(publicJob.artifact, "content_markdown"), "public_artifact_leaks_content");
  assert(publicJob.retry_count === 1, "public_retry_count_missing");

  const agentArtifact = __yeriHybridTest.agentYeriArtifactPayload(job);
  assert(agentArtifact.content_markdown.includes("[REDACTED]"), "agent_artifact_missing_sanitized_content");
  assert(agentArtifact.text_model === "mock-no-paid", "agent_artifact_model_mismatch");

  const staleAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  __yeriHybridTest.saveJobs({
    version: 1,
    jobs: [
      {
        id: "stuck-generating-job",
        user_id: "user-1",
        kind: "yeri_write",
        worker_code: "yeri_writer",
        status: "generating",
        created_at: staleAt,
        updated_at: staleAt,
        logs: [],
      },
    ],
  });
  const recovered = __yeriHybridTest.recoverStaleGeneratingJobs(Date.now());
  assert(recovered.recovered === 1, "stale_generating_not_recovered");
  const stuckJob = __yeriHybridTest.loadJobs().jobs[0];
  assert(stuckJob.status === "failed", "stale_generating_status_not_failed");
  assert(stuckJob.failed_stage === "content_generation", "stale_generating_stage_missing");
  assert(stuckJob.logs.some((entry) => entry.level === "error"), "stale_generating_log_missing");

  console.log("YERI_HYBRID_FOUNDATION_SMOKE_OK");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
