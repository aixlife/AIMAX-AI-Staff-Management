import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import https from "node:https";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-cancel-contract-"));
process.env.AIMAX_REPORT_DATA_DIR = dataDir;
process.env.GEMINI_API_KEY = "fixture-gemini-key";
const { __jobGuardTest, __yeriHybridTest } = createRequire(import.meta.url)("../oracle/aimax-reports-api/server.js");
function response(statusCode, body) {
  const stream = new EventEmitter();
  stream.statusCode = statusCode;
  stream.headers = {};
  setImmediate(() => { stream.emit("data", Buffer.from(JSON.stringify(body))); stream.emit("end"); });
  return stream;
}
const originalRequest = https.request;
try {
  const controller = new AbortController();
  https.request = (_url, _options, callback) => {
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => setImmediate(() => callback(response(503, { error: "temporary" })));
    request.destroy = (error) => queueMicrotask(() => request.emit("error", error));
    return request;
  };
  const pending = __jobGuardTest.requestYeriProviderJson("gemini", "https://example.test/retry", { signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, (error) => error.code === "user_cancelled");
  assert.equal(__jobGuardTest.buildFailureDiagnostic({ reason: "user_cancelled" }).code, "user_cancelled");

  const aborted = new AbortController();
  aborted.abort();
  assert.throws(() => __jobGuardTest.sleepMs(1, aborted.signal), (error) => error.code === "user_cancelled");
  await assert.rejects(
    __yeriHybridTest.enforceYeriArtifactLength({ content_markdown: "짧음" }, { id: "length-cancel", payload: { word_count: 900 } }, "fixture", aborted.signal),
    (error) => error.code === "user_cancelled",
  );

  // Start an actual length-rewrite provider request, then cancel it. This is
  // deliberately not a pre-aborted signal: removing the signal argument from
  // enforceYeriArtifactLength's rewrite call makes the request finish and this
  // assertion fail.
  let markRewriteStarted;
  const rewriteStarted = new Promise((resolve) => { markRewriteStarted = resolve; });
  let rewriteDestroyed = false;
  https.request = (url, options, callback) => {
    const request = new EventEmitter();
    request.write = () => {};
    request.destroy = (error) => {
      if (String(url).includes(":generateContent")) rewriteDestroyed = true;
      queueMicrotask(() => request.emit("error", error));
    };
    request.end = () => {
      if (String(url).includes("/models?pageSize=")) {
        setImmediate(() => callback(response(200, { models: [{ name: "models/gemini-3.6-flash", supportedGenerationMethods: ["generateContent"] }] })));
        return;
      }
      markRewriteStarted();
      setTimeout(() => callback(response(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ title: "보정", content_markdown: "가".repeat(900) }) }] } }],
      })), 30);
    };
    return request;
  };
  const rewriteController = new AbortController();
  const rewritePending = __yeriHybridTest.enforceYeriArtifactLength(
    { content_markdown: "짧음" },
    { id: "length-rewrite-cancel", payload: { word_count: 900, ai_model: "gemini-3.6-flash" } },
    "fixture-user",
    rewriteController.signal,
  );
  // The transport subscribes to AbortSignal itself; https.request options do
  // not contain it. Verify cancellation of the real in-flight request instead.
  const settled = rewritePending.then(() => "resolved", () => "rejected");
  let deadline;
  const timeout = new Promise((_, reject) => {
    deadline = setTimeout(() => reject(new Error("length_rewrite_timeout")), 1000);
  });
  try {
    await Promise.race([
      rewriteStarted,
      settled.then(() => { throw new Error("length_rewrite_request_not_started"); }),
      timeout,
    ]);
    rewriteController.abort();
    await assert.rejects(Promise.race([rewritePending, timeout]), (error) => error.code === "user_cancelled");
    assert.equal(rewriteDestroyed, true, "length_rewrite_request_not_destroyed");
  } finally {
    clearTimeout(deadline);
    rewriteController.abort();
  }
  console.log("YERI_CANCELLATION_CONTRACT_SMOKE_OK");
} finally {
  https.request = originalRequest;
  fs.rmSync(dataDir, { recursive: true, force: true });
}
