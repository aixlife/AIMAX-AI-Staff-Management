import { createRequire } from "node:module";
const require = createRequire(process.env.PW_ROOT + "/");
const { chromium } = require("playwright");
const SP = process.env.SP; const APP2 = "http://127.0.0.1:4176/app2/"; const PW = "QaPass!2026xyz";
const browser = await chromium.launch(); const R = {};
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" }); const page = await ctx.newPage();
await page.goto(APP2, { waitUntil: "networkidle" }); await page.fill("#live-login-email", "qa-yeri@example.com"); await page.fill("#live-login-password", PW); await page.click("form button[type=submit]"); await page.waitForTimeout(1500);
// internal wording scan per route
const banned = ["fixture", "픽스처", "프리뷰", "로컬 검토자", "LOCAL PREVIEW", "브라우저 메모리", "Phase 1", "시나리오"];
R.wording = {};
for (const route of ["home", "employees", "work", "connections", "help"]) {
  await page.goto(APP2 + "#" + route); await page.waitForTimeout(700);
  const t = await txt(page.locator("#main-content, main").first()).catch(async () => await txt(page.locator("body")));
  R.wording[route] = banned.filter((w) => t.includes(w)).map((w) => { const i = t.indexOf(w); return w + " → …" + t.slice(Math.max(0, i - 40), i + 50) + "…"; });
}
// home notices
await page.goto(APP2 + "#home"); await page.waitForTimeout(700); const home = await txt(page.locator("body"));
R.home_notice_waiting = home.includes("확인을 기다립니다"); R.home_snippet = home.slice(0, 400);
// task status labels
await page.goto(APP2 + "#work"); await page.waitForTimeout(800);
R.work_filters = await txt(page.locator(".work-filter-bar").first()).catch(() => "");
R.tasks = await page.locator(".master-list > *").evaluateAll((els) => els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80)).filter(Boolean)).catch(() => []);
// submit flow (read-only toast)
await page.goto(APP2 + "#employees"); await page.waitForTimeout(700);
await page.locator(".employee-card").filter({ hasText: "예리" }).first().click(); await page.waitForTimeout(300);
await page.locator(".detail-panel button").filter({ hasText: "업무 맡기기" }).first().click(); await page.waitForTimeout(600);
const dlg = page.locator('[role="dialog"]:visible').first();
const inputs = dlg.locator("input[type=text], textarea"); const n = await inputs.count();
for (let i = 0; i < Math.min(n, 3); i += 1) { await inputs.nth(i).fill("QA 테스트 " + i).catch(() => {}); }
const submit = dlg.locator("button[type=submit], button").filter({ hasText: /맡기기|시작|만들기|실행/ }).last();
R.submit_label = await txt(submit).catch(() => "(none)"); await submit.click({ force: true }).catch(() => {}); await page.waitForTimeout(900);
R.submit_toast = await txt(page.locator('.toast, [role="status"]').first()).catch(() => "(no toast)");
R.submit_dialog_still_open = await page.locator('[role="dialog"]:visible').count();
await page.screenshot({ path: `${SP}/app2_submit.png` });
// 송이 click behavior
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await page.locator(".employee-card").filter({ hasText: "송이" }).first().click(); await page.waitForTimeout(300);
await page.locator(".detail-panel button").filter({ hasText: "업무 맡기기" }).first().click(); await page.waitForTimeout(600);
R.songi_dialog = (await txt(page.locator('[role="dialog"]:visible').first()).catch(() => "(none)")).slice(0, 200);
R.songi_dialog_links = await page.locator('[role="dialog"]:visible a').evaluateAll((els) => els.map((a) => a.getAttribute("href")));
// sidebar account rendering
R.sidebar_account_html = (await page.locator(".sidebar-account").first().innerHTML()).replace(/\s+/g, " ").slice(0, 300);
await browser.close(); require("node:fs").writeFileSync(process.env.SP + "/qa_app2_b.json", JSON.stringify(R, null, 2)); console.log(JSON.stringify(R, null, 1).slice(0, 4000));
