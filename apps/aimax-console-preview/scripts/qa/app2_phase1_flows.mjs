import { createRequire } from "node:module";
const require = createRequire(process.env.PW_ROOT + "/");
const { chromium } = require("playwright");
const SP = process.env.SP;
const APP2 = "http://127.0.0.1:4176/app2/"; const LEGACY = "http://127.0.0.1:18899/app";
const PW = "QaPass!2026xyz";
const browser = await chromium.launch(); const R = {};
async function newPage(vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, locale: "ko-KR" });
  const page = await ctx.newPage(); const errors = []; const apiCalls = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.status() >= 400) { const u = new URL(r.url()); (globalThis.__404 ||= []).push(r.status() + " " + u.pathname); } });
  page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) apiCalls.push(r.method() + " " + u.pathname); });
  return { ctx, page, errors, apiCalls };
}
async function login2(page, email, pw = PW) {
  await page.goto(APP2, { waitUntil: "networkidle" });
  await page.fill("#live-login-email", email); await page.fill("#live-login-password", pw);
  await page.click("form button[type=submit]"); await page.waitForTimeout(1500);
}
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
// ---- F1 auth edge cases
{
  const { ctx, page, errors } = await newPage();
  await login2(page, "qa-yeri@example.com", "wrong-pass"); R.f1_wrongpw = await txt(page.locator(".live-login__error").first()).catch(() => "(no error shown)");
  await login2(page, "qa-inactive@example.com"); R.f1_inactive = await txt(page.locator(".live-login__error").first()).catch(() => "(no error shown)") + " | loggedIn=" + (await page.locator(".sidebar-account__logout").count() > 0);
  await login2(page, "qa-mustchange@example.com"); const body = await txt(page.locator("body"));
  R.f1_mustchange = { loggedIn: await page.locator(".sidebar-account__logout").count() > 0, noticeShown: body.includes("비밀번호 변경이 필요합니다"), legacyLink: await page.locator('a[href="/app"]').count() };
  R.f1_errors = errors; await ctx.close();
}
// ---- F2/F3/F4/F5/F6 main user
{
  const { ctx, page, errors, apiCalls } = await newPage();
  await login2(page, "qa-yeri@example.com");
  R.f2_loggedIn = await page.locator(".sidebar-account__logout").count() > 0;
  R.f2_account = await txt(page.locator(".sidebar-account").first()).catch(() => "");
  await page.screenshot({ path: `${SP}/app2_home.png` });
  await page.click('nav a[href="#employees"], nav button:has-text("AI 직원"), [aria-label*="직원"] >> nth=0').catch(() => {});
  if (!(await page.locator(".employee-card").count())) { await page.goto(APP2 + "#employees"); await page.waitForTimeout(800); }
  const cards = page.locator(".employee-card"); R.f2_employeeCount = await cards.count();
  R.f2_employees = await cards.evaluateAll((els) => els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60)));
  await page.screenshot({ path: `${SP}/app2_employees.png` });
  // partner employee click → what happens
  const jw = cards.filter({ hasText: "지원" }).filter({ hasNotText: "오피스" }).first(); await jw.click(); await page.waitForTimeout(500);
  R.f2_jiwonDetail = (await txt(page.locator(".detail-panel").first())).slice(0, 260);
  const startBtn = page.locator(".detail-panel button").filter({ hasText: /맡기기|시작|업무|데려오기/ }).first();
  R.f2_jiwonPrimaryBtn = await startBtn.count() ? await txt(startBtn) : "(none)";
  if (await startBtn.count()) { await startBtn.click(); await page.waitForTimeout(700); R.f4_toast_partner = await txt(page.locator('[role="status"], .toast').first()).catch(() => "(no toast)"); const dlg = page.locator('[role="dialog"]:visible'); R.f4_dialog_partner = (await dlg.count()) ? (await txt(dlg.first())).slice(0, 200) : "(no dialog)"; await page.keyboard.press("Escape"); }
  // yeri (owned) → new task attempt
  const ye = cards.filter({ hasText: "예리" }).first(); await ye.click(); await page.waitForTimeout(400);
  const yb = page.locator(".detail-panel button").filter({ hasText: /맡기기|시작|업무/ }).first(); R.f4_yeriBtn = await yb.count() ? await txt(yb) : "(none)";
  if (await yb.count()) { await yb.click(); await page.waitForTimeout(700); R.f4_toast_yeri = await txt(page.locator('[role="status"], .toast').first()).catch(() => "(no toast)"); const dlg = page.locator('[role="dialog"]:visible'); R.f4_dialog_yeri = (await dlg.count()) ? (await txt(dlg.first())).slice(0, 160) : "(no dialog)"; await page.keyboard.press("Escape"); }
  // work page
  await page.goto(APP2 + "#work"); await page.waitForTimeout(900);
  const taskEls = page.locator(".master-list [class*='task'], .master-list button, .master-list li"); R.f3_taskCount = await taskEls.count();
  R.f3_tasks = (await taskEls.evaluateAll((els) => els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 70)))).slice(0, 8);
  const failed = taskEls.filter({ hasText: /실패|failed/ }).first(); if (await failed.count()) { await failed.click(); await page.waitForTimeout(500); R.f3_failedDetail = (await txt(page.locator(".task-detail").first())).slice(0, 300); }
  await page.screenshot({ path: `${SP}/app2_work.png` });
  // F5 session persistence + logout + bogus token
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(800); R.f5_afterReloadLoggedIn = await page.locator(".sidebar-account__logout").count() > 0;
  await page.locator(".sidebar-account__logout").first().click(); await page.waitForTimeout(800); R.f5_afterLogoutLoginForm = await page.locator("#live-login-email").count() > 0;
  await page.evaluate(() => localStorage.setItem("aimax_live_session_token", "bogus-token-xyz")); await page.goto(APP2, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  R.f5_bogusTokenLoginForm = await page.locator("#live-login-email").count() > 0; R.f5_bogusTokenCleared = await page.evaluate(() => localStorage.getItem("aimax_live_session_token"));
  R.f6_apiPaths = [...new Set(apiCalls)]; R.f6_errors = errors; await ctx.close();
}
// ---- F7 parity app2 vs legacy for 4 accounts
R.f7 = {};
for (const email of ["qa-yeri@example.com", "qa-bundle@example.com", "qa-blog@example.com", "qa-member@example.com"]) {
  const { ctx, page } = await newPage();
  await login2(page, email); await page.goto(APP2 + "#employees"); await page.waitForTimeout(900);
  const app2 = await page.locator(".employee-card").evaluateAll((els) => els.map((e) => { const t = (e.innerText || "").replace(/\s+/g, " ").trim(); return t.slice(0, 40); }));
  // legacy
  const lp = await ctx.newPage(); await lp.goto(LEGACY, { waitUntil: "networkidle" }); await lp.fill("#email", email); await lp.fill("#password", PW); await lp.click("#loginForm button[type=submit]"); await lp.waitForSelector("#staffGrid [data-staff-card]", { state: "attached", timeout: 15000 });
  for (let i = 0; i < 4; i += 1) { const d = lp.locator('[role="dialog"]:visible').first(); if (!(await d.count())) break; const b = d.locator("button").last(); if (await b.isVisible().catch(() => false)) { await b.click(); await lp.waitForTimeout(250); } else break; }
  await lp.click('[data-tab="staff"]'); await lp.waitForTimeout(400);
  const legacy = await lp.$$eval("#staffGrid [data-staff-card]", (els) => els.map((e) => ({ key: e.dataset.staffCard, name: e.querySelector("strong")?.textContent?.trim(), status: e.querySelector(".pill")?.textContent?.trim() })));
  R.f7[email] = { app2, legacy }; await ctx.close();
}
// ---- F8 mobile
{
  const { ctx, page, errors } = await newPage({ width: 390, height: 844 });
  await login2(page, "qa-yeri@example.com"); await page.screenshot({ path: `${SP}/app2_mobile_home.png`, fullPage: false });
  await page.goto(APP2 + "#employees"); await page.waitForTimeout(800); await page.screenshot({ path: `${SP}/app2_mobile_employees.png` });
  R.f8_mobileNav = await page.locator(".mobile-nav__item").count(); R.f8_errors = errors; await ctx.close();
}
R.http_errors = [...new Set(globalThis.__404 || [])].slice(0, 12);
await browser.close(); require("node:fs").writeFileSync(process.env.SP + "/qa_app2_result.json", JSON.stringify(R, null, 2)); console.log("saved");
