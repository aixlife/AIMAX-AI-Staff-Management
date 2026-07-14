#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { __reportMailTest } = require("../oracle/aimax-reports-api/server.js");
const { buildWaitingUserReportMail, reportActionChecklist, waitingUserMailDesktopWorker } = __reportMailTest;

const maxMail = buildWaitingUserReportMail({
  status: "waiting_user",
  product: "maxalert",
  public_message: "최신 버전으로 다시 확인해주세요.",
});
assert.equal(waitingUserMailDesktopWorker({ product: "maxalert" })?.label, "맥스");
assert.match(maxMail.subject, /맥스/);
assert.match(maxMail.text, /맥스의 최신 설치 파일/);
assert.match(maxMail.text, /맥스 앱을 직접 실행/);
assert.doesNotMatch(maxMail.text, /로컬 실행기/);
assert.match(maxMail.text, /직원 채용 화면에서 '맥스' 카드를 선택/);
assert.doesNotMatch(maxMail.text, /aimax-bundle-windows\.exe/);

const bundleJieunMail = buildWaitingUserReportMail({
  status: "waiting_user",
  product: "bundle",
  work_context: "전체통합 계정에서 지은 직원 채용이 보이지 않습니다.",
  public_message: "지은 Mac 앱을 다시 확인해주세요.",
});
assert.equal(waitingUserMailDesktopWorker({
  product: "bundle",
  work_context: "지은 직원 채용이 보이지 않습니다.",
})?.label, "지은");
assert.match(bundleJieunMail.subject, /지은/);
assert.match(bundleJieunMail.text, /지은의 최신 설치 파일/);
assert.match(bundleJieunMail.text, /직원 채용 화면에서 '지은' 카드를 선택/);
assert.equal(waitingUserMailDesktopWorker({
  product: "bundle",
  work_context: "맥스 설치 후 앱이 열리지 않습니다.",
})?.label, "맥스");

const yeriMail = buildWaitingUserReportMail({
  status: "waiting_user",
  product: "yeri",
  job_kind: "yeri_write",
  public_message: "실행기 연결 상태를 확인해주세요.",
});
assert.equal(waitingUserMailDesktopWorker({ product: "yeri", job_kind: "yeri_write" }), null);
assert.equal(waitingUserMailDesktopWorker({
  product: "yeri",
  work_context: "AI가 지은 제목을 수정하고 싶습니다.",
}), null);
assert.match(yeriMail.text, /오류보고 탭에서 자세한 안내/);
assert.match(yeriMail.text, /다시 시도/);
assert.doesNotMatch(yeriMail.text, /최신 설치 파일을 다운로드해 다시 설치/);
assert.equal(reportActionChecklist({
  status: "waiting_user",
  product: "maxalert",
  work_context: "Windows 설치 후 맥스가 열리지 않습니다.",
})[0], "AIMAX 웹앱의 직원 채용 화면에서 '맥스' 카드를 선택합니다.");

console.log("PASS waiting_user mail product copy: desktop=2 runner=1");
