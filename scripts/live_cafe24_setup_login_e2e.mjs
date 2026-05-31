import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const inputPath = process.argv[2] || "/private/tmp/aimax-cafe24-e2e.json";
const prepared = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const evidenceRoot = path.join(process.cwd(), "docs", "testing", "evidence", `cafe24-onboarding-${prepared.run_id}`);
fs.mkdirSync(evidenceRoot, { recursive: true });

function safePassword() {
  return `Zx9!Flow${Date.now().toString(36)}Q`;
}

const password = safePassword();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto(prepared.setup_url, { waitUntil: "networkidle" });
  await page.locator("#setupForm").waitFor({ state: "visible", timeout: 15000 });
  const setupIntro = await page.locator("#intro").innerText();
  await page.screenshot({ path: path.join(evidenceRoot, "01-setup-form.png"), fullPage: true });

  await page.fill("#newPassword", password);
  await page.fill("#confirmPassword", password);
  await page.click("#submitBtn");
  await page.getByText("비밀번호 설정이 완료되었습니다.").waitFor({ timeout: 15000 });
  const setupDone = await page.locator("#intro").innerText();
  const setupNotice = await page.locator("#notice").innerText();
  await page.screenshot({ path: path.join(evidenceRoot, "02-setup-complete.png"), fullPage: true });

  await page.goto(`${prepared.public_base_url}/app`, { waitUntil: "networkidle" });
  await page.locator("#loginForm").waitFor({ state: "visible", timeout: 15000 });
  await page.fill("#email", prepared.email);
  await page.fill("#password", password);
  await page.click("#loginForm button[type=\"submit\"]");
  await page.locator("#appView").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#userEmail").waitFor({ timeout: 15000 });
  const loggedInEmail = await page.locator("#userEmail").innerText();
  const accountStatus = await page.locator("#accountStatus").innerText().catch(() => "");
  const pageTitle = await page.locator("#pageTitle").innerText().catch(() => "");
  await page.screenshot({ path: path.join(evidenceRoot, "03-app-login.png"), fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    run_id: prepared.run_id,
    email: prepared.email,
    order_id: prepared.order_id,
    user_id: prepared.user_id,
    product: prepared.product,
    product_label: prepared.product_label,
    order_status: prepared.order_status,
    order_sent_at: prepared.order_sent_at,
    auto_process_stage: prepared.auto_process_stage,
    mail_provider: prepared.mail_provider,
    mail_provider_message_id_present: Boolean(prepared.mail_provider_message_id),
    setup_intro: setupIntro,
    setup_done: setupDone,
    setup_notice: setupNotice,
    logged_in_email: loggedInEmail,
    account_status: accountStatus,
    page_title: pageTitle,
    evidence_dir: evidenceRoot,
    screenshots: [
      path.join(evidenceRoot, "01-setup-form.png"),
      path.join(evidenceRoot, "02-setup-complete.png"),
      path.join(evidenceRoot, "03-app-login.png"),
    ],
  }, null, 2));
} finally {
  await browser.close();
}
