const AIMAX_MAIL_MERGE_CONFIG = {
  SHEET_NAME: "", // 비워두면 현재 열린 첫 번째 시트를 사용합니다.
  REQUIRED_HEADERS: ["to", "subject", "body"],
  STATUS_HEADER: "send_status",
  SENT_AT_HEADER: "sent_at",
  ERROR_HEADER: "send_error",
  MAX_SEND_PER_RUN: 40,
  SLEEP_MS_BETWEEN_SENDS: 700,
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("AIMAX 발송")
    .addItem("1. 첫 행 테스트를 내 메일로 보내기", "sendAimaxFirstRowPreviewToMe")
    .addItem("2. 미발송 안내 메일 보내기", "sendPendingAimaxOnboardingEmails")
    .addItem("3. 발송 상태 열 만들기", "prepareAimaxMailMergeSheet")
    .addToUi();
}

function prepareAimaxMailMergeSheet() {
  const sheet = getAimaxSheet_();
  const headerMap = getHeaderMap_(sheet);
  ensureStatusColumns_(sheet, headerMap);
  SpreadsheetApp.getUi().alert("AIMAX 발송 상태 열 준비가 완료되었습니다.");
}

function sendAimaxFirstRowPreviewToMe() {
  const sheet = getAimaxSheet_();
  const headerMap = ensureStatusColumns_(sheet, getHeaderMap_(sheet));
  const row = findFirstPendingRow_(sheet, headerMap);

  if (!row) {
    SpreadsheetApp.getUi().alert("미발송 행이 없습니다.");
    return;
  }

  const values = readRow_(sheet, row, headerMap);
  const me = Session.getActiveUser().getEmail();
  if (!me) {
    throw new Error("현재 Google 계정 이메일을 확인하지 못했습니다.");
  }

  GmailApp.sendEmail(
    me,
    `[테스트] ${values.subject}`,
    `${values.body}\n\n---\n테스트 발송입니다. 실제 수신자: ${values.to}`,
  );
  SpreadsheetApp.getUi().alert(`첫 행 테스트를 ${me} 주소로 보냈습니다. 받은 편지함을 확인해주세요.`);
}

function sendPendingAimaxOnboardingEmails() {
  const sheet = getAimaxSheet_();
  const headerMap = ensureStatusColumns_(sheet, getHeaderMap_(sheet));
  const lastRow = sheet.getLastRow();
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let row = 2; row <= lastRow; row += 1) {
    if (sentCount >= AIMAX_MAIL_MERGE_CONFIG.MAX_SEND_PER_RUN) break;

    const values = readRow_(sheet, row, headerMap);
    if (!values.to || !values.subject || !values.body) {
      skippedCount += 1;
      writeStatus_(sheet, row, headerMap, "skipped", "", "to/subject/body 중 비어있는 값이 있습니다.");
      continue;
    }
    if (values.sent_at || values.send_status === "sent") {
      skippedCount += 1;
      continue;
    }

    try {
      GmailApp.sendEmail(values.to, values.subject, values.body);
      writeStatus_(sheet, row, headerMap, "sent", new Date(), "");
      sentCount += 1;
      Utilities.sleep(AIMAX_MAIL_MERGE_CONFIG.SLEEP_MS_BETWEEN_SENDS);
    } catch (error) {
      failedCount += 1;
      writeStatus_(sheet, row, headerMap, "failed", "", error.message || String(error));
    }
  }

  SpreadsheetApp.getUi().alert(
    [
      `이번 실행 발송: ${sentCount}건`,
      `건너뜀: ${skippedCount}건`,
      `실패: ${failedCount}건`,
      sentCount >= AIMAX_MAIL_MERGE_CONFIG.MAX_SEND_PER_RUN
        ? "남은 행이 있으면 메뉴를 다시 실행해주세요."
        : "처리할 수 있는 미발송 행을 모두 확인했습니다.",
    ].join("\n"),
  );
}

function getAimaxSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (AIMAX_MAIL_MERGE_CONFIG.SHEET_NAME) {
    return ss.getSheetByName(AIMAX_MAIL_MERGE_CONFIG.SHEET_NAME);
  }
  return ss.getSheets()[0];
}

function getHeaderMap_(sheet) {
  if (!sheet) throw new Error("시트를 찾지 못했습니다.");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    const key = String(header || "").trim();
    if (key) map[key] = index + 1;
  });

  for (const header of AIMAX_MAIL_MERGE_CONFIG.REQUIRED_HEADERS) {
    if (!map[header]) {
      throw new Error(`필수 열이 없습니다: ${header}`);
    }
  }
  return map;
}

function ensureStatusColumns_(sheet, headerMap) {
  const map = { ...headerMap };
  for (const header of [
    AIMAX_MAIL_MERGE_CONFIG.STATUS_HEADER,
    AIMAX_MAIL_MERGE_CONFIG.SENT_AT_HEADER,
    AIMAX_MAIL_MERGE_CONFIG.ERROR_HEADER,
  ]) {
    if (!map[header]) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(header);
      map[header] = nextCol;
    }
  }
  return map;
}

function findFirstPendingRow_(sheet, headerMap) {
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row += 1) {
    const values = readRow_(sheet, row, headerMap);
    if (values.to && values.subject && values.body && values.send_status !== "sent" && !values.sent_at) {
      return row;
    }
  }
  return null;
}

function readRow_(sheet, row, headerMap) {
  const getValue = (header) => {
    const col = headerMap[header];
    return col ? String(sheet.getRange(row, col).getValue() || "").trim() : "";
  };
  return {
    to: getValue("to"),
    subject: getValue("subject"),
    body: getValue("body"),
    send_status: getValue(AIMAX_MAIL_MERGE_CONFIG.STATUS_HEADER),
    sent_at: getValue(AIMAX_MAIL_MERGE_CONFIG.SENT_AT_HEADER),
  };
}

function writeStatus_(sheet, row, headerMap, status, sentAt, error) {
  sheet.getRange(row, headerMap[AIMAX_MAIL_MERGE_CONFIG.STATUS_HEADER]).setValue(status);
  sheet.getRange(row, headerMap[AIMAX_MAIL_MERGE_CONFIG.SENT_AT_HEADER]).setValue(sentAt || "");
  sheet.getRange(row, headerMap[AIMAX_MAIL_MERGE_CONFIG.ERROR_HEADER]).setValue(error || "");
}
