#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const appHtmlPath = path.join(repoRoot, "oracle", "aimax-reports-api", "static", "app.html");
const html = fs.readFileSync(appHtmlPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  /<select id="yeriWordCount">[\s\S]*<option value="300">300자<\/option>/.test(html),
  "yeri_300_word_option_missing",
);

assert(
  /word_count:\s*Number\(\$\(("#yeriWordCount"|'#yeriWordCount')\)\??\.value\s*\|\|\s*1500\)/.test(html),
  "yeri_submit_must_use_visible_word_count_select",
);

assert(
  /function jobBlockReason\(kind\)[\s\S]*!state\.agent\?\.agent\?\.connected[\s\S]*로컬 실행기 연결 후 사용할 수 있습니다/.test(html),
  "yeri_disabled_reason_must_explain_agent_connection",
);

assert(
  /function setJobFormEnabled\(config,\s*enabled\)[\s\S]*item\.disabled\s*=\s*!enabled/.test(html),
  "job_form_enabled_contract_missing",
);

assert(
  /localAgentJobTarget\(kind\)[\s\S]*target_platform[\s\S]*target_device_label/.test(html),
  "local_agent_job_target_contract_missing",
);

console.log("YERI_WEB_USER_FLOW_CONTRACT_OK");
