import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * 콘솔 UX 5라운드 (2026-08-31 카운슬 종합 6건 CEO 승인분) 계약 테스트.
 * 1) 작성 모드 3단 (예리·윤미 공통, 모델명·단가 보조 표기, 기본값 표준)
 * 2) 예리 카테고리 → 고급 설정 "발행할 네이버 게시판" 조건부 노출
 * 3) 스타일 템플릿 카드 미니 와이어프레임 (계정 기본 카드는 제외)
 * 4) "최근 설정 불러오기" 칩 저장·복원 (자동 복원 금지, 파일 항목 제외)
 * 5) 상수 즉시형 예외 (비이동·조용한 완료 적재·결과 화면 다운로드)
 * 6) 윤미 유료 전환 위치 (무료 설명 + 업무 페이지 CTA + 픽스처 과금 고지)
 */

// recentSettings가 쓰는 sessionStorage를 노드 테스트용 메모리 구현으로 대체합니다.
function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

const memoryStorage = createMemoryStorage();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage =
  memoryStorage;

const { buildFixture } = await import("../src/data/fixtures.ts");
const {
  AI_MODEL_PRICES,
  DEFAULT_WRITE_MODE,
  WRITE_MODES,
  allFields,
  buildDefaultOptionValues,
  fieldVisible,
  getTaskOptions,
  writeModeMeta,
  yunmiUpgradeEstimateWon,
} = await import("../src/data/taskOptions.ts");
const { loadRecentOptionValues, saveRecentOptionValues } = await import(
  "../src/lib/recentSettings.ts"
);
const { buildQuoteDeliverable } = await import("../src/lib/quoteDocument.ts");

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testsDir, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

/* ------------------------------------------------------------------ */
/* 1. 작성 모드 3단                                                     */
/* ------------------------------------------------------------------ */

test("write modes are exactly standard/balanced/premium with model+price meta", () => {
  assert.equal(DEFAULT_WRITE_MODE, "standard");
  assert.deepEqual(
    WRITE_MODES.map((mode) => [mode.value, mode.label, mode.model]),
    [
      ["standard", "표준", "gemini-3.7-flash"],
      ["balanced", "균형", "gpt-5.6-terra"],
      ["premium", "프리미엄", "claude-sonnet-5"],
    ],
  );
  // 6라운드: 개발자 표기($/1M 토큰) 대신 결과물 단위 원화 + 모델명 보조 표기.
  const expectedMeta: Record<string, string> = {
    standard: "글 1편(1,500자 기준) 약 10원 · Gemini 3.7 Flash",
    balanced: "글 1편(1,500자 기준) 약 28원 · GPT-5.6 Terra",
    premium: "글 1편(1,500자 기준) 약 37원 · Claude Sonnet 5",
  };
  for (const mode of WRITE_MODES) {
    assert.equal(writeModeMeta(mode), expectedMeta[mode.value]);
    assert.ok(mode.character.length > 0, mode.label + " 성격 한 줄이 없습니다");
    assert.ok(AI_MODEL_PRICES[mode.model], mode.label + " 모델 단가가 없습니다");
  }
});

test("yeri and yunmi replace the model select with the three mode cards", () => {
  for (const employeeId of ["yeri", "yunmi"]) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    const fields = allFields(config);

    // 기존 5~6모델 select는 제거 — aiModel 필드 자체가 없어야 합니다.
    assert.equal(
      fields.find((field) => field.id === "aiModel"),
      undefined,
      employeeId + "에 옛 글쓰기 모델 select가 남아 있습니다",
    );

    const mode = fields.find((field) => field.id === "writeMode");
    assert.ok(mode, employeeId + " 작성 모드 필드가 없습니다");
    assert.ok(mode.kind === "choice" && mode.variant === "cards");
    assert.equal(mode.defaultValue, "standard");
    assert.deepEqual(
      mode.choices.map((choice) => choice.value),
      ["standard", "balanced", "premium"],
    );
    assert.match(mode.choices[0].label, /기본값/);
    for (const choice of mode.choices) {
      assert.ok(choice.meta, choice.label + " 모델명·비용 보조 표기가 없습니다");
      assert.match(choice.meta || "", /글 1편\(1,500자 기준\) 약 \d+원/);
      assert.doesNotMatch(choice.meta || "", /\$|토큰/);
      assert.ok(choice.hint, choice.label + " 성격 한 줄이 없습니다");
    }
  }

  // 이미지 모델 select는 유지됩니다.
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const imageModel = allFields(yeri).find((field) => field.id === "imageModel");
  assert.ok(imageModel && imageModel.kind === "select");
  assert.equal(imageModel.choices.length, 5);
});

