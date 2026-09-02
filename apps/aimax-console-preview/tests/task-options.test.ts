import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildFixture } from "../src/data/fixtures.ts";
import {
  AI_MODEL_PRICES,
  allFields,
  buildDefaultOptionValues,
  computeQuoteTotals,
  countInputControls,
  fieldVisible,
  getTaskOptions,
} from "../src/data/taskOptions.ts";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testsDir, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

/**
 * 실서비스(oracle/aimax-reports-api/static/app.html) 폼의 입력 컨트롤 수.
 * 예리 yeriJobForm 16개, 송이 songiJobForm 13개, 현주 hyunjuJobForm 6개, 윤미 yunmiJobForm 5개,
 * 상수 sangsuJobForm 14개.
 * 예리 프리뷰 추가 2개: 스타일 템플릿 카드 1 + 예약 분(00/30) select 1
 * (실서비스 예약 시간 입력 1개를 네이버 예약 발행과 같은
 * 시·분 select 2개로 나눠 제공하면서 분 select가 추가 항목이 됨).
 * 상수 프리뷰 추가 1개: 부가세 토글(실서비스 견적서 렌더러의
 * 부가세 10% 자동 계산을 화면에서 고르게 한 항목).
 * 송이 프리뷰 추가 1개: 실서비스 탭 버튼 2개를 작업 방식 choice 1개로 제공합니다.
 */
const LIVE_CONTROL_COUNTS: Record<string, number> = {
  yeri: 16,
  songi: 13,
  hyunju: 6,
  yunmi: 5,
  sangsu: 14,
};

const PREVIEW_EXTRA_CONTROLS: Record<string, number> = {
  yeri: 2,
  songi: 1,
  // 현주 프리뷰 추가 1개: 내 블로그 소개 textarea (실서비스는 웹 작업 설정의
  // blog_profile을 쓰지만, 프리뷰는 폼 안에서 완결되게 멘트 위에 둡니다).
  hyunju: 1,
  sangsu: 1,
};

test("preview mirrors every live-service form control per employee", () => {
  for (const [employeeId, liveCount] of Object.entries(LIVE_CONTROL_COUNTS)) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    const expected = liveCount + (PREVIEW_EXTRA_CONTROLS[employeeId] || 0);
    assert.equal(
      countInputControls(config),
      expected,
      employeeId + " 항목 수가 실서비스와 다릅니다",
    );
  }
});

test("only the single advanced section may collapse and yeri keeps every field", () => {
  const dialog = read("src/components/NewTaskDialog.tsx");
  const fields = read("src/components/TaskOptionFields.tsx");
  // 접히는 details는 고급 설정 토글 1개만 허용합니다.
  assert.equal((dialog.match(/<details/g) || []).length, 1);
  assert.doesNotMatch(fields, /<details/);

  for (const employeeId of ["yeri", "yunmi", "sangsu"]) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    const advancedSections = config.sections.filter(
      (section) => section.advanced,
    );
    assert.equal(
      advancedSections.length,
      1,
      employeeId + " 고급 토글은 1개여야 합니다",
    );
  }

  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  // 이전 라운드(실서비스 16 + 스타일 템플릿 1 = 17개)에서 항목 수 감소 금지
  assert.ok(countInputControls(yeri) >= 17);
});

