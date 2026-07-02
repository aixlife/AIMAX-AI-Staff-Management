#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const REPORT_ID = "AIMAX-RPT-20260520021900-587c9a8c";
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v109-editor-contract`;

const change = {
  status: "working",
  status_label: "조치 중",
  public_message: "오류 원인을 확인했습니다. v1.0.9 실행기 안에서 글 입력 함수와 이미지 처리 인자 계약이 맞지 않아, 글 생성은 성공했지만 네이버 에디터 본문 입력 단계에서 실패했습니다. 사용자 설정이나 Gemini Flash API 키 문제가 아니라 실행기 빌드 문제입니다.",
  next_update_message: "운영팀이 긴급 Windows 실행기 수정본을 준비 중입니다. 글 생성 비용이 다시 발생할 수 있으니 같은 키워드로 반복 실행하지 말고, 새 업데이트 안내가 뜰 때까지 기다려주세요.",
};

function readRows() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`missing report index: ${INDEX_PATH}`);
  return fs.readFileSync(INDEX_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeRows(rows) {
  const tmpPath = `${INDEX_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.renameSync(tmpPath, INDEX_PATH);
}

function reportPath(row) {
  const date = String(row.date || row.stored_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return path.join(REPORTS_DIR, date, `${row.report_id}.json`);
}

function copyBackup(filePath) {
  if (!fs.existsSync(filePath)) return "";
  const backupPath = `${filePath}${backupSuffix}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

const updatedAt = new Date().toISOString();
const rows = readRows();
const backups = [copyBackup(INDEX_PATH)];
let touched = null;

const nextRows = rows.map((row) => {
  if (row.report_id !== REPORT_ID) return row;
  const next = {
    ...row,
    ...change,
    status_updated_at: updatedAt,
  };
  const filePath = reportPath(row);
  if (filePath && fs.existsSync(filePath)) {
    backups.push(copyBackup(filePath));
    const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
    report.support = {
      ...(report.support || {}),
      ...change,
      updated_at: updatedAt,
    };
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  touched = {
    report_id: row.report_id,
    previous_status: row.status,
    next_status: next.status,
  };
  return next;
});

if (!touched) throw new Error(`report not found: ${REPORT_ID}`);
writeRows(nextRows);

console.log(JSON.stringify({
  ok: true,
  updated_at: updatedAt,
  backups: backups.filter(Boolean),
  touched,
}, null, 2));
