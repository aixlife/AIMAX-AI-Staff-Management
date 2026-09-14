import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "node:https";
import { createRequire } from "node:module";

const { __jobGuardTest } = createRequire(import.meta.url)("../oracle/aimax-reports-api/server.js");
const originalRequest = https.request;
let attempts = 0;
try {
  https.request = () => {
    attempts += 1;
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {};
    request.destroy = (error) => queueMicrotask(() => request.emit("error", error));
    return request;
  };
  const controller = new AbortController();
  const pending = __jobGuardTest.requestYeriProviderJson("gemini", "https://example.test/generate", {
    method: "POST", body: {}, timeoutMs: 500, signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, (error) => error.code === "user_cancelled");
  assert.equal(attempts, 1);
  console.log("YERI_PROVIDER_CANCEL_SMOKE_OK");
} finally {
  https.request = originalRequest;
}
