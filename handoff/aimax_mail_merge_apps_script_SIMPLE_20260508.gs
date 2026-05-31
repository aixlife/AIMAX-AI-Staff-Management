var MAX_SEND_PER_RUN = 40;
var SLEEP_MS_BETWEEN_SENDS = 700;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("AIMAX 발송")
    .addItem("1. 발송 상태 열 만들기", "prepareAimaxSheet")
    .addItem("2. 첫 행 테스트를 내 메일로 보내기", "sendAimaxTestToMe")
    .addItem("3. 미발송 안내 메일 보내기", "sendPendingAimaxEmails")
    .addToUi();
}

function prepareAimaxSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  ensureColumns(sheet);
  SpreadsheetApp.getUi().alert("발송 상태 열 준비 완료");
}

function sendAimaxTestToMe() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = ensureColumns(sheet);
  var row = findFirstPendingRow(sheet, headers);
  if (!row) {
    SpreadsheetApp.getUi().alert("미발송 행이 없습니다.");
    return;
  }
  var item = readRow(sheet, row, headers);
  var me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, "[테스트] " + item.subject, item.body + "\n\n---\n실제 수신자: " + item.to);
  SpreadsheetApp.getUi().alert("테스트 메일을 " + me + " 주소로 보냈습니다.");
}

function sendPendingAimaxEmails() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = ensureColumns(sheet);
  var lastRow = sheet.getLastRow();
  var sent = 0;
  var skipped = 0;
  var failed = 0;

  for (var row = 2; row <= lastRow; row++) {
    if (sent >= MAX_SEND_PER_RUN) break;
    var item = readRow(sheet, row, headers);
    if (!item.to || !item.subject || !item.body) {
      skipped++;
      writeStatus(sheet, row, headers, "skipped", "", "to/subject/body 중 빈 값이 있습니다.");
      continue;
    }
    if (item.status === "sent" || item.sentAt) {
      skipped++;
      continue;
    }
    try {
      GmailApp.sendEmail(item.to, item.subject, item.body);
      writeStatus(sheet, row, headers, "sent", new Date(), "");
      sent++;
      Utilities.sleep(SLEEP_MS_BETWEEN_SENDS);
    } catch (e) {
      failed++;
      writeStatus(sheet, row, headers, "failed", "", e.message || String(e));
    }
  }

  SpreadsheetApp.getUi().alert("이번 실행 발송: " + sent + "건\n건너뜀: " + skipped + "건\n실패: " + failed + "건");
}

function ensureColumns(sheet) {
  var headers = getHeaders(sheet);
  requireHeader(headers, "to");
  requireHeader(headers, "subject");
  requireHeader(headers, "body");
  headers = addHeaderIfMissing(sheet, headers, "send_status");
  headers = addHeaderIfMissing(sheet, headers, "sent_at");
  headers = addHeaderIfMissing(sheet, headers, "send_error");
  return headers;
}

function getHeaders(sheet) {
  var values = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headers = {};
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i] || "").trim();
    if (key) headers[key] = i + 1;
  }
  return headers;
}

function requireHeader(headers, name) {
  if (!headers[name]) throw new Error("필수 열이 없습니다: " + name);
}

function addHeaderIfMissing(sheet, headers, name) {
  if (!headers[name]) {
    var col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(name);
    headers[name] = col;
  }
  return headers;
}

function findFirstPendingRow(sheet, headers) {
  for (var row = 2; row <= sheet.getLastRow(); row++) {
    var item = readRow(sheet, row, headers);
    if (item.to && item.subject && item.body && item.status !== "sent" && !item.sentAt) return row;
  }
  return null;
}

function readRow(sheet, row, headers) {
  return {
    to: String(sheet.getRange(row, headers.to).getValue() || "").trim(),
    subject: String(sheet.getRange(row, headers.subject).getValue() || "").trim(),
    body: String(sheet.getRange(row, headers.body).getValue() || "").trim(),
    status: String(sheet.getRange(row, headers.send_status).getValue() || "").trim(),
    sentAt: String(sheet.getRange(row, headers.sent_at).getValue() || "").trim()
  };
}

function writeStatus(sheet, row, headers, status, sentAt, error) {
  sheet.getRange(row, headers.send_status).setValue(status);
  sheet.getRange(row, headers.sent_at).setValue(sentAt || "");
  sheet.getRange(row, headers.send_error).setValue(error || "");
}
