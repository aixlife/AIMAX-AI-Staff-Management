#!/usr/bin/env node
// 스모크: 같은 사람이 같은 오류로 다시 보내면 새 보고·티켓·알림을 만들지 않는지 검증한다.
//
// 배경 (2026-08-18): 사용자에게는 "같은 오류를 다시 보내지 않아도 됩니다"라고 안내해 왔지만
// 접수 쪽에는 강제 장치가 없었다. 5번 누르면 리포트 5건 + 자동화 티켓 5건 + 텔레그램 5건이
// 생긴다. 실측: 전체 162건 중 11건(7%)이 24시간 내 반복, 최다 3회.
// 이 중복이 열린 티켓 수를 부풀려 감시·수리 에이전트 노이즈까지 키웠다.
//
// 계약: 억제하되 삼키지 않는다 — 원본에 repeat_count 를 쌓아 "또 났다"는 신호는 남긴다.
//
// 실행: node scripts/smoke_report_duplicate_suppression.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-dedup-smoke-"));
fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");

process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;

const require = createRequire(import.meta.url);
const server = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
const t = server.__automationTest;
const { findOpenDuplicateReport, reportDuplicateSignature, summaryFor } = t;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
    console.log(`  PASS  ${name}  (=${actual})`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}  expected=${expected} actual=${actual}`);
  }
}

const indexPath = path.join(tmpDir, "reports-index.jsonl");
const reportsDir = path.join(tmpDir, "reports");

function makeReport(overrides = {}) {
  return {
    source: "aimax-webapp",
    report_kind: "error",
    account: { user_id: "user-dup", email: "a***@naver.com" },
    user_input: {
      work_context: "예리 글쓰기 중",
      visible_error: "로그인 버튼을 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다.",
      user_note: "",
    },
    ...overrides,
  };
}

// 원본 1건을 인덱스/상세에 심는다 (handleReport 가 하는 것과 같은 모양).
function seedReport(reportId, storedAt, status, report) {
  const dateKey = storedAt.slice(0, 10);
  const detail = {
    ...report,
    report_id: reportId,
    server_received_at: storedAt,
    support: {
      status,
      status_label: "접수됨",
      public_message: "오류 보고가 접수되었습니다.",
      next_update_message: "영업시간 기준 24시간 안에 확인합니다.",
      updated_at: storedAt,
      automation_ticket_id: "AIMAX-AUTO-SEED",
      duplicate_signature: reportDuplicateSignature({ ...report, report_id: reportId }),
    },
  };
  fs.mkdirSync(path.join(reportsDir, dateKey), { recursive: true });
  fs.writeFileSync(path.join(reportsDir, dateKey, `${reportId}.json`), JSON.stringify(detail, null, 2), "utf8");
  fs.appendFileSync(indexPath, `${JSON.stringify(summaryFor(detail, storedAt, dateKey))}\n`, "utf8");
  return detail;
}

const now = new Date();
const recent = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
const old = new Date(now.getTime() - 40 * 60 * 60 * 1000).toISOString();

console.log("[1] 같은 서명은 안정적이고, 다른 오류는 다른 서명이다");
const base = makeReport();
check("같은 입력 → 같은 서명", reportDuplicateSignature(base) === reportDuplicateSignature(makeReport()), true);
const other = makeReport({ user_input: { work_context: "예리 글쓰기 중", visible_error: "전혀 다른 오류", user_note: "" } });
check("다른 오류 → 다른 서명", reportDuplicateSignature(base) === reportDuplicateSignature(other), false);
const otherUser = makeReport({ account: { user_id: "user-other", email: "b***@naver.com" } });
check("다른 사용자 → 다른 서명", reportDuplicateSignature(base) === reportDuplicateSignature(otherUser), false);

console.log("[2] 24시간 안의 열린 보고와 같으면 중복으로 잡는다");
seedReport("AIMAX-RPT-SEED-1", recent, "new", makeReport());
const dup = findOpenDuplicateReport(makeReport(), Date.now());
check("중복 발견", dup?.report_id, "AIMAX-RPT-SEED-1");

console.log("[3] 다른 오류·다른 사용자는 중복이 아니다");
check("다른 오류", findOpenDuplicateReport(other, Date.now()), null);
check("다른 사용자", findOpenDuplicateReport(otherUser, Date.now()), null);

console.log("[4] 24시간이 지나면 새 보고로 받는다");
fs.writeFileSync(indexPath, "", "utf8");
seedReport("AIMAX-RPT-SEED-OLD", old, "new", makeReport());
check("창 밖 → 중복 아님", findOpenDuplicateReport(makeReport(), Date.now()), null);

console.log("[5] 이미 종결된 건과 같은 증상이면 재발 — 새 보고로 받는다");
fs.writeFileSync(indexPath, "", "utf8");
seedReport("AIMAX-RPT-SEED-DONE", recent, "done", makeReport());
check("done → 중복 아님", findOpenDuplicateReport(makeReport(), Date.now()), null);

console.log("[6] 반복 횟수는 원본에 쌓인다 (억제하되 삼키지 않는다)");
fs.writeFileSync(indexPath, "", "utf8");
seedReport("AIMAX-RPT-SEED-2", recent, "reviewing", makeReport());
let row = findOpenDuplicateReport(makeReport(), Date.now());
check("열린 reviewing 도 중복으로 잡음", row?.report_id, "AIMAX-RPT-SEED-2");
const after1 = t.recordReportRepeat(row, new Date().toISOString());
check("1회 반복 기록", after1.repeat_count, 1);
const after2 = t.recordReportRepeat(findOpenDuplicateReport(makeReport(), Date.now()), new Date().toISOString());
check("2회 반복 누적", after2.repeat_count, 2);
const rows = fs.readFileSync(indexPath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("인덱스 행은 여전히 1건 (새 보고 안 만듦)", rows.length, 1);
check("인덱스에 반복 횟수 반영", rows[0].repeat_count, 2);

console.log(`\n결과: PASS ${passed} / FAIL ${failed}`);
fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
