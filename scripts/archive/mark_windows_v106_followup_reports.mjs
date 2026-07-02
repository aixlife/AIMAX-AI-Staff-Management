#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v106-followup`;

const changes = {
  "AIMAX-RPT-20260518071933-5e3b43e6": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "Windows가 기존 AIMAX 실행 파일을 사용 중이라 업데이트 설치 파일이 교체하지 못한 상태로 보입니다. AIMAX 창을 모두 닫고, 작업 관리자에서 AIMAX 또는 aimax-agent-launcher가 남아 있으면 종료한 뒤 웹앱 업데이트 탭에서 AIMAX 통합 Windows 설치 파일을 다시 실행해주세요.",
    next_update_message: "같은 `deletefile 실패: 코드 5`가 반복되면 이 화면에서 '아직 안 돼요'를 눌러주세요. 설치기가 실행 중인 AIMAX를 더 부드럽게 종료하도록 후속 보강하겠습니다.",
  },
  "AIMAX-RPT-20260518072529-c4524800": {
    status: "reviewing",
    status_label: "확인 중",
    public_message: "글 생성 단계에서 실패한 것으로 확인했습니다. 기록상 토큰 사용량과 이미지 생성량은 0으로 남아 있어 자동 재시도는 하지 않겠습니다.",
    next_update_message: "AI 모델/API 응답 원인을 더 정확히 남기도록 오류 보고 진단을 보강했습니다. 비용이 발생할 수 있으니 운영 확인 전에는 같은 작업을 여러 번 반복하지 말고, 필요하면 키워드 1개와 임시저장으로만 확인해주세요.",
  },
  "AIMAX-RPT-20260518072833-17cb362a": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "로컬 실행기가 네이버 로그인 단계에서 120초 동안 응답하지 않아 작업이 중단된 상태입니다. AIMAX와 열린 네이버/Chrome 창을 모두 닫고 실행기를 다시 연결한 뒤, 먼저 키워드 1개로 임시저장을 확인해주세요.",
    next_update_message: "다시 연결 후에도 `localhost:8669 Read timed out`이 반복되면 이 화면에서 '아직 안 돼요'를 눌러주세요. 실행기 재시작/브라우저 복구 흐름까지 이어서 보강하겠습니다.",
  },
  "AIMAX-RPT-20260518072852-330b6ff3": {
    status: "reviewing",
    status_label: "확인 중",
    public_message: "같은 글 생성 단계 실패로 묶어서 확인 중입니다. 기록상 토큰 사용량과 이미지 생성량은 0으로 남아 있어 자동 재시도는 하지 않겠습니다.",
    next_update_message: "AI 모델/API 응답 원인을 더 정확히 남기도록 오류 보고 진단을 보강했습니다. 비용이 발생할 수 있으니 운영 확인 전에는 같은 작업을 여러 번 반복하지 말고, 필요하면 키워드 1개와 임시저장으로만 확인해주세요.",
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

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`missing report index: ${INDEX_PATH}`);
}

const updatedAt = new Date().toISOString();
const backups = [copyBackup(INDEX_PATH)];
const rows = readRows();
const touched = [];

const nextRows = rows.map((row) => {
  const change = changes[row.report_id];
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
    public_message: next.public_message,
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
