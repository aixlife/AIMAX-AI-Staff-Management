import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-automation-tickets-"));
process.env.AIMAX_REPORT_DATA_DIR = tmpRoot;
process.env.AIMAX_REPORT_TOKEN = "smoke-token";
process.env.AIMAX_ADMIN_SECRET = "smoke-admin-secret";

const require = createRequire(import.meta.url);
const { __automationTest } = require("../oracle/aimax-reports-api/server.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const storedAt = "2026-06-17T03:30:00.000Z";
  const report = {
    report_id: "AIMAX-RPT-20260617033000-smoke",
    source: "smoke",
    account: {
      email: "tester@example.com",
      product: "aimax-bundle",
    },
    user_input: {
      work_context: "예리 임시저장 테스트",
      visible_error: "Smart Editor 확인 버튼을 찾지 못했습니다.",
    },
    system: {
      app: { version: "v1.0.52" },
      runtime: { system: "Windows" },
      agent: {
        jobs_recent: [
          {
            id: "job-smoke-1",
            kind: "yeri_write",
            worker_code: "yeri_writer",
            status: "failed",
            failed_stage: "smart_editor_publish",
          },
        ],
      },
    },
    support: {
      status: "new",
      updated_at: storedAt,
    },
  };
  const ticket = __automationTest.buildAutomationTicketForReport(report, storedAt, storedAt.slice(0, 10));
  assert(ticket.ticket_id.startsWith("AIMAX-AUTO-20260617033000-"), "ticket_id_prefix_mismatch");
  assert(ticket.category === "naver_editor", "ticket_category_mismatch");
  assert(ticket.priority === "normal", "ticket_priority_mismatch");
  assert(ticket.report_id === report.report_id, "ticket_report_id_mismatch");
  assert(!JSON.stringify(ticket).includes("smoke-token"), "ticket_leaks_token");
  __automationTest.appendAutomationTicket(ticket);
  const tickets = __automationTest.loadAutomationTickets();
  assert(tickets.length === 1, "ticket_not_persisted");
  report.support.automation_ticket_id = ticket.ticket_id;
  const telegramText = __automationTest.telegramReportAlertText(report, storedAt);
  assert(telegramText.includes(ticket.ticket_id), "telegram_alert_missing_ticket_id");
  console.log("AUTOMATION_TICKETS_SMOKE_OK");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
