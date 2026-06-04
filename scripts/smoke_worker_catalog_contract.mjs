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
assert(publicJobKinds.some((jobKind) => jobKind.kind === "sangsu_quote" && jobKind.api_mode === "client_only" && jobKind.queue === false), "sangsu_job_kind_contract_missing");
assert(productCatalog.some((product) => product.product === "songi" && product.job_kinds.includes("songi_research")), "songi_product_job_kind_missing");
assert(productCatalog.some((product) => product.product === "yunmi" && product.price_won === 9900 && product.job_kinds.includes("yunmi_script")), "yunmi_product_catalog_missing");
assert(productCatalog.some((product) => product.product === "jieun" && product.price_won === 5500), "jieun_product_catalog_missing");
assert(productCatalog.some((product) => product.product === "nakyung" && product.price_won === 9900), "nakyung_product_catalog_missing");
assert(productCatalog.some((product) => product.product === "hyojin" && product.price_won === 33000), "hyojin_product_catalog_missing");
assert(productCatalog.some((product) => product.product === "sangsu" && product.job_kinds.includes("sangsu_quote")), "sangsu_product_job_kind_missing");
assert(productCatalog.every((product) => (product.job_kinds || []).every((kind) => jobKinds[kind])), "product_catalog_unknown_job_kind");
const sangsu = publicWorkers.find((worker) => worker.staff_code === "sangsu");
assert(sangsu?.name === "상수", "sangsu_worker_name_missing");
assert(sangsu?.role === "경리", "sangsu_worker_role_missing");
assert(sangsu?.execution === "web_module", "sangsu_execution_contract_missing");
assert(sangsu?.product === "sangsu", "sangsu_product_contract_missing");
assert(sangsu?.profile_image === "/assets/avatar_sangsu.jpg", "sangsu_profile_image_missing");
assert(__catalogTest.productList("bundle").includes("sangsu"), "bundle_should_include_sangsu_product");
assert(__catalogTest.productList("bundle").includes("yunmi"), "bundle_should_include_yunmi_product");
assert(__catalogTest.productList("bundle").includes("jieun"), "bundle_should_include_jieun_product");
assert(__catalogTest.productList("blog_team").includes("yeri") && __catalogTest.productList("blog_team").includes("hyunju"), "blog_team_product_list_missing");
const bundleOnlyUser = { status: "active", entitlements: { product: "bundle", products: ["bundle"], status: "active", source: "test" } };
assert(__catalogTest.isJobAllowed(bundleOnlyUser, "sangsu_quote"), "bundle_should_allow_sangsu_quote");
assert(__catalogTest.isJobAllowed(bundleOnlyUser, "yunmi_script"), "bundle_should_allow_yunmi_script");
const yunmiUser = { status: "active", entitlements: { product: "yunmi", products: ["yunmi"], status: "active", source: "test" } };
assert(__catalogTest.isJobAllowed(yunmiUser, "yunmi_script"), "yunmi_product_should_allow_yunmi_script");
const bundleUser = { entitlements: { product: "bundle", products: ["yeri", "hyunju", "songi", "yunmi", "blog_team", "bundle"], status: "active", source: "test" } };
__catalogTest.grantProductToUser(bundleUser, "sangsu", "2026-06-01T00:00:00.000Z", "test");
assert(bundleUser.entitlements.product === "bundle", "grant_sangsu_should_keep_bundle_primary");
assert(bundleUser.entitlements.products.includes("bundle"), "grant_sangsu_should_keep_bundle");
assert(bundleUser.entitlements.products.includes("sangsu"), "grant_sangsu_should_add_sangsu");
const jieun = publicWorkers.find((worker) => worker.staff_code === "jieun");
assert(jieun?.name === "지은", "jieun_worker_name_missing");
assert(jieun?.role === "AI 오피스 지원", "jieun_worker_role_missing");
assert(jieun?.execution === "external_download", "jieun_execution_contract_missing");
assert(jieun?.product === "jieun", "jieun_product_contract_missing");
assert(!jieun?.access_policy, "jieun_should_not_be_public_after_paid_launch");
assert(jieun?.supported_platforms?.includes("windows"), "jieun_windows_only_missing");
assert(jieun?.version === "0.1.5", "jieun_version_missing");
assert(jieun?.setup_download_url === "https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.5.exe", "jieun_setup_download_missing");
assert(jieun?.capabilities?.includes("캡처 이미지 모자이크"), "jieun_mosaic_capability_missing");
assert(jieun?.profile_image === "/assets/avatar_jieun.jpg", "jieun_profile_image_missing");
const nakyung = publicWorkers.find((worker) => worker.staff_code === "nakyung");
assert(nakyung?.name === "나경", "nakyung_worker_name_missing");
assert(nakyung?.role === "판서", "nakyung_worker_role_missing");
assert(nakyung?.execution === "external_download", "nakyung_execution_contract_missing");
assert(nakyung?.product === "nakyung", "nakyung_product_contract_missing");
assert(!nakyung?.access_policy, "nakyung_should_not_be_public_after_paid_launch");
assert(nakyung?.supported_platforms?.includes("windows"), "nakyung_windows_only_missing");
assert(nakyung?.setup_download_url === "https://api.aimax.ai.kr/downloads/Pencil-Setup-1.0.0.exe", "nakyung_setup_download_missing");
assert(nakyung?.profile_image === "/assets/avatar_nakyung.jpg", "nakyung_profile_image_missing");

const appHtml = fs.readFileSync("oracle/aimax-reports-api/static/app.html", "utf8");
const appJobKindKeys = extractObjectKeys(appHtml, "jobKinds");
const serverJobKindKeys = Object.keys(jobKinds);
assert(appHtml.includes("function staffCatalogEmployees()"), "staff_catalog_employees_helper_missing");
assert(appHtml.includes("return staffCatalogEmployees().map(({ key, employee }) => [key, employee]).filter"), "staff_filter_should_use_full_catalog");
assert(appHtml.includes("const entries = staffCatalogEmployees().map(({ key, employee }) => [key, employee]);"), "staff_counts_should_use_full_catalog");
assert(appHtml.includes("sangsuClientEmail"), "sangsu_client_email_field_missing");

for (const kind of appJobKindKeys) {
  assert(serverJobKindKeys.includes(kind), `app_job_kind_not_in_server_catalog:${kind}`);
}
for (const kind of serverJobKindKeys) {
  const config = jobKinds[kind];
  const worker = workers[config.workerCode];
  if (worker?.jobKind) assert(appJobKindKeys.includes(kind), `server_job_kind_not_in_app_fallback:${kind}`);
}

console.log("WORKER_CATALOG_CONTRACT_SMOKE_OK");