test("sangsu regroups into required/frequent/advanced with a live quote preview and vat toggle", () => {
  const sangsu = getTaskOptions("sangsu");
  assert.ok(sangsu);
  assert.deepEqual(
    sangsu.sections.map((section) => section.title),
    ["필수 입력", "자주 쓰는 설정", "고급 설정"],
  );
  assert.deepEqual(
    sangsu.sections[0].fields.map((field) => field.id),
    ["clientName", "items"],
    "필수 그룹은 거래처명(받는 곳)과 품목표여야 합니다",
  );

  const vat = allFields(sangsu).find((field) => field.id === "vatMode");
  assert.ok(vat && vat.kind === "choice");
  assert.deepEqual(
    vat.choices.map((choice) => choice.value),
    ["separate", "none"],
  );
  assert.equal(vat.defaultValue, "separate");

  const defaults = buildDefaultOptionValues(sangsu);
  const withVat = computeQuoteTotals(defaults);
  assert.equal(withVat.subtotal, 180000);
  assert.equal(withVat.vat, 18000);
  assert.equal(withVat.total, 198000);
  const noVat = computeQuoteTotals({ ...defaults, vatMode: "none" });
  assert.equal(noVat.vat, 0);
  assert.equal(noVat.total, 180000);
  assert.notEqual(
    sangsu.estimateCost(defaults).headline,
    sangsu.estimateCost({ ...defaults, vatMode: "none" }).headline,
    "부가세 토글이 예상 비용 박스에 반영돼야 합니다",
  );

  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.match(dialog, /QuotePreview/);
  assert.match(dialog, /quote-live-preview--desktop/);
  assert.match(dialog, /quote-live-preview--inline/);
  const preview = read("src/components/QuotePreview.tsx");
  assert.match(preview, /deliverable-doc/);
  assert.match(preview, /computeQuoteTotals/);
});

test("yunmi regroups into required/frequent/advanced and objective cards carry script samples", () => {
  const yunmi = getTaskOptions("yunmi");
  assert.ok(yunmi);
  assert.deepEqual(
    yunmi.sections.map((section) => section.title),
    ["필수 입력", "자주 쓰는 설정", "고급 설정"],
  );
  assert.deepEqual(
    yunmi.sections[0].fields.map((field) => field.id),
    ["topic", "objective"],
  );
  const advanced = yunmi.sections.find((section) => section.advanced);
  assert.ok(advanced);
  assert.deepEqual(
    advanced.fields.map((field) => field.id),
    ["referenceUrl", "referenceText"],
  );

  // 실서비스 5개 항목 그대로 (길이·톤 같은 무근거 항목 신설 금지)
  assert.equal(countInputControls(yunmi), 5);

  const objective = allFields(yunmi).find((field) => field.id === "objective");
  assert.ok(objective && objective.kind === "choice");
  assert.equal(objective.variant, "cards");
  for (const choice of objective.choices) {
    assert.ok(choice.example, choice.label + " 대본 샘플이 없습니다");
    assert.ok(choice.example.lines.length >= 4);
    assert.ok(choice.example.lines.length <= 8);
  }
});

test("the new-task entry opens an employee picker that reaches every guidance screen", () => {
  const app = read("src/App.tsx");
  assert.match(app, /EmployeePickerDialog/);
  assert.match(app, /openEmployeePicker/);
  assert.match(app, /onBack=\{taskFromPicker \? backToEmployeePicker : undefined\}/);

  const picker = read("src/components/EmployeePickerDialog.tsx");
  assert.match(picker, /employee-picker-grid/);
  assert.match(picker, /EmployeePortrait/);
  assert.match(picker, /송이 업무는 외부 서비스로 연결/);
  assert.match(picker, /employee\.id === "songi"/);
  assert.doesNotMatch(picker, /employee\.id === "hyunju"/);
  assert.doesNotMatch(picker, /pickerEmployee/);
  assert.doesNotMatch(picker, /훔쳐봐/);
  assert.match(picker, /다운로드 안내로 연결/);
});

