import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-json-storage-smoke-"));
process.env.AIMAX_REPORT_DATA_DIR = tmpRoot;
process.env.AIMAX_REPORT_TOKEN = "smoke-token";
process.env.AIMAX_ADMIN_SECRET = "smoke-admin-secret";

const require = createRequire(import.meta.url);
const { __storageTest } = require("../oracle/aimax-reports-api/server.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

try {
  const usersPath = path.join(tmpRoot, "users.json");

  assert(__storageTest.readJsonFile(usersPath, { version: 1, users: [] }).users.length === 0, "missing_json_fallback_failed");

  __storageTest.saveUsers({ users: [{ id: "u1", email: "a@example.com" }] });
  assert(readJson(usersPath).users.length === 1, "initial_save_failed");

  __storageTest.saveUsers({ users: [{ id: "u2", email: "b@example.com" }] });
  assert(fs.existsSync(`${usersPath}.bak`), "backup_not_created");
  assert(readJson(`${usersPath}.bak`).users[0].id === "u1", "backup_does_not_hold_previous_state");
  assert(readJson(usersPath).users[0].id === "u2", "current_state_not_updated");

  fs.writeFileSync(usersPath, "{ broken json", "utf8");
  let readFailed = false;
  try {
    __storageTest.loadUsers();
  } catch (error) {
    readFailed = error.code === "json_read_failed";
  }
  assert(readFailed, "corrupt_json_did_not_fail_closed");
  assert(fs.readFileSync(usersPath, "utf8") === "{ broken json", "corrupt_json_was_overwritten");

  fs.writeFileSync(usersPath, JSON.stringify({ version: 1, users: "not-array" }), "utf8");
  let shapeFailed = false;
  try {
    __storageTest.loadUsers();
  } catch (error) {
    shapeFailed = error.code === "json_shape_invalid";
  }
  assert(shapeFailed, "invalid_shape_did_not_fail_closed");

  const health = __storageTest.jsonStorageHealth();
  assert(health.ok === false, "storage_health_should_fail_on_invalid_shape");
  assert(health.issues.some((issue) => issue.file === "users.json"), "storage_health_missing_users_issue");

  __storageTest.writeJsonLinesAtomic(path.join(tmpRoot, "reports-index.jsonl"), [
    { report_id: "r1", status: "new" },
  ]);
  assert(fs.existsSync(path.join(tmpRoot, "reports-index.jsonl")), "jsonl_write_failed");

  console.log("JSON_STORAGE_SAFETY_SMOKE_OK");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