test("cost estimate boxes react to the selected write mode", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const yeriDefaults = buildDefaultOptionValues(yeri);
  const standard = yeri.estimateCost(yeriDefaults);
  assert.match(standard.lines[0], /표준 모드 · Gemini 3\.7 Flash/);
  const premium = yeri.estimateCost({ ...yeriDefaults, writeMode: "premium" });
  assert.match(premium.lines[0], /프리미엄 모드 · Claude Sonnet 5/);
  assert.notEqual(standard.headline, premium.headline);

  const yunmi = getTaskOptions("yunmi");
  assert.ok(yunmi);
  const yunmiDefaults = buildDefaultOptionValues(yunmi);
  const yunmiStandard = yunmi.estimateCost(yunmiDefaults);
  const yunmiBalanced = yunmi.estimateCost({
    ...yunmiDefaults,
    writeMode: "balanced",
  });
  assert.notDeepEqual(yunmiStandard.lines, yunmiBalanced.lines);
});

/* ------------------------------------------------------------------ */
/* 2. 카테고리 → 고급 설정 "발행할 네이버 게시판" 조건부 노출              */
/* ------------------------------------------------------------------ */

test("yeri category becomes a conditional naver-board field in advanced settings", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const advanced = yeri.sections.find((section) => section.advanced);
  assert.ok(advanced, "고급 설정 섹션이 없습니다");
  const category = advanced.fields.find((field) => field.id === "category");
  assert.ok(category, "카테고리 항목이 고급 설정에 없습니다");
  assert.equal(category.label, "발행할 네이버 게시판");
  assert.match(category.hint || "", /비워두면 기본 게시판에 발행됩니다/);
  assert.deepEqual(category.visibleWhen, {
    fieldId: "mode",
    oneOf: ["publish", "schedule"],
  });

  // 기본 화면(자주 쓰는 설정)에는 더 이상 없습니다.
  for (const section of yeri.sections) {
    if (section.advanced) continue;
    assert.equal(
      section.fields.find((field) => field.id === "category"),
      undefined,
      "'" + section.title + "' 섹션에 카테고리가 남아 있습니다",
    );
  }

  const values = buildDefaultOptionValues(yeri);
  // 기본값(임시 저장)에서는 숨김, 바로 발행·예약 발행에서만 노출.
  assert.equal(fieldVisible(category, { ...values, mode: "save" }), false);
  assert.equal(fieldVisible(category, { ...values, mode: "publish" }), true);
  assert.equal(fieldVisible(category, { ...values, mode: "schedule" }), true);
});

/* ------------------------------------------------------------------ */
/* 3. 스타일 템플릿 카드 미니 와이어프레임                                */
/* ------------------------------------------------------------------ */

test("style template cards carry mini wireframes except the account default", () => {
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  const template = allFields(yeri).find((field) => field.id === "template");
  assert.ok(template && template.kind === "choice");
  const byValue = Object.fromEntries(
    template.choices.map((choice) => [choice.value, choice]),
  );
  assert.equal(byValue["account-default"].wireframe, undefined);
  assert.equal(byValue["consult"].wireframe, "consult");
  assert.equal(byValue["info"].wireframe, "info");
  assert.equal(byValue["review"].wireframe, "review");
  // 기존 "예시 보기" 텍스트 토글도 유지됩니다 (보조).
  for (const choice of template.choices) {
    assert.ok(choice.example, choice.label + " 예시가 사라졌습니다");
  }

  const fieldsSource = read("src/components/TaskOptionFields.tsx");
  assert.match(fieldsSource, /TemplateWireframe/);
  const wireframeSource = read("src/components/TemplateWireframe.tsx");
  assert.match(wireframeSource, /aria-hidden="true"/);
  for (const kind of ["consult", "info", "review"]) {
    assert.match(wireframeSource, new RegExp('kind === "' + kind + '"'));
  }
  const styles = read("src/styles/components.css");
  assert.match(styles, /\.tpl-wireframe/);
});