test("every form employee exposes a cost estimate that reacts to selections", () => {
  for (const employeeId of Object.keys(LIVE_CONTROL_COUNTS)) {
    const config = getTaskOptions(employeeId);
    assert.ok(config);
    const estimate = config.estimateCost(buildDefaultOptionValues(config));
    assert.ok(estimate.headline.length > 0);
    assert.ok(estimate.lines.length > 0);
    assert.ok(estimate.basisLabel.length > 0);
  }

  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const yeriDefaults = buildDefaultOptionValues(yeri);
  const base = yeri.estimateCost(yeriDefaults);
  const premium = yeri.estimateCost({ ...yeriDefaults, writeMode: "premium" });
  assert.notEqual(base.headline, premium.headline);

  const hyunju = getTaskOptions("hyunju");
  assert.ok(hyunju);
  const hyunjuDefaults = buildDefaultOptionValues(hyunju);
  const ten = hyunju.estimateCost(hyunjuDefaults);
  const thirty = hyunju.estimateCost({ ...hyunjuDefaults, count: "30" });
  assert.notEqual(ten.headline, thirty.headline);

  const songi = getTaskOptions("songi");
  assert.ok(songi);
  const songiDefaults = buildDefaultOptionValues(songi);
  const youtube = songi.estimateCost(songiDefaults);
  const instagram = songi.estimateCost({
    ...songiDefaults,
    discoveryPlatform: "instagram",
  });
  assert.notEqual(youtube.headline, instagram.headline);
  const oneLink = songi.estimateCost({
    ...songiDefaults,
    taskMode: "links",
    urls: "https://example.com/one",
  });
  const twoLinks = songi.estimateCost({
    ...songiDefaults,
    taskMode: "links",
    urls: "https://example.com/one\nhttps://example.com/two",
  });
  assert.notEqual(oneLink.headline, twoLinks.headline);
});

test("yeri style template cards carry toggleable examples", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const template = yeri.sections
    .flatMap((section) => section.fields)
    .find((field) => field.id === "template");
  assert.ok(template && template.kind === "choice");
  for (const choice of template.choices) {
    assert.ok(choice.example, choice.label + " 예시가 없습니다");
    assert.ok(choice.example.lines.length >= 4);
    assert.ok(choice.example.lines.length <= 6);
  }
});

test("2026-08 model price table stays the pricing source of truth", () => {
  // Gemini 3.7 Flash는 2026-08-13 출시 신형(12/31까지 인트로가 0.75/3.75).
  // 선택 UI는 작성 모드 3단으로 좁혔지만 단가표는 라인업 기록으로 유지합니다.
  const expectedPrices: Record<string, [number, number]> = {
    "gemini-3.5-flash": [1.5, 9.0],
    "gemini-3.7-flash": [0.75, 3.75],
    "gpt-5.6-terra": [2.0, 12.0],
    "claude-sonnet-5": [3.0, 15.0],
    "gpt-5.6-sol": [4.0, 20.0],
    "claude-haiku-4.5": [1.0, 5.0],
  };
  assert.deepEqual(
    Object.keys(AI_MODEL_PRICES).sort(),
    Object.keys(expectedPrices).sort(),
  );
  for (const [model, [input, output]] of Object.entries(expectedPrices)) {
    const price = AI_MODEL_PRICES[model];
    assert.ok(price, model + " 단가가 없습니다");
    assert.equal(price.inputUsdPer1m, input, model + " 입력 단가 불일치");
    assert.equal(price.outputUsdPer1m, output, model + " 출력 단가 불일치");
  }
});

test("yeri publish mode mirrors live label order but defaults to draft save", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const mode = allFields(yeri).find((field) => field.id === "mode");
  assert.ok(mode && mode.kind === "select");
  assert.deepEqual(
    mode.choices.map((choice) => [choice.value, choice.label]),
    [
      ["publish", "즉시 발행"],
      ["save", "임시 저장"],
      ["schedule", "예약 발행"],
    ],
    "발행 방식 옵션 순서·라벨은 실서비스 미러여야 합니다",
  );
  assert.equal(mode.defaultValue, "save");
});

