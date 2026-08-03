#!/usr/bin/env node
// 카페24 주문 <-> 계정 권한 전수 대조 감사 (읽기 전용).
//
// 목적: "결제는 됐는데 직원이 안 열린다" 유형을 전수로 찾아낸다.
//   A. 상품 매칭이 된 주문인데 계정에 그 권한이 없는 건 (권한 누락)
//   B. 상품 매칭 자체가 실패해 대기열에 묶인 건 (unknown_product) — 직원 상품 후보만 추림
//   C. 주문 이메일로 계정을 못 찾은 건
//
// 사용: node scripts/audit_cafe24_entitlement_gap.mjs [데이터디렉토리]
//   기본 데이터디렉토리: /home/ubuntu/aimax-reports/data
// 출력에 이메일은 마스킹해서 찍는다.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.argv[2] || "/home/ubuntu/aimax-reports/data";

const PRODUCT_ORDER = ["yeri", "hyunju", "songi", "yunmi", "jieun", "semu", "maxalert", "nakyung", "hyojin", "sangsu", "eunseo", "blog_team", "bundle"];
const PRODUCTS = new Set(PRODUCT_ORDER);
const MEMBER_ONLY_PRODUCTS = new Set(["eunseo"]);
const BUNDLE_PRODUCTS = PRODUCT_ORDER.filter((p) => !MEMBER_ONLY_PRODUCTS.has(p));
// 아직 출시 전이라 주문이 있어도 권한을 줄 수 없는 상품
const NOT_READY = new Set(["hyojin"]);

const LABEL = {
  yeri: "예리", hyunju: "현주", songi: "송이", yunmi: "윤미", jieun: "지은",
  semu: "세무", maxalert: "맥스", nakyung: "나경", hyojin: "효진", sangsu: "상수(경리)",
  eunseo: "은서", blog_team: "블로그팀", bundle: "통합",
};

// 직원 상품일 가능성이 있는 이름인지 (사람이 최종 판단할 후보 추림용)
const STAFF_HINT = /직원|예리|현주|송이|윤미|지은|나경|상수|효진|맥스|은서|경리|견적|블로그|마케터|영업|자료조사|리서치|스크립트|숏폼|오피스|매니저|알람|판서|세무|세금계산서|통합|번들|bundle|ai\s*직원/i;
// 명백히 직원 상품이 아닌 것 (강의/전자책/멤버십/시스템 메일)
const NON_STAFF = /무료배포|배포판|전자책|가이드북|클래스|웨비나|창업\s*프로그램|패밀리데이|평생회원|평생업데이트|패밀리회원|회원가입|탈퇴|환불|입금|컨설팅|수입|구매대행|사전예약|회원\s*링크|공동구매|제2의뇌|사업자\s*pt|챗봇\s*만드는/i;

function productList(product) {
  if (product === "blog_team") return ["yeri", "hyunju", "blog_team"];
  if (product === "bundle") return [...BUNDLE_PRODUCTS];
  return [product];
}

function orderProducts(order) {
  const set = new Set();
  const primary = String(order?.product || "").trim();
  if (PRODUCTS.has(primary)) productList(primary).forEach((p) => set.add(p));
  for (const item of Array.isArray(order?.products) ? order.products : []) {
    const value = String(item || "").trim();
    if (PRODUCTS.has(value)) productList(value).forEach((p) => set.add(p));
  }
  return [...set];
}

function entitlementProducts(user) {
  const set = new Set();
  const ent = user?.entitlements || {};
  for (const item of Array.isArray(ent.products) ? ent.products : []) {
    const value = String(item || "").trim();
    if (PRODUCTS.has(value)) productList(value).forEach((p) => set.add(p));
  }
  const primary = String(ent.product || "").trim();
  if (PRODUCTS.has(primary)) productList(primary).forEach((p) => set.add(p));
  return set;
}

function entitlementActive(user) {
  const ent = user?.entitlements || {};
  if (ent.status !== "active") return false;
  if (ent.expires_at && Date.parse(ent.expires_at) <= Date.now()) return false;
  return true;
}

function maskEmail(value) {
  const raw = String(value || "").trim();
  if (!raw.includes("@")) return raw ? `${raw.slice(0, 1)}***` : "(없음)";
  const [id, domain] = raw.split("@");
  return `${id.slice(0, 2)}***@${domain}`;
}