/* ------------------------------------------------------------------ */
/* 4. "최근 설정 불러오기" 칩 저장·복원                                   */
/* ------------------------------------------------------------------ */

test("recent settings save and restore per employee via sessionStorage", () => {
  memoryStorage.clear();
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);

  // 저장 전에는 칩을 그릴 근거가 없습니다.
  assert.equal(loadRecentOptionValues("yeri", yeri), null);

  const edited = buildDefaultOptionValues(yeri);
  edited.keywords = "순천 점심 맛집";
  edited.writeMode = "premium";
  edited.mode = "schedule";
  edited.quality = ["seoResearch", "keywordEmphasis"];
  saveRecentOptionValues("yeri", yeri, edited);

  const restored = loadRecentOptionValues("yeri", yeri);
  assert.ok(restored, "저장분이 복원되지 않았습니다");
  assert.equal(restored.keywords, "순천 점심 맛집");
  assert.equal(restored.writeMode, "premium");
  assert.equal(restored.mode, "schedule");
  assert.deepEqual(restored.quality, ["seoResearch", "keywordEmphasis"]);

  // 직원별로 분리 저장됩니다.
  const sangsu = getTaskOptions("sangsu");
  assert.ok(sangsu);
  assert.equal(loadRecentOptionValues("sangsu", sangsu), null);
});

test("recent settings skip file fields and reject corrupted or unknown values", () => {
  memoryStorage.clear();
  const sangsu = getTaskOptions("sangsu");
  assert.ok(sangsu);

  const edited = buildDefaultOptionValues(sangsu);
  edited.clientName = "온들스튜디오";
  edited.logo = "logo.png"; // 파일 항목은 저장 대상이 아닙니다.
  saveRecentOptionValues("sangsu", sangsu, edited);
  const restored = loadRecentOptionValues("sangsu", sangsu);
  assert.ok(restored);
  assert.equal(restored.clientName, "온들스튜디오");
  assert.equal(restored.logo, "", "파일 항목이 복원되면 안 됩니다");

  // 깨진 JSON은 조용히 무시합니다.
  memoryStorage.setItem(
    "aimax-console-preview:recent-options:sangsu",
    "{broken",
  );
  assert.equal(loadRecentOptionValues("sangsu", sangsu), null);

  // 선택지에 없는 값(옛 모델 id 등)은 복원하지 않습니다.
  const yeri = getTaskOptions("yeri");
  assert.ok(yeri);
  memoryStorage.setItem(
    "aimax-console-preview:recent-options:yeri",
    JSON.stringify({ version: 1, values: { writeMode: "gpt-5.6-sol" } }),
  );
  assert.equal(loadRecentOptionValues("yeri", yeri), null);
});

