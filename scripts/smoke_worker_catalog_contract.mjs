import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __catalogTest } = require("../oracle/aimax-reports-api/server.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractObjectKeys(source, objectName) {
  const marker = `const ${objectName} = {`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${objectName}_not_found`);
  let index = start + marker.length - 1;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = source.slice(start + marker.length, index);
        const keys = [];
        let bodyIndex = 0;
        while (bodyIndex < body.length) {
          while (/[\s,]/.test(body[bodyIndex] || "")) bodyIndex += 1;
          const keyMatch = /^[A-Za-z0-9_]+/.exec(body.slice(bodyIndex));
          if (!keyMatch) {
            bodyIndex += 1;
            continue;
          }
          const key = keyMatch[0];
          bodyIndex += key.length;
          while (/\s/.test(body[bodyIndex] || "")) bodyIndex += 1;
          if (body[bodyIndex] !== ":") continue;
          keys.push(key);
          bodyIndex += 1;
          let valueDepth = 0;
          let valueQuote = "";
          let valueEscaped = false;
          while (bodyIndex < body.length) {
            const valueChar = body[bodyIndex];
            if (valueQuote) {
              if (valueEscaped) {
                valueEscaped = false;
              } else if (valueChar === "\\") {
                valueEscaped = true;
              } else if (valueChar === valueQuote) {
                valueQuote = "";
              }
              bodyIndex += 1;
              continue;
            }
            if (valueChar === "\"" || valueChar === "'" || valueChar === "`") {
              valueQuote = valueChar;
              bodyIndex += 1;
              continue;
            }
            if (valueChar === "{" || valueChar === "[" || valueChar === "(") valueDepth += 1;
            if (valueChar === "}" || valueChar === "]" || valueChar === ")") valueDepth -= 1;
            if (valueChar === "," && valueDepth === 0) {
              bodyIndex += 1;
              break;
            }
            bodyIndex += 1;
          }
        }
        return keys;
      }
    }
  }
  throw new Error(`${objectName}_unterminated`);
}

const issues = __catalogTest.workerCatalogContractIssues();
assert(issues.length === 0, `worker_catalog_contract_issues=${JSON.stringify(issues)}`);

const workers = __catalogTest.WORKERS;
const jobKinds = __catalogTest.JOB_KINDS;
const productCatalog = __catalogTest.adminProductCatalog();
const publicWorkers = Object.values(workers).map(__catalogTest.publicWorker);
const publicJobKinds = Object.entries(jobKinds).map(([kind, config]) => __catalogTest.publicJobKind(kind, config));

assert(publicWorkers.some((worker) => worker.staff_code === "songi" && worker.job_kind === "songi_research"), "songi_worker_job_kind_missing");
assert(publicJobKinds.some((jobKind) => jobKind.kind === "songi_research" && jobKind.api_mode === "research_api" && jobKind.queue === false), "songi_job_kind_contract_missing");
assert(publicJobKinds.some((jobKind) => jobKind.kind === "yunmi_script" && jobKind.execution === "web_module"), "yunmi_job_kind_contract_missing");
assert(productCatalog.some((product) => product.product === "songi" && product.job_kinds.includes("songi_research")), "songi_product_job_kind_missing");
assert(productCatalog.every((product) => (product.job_kinds || []).every((kind) => jobKinds[kind])), "product_catalog_unknown_job_kind");

const appHtml = fs.readFileSync("oracle/aimax-reports-api/static/app.html", "utf8");
const appJobKindKeys = extractObjectKeys(appHtml, "jobKinds");
const serverJobKindKeys = Object.keys(jobKinds);

for (const kind of appJobKindKeys) {
  assert(serverJobKindKeys.includes(kind), `app_job_kind_not_in_server_catalog:${kind}`);
}
for (const kind of serverJobKindKeys) {
  const config = jobKinds[kind];
  const worker = workers[config.workerCode];
  if (worker?.jobKind) assert(appJobKindKeys.includes(kind), `server_job_kind_not_in_app_fallback:${kind}`);
}

console.log("WORKER_CATALOG_CONTRACT_SMOKE_OK");
