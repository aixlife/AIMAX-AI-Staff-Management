#!/usr/bin/env node
import crypto from "node:crypto";
import https from "node:https";

const BASE_URL = process.env.AIMAX_BASE_URL || "https://api.aimax.ai.kr";
const DMG_FILENAME = "AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg";
const EXPECTED_SHA256 = "4f509535844595cf0d7d8c84b3c1d701b27d989d30b74695feacb1838e536a1b";
const EXPECTED_MIN_BYTES = 30 * 1024 * 1024;

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: options.method || "GET" }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(request(nextUrl, options));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    req.end();
  });
}

async function readJson(url) {
  const res = await request(url);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  if (res.statusCode !== 200) {
    throw new Error(`GET ${url} returned ${res.statusCode}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(body);
}

async function hashDownload(url) {
  const res = await request(url);
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`GET ${url} returned ${res.statusCode}; expected 200`);
  }
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of res) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const downloadUrl = `${BASE_URL}/downloads/${DMG_FILENAME}`;
const workersUrl = `${BASE_URL}/api/workers`;

console.log(`[smoke] Checking Jieun macOS download at ${BASE_URL}`);

const catalog = await readJson(workersUrl);
const workers = Array.isArray(catalog.workers) ? catalog.workers : [];
const jieun = workers.find((worker) => worker.code === "jieun_office_support" || worker.staff_code === "jieun");

assert(jieun, "Jieun worker not found in /api/workers");
assert(Array.isArray(jieun.supported_platforms), "Jieun supported_platforms is missing");
assert(jieun.supported_platforms.includes("macos"), "Jieun supported_platforms does not include macos");

const options = Array.isArray(jieun.execution_options) ? jieun.execution_options : [];
const macOption = options.find((option) => Array.isArray(option.platforms) && option.platforms.includes("macos"));

assert(macOption, "Jieun macOS execution option is missing");
assert(macOption.status === "available", `Jieun macOS execution option is not available: ${macOption.status}`);
assert(String(macOption.url || "").includes(DMG_FILENAME), "Jieun macOS execution option does not point to the DMG");

const result = await hashDownload(downloadUrl);
assert(result.bytes >= EXPECTED_MIN_BYTES, `DMG size too small: ${result.bytes}`);
assert(result.sha256 === EXPECTED_SHA256, `DMG SHA mismatch: ${result.sha256}`);

console.log(JSON.stringify({
  ok: true,
  download_url: downloadUrl,
  bytes: result.bytes,
  sha256: result.sha256,
  supported_platforms: jieun.supported_platforms,
  mac_option: {
    kind: macOption.kind,
    label: macOption.label,
    status: macOption.status,
    url: macOption.url,
  },
}, null, 2));
