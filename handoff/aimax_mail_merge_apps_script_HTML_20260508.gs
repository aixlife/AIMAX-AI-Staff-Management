var MAX_SEND_PER_RUN = 40;
var SLEEP_MS = 700;
var EXPIRES_TEXT = "2026. 05. 15. 22:46";

function onOpen() {
  SpreadsheetApp.getUi().createMenu("AIMAX 발송")
    .addItem("1. 상태 열 만들기", "prepareAimaxSheet")
    .addItem("2. 첫 행 HTML 테스트", "sendAimaxTestToMe")
    .addItem("3. 미발송 HTML 보내기", "sendPendingAimaxEmails")
    .addToUi();
}

function prepareAimaxSheet() {
  ensureHeaders(getSheet());
  SpreadsheetApp.getUi().alert("상태 열 준비 완료");
}

function sendAimaxTestToMe() {
  var sheet = getSheet(), h = ensureHeaders(sheet), row = firstPendingRow(sheet, h);
  if (!row) return SpreadsheetApp.getUi().alert("미발송 행이 없습니다.");
  var item = readItem(sheet, row, h), me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, "[테스트] " + item.subject, plainBody(item), {htmlBody: htmlBody(item)});
  SpreadsheetApp.getUi().alert("HTML 테스트 메일을 보냈습니다: " + me);
}

function sendPendingAimaxEmails() {
  var sheet = getSheet(), h = ensureHeaders(sheet), sent = 0, skipped = 0, failed = 0;
  for (var row = 2; row <= sheet.getLastRow(); row++) {
    if (sent >= MAX_SEND_PER_RUN) break;
    var item = readItem(sheet, row, h);
    if (!item.to || !item.subject || !item.setupUrl) {
      skipped++; writeResult(sheet, row, h, "skipped", "", "to/subject/setup_url 중 빈 값"); continue;
    }
    if (item.status === "sent" || item.sentAt) {
      skipped++; continue;
    }
    try {
      GmailApp.sendEmail(item.to, item.subject, plainBody(item), {htmlBody: htmlBody(item)});
      writeResult(sheet, row, h, "sent", new Date(), "");
      sent++; Utilities.sleep(SLEEP_MS);
    } catch (e) {
      failed++; writeResult(sheet, row, h, "failed", "", e.message || String(e));
    }
  }
  SpreadsheetApp.getUi().alert("발송 " + sent + "건\n건너뜀 " + skipped + "건\n실패 " + failed + "건");
}

function plainBody(item) {
  return "AIMAX 이용 안내입니다.\n\n1. 먼저 아래 링크에서 비밀번호를 설정해주세요.\n" + item.setupUrl +
    "\n\n2. 비밀번호 설정 후 웹앱에 접속해주세요.\nhttps://api.aimax.ai.kr/app" +
    "\n\n3. 이메일: " + item.to +
    "\n4. 구매 상품: " + item.productLabel +
    "\n5. 설치 파일을 한 번 설치한 뒤, 웹앱에서 실행기 연결을 눌러주세요." +
    "\n\n설정 링크는 " + EXPIRES_TEXT + "까지 사용할 수 있으며, 한 번 사용하면 다시 사용할 수 없습니다." +
    "\n설치가 막히면 웹앱의 권한 허용 가이드를 순서대로 확인해주세요.";
}

function htmlBody(item) {
  var url = esc(item.setupUrl), email = esc(item.to), product = esc(item.productLabel);
  return '<div style="font-family:Arial,Apple SD Gothic Neo,Malgun Gothic,sans-serif;font-size:15px;line-height:1.75;color:#222;max-width:640px;">' +
    '<p style="margin:0 0 18px;">AIMAX 이용 안내입니다.</p>' +
    '<p style="margin:0 0 10px;"><strong>1. 먼저 아래 버튼에서 비밀번호를 설정해주세요.</strong></p>' +
    '<p style="margin:0 0 18px;"><a href="' + url + '" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:700;">비밀번호 설정하기</a></p>' +
    '<p style="margin:0 0 22px;color:#555;">버튼이 열리지 않으면 아래 링크를 복사해서 브라우저에 붙여넣어주세요.<br><a href="' + url + '" style="color:#0f766e;word-break:break-all;">' + url + '</a></p>' +
    '<p style="margin:0 0 8px;"><strong>2. 비밀번호 설정 후 웹앱에 접속해주세요.</strong><br><a href="https://api.aimax.ai.kr/app" style="color:#0f766e;">https://api.aimax.ai.kr/app</a></p>' +
    '<p style="margin:0 0 8px;"><strong>3. 이메일:</strong> ' + email + '</p>' +
    '<p style="margin:0 0 8px;"><strong>4. 구매 상품:</strong> ' + product + '</p>' +
    '<p style="margin:0 0 18px;"><strong>5.</strong> 설치 파일을 한 번 설치한 뒤, 웹앱에서 <strong>실행기 연결</strong>을 눌러주세요.</p>' +
    '<p style="margin:0 0 8px;color:#555;">설정 링크는 ' + esc(EXPIRES_TEXT) + '까지 사용할 수 있으며, 한 번 사용하면 다시 사용할 수 없습니다.</p>' +
    '<p style="margin:0;color:#555;">설치가 막히면 웹앱의 권한 허용 가이드를 순서대로 확인해주세요.</p>' +
    '</div>';
}

function getSheet() { return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; }
function ensureHeaders(sheet) {
  var h = headerMap(sheet);
  need(h, "to"); need(h, "subject"); need(h, "setup_url");
  if (!h.product_label) h.product_label = 0;
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
function need(h, key) { if (!h[key]) throw new Error("필수 열이 없습니다: " + key); }
function addHeader(sheet, name) {
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(name);
  return col;
}
function firstPendingRow(sheet, h) {
  for (var row = 2; row <= sheet.getLastRow(); row++) {
    var item = readItem(sheet, row, h);
    if (item.to && item.subject && item.setupUrl && item.status !== "sent" && !item.sentAt) return row;
  }
  return null;
}
function readItem(sheet, row, h) {
  return {to: cell(sheet, row, h.to), subject: cell(sheet, row, h.subject), setupUrl: cell(sheet, row, h.setup_url), productLabel: cell(sheet, row, h.product_label) || "통합", status: cell(sheet, row, h.send_status), sentAt: cell(sheet, row, h.sent_at)};
}
function cell(sheet, row, col) {
  if (!col) return "";
  return String(sheet.getRange(row, col).getValue() || "").trim();
}
function writeResult(sheet, row, h, status, sentAt, error) {
  sheet.getRange(row, h.send_status).setValue(status);
  sheet.getRange(row, h.sent_at).setValue(sentAt || "");
  sheet.getRange(row, h.send_error).setValue(error || "");
}
function esc(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
