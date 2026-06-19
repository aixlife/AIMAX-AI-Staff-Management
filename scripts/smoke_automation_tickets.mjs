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
  const guided = {
    report_id: "AIMAX-RPT-20260618090000-guided",
    source: "aimax-webapp",
    report_kind: "error",
    user_input: {
      work_context: "블로그 게시글 작성",
      visible_error: "ai모델 사용불가 단계 : 이미지 생성 image_paid_reauired",
    },
    support: { status: "new", updated_at: storedAt },
  };
  const guidance = __automationTest.applyReportAutoGuidance(guided, storedAt);
  assert(guidance, "auto_guidance_missing");
  assert(guided.support.status === "waiting_user", "auto_guidance_status_mismatch");
  assert(guided.support.auto_guidance_category === "image_paid_required", "auto_guidance_category_mismatch");
  assert(guided.support.public_message.includes("이미지 생성"), "auto_guidance_public_message_mismatch");
  const guidedTicket = __automationTest.buildAutomationTicketForReport(guided, storedAt, storedAt.slice(0, 10));
  assert(guidedTicket.category === "user_ai_provider", "guided_ticket_category_mismatch");
  assert(guidedTicket.status === "waiting_user", "guided_ticket_status_mismatch");
  const ticketUpdate = __automationTest.appendAutomationTicketStatusUpdate(guidedTicket.ticket_id, guided.report_id, guided.support.status, storedAt);
  assert(ticketUpdate.status === "waiting_user", "ticket_update_status_mismatch");
  assert(__automationTest.latestAutomationTickets().find((item) => item.ticket_id === guidedTicket.ticket_id)?.status === "waiting_user", "latest_ticket_status_mismatch");

  const transientReport = {
    report_id: "AIMAX-RPT-20260618122443-d8ccac1e",
    source: "aimax-webapp",
    account: {
      email: "tester@example.com",
      product: "yeri",
    },
    user_input: {
      work_context: "블로그",
      visible_error: "단계: content_generation server_generation_provider_transient",
      user_note: "단 한번도 발행이된적이 없네요.",
    },
    system: {
      app: { version: "v1.0.52" },
      runtime: { system: "Windows" },
      jobs_recent: [
        {
          id: "job-transient-1",
          kind: "yeri_write",
          worker_code: "yeri_writer",
          status: "failed",
          failed_stage: "content_generation",
          result: { error: "server_generation_provider_transient" },
        },
      ],
    },
    support: { status: "new", updated_at: storedAt },
  };
  __automationTest.applyReportAutoGuidance(transientReport, storedAt);
  const transientTicket = __automationTest.buildAutomationTicketForReport(transientReport, storedAt, storedAt.slice(0, 10));
  assert(transientTicket.category === "user_ai_provider", "transient_ticket_category_mismatch");
  assert(transientTicket.priority === "high", "never_published_priority_mismatch");
  assert(transientTicket.job_id === "job-transient-1", "system_jobs_recent_not_used");
  assert(transientTicket.job_stage === "content_generation", "system_jobs_recent_stage_not_used");
  console.log("AUTOMATION_TICKETS_SMOKE_OK");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
