import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildFixture } from "../src/data/fixtures.ts";
import {
  buildDefaultOptionValues,
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
 * 상수 sangsuJobForm 14개. 예리의 스타일 템플릿 카드 1개는 프리뷰 추가 항목.
 */
const LIVE_CONTROL_COUNTS: Record<string, number> = {
  yeri: 16,
  hyunju: 6,
  yunmi: 5,
  sangsu: 14,
};

const PREVIEW_EXTRA_CONTROLS: Record<string, number> = {
  yeri: 1,
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

test("no option field hides behind a collapsible details element", () => {
  const dialog = read("src/components/NewTaskDialog.tsx");
  const fields = read("src/components/TaskOptionFields.tsx");
  assert.doesNotMatch(dialog, /<details/);
  assert.doesNotMatch(fields, /<details/);
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
  const claude = yeri.estimateCost({ ...yeriDefaults, aiModel: "claude" });
  assert.notEqual(base.headline, claude.headline);

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
