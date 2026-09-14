import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-finalization-lock-"));
process.env.AIMAX_REPORT_DATA_DIR = dataDir;
const api = createRequire(import.meta.url)("../oracle/aimax-reports-api/server.js").__yeriHybridTest;
const job = (id) => ({ id, user_id: "lock-smoke-user", kind: "yeri_write", status: "generating", payload: {}, logs: [] });
try {
  const first = job("cancel-first");
  api.saveJobs({ version: 1, jobs: [first] });
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  api.setFinalizationBarrierForTest(() => barrier);
  const finalizing = api.finalizeYeriArtifactForJob(first.id, first.user_id, { title: "cancelled", content_markdown: "must not save" }, new AbortController().signal);
  await new Promise((resolve) => setImmediate(resolve));
  api.mutateJobsWithLock((jobs) => { jobs.jobs[0].status = "cancelled"; });
  release();
  const cancelled = await finalizing;
  assert.equal(cancelled.error, "user_cancelled");
  assert.equal(fs.existsSync(path.join(dataDir, "artifacts", `${first.id}.json`)), false);
  assert.equal(api.loadJobs().jobs[0].status, "cancelled");

  api.setFinalizationBarrierForTest(null);
  const second = job("finalize-first");
  api.saveJobs({ version: 1, jobs: [second] });
  const finalized = await api.finalizeYeriArtifactForJob(second.id, second.user_id, { title: "saved", content_markdown: "saved" }, new AbortController().signal);
  assert.equal(finalized.job.status, "ready_for_publish");
  console.log("YERI_FINALIZATION_LOCK_SMOKE_OK");
} finally {
  api.setFinalizationBarrierForTest(null);
  fs.rmSync(dataDir, { recursive: true, force: true });
}
