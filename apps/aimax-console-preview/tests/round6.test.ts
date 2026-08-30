import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  HYUNJU_GENERIC_MESSAGE_DRAFTS,
  WRITE_MODES,
  WRITE_MODE_ARTICLE_CHARS,
  allFields,
  buildDefaultOptionValues,
  buildHyunjuMessageDrafts,
  getTaskOptions,
  writeModeMeta,
  writeModePerArticleWon,
} from "../src/data/taskOptions.ts";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testsDir, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

/**
 * 콘솔 UX 6라운드 (2026-08-31 CEO 피드백 4건) 계약 테스트.
 * 1) 작성 모드 비용 표기 ELI5 — 개발자 표기 제거, 결과물 단위 원화
 * 2) 윤미 실행 전 확인 — 무료/전환 두 줄 + 생성 직전 예상 비용 요약(전 직원)
 * 3) 현주 "내 블로그 소개" 입력처 신설 + 소개 반영 멘트 초안
 * 4) 업무 이름 placeholder화 + 빈 이름 자동 부여
 */

/* ------------------------------------------------------------------ */
/* 1. 작성 모드 비용 표기 ELI5                                           */
/* ------------------------------------------------------------------ */

test("write mode cards speak in article-unit won, never developer pricing", () => {
  assert.equal(WRITE_MODE_ARTICLE_CHARS, 1500);
  for (const mode of WRITE_MODES) {
    const meta = writeModeMeta(mode);
    // 결과물 단위 원화 + 모델명 보조 표기.
    assert.match(meta, /^글 1편\(1,500자 기준\) 약 \d{1,3}(,\d{3})*원 · /);
    // "$0.75/$3.75", "1M 토큰" 같은 개발자 표기 금지.
    assert.doesNotMatch(meta, /\$/);
    assert.doesNotMatch(meta, /토큰/);
    assert.doesNotMatch(meta, /1M/);
    assert.doesNotMatch(meta, /USD/);
    // 원화 금액은 토큰 추정식 · 환율 1476 그대로 계산한 값입니다.
    assert.ok(writeModePerArticleWon(mode.value) > 0);
  }
  // 검산: 표준 10원 · 균형 28원 · 프리미엄 37원 (1500자, 환율 1476).
  assert.equal(writeModePerArticleWon("standard"), 10);
  assert.equal(writeModePerArticleWon("balanced"), 28);
  assert.equal(writeModePerArticleWon("premium"), 37);
});

test("cost boxes keep one won-only detail line and no dollar or token text", () => {
  for (const employeeId of ["yeri", "yunmi"]) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    const estimate = config.estimateCost(buildDefaultOptionValues(config));
    const detailLines = estimate.lines.filter((line) =>
      line.startsWith("상세 단가"),
    );
    assert.equal(detailLines.length, 1, employeeId + " 상세 단가 한 줄이 없습니다");
    assert.match(detailLines[0], /표준 약 \d+원 · 균형 약 \d+원 · 프리미엄 약 \d+원/);
    const everything = [estimate.headline, ...estimate.lines].join("\n");
    assert.doesNotMatch(everything, /\$/);
    assert.doesNotMatch(everything, /토큰|1M|\dt\b|USD/);
  }
});

/* ------------------------------------------------------------------ */
/* 2. 윤미 두 줄 + 생성 직전 예상 비용 요약 (전 직원)                     */
/* ------------------------------------------------------------------ */