function maskName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "(이름없음)";
  return raw.length <= 1 ? raw : `${raw.slice(0, 1)}${"*".repeat(raw.length - 1)}`;
}

function loadJson(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
  if (Array.isArray(raw)) return raw;
  for (const key of ["orders", "users", "items"]) if (Array.isArray(raw[key])) return raw[key];
  return Object.values(raw).find(Array.isArray) || [];
}

const orders = loadJson("cafe24-orders.json");
const users = loadJson("users.json");
const usersByEmail = new Map();
for (const user of users) {
  const key = String(user.email || "").trim().toLowerCase();
  if (key) usersByEmail.set(key, user);
}
const usersById = new Map(users.map((user) => [user.id, user]));

const gaps = [];        // A. 권한 누락
const unmatched = [];   // B. 상품 매칭 실패 (직원 상품 후보)
const noAccount = [];   // C. 계정 없음
const notReady = [];    // 미출시 상품 주문

for (const order of orders) {
  const status = String(order.status || "");
  if (status === "ignored") continue;
  const wanted = orderProducts(order);
  const email = String(order.email || "").trim().toLowerCase();
  const user = usersById.get(order.user_id) || usersByEmail.get(email) || null;

  if (!wanted.length) {
    const name = String(order.product_name || "");
    if (status !== "needs_review") continue;
    if (NON_STAFF.test(name)) continue;
    if (!STAFF_HINT.test(name)) continue;
    unmatched.push({ order, name, user });
    continue;
  }

  if (!user) {
    noAccount.push({ order, wanted });
    continue;
  }

  const held = entitlementProducts(user);
  const active = entitlementActive(user);
  const missing = wanted.filter((p) => !held.has(p));
  const blocked = missing.filter((p) => NOT_READY.has(p));
  const real = missing.filter((p) => !NOT_READY.has(p));
  if (blocked.length) notReady.push({ order, blocked, user });
  if (real.length || (wanted.length && !active)) {
    gaps.push({ order, wanted, missing: real, user, active });
  }
}

const fmt = (list) => list.map((p) => LABEL[p] || p).join(",");

console.log(`데이터: ${DATA_DIR}`);
console.log(`주문 ${orders.length}건 / 계정 ${users.length}건 대조\n`);

console.log(`== A. 결제 주문인데 권한 누락 (${gaps.length}건) ==`);
if (!gaps.length) console.log("없음");
for (const g of gaps.sort((a, b) => String(a.order.order_date).localeCompare(String(b.order.order_date)))) {
  const why = !g.active ? "권한상태 비활성" : `누락:${fmt(g.missing)}`;
  console.log(
    [
      g.order.order_date || "(날짜없음)",
      maskName(g.order.name),
      maskEmail(g.order.email),
      `주문:${g.order.product_name || ""}`,
      `필요:${fmt(g.wanted)}`,
      why,
      `주문상태:${g.order.status}`,
    ].join(" | "),
  );
}

console.log(`\n== B. 상품 매칭 실패 — 직원 상품 후보 (${unmatched.length}건) ==`);
if (!unmatched.length) console.log("없음");
for (const u of unmatched.sort((a, b) => String(a.order.order_date).localeCompare(String(b.order.order_date)))) {
  console.log(
    [
      u.order.order_date || "(날짜없음)",
      maskName(u.order.name),
      maskEmail(u.order.email),
      `상품명:${u.name}`,
      u.user ? `계정있음(보유:${fmt([...entitlementProducts(u.user)]) || "없음"})` : "계정없음",
    ].join(" | "),
  );
}

console.log(`\n== C. 주문은 매칭됐지만 계정을 못 찾음 (${noAccount.length}건) ==`);
if (!noAccount.length) console.log("없음");
for (const n of noAccount.sort((a, b) => String(a.order.order_date).localeCompare(String(b.order.order_date)))) {
  console.log([n.order.order_date || "", maskName(n.order.name), maskEmail(n.order.email), `필요:${fmt(n.wanted)}`, `주문상태:${n.order.status}`].join(" | "));
}

console.log(`\n== D. 미출시 상품 주문 (${notReady.length}건) ==`);
if (!notReady.length) console.log("없음");
for (const n of notReady) {
  console.log([n.order.order_date || "", maskName(n.order.name), maskEmail(n.order.email), `미출시:${fmt(n.blocked)}`].join(" | "));
}
