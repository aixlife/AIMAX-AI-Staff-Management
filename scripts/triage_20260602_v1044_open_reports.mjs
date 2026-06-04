#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

const STATUS = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
};

const MESSAGES = {
  update: {
    public_message:
      "Windows 실행기 v1.0.44 배포로 업데이트, 실행기 연결, 로컬 설정, AI/API 키 인식 경로가 보강되었습니다. 이 접수는 최신 설치 후 사용자 확인 단계로 넘깁니다.",
    next_update_message:
      "웹앱을 새로고침한 뒤 업데이트 탭에서 AIMAX 통합 Windows 설치 파일을 새로 받아 설치해주세요. 설치 전 AIMAX와 열린 Chrome/Whale/Naver 창을 모두 닫고, 설치 후 실행기를 다시 연결한 다음 웹 설정 > AI/API 연결에서 키 상태를 확인하거나 다시 저장해주세요. 같은 현상이 계속되면 이 화면에서 \"아직 안 돼요\"를 눌러주세요.",
  },
  windows10_spec: {
    public_message:
      "공유해주신 Windows 10 x64 PC 사양은 AIMAX Windows 통합 실행기 지원 대상입니다. v1.0.44 배포로 설치, 연결, 버전 인식 보강이 반영됐고 장치 사양 자체가 차단 원인으로 보이지 않습니다.",
    next_update_message:
      "업데이트 탭에서 최신 Windows 설치 파일을 다시 받은 뒤 AIMAX와 브라우저를 모두 닫고 설치해주세요. SmartScreen이 나오면 추가 정보 > 실행을 선택하고, 설치 후 실행기를 다시 연결해주세요. 설치 버튼이 바로 닫히거나 버전이 계속 비어 있으면 \"아직 안 돼요\"로 알려주세요.",
  },
  queued_or_draft: {
    public_message:
      "Windows 실행기 v1.0.44 배포로 v1.0.41에서 보였던 작업 시작 지연, 제목 입력, 임시저장 완료 판단 문제가 보강되었습니다. 운영 설치파일과 버전 API 모두 최신 상태로 확인했습니다.",
    next_update_message:
      "업데이트 탭에서 v1.0.44를 설치한 뒤 실행기를 다시 연결하고 키워드 1개, 이미지 0장, 임시저장으로만 확인해주세요. 실패하면 같은 유료 작업을 반복 제출하지 말고 이 화면에서 \"아직 안 돼요\"를 눌러주세요.",
  },
  api_key: {
    public_message:
      "v1.0.44 기준으로 확인된 증상은 실행기 설치 오류가 아니라 AI 제공자 API 키, 모델 권한, 사용량 한도 확인이 필요한 상태입니다. 운영 서버와 Windows 실행기 배포 상태는 정상입니다.",
    next_update_message:
      "웹 설정 > AI/API 연결에서 해당 제공자의 키, 모델 접근 권한, 결제/사용량 한도를 확인하고 키를 다시 저장한 뒤 새 작업으로 1건만 재시도해주세요. 같은 유료 작업은 반복 제출하지 말고 실패하면 이 화면에서 \"아직 안 돼요\"를 눌러주세요.",
  },
};

const TARGETS = {
  "AIMAX-RPT-20260529074031-53cbc6d0": "update",
  "AIMAX-RPT-20260529081248-555fe992": "update",
  "AIMAX-RPT-20260601030134-c79e257d": "update",
  "AIMAX-RPT-20260601033553-b926a183": "update",
  "AIMAX-RPT-20260601050219-bdb0a185": "update",
  "AIMAX-RPT-20260601050435-cb74d59b": "windows10_spec",
  "AIMAX-RPT-20260601074107-3760c7b0": "update",
  "AIMAX-RPT-20260601092614-a971168e": "update",
  "AIMAX-RPT-20260601143901-e5cd40f5": "api_key",
  "AIMAX-RPT-20260601145545-8b47e0df": "api_key",
  "AIMAX-RPT-20260601180431-9e5f513b": "queued_or_draft",
  "AIMAX-RPT-20260602004804-e8e6a477": "api_key",
  "AIMAX-RPT-20260602031649-143536d2": "api_key",
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

function openCounts(rows) {
  const counts = {};
  for (const row of rows) {
    const key = row.status || "";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function main() {
  const updatedAt = utcNow();
  const suffix = `.bak-${updatedAt.replace(/[-:TZ.]/g, "").slice(0, 14)}-v1044-open-report-triage`;
  const rows = readRows();
  const beforeCounts = openCounts(rows);
  const backups = [];
  const touched = [];
  const missing = [];
  const targetIds = new Set(Object.keys(TARGETS));

  backup(INDEX_PATH, suffix, backups);

  for (const row of rows) {
    const category = TARGETS[row.report_id];
    if (!category) continue;
    targetIds.delete(row.report_id);
    const message = MESSAGES[category];
    const previousStatus = row.status || "";
    Object.assign(row, STATUS, message, { status_updated_at: updatedAt });

    const filePath = reportPath(row);
    if (filePath && fs.existsSync(filePath)) {
      backup(filePath, suffix, backups);
      if (!DRY_RUN) {
        const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
        report.support = {
          ...(report.support || {}),
          ...STATUS,
          ...message,
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
      category,
    });
  }

  for (const reportId of targetIds) missing.push(reportId);
  if (!DRY_RUN) writeRows(rows);

  const afterCounts = openCounts(rows);
  console.log(JSON.stringify({
    ok: missing.length === 0,
    dry_run: DRY_RUN,
    updated_at: updatedAt,
    before_counts: beforeCounts,
    after_counts: afterCounts,
    touched,
    missing,
    backups,
  }, null, 2));
}

main();