test("yunmi estimate is two-line free/upgrade and never a bare zero", () => {
  const yunmi = getTaskOptions("yunmi");
  assert.ok(yunmi);
  const estimate = yunmi.estimateCost(buildDefaultOptionValues(yunmi));
  assert.equal(estimate.headline, "기본 초안 만들기: 무료");
  assert.match(
    estimate.lines[0],
    /^AI 완성으로 전환 시: 약 \d{1,3}(,\d{3})*원 \(선택한 작성 모드/,
  );
  // 생성 직전 요약도 같은 두 줄.
  assert.deepEqual(estimate.submitRecap.length, 2);
  assert.equal(estimate.submitRecap[0], "기본 초안 만들기: 무료");
  assert.match(estimate.submitRecap[1], /AI 완성으로 전환 시: 약 \d+원/);
  // 모드를 바꾸면 전환 비용도 갱신됩니다.
  const premium = yunmi.estimateCost({
    ...buildDefaultOptionValues(yunmi),
    writeMode: "premium",
  });
  assert.notEqual(estimate.submitRecap[1], premium.submitRecap[1]);
});

test("every form employee shows a pre-submit cost recap with a reason", () => {
  for (const employeeId of ["yeri", "hyunju", "yunmi", "sangsu"]) {
    const config = getTaskOptions(employeeId);
    assert.ok(config, employeeId + " 옵션 폼이 없습니다");
    const estimate = config.estimateCost(buildDefaultOptionValues(config));
    assert.ok(
      estimate.submitRecap.length > 0,
      employeeId + " 생성 직전 예상 비용 요약이 없습니다",
    );
    for (const line of estimate.submitRecap) {
      // "0원" 단독 표기 금지 — 0원이면 이유(로컬/브라우저/무료)가 같이 붙습니다.
      assert.notEqual(line.trim(), "0원");
      if (/0원/.test(line)) {
        assert.match(line, /로컬|브라우저|무료/);
      }
    }
  }

  // 다이얼로그는 확인 체크 바로 위에서 요약을 렌더링합니다.
  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.match(dialog, /submit-cost-recap/);
  const recapIndex = dialog.indexOf("submit-cost-recap");
  const checkIndex = dialog.indexOf('className="check-row"');
  assert.ok(recapIndex > -1 && checkIndex > -1 && recapIndex < checkIndex);
  const styles = read("src/styles/components.css");
  assert.match(styles, /\.submit-cost-recap/);
});

/* ------------------------------------------------------------------ */
/* 3. 현주 "내 블로그 소개" 입력처                                       */
/* ------------------------------------------------------------------ */

test("hyunju gains a blog-profile textarea right above the message list", () => {
  const hyunju = getTaskOptions("hyunju");
  assert.ok(hyunju);
  const messageSection = hyunju.sections.find(
    (section) => section.title === "서로이웃 신청 멘트",
  );
  assert.ok(messageSection, "멘트 섹션이 없습니다");
  assert.deepEqual(
    messageSection.fields.map((field) => field.id),
    ["blogProfile", "messages"],
    "블로그 소개는 멘트 바로 위에 있어야 합니다",
  );
  const profile = messageSection.fields[0];
  assert.equal(profile.kind, "textarea");
  assert.equal(profile.label, "내 블로그 소개");
  assert.ok(profile.kind === "textarea" && !profile.required, "소개는 선택 입력입니다");
  assert.match(
    (profile.kind === "textarea" && profile.placeholder) || "",
    /어떤 블로그인지 한두 문장/,
  );

  const messages = allFields(hyunju).find((field) => field.id === "messages");
  assert.ok(messages && messages.kind === "textList" && messages.draftFill);
  // 고지문 정정: 계정 소개 → 입력한 블로그 소개.
  assert.match(messages.draftFill.notice, /입력한 블로그 소개를 바탕으로/);
  assert.ok(messages.draftFill.profile);
  assert.equal(messages.draftFill.profile.fieldId, "blogProfile");
  assert.match(messages.draftFill.profile.emptyNotice, /일반 멘트/);
});

test("draft messages reflect the typed blog profile or fall back politely", () => {
  const intro = "순천 맛집과 동네 카페를 기록하는 블로그입니다.";
  const drafts = buildHyunjuMessageDrafts(intro);
  assert.equal(drafts.length, 3);
  for (const draft of drafts) {
    assert.match(draft, /서로이웃/);
    assert.match(draft, /순천 맛집과 동네 카페를 기록하는 블로그/);
    // "입니다."가 문장 중간에 겹치지 않게 명사구로 정돈됩니다.
    assert.doesNotMatch(draft, /블로그입니다 운영자/);
  }
  // 소개가 비면 일반 멘트 3종으로 폴백합니다.
  assert.deepEqual(buildHyunjuMessageDrafts("   "), HYUNJU_GENERIC_MESSAGE_DRAFTS);
  assert.equal(HYUNJU_GENERIC_MESSAGE_DRAFTS.length, 3);

  // 폼 컴포넌트가 profile 규칙을 실제로 사용합니다.
  const fields = read("src/components/TaskOptionFields.tsx");
  assert.match(fields, /draftFill\.profile/);
  assert.match(fields, /emptyNotice/);
  assert.match(fields, /role="status"/);
});

/* ------------------------------------------------------------------ */
/* 4. 업무 이름 placeholder화                                            */
/* ------------------------------------------------------------------ */

test("task name starts empty with a grey example and auto-names on submit", () => {
  const dialog = read("src/components/NewTaskDialog.tsx");
  // 초기값은 빈 문자열, 기본 이름은 placeholder로만 보여줍니다.
  assert.match(dialog, /const \[title, setTitle\] = useState\(""\);/);
  assert.match(
    dialog,
    /const defaultTitle = employee\.name \+ " 새 업무 프리뷰";/,
  );
  assert.match(dialog, /placeholder=\{defaultTitle\}/);
  // 빈 이름은 막지 않고 자동 부여합니다.
  assert.match(dialog, /const finalTitle = title\.trim\(\) \|\| defaultTitle;/);
  assert.doesNotMatch(
    dialog,
    /Boolean\(title\.trim\(\)\)/,
    "빈 업무 이름을 검증으로 막으면 안 됩니다 (자동 부여로 대체)",
  );
  assert.match(dialog, /비워두면/);
});
