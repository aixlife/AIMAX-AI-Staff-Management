#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v108-openai-hotfix`;

const OPENAI_HOTFIX_REPORT_ID = "AIMAX-RPT-20260518095126-d9a35540";

const openAiHotfixChange = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "Windows 실행기 v1.0.8 핫픽스를 배포했습니다. OpenAI GPT-5.4 mini 글 생성 실패를 일으키던 호출 설정값을 수정했으니, 업데이트 탭에서 최신 Windows 설치 파일을 받아 설치한 뒤 키워드 1개와 임시저장으로 먼저 확인해주세요.",
  next_update_message: "업데이트 후에도 같은 글 생성 실패가 반복되면 이 화면에서 '아직 안 돼요'를 눌러주세요. 새 오류 보고에는 provider/model/status/request id/토큰 사용량이 함께 들어와 운영팀이 바로 이어서 확인할 수 있습니다.",
};

function readRows() {
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

function normalizeV108Message(text) {
  return String(text || "").replaceAll("v1.0.7", "v1.0.8");
}

function changeForRow(row) {
  if (row.report_id === OPENAI_HOTFIX_REPORT_ID) return openAiHotfixChange;

  if (row.status !== "waiting_user") return null;

  const publicMessage = normalizeV108Message(row.public_message);
  const nextUpdateMessage = normalizeV108Message(row.next_update_message);
  if (publicMessage === (row.public_message || "") && nextUpdateMessage === (row.next_update_message || "")) {
    return null;
  }

  return {
    status: "waiting_user",
    status_label: row.status_label || "사용자 확인 필요",
    public_message: publicMessage,
    next_update_message: nextUpdateMessage,
  };
}

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`missing report index: ${INDEX_PATH}`);
}

const updatedAt = new Date().toISOString();
const rows = readRows();
const backups = [copyBackup(INDEX_PATH)];
const touched = [];

const nextRows = rows.map((row) => {
  const change = changeForRow(row);
  if (!change) return row;

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

  touched.push({
    report_id: row.report_id,
    previous_status: row.status,
    next_status: next.status,
  });
  return next;
});

writeRows(nextRows);

console.log(JSON.stringify({
  ok: true,
  updated_at: updatedAt,
  updated_count: touched.length,
  backups: backups.filter(Boolean),
  touched,
}, null, 2));
