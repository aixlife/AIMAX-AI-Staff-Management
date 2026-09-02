import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { landingHash, routeHash, viewFromHash } from "../src/lib/routes.ts";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testsDir, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return /\.(css|ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

test("preview boundary is always visible and explicitly login-free", () => {
  const shell = read("src/components/AppShell.tsx");
  assert.match(shell, /LOCAL PREVIEW/);
  assert.match(shell, /로그인·서버·API 연결 없음/);
  assert.match(shell, /aria-label="로컬 프리뷰 안내"/);
});

/**
 * 네트워크 계약 (2026-09-02 실전환 Phase 1 개정):
 * - fetch는 라이브 운영실 데이터 계층인 src/api/client.ts 한 곳에서만 허용한다.
 * - 호출 가능한 엔드포인트는 client.ts의 ALLOWED_API_PATHS 화이트리스트뿐이고,
 *   api/ 밖의 화면 코드는 여전히 네트워크 원시 호출을 가질 수 없다.
 * - 프리뷰(랜딩) 모드는 이 계층을 호출하지 않으므로 종전의 "네트워크 0" 성질을 유지한다.
 */
test("network calls stay inside the api client with a whitelisted endpoint list", () => {
  const files = sourceFiles(path.join(appRoot, "src"));
  const clientPath = path.join(appRoot, "src/api/client.ts");
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (path.resolve(file) !== path.resolve(clientPath)) {
      assert.doesNotMatch(source, /\bfetch\s*\(/, `fetch는 api/client.ts에서만: ${file}`);
    }
    assert.doesNotMatch(source, /\bXMLHttpRequest\b/, file);
    assert.doesNotMatch(source, /\bWebSocket\b/, file);
    assert.doesNotMatch(source, /\bEventSource\b/, file);
  }

  const client = readFileSync(clientPath, "utf8");
  assert.match(client, /ALLOWED_API_PATHS = \[/);
  // Phase 1 허용 목록: 인증·직원 카탈로그·잡 조회뿐. 늘릴 때는 여기와 client.ts를 함께 고친다.
  for (const allowed of [
    '"/api/auth/login"',
    '"/api/auth/me"',
    '"/api/auth/logout"',
    '"/api/workers"',
    '"/api/jobs"',
  ]) {
    assert.ok(client.includes(allowed), `허용 목록 누락: ${allowed}`);
  }
  const listed = (client.match(/"\/api\/[a-z0-9/_-]+"/g) || []).filter(
    (value, index, all) => all.indexOf(value) === index,
  );
  assert.equal(listed.length, 5, `허용 엔드포인트가 5개를 넘었습니다: ${listed.join(", ")}`);
});

/**
 * 공개 랜딩은 구매·로그인·파트너로 나가는 바깥 주소가 필요합니다.
 * 대신 어디로 나갈 수 있는지를 이 목록으로 묶어 둡니다.
 */
test("outbound links stay inside the allowed hosts", () => {
  const allowedHosts = [
    "makefamily.kr",
    "api.aimax.ai.kr",
    "hoomcha.com",
    "lounge.aimax.ai.kr",
  ];
  const source = sourceFiles(path.join(appRoot, "src"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  const urls = source.match(/https?:\/\/[^\s"'`)]+/g) || [];
  assert.ok(urls.length > 0, "랜딩에는 구매·로그인 바깥 링크가 있어야 합니다");
  for (const url of urls) {
    const host = new URL(url).hostname;
    assert.ok(allowedHosts.includes(host), `허용하지 않은 주소: ${url}`);
    assert.doesNotMatch(url, /utm_/, `추적 파라미터가 붙었습니다: ${url}`);
  }
});

test("core routes remain present in the shared shell contract", () => {
  const routes = read("src/lib/routes.ts");
  for (const route of ["home", "employees", "work", "connections", "help"]) {
    assert.match(routes, new RegExp(`id: "${route}"`));
  }
});

test("foundations, focus, and reduced-motion rules stay centralized", () => {
  const tokens = read("src/styles/tokens.css");
  const globalStyles = read("src/styles/global.css");

  for (const token of [
    "--color-brand",
    "--color-positive",
    "--color-warning",
    "--color-critical",
    "--space-4",
    "--radius-md",
    "--shadow-modal",
  ]) {
    assert.match(tokens, new RegExp(token));
  }

  assert.match(globalStyles, /:focus-visible/);
  assert.match(globalStyles, /prefers-reduced-motion: reduce/);
});

test("shell exposes skip navigation and current-page semantics", () => {
  const shell = read("src/components/AppShell.tsx");
  assert.match(shell, /className="skip-link"/);
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /aria-current=/);
  assert.match(shell, /<main id="main-content"/);
});

test("the public landing is the default and console routes live below app", () => {
  assert.equal(viewFromHash(""), "landing");
  assert.equal(viewFromHash("#/"), "landing");
  assert.equal(viewFromHash("#/app/home"), "home");
  assert.equal(viewFromHash("#/app/employees"), "employees");
  assert.equal(routeHash("work"), "#/app/work");
  assert.equal(landingHash(), "#/");
});

test("landing removes public login and keeps employee identity primary", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const resume = read("src/components/ResumeDialog.tsx");

  assert.doesNotMatch(landing, /public-login/);
  assert.doesNotMatch(landing, /onLoginPreview/);
  assert.match(landing, /설명보다/);
  assert.match(landing, /일 하나/);
  assert.match(landing, /직원 데려오기/);
  assert.match(landing, /입사지원서 전체 보기/);
  assert.match(landing, /이미 회원이라면 로그인/);
  assert.match(landing, /가상의 AI 직원/);
  assert.match(resume, /입 사 지 원 서/);
  assert.match(resume, /인적사항/);
  assert.match(resume, /자기소개/);
  assert.match(resume, /경력사항/);
  assert.match(resume, /보유기술/);
  assert.match(resume, /추천사/);
  assert.match(resume, /면접 메모/);
});

test("landing keeps one task-to-result-to-team story with accessible motion", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const styles = read("src/styles/landing.css");
  const packageJson = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };

  assert.match(landing, /task-proof-card/);
  assert.match(landing, /work-journey/);
  assert.match(landing, /useState<TaskChoice\["id"\]>\("blog"\)/);
  assert.match(landing, /employee\.id === "yeri"/);
  assert.match(landing, /window\.setTimeout/);
  assert.match(landing, /staff-lineup/);
  assert.match(landing, /team-scroll-story/);
  assert.match(landing, /syncEmployeeToScroll/);
  assert.match(landing, /selectTeamEmployee/);
  assert.match(landing, /teamApplicationRef\.current\?\.scrollIntoView/);
  assert.match(landing, /window\.addEventListener\("scroll"/);
  assert.match(landing, /window\.requestAnimationFrame/);
  assert.match(landing, /resume-preview-paper/);
  assert.doesNotMatch(landing, /setInterval/);
  assert.doesNotMatch(landing, /staff-orbit-stage/);
  assert.doesNotMatch(landing, /team-arrival/);
  assert.doesNotMatch(landing, /landing-employee-grid/);
  assert.doesNotMatch(landing, /공식 출처 24개/);
  assert.match(landing, /IntersectionObserver/);
  assert.match(landing, /모션 끄기/);
  assert.match(landing, /aria-live="polite"/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.team-scroll-story__sticky/);
  assert.match(styles, /position: sticky/);
  assert.match(styles, /staff-select-pop/);
  assert.match(styles, /\.landing-page\.is-motion-paused/);
  assert.match(styles, /animation: none !important/);
  assert.match(styles, /transition: none !important/);
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ["react", "react-dom"]);
});

test("creating a task lands on the work page with the new task highlighted", () => {
  const app = read("src/App.tsx");
  assert.match(app, /setHighlightTaskId\(taskId\)/);
  assert.match(app, /navigate\("work"\)/);
  assert.match(app, /highlightTaskId=\{highlightTaskId\}/);
  // 강조는 수 초 뒤 자동 해제됩니다.
  assert.match(app, /setHighlightTaskId\(undefined\), 4000/);

  const card = read("src/components/TaskCard.tsx");
  assert.match(card, /task-card--just-created/);
  assert.match(card, /방금 만든 업무/);

  const styles = read("src/styles/pages.css");
  assert.match(styles, /\.task-card--just-created/);
});

test("done tasks expose preview and download actions for every employee", () => {
  const work = read("src/pages/WorkPage.tsx");
  assert.match(work, /미리보기/);
  assert.match(work, /다운로드/);
  assert.match(work, /downloadDeliverable/);
  assert.match(work, /DeliverableDialog/);

  const lib = read("src/lib/deliverableFile.ts");
  assert.match(lib, /URL\.createObjectURL/);
  assert.match(lib, /deliverableToText/);

  // 상수만 제출 버튼명이 견적서 생성하기이고, 다른 직원은 유지됩니다.
  const dialog = read("src/components/NewTaskDialog.tsx");
  assert.match(dialog, /isQuote \? "견적서 생성하기" : "로컬 업무 만들기"/);
});

test("public landing carries no local-preview wording", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const styles = read("src/styles/landing.css");

  for (const banned of [
    /LOCAL PREVIEW/,
    /landing-preview-bar/,
    /로컬 프리뷰/,
    /운영실 체험/,
    /프리뷰/,
    /픽스처/,
    /fixture/i,
    /onEnterConsole/,
  ]) {
    assert.doesNotMatch(landing, banned, `랜딩에 내부 검토용 문구가 남았습니다: ${banned}`);
  }
  assert.doesNotMatch(styles, /landing-preview-bar/);
});

test("songi links to the external service while hyunju keeps her own job", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const links = read("src/data/purchaseLinks.ts");

  // 송이는 자기 이름·프로필 그대로, 레퍼런스 업무만 외부 서비스로 이동합니다.
  assert.match(
    landing,
    /id: "research"[\s\S]{0,180}label: "레퍼런스 모으기"[\s\S]{0,120}employeeId: "songi"/,
  );
  assert.match(landing, /resultTitle: "송이가 모아주는 레퍼런스"/);
  assert.match(landing, /ctaLabel: "송이에게 맡기기"/);
  assert.match(landing, /externalDestination: SONGI_EXTERNAL_DESTINATION/);
  // 현주는 외부 이동 없이 영업개척(고객 찾기) 업무를 유지합니다.
  assert.match(
    landing,
    /id: "leads"[\s\S]{0,180}label: "고객 찾기"[\s\S]{0,120}employeeId: "hyunju"/,
  );
  assert.match(landing, /resultTitle: "먼저 연락할 고객 목록"/);
  assert.doesNotMatch(landing, /HYUNJU_EXTERNAL_DESTINATION/);
  assert.doesNotMatch(landing, /현주에게 맡기기/);
  assert.match(landing, /href=\{activeTask\.externalDestination\.url\}/);
  assert.match(landing, /레퍼런스 수집은 송이, 고객 찾기는 현주/);
  // 별도 훔쳐봐 직원명은 사용자 UI 소스 어디에도 없어야 합니다.
  const allSource = sourceFiles(path.join(appRoot, "src"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(allSource, /훔쳐봐/);
  assert.match(landing, /target="_blank"/);
  assert.match(landing, /rel="noopener noreferrer"/);
  assert.match(links, /HOOMCHA_URL = "https:\/\/hoomcha\.com\/aimax"/);
  // 시연은 5종 구조를 유지합니다.
  assert.equal((landing.match(/^ {4}id: "/gm) || []).length, 5);
});

test("purchase links live in one file and point at real cafe24 products", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const links = read("src/data/purchaseLinks.ts");

  assert.match(landing, /from "\.\.\/data\/purchaseLinks"/);
  assert.match(landing, /getPurchaseLink/);
  assert.match(landing, /formatPrice/);

  // 2026-08-31 스토어 실측 상품번호
  for (const productNo of ["104", "112", "129", "126", "114", "111", "243"]) {
    assert.match(links, new RegExp(`product_no=${productNo}"`));
  }
  assert.match(links, /priceWon: 30000/);
  // 개별 상품을 못 찾은 직원은 대표 스토어로 보냅니다.
  assert.match(links, /employeeId: "hyunju"[\s\S]{0,160}verified: false/);
  assert.match(links, /STORE_URL = "https:\/\/makefamily\.kr\/product\/list\.html\?cate_no=85"/);
  assert.match(links, /CONSOLE_LOGIN_URL = "https:\/\/api\.aimax\.ai\.kr\/app"/);
});

test("landing shows price, company identity, and the makefamily link", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const styles = read("src/styles/landing.css");

  assert.match(landing, /id="hire"/);
  assert.match(landing, /30,000원/);
  assert.match(landing, /주식회사 메이크패밀리/);
  assert.match(landing, /사업자등록번호 537-87-01496/);
  assert.match(landing, /통신판매업신고 제2020-서울금천-0389호/);
  assert.match(landing, /href=\{COMPANY_URL\}/);
  assert.match(landing, /스토어에서 확인/);
  assert.match(styles, /\.hire-list/);
  assert.match(styles, /\.public-footer__company/);
});

test("landing offers a contextual learner bridge to the lounge", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const links = read("src/data/purchaseLinks.ts");
  const styles = read("src/styles/landing.css");

  assert.match(links, /LOUNGE_URL = "https:\/\/lounge\.aimax\.ai\.kr"/);
  assert.match(landing, /href=\{LOUNGE_URL\}/);
  assert.match(landing, /AI 직원이 아직 낯설다면/);
  assert.match(landing, /수강생 라운지 보기/);
  assert.match(styles, /\.trust-strip__learning/);
});

test("landing copy avoids emoji and the banned metaphor", () => {
  const landing = read("src/pages/LandingPage.tsx");
  const links = read("src/data/purchaseLinks.ts");

  for (const source of [landing, links]) {
    assert.doesNotMatch(source, /마법/);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u);
  }
});

test("shared dialogs restore focus and trap keyboard navigation", () => {
  const modal = read("src/components/Modal.tsx");
  assert.match(modal, /previous\?\.focus\(\)/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /lastFocusable\.focus\(\)/);
  assert.match(modal, /firstFocusable\.focus\(\)/);
  assert.match(modal, /event\.key === "Escape"/);
});
