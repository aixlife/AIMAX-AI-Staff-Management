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
  const genericVersion = __yeriHybridTest.versionPayload("v1.0.2");
  assert(genericVersion.latest_version === "v1.0.51", "generic_latest_version_should_follow_platform_latest");
  assert(genericVersion.min_version === "v1.0.44", "generic_min_version_should_not_fall_back_to_legacy_global_min");
  assert(genericVersion.update_required === true, "generic_legacy_version_should_require_update");
  const macVersion = __yeriHybridTest.versionPayload("v1.0.36", "macos");
  assert(macVersion.latest_version === "v1.0.51", "macos_latest_version_mismatch");
  assert(macVersion.min_version === "v1.0.36", "macos_min_version_mismatch");
  assert(macVersion.update_required === false, "macos_min_version_should_remain_supported");
  const bunchedImages = __yeriHybridTest.sanitizeYeriGeneratedArtifact({
    title: "이미지 분산 테스트",
    content_markdown: [
      "# 이미지 분산 테스트",
      "",
      "## 첫 문단",
      "본문 1",
      "",
      "## 둘째 문단",
      "본문 2",
      "",
      "[이미지] 첫 이미지",
      "",
      "[이미지] 둘째 이미지",
      "",
      "[이미지] 셋째 이미지",
      "",
      "## 마무리",
      "본문 3",
    ].join("\\n"),
  }, { keywords: ["이미지 분산 테스트"], image_count: 3 }, "mock-no-paid");
  assert(!/\\[이미지\\][^\\n]*\\n\\n\\[이미지\\]/.test(bunchedImages.content_markdown), "bunched_image_lines_should_be_redistributed");
  const transientDiagnostic = __yeriHybridTest.buildFailureDiagnostic({
    stage: "content_generation",
    reason: "server_generation_provider_transient",
    error: "server_generation_provider_transient",
    visible_error: "Gemini 일시적 오류 - 잠시 후 다시 시도해주세요.",
  });
  assert(transientDiagnostic.code === "provider_transient", "provider_transient_code_missing");
  assert(transientDiagnostic.user_actionable === true, "provider_transient_should_be_user_actionable");
  assert(transientDiagnostic.admin_action_required === false, "provider_transient_should_not_require_admin");

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