test("yeri image models show per-image won prices and recommend gpt-image-2", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const imageModel = allFields(yeri).find((field) => field.id === "imageModel");
  assert.ok(imageModel && imageModel.kind === "select");
  // 실서비스 USD 단가 × 환율 1476, Math.ceil 기준 장당 원화.
  const expectedWon: Record<string, string> = {
    "gpt-image-1": "62원",
    "gpt-image-2": "79원",
    "gemini-2.5-flash-image": "58원",
    "gemini-3.1-flash-image": "99원",
    "gemini-3-pro-image": "198원",
  };
  assert.deepEqual(
    imageModel.choices.map((choice) => choice.value),
    Object.keys(expectedWon),
  );
  for (const choice of imageModel.choices) {
    assert.match(
      choice.label,
      new RegExp("장당 약 " + expectedWon[choice.value]),
      choice.value + " 장당 원화 표기가 없습니다",
    );
  }
  const recommended = imageModel.choices.find(
    (choice) => choice.value === "gpt-image-2",
  );
  assert.ok(recommended);
  assert.match(recommended.label, /추천/);
  assert.match(recommended.hint || "", /한글/);
  assert.match(recommended.hint || "", /2026-08-18/);
  assert.equal(
    imageModel.choices.filter((choice) => /추천/.test(choice.label)).length,
    1,
    "이미지 모델 추천 배지는 gpt-image-2 하나여야 합니다",
  );
  // 기본값 변경은 지시에 없어 기존값을 유지합니다.
  assert.equal(imageModel.defaultValue, "gpt-image-1");
});

test("yeri CTA fields show only for consult-style templates and keep values", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const fields = allFields(yeri);
  const values = buildDefaultOptionValues(yeri);
  values.ctaLink = "smartstore 상담 예약 페이지 주소";
  values.ctaText = "상담 신청하기";

  for (const id of ["ctaLink", "ctaText"]) {
    const field = fields.find((candidate) => candidate.id === id);
    assert.ok(field, id + " 필드가 없습니다");
    assert.equal(
      fieldVisible(field, { ...values, template: "consult" }),
      true,
      id + "는 상담 유도형에서 보여야 합니다",
    );
    assert.equal(
      fieldVisible(field, { ...values, template: "account-default" }),
      true,
      id + "는 계정 기본 스타일에서 보여야 합니다 (무엇이 올지 모르므로)",
    );
    for (const template of ["info", "review"]) {
      assert.equal(
        fieldVisible(field, { ...values, template }),
        false,
        id + "는 " + template + " 템플릿에서 숨겨져야 합니다",
      );
    }
  }
  // 숨김은 표시만 제어하고 입력값은 보존됩니다.
  assert.equal(values.ctaLink, "smartstore 상담 예약 페이지 주소");
  assert.equal(values.ctaText, "상담 신청하기");
});

test("no visible field label duplicates its section title", () => {
  for (const employeeId of ["yeri", "songi", "hyunju", "yunmi", "sangsu"]) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    for (const section of config.sections) {
      for (const field of section.fields) {
        if (field.hideLabel) continue;
        assert.notEqual(
          field.label,
          section.title,
          employeeId +
            " '" +
            section.title +
            "' 섹션 제목과 필드 라벨이 중복됩니다",
        );
      }
    }
  }
  const hyunju = getTaskOptions("hyunju");
  assert.ok(hyunju);
  const messages = allFields(hyunju).find((field) => field.id === "messages");
  assert.ok(messages && messages.kind === "textList");
  assert.equal(messages.hideLabel, true);
});

test("hyunju restores the draft-message button as a fixture", () => {
  const hyunju = getTaskOptions("hyunju");
  assert.ok(hyunju);
  const messages = allFields(hyunju).find((field) => field.id === "messages");
  assert.ok(messages && messages.kind === "textList");
  assert.ok(messages.draftFill, "멘트 초안 만들기 픽스처 구성이 없습니다");
  assert.equal(messages.draftFill.buttonLabel, "멘트 초안 만들기");
  assert.equal(messages.draftFill.drafts.length, 3);
  for (const draft of messages.draftFill.drafts) {
    assert.match(draft, /서로이웃/);
  }
  assert.match(messages.draftFill.notice, /입력한 블로그 소개를 바탕으로/);

  const fieldsSource = read("src/components/TaskOptionFields.tsx");
  assert.match(fieldsSource, /draftFill/);
  assert.match(fieldsSource, /field-action-row/);
});

