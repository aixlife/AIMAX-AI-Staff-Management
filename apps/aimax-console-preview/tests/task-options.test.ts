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
  getTaskOptions,
} from "../src/data/taskOptions.ts";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testsDir, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

/**
 * 실서비스(oracle/aimax-reports-api/static/app.html) 폼의 입력 컨트롤 수.
 * 예리 yeriJobForm 16개, 현주 hyunjuJobForm 6개, 윤미 yunmiJobForm 5개,
 * 상수 sangsuJobForm 14개.
 * 예리 프리뷰 추가 2개: 스타일 템플릿 카드 1 + 예약 분(00/30) select 1
 * (실서비스 예약 시간 입력 1개를 네이버 예약 발행과 같은
 * 시·분 select 2개로 나눠 제공하면서 분 select가 추가 항목이 됨).
 * 상수 프리뷰 추가 1개: 부가세 토글(실서비스 견적서 렌더러의
 * 부가세 10% 자동 계산을 화면에서 고르게 한 항목).
 */
const LIVE_CONTROL_COUNTS: Record<string, number> = {
  yeri: 16,
  hyunju: 6,
  yunmi: 5,
  sangsu: 14,
};

const PREVIEW_EXTRA_CONTROLS: Record<string, number> = {
  yeri: 2,
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
  assert.match(picker, /훔쳐봐 안내로 연결/);
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
  const sol = yeri.estimateCost({ ...yeriDefaults, aiModel: "gpt-5.6-sol" });
  assert.notEqual(base.headline, sol.headline);

  const hyunju = getTaskOptions("hyunju");
  assert.ok(hyunju);
  const hyunjuDefaults = buildDefaultOptionValues(hyunju);
  const ten = hyunju.estimateCost(hyunjuDefaults);
  const thirty = hyunju.estimateCost({ ...hyunjuDefaults, count: "30" });
  assert.notEqual(ten.headline, thirty.headline);
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

test("2026-08 writing model lineup is mirrored with prices for yeri and yunmi", () => {
  const expectedPrices: Record<string, [number, number]> = {
    "gemini-3.5-flash": [1.5, 9.0],
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

  for (const employeeId of ["yeri", "yunmi"]) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    const modelField = allFields(config).find(
      (field) => field.id === "aiModel",
    );
    assert.ok(modelField && modelField.kind === "select");
    assert.deepEqual(
      modelField.choices.map((choice) => choice.value),
      Object.keys(expectedPrices),
      employeeId + " 모델 선택지가 라인업과 다릅니다",
    );
    assert.equal(modelField.defaultValue, "gemini-3.5-flash");
    assert.match(modelField.choices[0].label, /추천/);
    for (const choice of modelField.choices) {
      assert.ok(choice.hint, choice.label + " 모델 설명 한 줄이 없습니다");
    }
  }
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

test("songi and jieun replaced their forms and semu is fully retired", () => {
  assert.equal(getTaskOptions("songi"), undefined);
  assert.equal(getTaskOptions("jieun"), undefined);
  assert.equal(getTaskOptions("semu"), undefined);

  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.match(dialog, /훔쳐봐/);
  assert.match(dialog, /hoomcha\.com\/aimax/);
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
