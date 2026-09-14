import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yeri-storage-recovery-"));
process.env.AIMAX_REPORT_DATA_DIR = dir;
const api = createRequire(import.meta.url)("../oracle/aimax-reports-api/server.js").__yeriHybridTest;
const job = { id: "recovery-job", user_id: "synthetic-user", kind: "yeri_write", status: "generating", payload: {}, logs: [] };

try {
  api.saveJobs({ version: 1, jobs: [job] });
  const stale = api.loadJobs();
  api.mutateJobsWithLock((data) => { data.jobs[0].status = "cancelled"; });
  stale.jobs[0].status = "ready_for_publish";
  assert.throws(() => api.saveJobs(stale), (error) => error.code === "json_write_conflict");
  assert.equal(api.loadJobs().jobs[0].status, "cancelled");

  const crossProcessStale = api.loadJobs();
  const child = spawnSync(process.execPath, ["-e", `const a=require(${JSON.stringify(path.resolve("oracle/aimax-reports-api/server.js"))}).__yeriHybridTest;a.mutateJobsWithLock(d=>{d.jobs[0].status='cancelled';d.jobs[0].updated_at='child-cancel';});`], { env: process.env, encoding: "utf8", timeout: 5000 });
  assert.equal(child.status, 0, child.stderr);
  crossProcessStale.jobs[0].status = "running";
  assert.throws(() => api.saveJobs(crossProcessStale), (error) => error.code === "json_write_conflict");
  assert.equal(api.loadJobs().jobs[0].updated_at, "child-cancel");

  const lock = path.join(dir, "jobs.lock");
  fs.writeFileSync(lock, "existing-owner");
  const started = Date.now();
  assert.throws(() => api.withJobsStorageLockSync(() => {}), (error) => error.code === "json_lock_busy");
  assert.ok(Date.now() - started < 250);
  assert.equal(fs.readFileSync(lock, "utf8"), "existing-owner");
  fs.unlinkSync(lock);
  assert.throws(() => api.withJobsStorageLockSync(() => api.withJobsStorageLockSync(() => {})), (error) => error.code === "json_lock_reentrant");
  assert.equal(fs.existsSync(lock), false);
  console.log("YERI_STORAGE_RECOVERY_SMOKE_OK");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