test("yeri schedule area shows only for reserved publishing with naver 30-minute slots", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const fields = allFields(yeri);
  for (const id of [
    "scheduleDate",
    "scheduleHour",
    "scheduleMinute",
    "scheduleInterval",
  ]) {
    const field = fields.find((candidate) => candidate.id === id);
    assert.ok(field, id + " 필드가 없습니다");
    assert.deepEqual(
      field.visibleWhen,
      { fieldId: "mode", equals: "schedule" },
      id + "는 예약 발행 선택 시에만 보여야 합니다",
    );
  }

  const date = fields.find((field) => field.id === "scheduleDate");
  assert.ok(date && date.kind === "date");

  // 자유 시간 입력 금지: 시·분 모두 select이고 분은 00/30만 허용합니다.
  const hour = fields.find((field) => field.id === "scheduleHour");
  assert.ok(hour && hour.kind === "select");
  assert.equal(hour.choices.length, 24);
  const minute = fields.find((field) => field.id === "scheduleMinute");
  assert.ok(minute && minute.kind === "select");
  assert.deepEqual(
    minute.choices.map((choice) => choice.value),
    ["00", "30"],
  );
});

test("songi hands off externally, hyunju keeps her form, and semu stays retired", () => {
  const songi = getTaskOptions("songi");
  assert.ok(songi);
  assert.equal(getTaskOptions("jieun"), undefined);
  assert.equal(getTaskOptions("semu"), undefined);

  assert.deepEqual(
    songi.sections.map((section) => section.title),
    ["작업 방식", "키워드로 찾기", "링크로 분석"],
  );
  assert.deepEqual(
    allFields(songi).map((field) => field.id),
    [
      "taskMode",
      "discoveryProject",
      "discoveryProjectName",
      "discoveryKeyword",
      "discoveryPlatform",
      "discoverySort",
      "discoveryDays",
      "discoveryMaxResults",
      "linkProject",
      "linkProjectName",
      "instagramProfile",
      "contentCategory",
      "contentTopic",
      "urls",
    ],
  );
  const defaults = buildDefaultOptionValues(songi);
  assert.equal(fieldVisible(allFields(songi)[1], defaults), true);
  assert.equal(fieldVisible(allFields(songi)[2], defaults), false);
  assert.equal(
    fieldVisible(allFields(songi)[2], {
      ...defaults,
      discoveryProject: "new",
    }),
    true,
  );
  assert.equal(fieldVisible(allFields(songi)[8], defaults), false);
  assert.equal(
    fieldVisible(allFields(songi)[8], { ...defaults, taskMode: "links" }),
    true,
  );

  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.doesNotMatch(dialog, /훔쳐봐/);
  assert.match(dialog, /href=\{HOOMCHA_URL\}/);
  assert.match(dialog, /송이 업무는 연결된 외부 서비스/);
  assert.match(dialog, /employee\.id === "songi"/);
  // 현주는 외부 이동 없이 기존 영업개척 폼으로 들어갑니다.
  assert.doesNotMatch(dialog, /employee\.id === "hyunju"/);
  assert.match(dialog, /section\.fields\.some\(\(field\) => fieldVisible/);
  assert.match(dialog, /Windows Setup 다운로드/);
  assert.match(dialog, /Apple Silicon Mac 앱 다운로드/);

  const fixture = buildFixture("normal");
  assert.equal(
    fixture.employees.some((employee) => employee.id === "semu"),
    false,
  );
  assert.equal(
    fixture.tasks.some((task) => task.employeeId === "semu"),
    false,
  );
});

test("yunmi is a public employee with photo and complete resume", () => {
  const fixture = buildFixture("normal");
  const yunmi = fixture.employees.find((employee) => employee.id === "yunmi");
  assert.ok(yunmi);
  assert.equal(yunmi.photo, "/assets/avatar_yunmi.jpg");
  assert.ok(yunmi.resume);
  assert.ok(yunmi.resume.career.length >= 3);
  assert.ok(yunmi.resume.skills.length >= 5);
  assert.match(yunmi.role, /스크립트/);
});
