#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

const TARGETS = {
  "AIMAX-RPT-20260602070559-07666cf9": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message:
      "송이 Gemini 분석 실패 원인은 저장된 Gemini API 키가 Google에서 API_KEY_INVALID로 거부된 상태로 확인했습니다. 앱/실행기 문제가 아니며, 웹앱도 이제 이 오류를 'Gemini API 키가 유효하지 않음'으로 표시하도록 수정 및 배포했습니다.",
    next_update_message:
      "설정 > AI/API 연결에서 Gemini API 키를 새로 발급하거나 다시 복사해 저장한 뒤 송이 분석을 1건만 재시도해주세요. 같은 키로 계속 실패하면 반복 실행하지 말고 이 화면에서 '아직 안 돼요'로 알려주세요.",
  },
  "AIMAX-RPT-20260602071428-cb7806fa": {
    status: "done",
    status_label: "완료",
    public_message:
      "윤미 결과에 Instagram URL이 대본 대사로 섞인 원인을 확인해 수정 및 배포했습니다. URL만으로는 대본 내용을 추출하지 않고, 주제/목표/레퍼런스 메모가 있을 때만 생성하며 URL은 대사 근거로 사용하지 않게 했습니다.",
    next_update_message:
      "웹앱을 새로고침한 뒤 윤미에는 주제, 목표, 레퍼런스 메모를 함께 입력하거나 송이 분석 결과의 '윤미에게 넘기기' 흐름을 사용해주세요. 같은 문제가 다시 보이면 새 결과 화면과 함께 오류 보고를 보내주세요.",
  },
};

function utcNow() {
  return new Date().toISOString();
}

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

function backup(filePath, suffix, backups) {
  if (!filePath || !fs.existsSync(filePath) || DRY_RUN) return;
  const backupPath = `${filePath}${suffix}`;
  fs.copyFileSync(filePath, backupPath);
  backups.push(backupPath);
}

function countsByStatus(rows) {
  const counts = {};
  for (const row of rows) {
    const key = row.status || "";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function main() {
  const updatedAt = utcNow();
  const suffix = `.bak-${updatedAt.replace(/[-:TZ.]/g, "").slice(0, 14)}-api-key-yunmi-report-triage`;
  const rows = readRows();
  const beforeCounts = countsByStatus(rows);
  const backups = [];
  const touched = [];
  const missing = new Set(Object.keys(TARGETS));

  backup(INDEX_PATH, suffix, backups);

  for (const row of rows) {
    const next = TARGETS[row.report_id];
    if (!next) continue;
    missing.delete(row.report_id);
    const previousStatus = row.status || "";
    Object.assign(row, next, { status_updated_at: updatedAt });

    const filePath = reportPath(row);
    if (filePath && fs.existsSync(filePath)) {
      backup(filePath, suffix, backups);
      if (!DRY_RUN) {
        const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
        report.support = {
          ...(report.support || {}),
          ...next,
          updated_at: updatedAt,
        };
        const tmpPath = `${filePath}.tmp-${process.pid}`;
        fs.writeFileSync(tmpPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        fs.renameSync(tmpPath, filePath);
      }
    }

    touched.push({
      report_id: row.report_id,
      previous_status: previousStatus,
      next_status: row.status,
    });
  }

  if (!DRY_RUN) writeRows(rows);

  console.log(JSON.stringify({
    ok: missing.size === 0,
    dry_run: DRY_RUN,
    updated_at: updatedAt,
    before_counts: beforeCounts,
    after_counts: countsByStatus(rows),
    touched,
    missing: [...missing],
    backups,
  }, null, 2));
}

main();
