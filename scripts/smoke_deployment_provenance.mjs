import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-deployment-proof-"));
process.env.AIMAX_REPORT_DATA_DIR = dir;
const { __r02Test } = createRequire(import.meta.url)("../oracle/aimax-reports-api/server.js");
try {
  const stamp = path.join(dir, "commit");
  assert.equal(__r02Test.readDeploymentCommit(stamp), null);
  fs.writeFileSync(stamp, "not-a-commit\n");
  assert.equal(__r02Test.readDeploymentCommit(stamp), null);
  const commit = "a74c931e71f19d596848b571bce81b084c3ff045";
  fs.writeFileSync(stamp, `${commit}\n`);
  assert.equal(__r02Test.readDeploymentCommit(stamp), commit);
  const req = Readable.from([]);
  Object.assign(req, { method: "GET", url: "/api/reports/health", headers: { host: "fixture.local" } });
  let status, body;
  await __r02Test.dispatchApiRequest(req, {
    writeHead(code) { status = code; },
    end(value) { body = JSON.parse(value); },
  });
  assert.equal(status, 200);
  const source = fs.readFileSync(new URL("../oracle/aimax-reports-api/server.js", import.meta.url));
  assert.equal(body.deployment.server_sha256, crypto.createHash("sha256").update(source).digest("hex"));
  assert.equal(body.deployment.commit, null);
  console.log("DEPLOYMENT_PROVENANCE_SMOKE_OK");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
