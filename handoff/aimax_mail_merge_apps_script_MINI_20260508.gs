var MAX_SEND_PER_RUN = 40;
var SLEEP_MS = 700;
function onOpen() {
  SpreadsheetApp.getUi().createMenu("AIMAX 발송").addItem("1. 상태 열 만들기", "prepareAimaxSheet").addItem("2. 첫 행 테스트", "sendAimaxTestToMe").addItem("3. 미발송 보내기", "sendPendingAimaxEmails").addToUi();
}
function prepareAimaxSheet() {
  ensureHeaders(getSheet());
  SpreadsheetApp.getUi().alert("상태 열 준비 완료");
}
function sendAimaxTestToMe() {
  var sheet = getSheet(), h = ensureHeaders(sheet), row = firstPendingRow(sheet, h);
  if (!row) return SpreadsheetApp.getUi().alert("미발송 행이 없습니다.");
  var item = readItem(sheet, row, h), me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, "[테스트] " + item.subject, item.body + "\n\n---\n실제 수신자: " + item.to);
  SpreadsheetApp.getUi().alert("테스트 메일을 보냈습니다: " + me);
}
function sendPendingAimaxEmails() {
  var sheet = getSheet(), h = ensureHeaders(sheet), sent = 0, skipped = 0, failed = 0;
  for (var row = 2; row <= sheet.getLastRow(); row++) {
    if (sent >= MAX_SEND_PER_RUN) break;
    var item = readItem(sheet, row, h);
    if (!item.to || !item.subject || !item.body) {
      skipped++; writeResult(sheet, row, h, "skipped", "", "to/subject/body 중 빈 값"); continue;
    }
    if (item.status === "sent" || item.sentAt) {
      skipped++; continue;
    }
    try {
      GmailApp.sendEmail(item.to, item.subject, item.body);
      writeResult(sheet, row, h, "sent", new Date(), "");
      sent++; Utilities.sleep(SLEEP_MS);
    } catch (e) {
      failed++; writeResult(sheet, row, h, "failed", "", e.message || String(e));
    }
  }
  SpreadsheetApp.getUi().alert("발송 " + sent + "건\n건너뜀 " + skipped + "건\n실패 " + failed + "건");
}
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}
function ensureHeaders(sheet) {
  var h = headerMap(sheet);
  need(h, "to"); need(h, "subject"); need(h, "body");
  if (!h.send_status) h.send_status = addHeader(sheet, "send_status");
  if (!h.sent_at) h.sent_at = addHeader(sheet, "sent_at");
  if (!h.send_error) h.send_error = addHeader(sheet, "send_error");
  return h;
}
function headerMap(sheet) {
  var vals = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], h = {};
  for (var i = 0; i < vals.length; i++) {
    var key = String(vals[i] || "").trim();
    if (key) h[key] = i + 1;
  }
  return h;
}
function need(h, key) {
  if (!h[key]) throw new Error("필수 열이 없습니다: " + key);
}
function addHeader(sheet, name) {
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(name);
  return col;
}
function firstPendingRow(sheet, h) {
  for (var row = 2; row <= sheet.getLastRow(); row++) {
    var item = readItem(sheet, row, h);
    if (item.to && item.subject && item.body && item.status !== "sent" && !item.sentAt) return row;
  }
  return null;
}
function readItem(sheet, row, h) {
  return {to: cell(sheet, row, h.to), subject: cell(sheet, row, h.subject), body: cell(sheet, row, h.body), status: cell(sheet, row, h.send_status), sentAt: cell(sheet, row, h.sent_at)};
}
function cell(sheet, row, col) {
  return String(sheet.getRange(row, col).getValue() || "").trim();
}
function writeResult(sheet, row, h, status, sentAt, error) {
  sheet.getRange(row, h.send_status).setValue(status);
  sheet.getRange(row, h.sent_at).setValue(sentAt || "");
  sheet.getRange(row, h.send_error).setValue(error || "");
}