test("the new-task dialog wires the chip without auto-restoring", () => {
  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.match(dialog, /loadRecentOptionValues/);
  assert.match(dialog, /saveRecentOptionValues/);
  assert.match(dialog, /최근 설정 불러오기/);
  assert.match(dialog, /recent-settings-chip/);
  // 폼 초기값은 항상 기본값 — 저장분을 초기 state로 쓰지 않습니다.
  assert.match(
    dialog,
    /useState<OptionValues>\(\(\) =>\s*\n\s*optionConfig \? buildDefaultOptionValues\(optionConfig\) : \{\},/,
  );
});

/* ------------------------------------------------------------------ */
/* 5. 상수 즉시형 예외                                                   */
/* ------------------------------------------------------------------ */

test("sangsu quote finishes in place and lands silently as a done task", () => {
  const app = read("src/App.tsx");
  const quoteBlock = app.match(
    /const createQuoteDoneTask =[\s\S]*?return taskId;\s*\};/,
  );
  assert.ok(quoteBlock, "createQuoteDoneTask가 없습니다");
  assert.match(quoteBlock[0], /status: "done"/);
  assert.match(quoteBlock[0], /progress: 100/);
  // 조용한 적재: 이동·강조·토스트가 없어야 합니다.
  assert.doesNotMatch(quoteBlock[0], /navigate\(/);
  assert.doesNotMatch(quoteBlock[0], /setHighlightTaskId/);
  assert.doesNotMatch(quoteBlock[0], /setToast/);
  // 라이브 베타(조회 전용)에서는 즉시 견적 적재를 끄고, 프리뷰에서만 연결합니다.
  assert.match(app, /onQuoteCreate=\{live \? undefined : createQuoteDoneTask\}/);
  assert.match(app, /onOpenTask=\{openTask\}/);

  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.match(dialog, /isQuote && onQuoteCreate/);
  assert.match(dialog, /견적서가 완성됐습니다/);
  assert.match(dialog, /업무 기록에서 보기/);
  assert.match(dialog, /견적서 다운로드/);
  assert.match(dialog, /buildQuoteDeliverable/);
  // 다른 직원은 현행 이동+강조 유지 (onCreate 경로 보존).
  assert.match(dialog, /onCreate\(employee, finalTitle, optionSummary \|\| undefined\);/);

  // 다운로드 문서는 견적 합계·부가세 계산을 그대로 담습니다.
  const sangsu = getTaskOptions("sangsu");
  assert.ok(sangsu);
  const doc = buildQuoteDeliverable(
    buildDefaultOptionValues(sangsu),
    "테스트 견적",
  );
  assert.equal(doc.docType, "견적서");
  assert.equal(doc.title, "테스트 견적");
  const table = doc.blocks.find((block) => block.type === "table");
  assert.ok(table && table.type === "table");
  const flat = table.rows.map((row) => row.join("|")).join("\n");
  assert.match(flat, /공급가액\|\|180,000원/);
  assert.match(flat, /부가세 \(10%\)\|\|18,000원/);
  assert.match(flat, /총 견적 금액\|\|198,000원/);
});

/* ------------------------------------------------------------------ */
/* 6. 윤미 유료 전환 위치                                                */
/* ------------------------------------------------------------------ */

test("yunmi free draft is explained and the upgrade CTA lives on the work page", () => {
  const yunmi = getTaskOptions("yunmi");
  assert.ok(yunmi);
  const estimate = yunmi.estimateCost(buildDefaultOptionValues(yunmi));
  // 6라운드: 두 줄 고정 — 무료 표기와 전환 시 예상 비용을 같이 보여줍니다.
  assert.equal(estimate.headline, "기본 초안 만들기: 무료");
  assert.match(estimate.lines[0], /AI 완성으로 전환 시: 약 \d+원/);

  // 폼 안에는 유료 전환 선택(전환 여부 토글)이 없습니다 — 모드 선택만 있습니다.
  const fieldIds = allFields(yunmi).map((field) => field.id);
  assert.deepEqual(fieldIds, [
    "topic",
    "objective",
    "writeMode",
    "referenceUrl",
    "referenceText",
  ]);

  // 모드별 예상 비용 (기본 글자 수 2,600자 기준).
  assert.equal(yunmiUpgradeEstimateWon("standard"), 14);
  assert.equal(yunmiUpgradeEstimateWon("balanced"), 44);
  assert.equal(yunmiUpgradeEstimateWon("premium"), 56);

  const work = read("src/pages/WorkPage.tsx");
  assert.match(work, /AI로 완성하기 · 예상 ₩/);
  assert.match(work, /yunmiUpgradeEstimateWon/);
  assert.match(work, /WRITE_MODES\.map/);
  assert.match(work, /과금 확인/);
  assert.match(work, /프리뷰에서는 아무 작업도 실행되지 않고 과금도 없습니다/);
  // 완료·확인 필요 화면 공용 조건.
  assert.match(
    work,
    /selected\?\.status === "done" \|\| selected\?\.status === "waiting_user"/,
  );

  // 확인 필요 픽스처의 비용 표기도 표준 모드 기준으로 정렬돼 있습니다.
  const fixture = buildFixture("normal");
  const waiting = fixture.tasks.find((task) => task.id === "task-script-017");
  assert.ok(waiting);
  assert.equal(waiting.cost, "예상 약 14원 · 표준 모드 (Gemini 3.7 Flash)");
});
