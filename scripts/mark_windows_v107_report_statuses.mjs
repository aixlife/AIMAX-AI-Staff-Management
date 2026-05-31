#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v107-status`;

const freshChanges = {
  "AIMAX-RPT-20260518071933-5e3b43e6": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "Windows 실행기 v1.0.7에서 설치 중 AIMAX가 실행 중일 때의 파일 잠김 안내를 보강했습니다. 웹앱 업데이트 탭에서 AIMAX 통합 Windows 설치 파일을 다시 받아 설치해주세요.",
    next_update_message: "설치 중 닫아야 할 AIMAX 프로세스가 있으면 한국어 안내가 표시됩니다. 안내대로 닫은 뒤 다시 설치해도 같은 오류가 반복되면 이 화면에서 '아직 안 돼요'를 눌러주세요.",
  },
  "AIMAX-RPT-20260518072529-c4524800": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "Windows 실행기 v1.0.7에서 AI 글 생성 실패 원인이 더 자세히 기록되도록 보강했습니다. 최신 설치 파일로 업데이트한 뒤 비용이 커지지 않게 키워드 1개와 임시저장으로만 먼저 확인해주세요.",
    next_update_message: "다시 실패하면 이 화면에서 '아직 안 돼요'를 눌러주세요. 다음 오류 보고에는 provider/model/status/request id/토큰 사용량이 함께 들어와 운영팀이 원인을 더 정확히 확인할 수 있습니다.",
  },
  "AIMAX-RPT-20260518072833-17cb362a": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "Windows 실행기 v1.0.7에서 로컬 실행기 `localhost:8669` 타임아웃 진단과 안내를 보강했습니다. 최신 설치 파일로 업데이트한 뒤 AIMAX와 열린 네이버/Chrome 창을 모두 닫고 실행기를 다시 연결해주세요.",
    next_update_message: "재연결 후 먼저 키워드 1개와 임시저장으로 확인해주세요. 같은 타임아웃이 반복되면 이 화면에서 '아직 안 돼요'를 눌러주세요.",
  },
  "AIMAX-RPT-20260518072852-330b6ff3": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "Windows 실행기 v1.0.7에서 AI 글 생성 실패 원인이 더 자세히 기록되도록 보강했습니다. 최신 설치 파일로 업데이트한 뒤 비용이 커지지 않게 키워드 1개와 임시저장으로만 먼저 확인해주세요.",
    next_update_message: "다시 실패하면 이 화면에서 '아직 안 돼요'를 눌러주세요. 다음 오류 보고에는 provider/model/status/request id/토큰 사용량이 함께 들어와 운영팀이 원인을 더 정확히 확인할 수 있습니다.",
  },
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

function normalizeMessage(text) {
  return String(text || "").replaceAll("v1.0.6", "v1.0.7");
}

function changeForRow(row) {
  if (freshChanges[row.report_id]) return freshChanges[row.report_id];
  const publicMessage = normalizeMessage(row.public_message);
  const nextUpdateMessage = normalizeMessage(row.next_update_message);
  if (publicMessage !== (row.public_message || "") || nextUpdateMessage !== (row.next_update_message || "")) {
    return {
      status: row.status || "waiting_user",
      status_label: row.status_label || "사용자 확인 필요",
      public_message: publicMessage,
      next_update_message: nextUpdateMessage,
    };
  }
  return null;
}

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`missing report index: ${INDEX_PATH}`);
}

const updatedAt = new Date().toISOString();
const backups = [copyBackup(INDEX_PATH)];
const rows = readRows();
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
      public_message: normalizeMessage(change.public_message),
      next_update_message: normalizeMessage(change.next_update_message),
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
