#!/usr/bin/env node
import { spawn, spawnSync, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DATA_DIR = path.join(os.homedir(), "Documents", "AIMAX-Songi-Local");
const DATA_DIR = process.env.AIMAX_SONGI_LOCAL_DIR || DEFAULT_DATA_DIR;
const DEFAULT_GEMINI_MODEL = process.env.AIMAX_SONGI_GEMINI_MODEL || "gemini-2.5-flash";
const MAX_HTML_BYTES = Number(process.env.AIMAX_SONGI_FETCH_MAX_BYTES || 1024 * 1024);
const VIDEO_MAX_SECONDS = Number(process.env.AIMAX_SONGI_VIDEO_MAX_SECONDS || 75);
const VIDEO_MAX_BYTES = Number(process.env.AIMAX_SONGI_VIDEO_MAX_BYTES || 18 * 1024 * 1024);
const VIDEO_FORMAT = process.env.AIMAX_SONGI_VIDEO_FORMAT || "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]/best";

const PAID_NOTICE = [
  "유료/크레딧 사용 가능 작업입니다.",
  "Apify 또는 Gemini 호출은 --confirm-paid 플래그가 있을 때만 실행합니다.",
  "이미 실행된 Apify run_id가 있으면 새 실행 대신 상태/데이터셋 조회를 우선 사용하세요.",
].join(" ");

function usage() {
  return `송이 로컬 CLI

사용:
  node scripts/songi-local.mjs status
  node scripts/songi-local.mjs profile <instagram_url_or_username> [--apify] [--confirm-paid]
  node scripts/songi-local.mjs analyze <url...> [--project 이름] [--gemini] [--include-video] [--apify] [--confirm-paid]

예:
  node scripts/songi-local.mjs analyze "https://www.youtube.com/watch?v=..." --project "뷰티_후킹"
  node scripts/songi-local.mjs analyze "https://www.youtube.com/watch?v=..." --gemini --include-video --confirm-paid

옵션:
  --project <name>       저장 프로젝트명. 기본값: inbox
  --out <dir>            결과 저장 루트. 기본값: ${DEFAULT_DATA_DIR}
  --gemini               Gemini 심화 분석 실행. 비용 발생 가능.
  --model <id>           Gemini 모델. 기본값: ${DEFAULT_GEMINI_MODEL}
  --include-video        YouTube/Instagram/TikTok 앞부분 영상을 yt-dlp로 내려받아 Gemini에 첨부. 비용/시간 증가.
  --cookies-from-browser <name>  yt-dlp에 브라우저 쿠키 사용. 예: chrome, safari, firefox
  --apify                Instagram/TikTok Apify 수집 실행. 비용 발생 가능.
  --apify-run-id <id>    기존 Apify run_id 재사용.
  --confirm-paid         유료/크레딧 가능 작업 승인.
  --json                 stdout에 JSON만 출력.
  --no-save              파일 저장 생략.
`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {
    command: command || "help",
    urls: [],
    project: "inbox",
    out: DATA_DIR,
    model: DEFAULT_GEMINI_MODEL,
    gemini: false,
    includeVideo: false,
    cookiesFromBrowser: process.env.AIMAX_SONGI_YTDLP_COOKIES_FROM_BROWSER || "",
    apify: false,
    confirmPaid: false,
    json: false,
    save: true,
    apifyRunId: "",
  };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--project") flags.project = rest[++index] || flags.project;
    else if (value === "--out") flags.out = path.resolve(rest[++index] || flags.out);
    else if (value === "--model") flags.model = rest[++index] || flags.model;
    else if (value === "--gemini") flags.gemini = true;
    else if (value === "--include-video") flags.includeVideo = true;
    else if (value === "--cookies-from-browser") flags.cookiesFromBrowser = rest[++index] || "";
    else if (value === "--apify") flags.apify = true;
    else if (value === "--confirm-paid") flags.confirmPaid = true;
    else if (value === "--json") flags.json = true;
    else if (value === "--no-save") flags.save = false;
    else if (value === "--apify-run-id") flags.apifyRunId = rest[++index] || "";
    else if (value === "-h" || value === "--help") flags.command = "help";
    else flags.urls.push(value);
  }
  return flags;
}

function log(flags, message) {
  if (!flags.json) process.stderr.write(`${message}\n`);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function safeSlug(value, fallback = "songi") {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function compactText(value, limit = 300) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function cleanMultiline(value, limit = 8000) {
  const text = String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function stripHtml(html) {
  return cleanMultiline(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\""), 12000);
}

function htmlAttr(html, selector) {
  const pattern = selector === "title"
    ? /<title[^>]*>([\s\S]*?)<\/title>/i
    : new RegExp(`<meta[^>]+(?:name|property)=["']${selector}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const match = String(html || "").match(pattern);
  return compactText(stripHtml(match?.[1] || ""), 500);
}

function inferPlatform(rawUrl) {
  const host = safeUrl(rawUrl)?.hostname.replace(/^www\./i, "").toLowerCase() || "";
  if (/youtu\.be|youtube\.com$/.test(host)) return "YouTube";
  if (/instagram\.com$/.test(host)) return "Instagram";
  if (/tiktok\.com$/.test(host)) return "TikTok";
  if (/naver\.com$/.test(host)) return "Naver";
  if (/threads\.net$/.test(host)) return "Threads";
  return host ? "Web" : "Manual";
}

function instagramUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/instagram\.com$/i.test(url.hostname.replace(/^www\./i, ""))) return "";
    const first = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["p", "reel", "reels", "tv", "stories", "explore"].includes(first.toLowerCase())) return "";
    return first.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  } catch (_error) {
    return raw.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  }
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch (_error) {
    return null;
  }
}

function isPrivateIp(address) {
  if (!address) return true;
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const parts = address.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((x) => !Number.isFinite(x))) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 0;
}

async function assertPublicHttpUrl(rawUrl) {
  const url = safeUrl(rawUrl);
  if (!url) throw codedError("invalid_url", "http/https URL만 사용할 수 있습니다.");
  const host = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".local")) {
    throw codedError("blocked_private_url", "로컬/사설 주소는 수집하지 않습니다.");
  }
  const records = await dns.lookup(host, { all: true }).catch(() => []);
  if (records.some((record) => isPrivateIp(record.address))) {
    throw codedError("blocked_private_url", "사설 IP로 해석되는 URL은 수집하지 않습니다.");
  }
  return url;
}

function codedError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

async function fetchText(rawUrl, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(rawUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "accept": options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "AIMAX-Songi-Local/1.0 (+local research)",
        ...(options.headers || {}),
      },
      method: options.method || "GET",
      body: options.body,
    });
    const array = await response.arrayBuffer();
    const maxBytes = options.maxBytes || MAX_HTML_BYTES;
    if (array.byteLength > maxBytes) throw codedError("response_too_large", "응답이 너무 큽니다.");
    const text = Buffer.from(array).toString("utf8");
    if (!response.ok) {
      const error = codedError("http_error", `HTTP ${response.status}`);
      error.status = response.status;
      error.body = text.slice(0, 1000);
      throw error;
    }
    return { text, status: response.status, finalUrl: response.url, headers: Object.fromEntries(response.headers.entries()) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(rawUrl, options = {}) {
  const result = await fetchText(rawUrl, {
    ...options,
    accept: "application/json",
    headers: {
      "content-type": options.body ? "application/json" : undefined,
      ...(options.headers || {}),
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
    maxBytes: options.maxBytes || 2 * 1024 * 1024,
  });
  return { ...result, json: JSON.parse(result.text || "{}") };
}

async function fetchYouTube(rawUrl) {
  const url = await assertPublicHttpUrl(rawUrl);
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`;
  const oembed = await fetchJson(endpoint, { timeoutMs: 10000 });
  const data = oembed.json || {};
  const title = compactText(data.title || rawUrl, 180);
  const author = compactText(data.author_name || "", 180);
  return {
    ok: true,
    platform: "YouTube",
    title,
    final_url: url.toString(),
    source_text: cleanMultiline([
      `플랫폼: YouTube`,
      `제목: ${title}`,
      author ? `채널: ${author}` : "",
      data.author_url ? `채널 URL: ${data.author_url}` : "",
      `원본 링크: ${url.toString()}`,
      "자막/영상 심화 분석은 --gemini --include-video --confirm-paid 실행 시 진행합니다.",
    ].filter(Boolean).join("\n"), 8000),
    meta: {
      provider: "youtube_oembed",
      author_name: author,
      thumbnail_url: data.thumbnail_url || "",
    },
  };
}

async function fetchGeneric(rawUrl) {
  const url = await assertPublicHttpUrl(rawUrl);
  const result = await fetchText(url.toString(), { timeoutMs: 12000 });
  const html = result.text;
  const title = htmlAttr(html, "og:title") || htmlAttr(html, "title") || compactText(url.toString(), 180);
  const description = htmlAttr(html, "description") || htmlAttr(html, "og:description");
  const body = stripHtml(html);
  return {
    ok: true,
    platform: inferPlatform(url.toString()),
    title,
    final_url: result.finalUrl || url.toString(),
    source_text: cleanMultiline([
      `플랫폼: ${inferPlatform(url.toString())}`,
      `제목: ${title}`,
      description ? `설명: ${description}` : "",
      `원본 링크: ${url.toString()}`,
      "",
      "본문 발췌:",
      body,
    ].filter(Boolean).join("\n"), 8000),
    meta: {
      provider: "generic_html",
      description,
    },
  };
}

async function fetchBasicSource(rawUrl) {
  const platform = inferPlatform(rawUrl);
  if (platform === "YouTube") return fetchYouTube(rawUrl);
  if (platform === "Instagram" || platform === "TikTok") {
    await assertPublicHttpUrl(rawUrl);
    return {
      ok: true,
      platform,
      title: `${platform} 링크`,
      final_url: rawUrl,
      source_text: cleanMultiline([
        `플랫폼: ${platform}`,
        `원본 링크: ${rawUrl}`,
        `${platform}는 기본 URL 읽기만으로 본문을 안정적으로 읽기 어려워 로컬 대기 상태로 저장했습니다.`,
        "실제 영상 분석은 --gemini --include-video --confirm-paid 실행 시 진행합니다.",
        "공개 접근이 막히면 --cookies-from-browser chrome 같은 브라우저 쿠키 옵션이 필요할 수 있습니다.",
      ].join("\n"), 4000),
      meta: { provider: "sns_pending_apify" },
    };
  }
  return fetchGeneric(rawUrl);
}

function normalizeTags(values) {
  const seen = new Set();
  return values
    .flatMap((value) => String(value || "").split(/[,#\n]/))
    .map((value) => value.trim().replace(/^\W+|\W+$/g, ""))
    .filter((value) => value && value.length <= 24)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function deterministicAnalysis(source) {
  const text = cleanMultiline(source.source_text || "", 8000);
  const lines = text.split(/\n+/).map((line) => compactText(line, 220)).filter(Boolean);
  const title = source.title || lines[0] || source.url || "자료";
  const firstUseful = lines.find((line) => !/^플랫폼:|^원본 링크:|^제목:|^채널:|^채널 URL:|^본문 발췌:|^자막\/영상|^실제 공개/.test(line)) || title;
  const hashtagMatches = [...text.matchAll(/#[\p{L}\p{N}_]+/gu)].map((match) => match[0].replace(/^#/, ""));
  const tags = normalizeTags([source.platform, ...hashtagMatches, ...String(title).split(/\s+/).slice(0, 6)]);
  const summary = compactText(firstUseful, 220) || compactText(title, 220);
  const platformFollowUp = source.platform === "YouTube"
    ? "영상 장면 분석은 Gemini 영상 첨부 실행 후 더 정확해집니다."
    : ["Instagram", "TikTok"].includes(source.platform)
      ? "SNS 원문 수집은 Apify 실행 후 더 정확해집니다."
      : "본문 전체 맥락은 Gemini 텍스트 분석을 실행하면 더 정교해집니다.";
  return {
    summary,
    transcript: "",
    tags,
    insights: [
      compactText(`핵심 소재는 "${title}"로 보이며, 첫 인상은 ${summary}`, 220),
      "실제 성과 수치가 없으면 조회/좋아요/댓글 원인은 추정으로만 다룹니다.",
      platformFollowUp,
    ],
    hooks: [
      compactText(`제목/첫 정보가 후킹 역할을 합니다: ${title}`, 220),
      "숫자, 전후 대비, 문제 제기, 타깃 직접 호명 여부를 추가 확인하면 좋습니다.",
    ],
    flow: [
      { timestamp: "0:00", description: "링크/제목/메타데이터 중심으로 1차 구조를 파악했습니다." },
      { timestamp: "구간 2", description: compactText(summary, 220) },
    ],
    benchmarking: [
      "브리프 재활용 시 훅, 첫 자막, CTA, 댓글 유발 장치를 분리해서 참고하세요.",
      "동일 카테고리 자료 3개 이상을 모으면 반복 패턴 비교가 유효해집니다.",
    ],
    copywriting_points: [
      compactText(`카피 기준점: ${title}`, 180),
      "구체성, 대조, 숫자, 감정 자극, 타깃 명시 여부를 체크하세요.",
    ],
    visual_cues: [
      "영상/이미지 자체는 아직 분석하지 않았습니다.",
      "Gemini 영상 첨부 시 첫 장면, 전환 밀도, 화면 자막을 보강합니다.",
    ],
    performance_reasons: {
      views: "실제 조회수 데이터 없음. 제목/소재의 즉시 이해도와 플랫폼 맥락으로만 추정 가능합니다.",
      likes: "실제 좋아요 데이터 없음. 공감/실용성/정체성 표현 요소를 추가 확인해야 합니다.",
      comments: "실제 댓글 데이터 없음. 논쟁, 질문, 경험 공유 유도 장치를 확인해야 합니다.",
      saves: "실제 저장수 데이터 없음. 체크리스트, 방법론, 비교표가 있으면 저장 유도 가능성이 커집니다.",
    },
    hook_note: compactText(`초반 훅 후보: ${title}`, 260),
    copy_note: "제목과 설명에서 구체성/대조/숫자/감정 단서를 분리해 다음 제작 카피로 재사용하세요.",
    structure_note: "현재는 URL 메타데이터 기반 1차 구조입니다. 영상/자막 수집 후 문제 제기 -> 전개 -> 증거 -> CTA 흐름으로 다시 정리할 수 있습니다.",
    performance_note: "성과 수치가 없어서 원인 분석은 보수적으로 표시했습니다.",
    personalized_plan: "비슷한 카테고리 레퍼런스를 3개 이상 추가한 뒤 공통 훅과 CTA만 추려 제작 브리프로 넘기세요.",
    script_brief: `참고 소재: ${title}\n추천 훅: ${compactText(title, 120)}\n주의: 실제 성과 수치 없이 과장하지 않기.`,
  };
}

function readKeychain(account, service) {
  if (process.platform !== "darwin") return "";
  try {
    return execFileSync("security", ["find-generic-password", "-a", account, "-s", service, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2500,
    }).trim();
  } catch (_error) {
    return "";
  }
}

function secret(name) {
  const envNames = {
    GEMINI_API_KEY: ["GEMINI_API_KEY", "AIMAX_GEMINI_API_KEY"],
    APIFY_API_TOKEN: ["APIFY_API_TOKEN", "AIMAX_APIFY_API_TOKEN"],
  }[name] || [name];
  for (const key of envNames) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  if (name === "GEMINI_API_KEY") {
    return readKeychain("gemini_api_key", "AIMAX")
      || readKeychain("gemini_api_key", "NaverBlogAuto")
      || readKeychain("minsu-api", "GEMINI_API_KEY");
  }
  if (name === "APIFY_API_TOKEN") {
    return readKeychain("apify_api_token", "AIMAX")
      || readKeychain("minsu-api", "APIFY_API_TOKEN");
  }
  return "";
}

function executable(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return {
    available: result.status === 0,
    command,
    version: compactText(`${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/)[0] || "", 100),
  };
}

function apifyActorConfig(url) {
  const platform = inferPlatform(url);
  if (platform === "Instagram") {
    return {
      platform,
      actorId: process.env.AIMAX_SONGI_APIFY_INSTAGRAM_ACTOR || "apify/instagram-reel-scraper",
      pricingLabel: "Instagram Reel Scraper: actor/결과 수에 따라 Apify 비용 발생 가능",
      input: {
        username: [url],
        resultsLimit: 1,
        includeSharesCount: false,
        includeTranscript: false,
        includeDownloadedVideo: false,
      },
    };
  }
  if (platform === "TikTok") {
    return {
      platform,
      actorId: process.env.AIMAX_SONGI_APIFY_TIKTOK_ACTOR || "clockworks/tiktok-video-scraper",
      pricingLabel: "TikTok Video Scraper: actor/결과 수에 따라 Apify 비용 발생 가능",
      input: {
        postURLs: [url],
        scrapeRelatedVideos: false,
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
      },
    };
  }
  return null;
}

function apifyProfileActorConfig(username) {
  return {
    platform: "Instagram Profile",
    actorId: process.env.AIMAX_SONGI_APIFY_INSTAGRAM_PROFILE_ACTOR || "apify/instagram-profile-scraper",
    pricingLabel: "Instagram Profile Scraper: actor/결과 수에 따라 Apify 비용 발생 가능",
    input: {
      usernames: [username],
      includeAboutSection: false,
    },
  };
}

function actorPath(actorId) {
  return encodeURIComponent(String(actorId || "").replace("/", "~"));
}

async function runApify(url, flags) {
  if (!flags.confirmPaid) throw codedError("paid_confirmation_required", PAID_NOTICE);
  const token = secret("APIFY_API_TOKEN");
  if (!token) throw codedError("apify_key_missing", "APIFY_API_TOKEN 또는 Keychain AIMAX/apify_api_token이 필요합니다.");
  const config = apifyActorConfig(url);
  if (!config) throw codedError("apify_not_supported", "현재 Apify는 Instagram/TikTok 링크만 지원합니다.");
  let run = null;
  if (flags.apifyRunId) {
    const endpoint = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(flags.apifyRunId)}?waitForFinish=0`;
    run = (await fetchJson(endpoint, { headers: { authorization: `Bearer ${token}` } })).json?.data;
  } else {
    const endpoint = `https://api.apify.com/v2/acts/${actorPath(config.actorId)}/runs?waitForFinish=0`;
    run = (await fetchJson(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: config.input,
    })).json?.data;
  }
  if (!run?.id) throw codedError("apify_run_missing", "Apify run_id를 받지 못했습니다.");
  for (let attempt = 0; attempt < 8 && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(String(run.status || "").toUpperCase()); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const endpoint = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(run.id)}?waitForFinish=5`;
    run = (await fetchJson(endpoint, { headers: { authorization: `Bearer ${token}` } })).json?.data || run;
  }
  if (String(run.status || "").toUpperCase() !== "SUCCEEDED") {
    const error = codedError("apify_not_succeeded", `Apify run 상태: ${run.status || "unknown"}`);
    error.run = run;
    throw error;
  }
  const datasetId = run.defaultDatasetId;
  const items = datasetId
    ? (await fetchJson(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=3`, {
      headers: { authorization: `Bearer ${token}` },
      maxBytes: 3 * 1024 * 1024,
    })).json
    : [];
  const item = Array.isArray(items) ? (items[0] || {}) : {};
  const caption = compactText(item.caption || item.text || item.description || item.title || item.shortCode || "", 1200);
  const author = compactText(item.ownerUsername || item.username || item.authorMeta?.name || item.author?.username || "", 180);
  const stats = [
    item.videoViewCount || item.playCount || item.viewCount ? `조회 ${item.videoViewCount || item.playCount || item.viewCount}` : "",
    item.likesCount || item.diggCount ? `좋아요 ${item.likesCount || item.diggCount}` : "",
    item.commentsCount || item.commentCount ? `댓글 ${item.commentsCount || item.commentCount}` : "",
    item.sharesCount || item.shareCount ? `공유 ${item.sharesCount || item.shareCount}` : "",
  ].filter(Boolean).join(" · ");
  return {
    platform: config.platform,
    title: compactText(caption || url, 180),
    source_text: cleanMultiline([
      `Apify Actor: ${config.actorId}`,
      `Apify run_id: ${run.id}`,
      `원본 링크: ${url}`,
      author ? `작성자: ${author}` : "",
      caption ? `캡션/본문:\n${caption}` : "",
      stats,
    ].filter(Boolean).join("\n\n"), 8000),
    apify: {
      status: "completed",
      actor_id: config.actorId,
      run_id: run.id,
      dataset_id: datasetId || "",
      status_url: `https://console.apify.com/actors/runs/${run.id}`,
      pricing_label: config.pricingLabel,
      cost_usd: Number.isFinite(Number(run.usageTotalUsd)) ? Number(run.usageTotalUsd) : null,
      item_count: Array.isArray(items) ? items.length : 0,
    },
  };
}

async function runApifyProfile(username, flags) {
  if (!flags.confirmPaid) throw codedError("paid_confirmation_required", PAID_NOTICE);
  const token = secret("APIFY_API_TOKEN");
  if (!token) throw codedError("apify_key_missing", "APIFY_API_TOKEN 또는 Keychain AIMAX/apify_api_token이 필요합니다.");
  const config = apifyProfileActorConfig(username);
  let run = null;
  if (flags.apifyRunId) {
    const endpoint = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(flags.apifyRunId)}?waitForFinish=0`;
    run = (await fetchJson(endpoint, { headers: { authorization: `Bearer ${token}` } })).json?.data;
  } else {
    const endpoint = `https://api.apify.com/v2/acts/${actorPath(config.actorId)}/runs?waitForFinish=0`;
    run = (await fetchJson(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: config.input,
    })).json?.data;
  }
  if (!run?.id) throw codedError("apify_run_missing", "Apify run_id를 받지 못했습니다.");
  for (let attempt = 0; attempt < 10 && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(String(run.status || "").toUpperCase()); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const endpoint = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(run.id)}?waitForFinish=5`;
    run = (await fetchJson(endpoint, { headers: { authorization: `Bearer ${token}` } })).json?.data || run;
  }
  if (String(run.status || "").toUpperCase() !== "SUCCEEDED") {
    const error = codedError("apify_not_succeeded", `Apify run 상태: ${run.status || "unknown"}`);
    error.run = run;
    throw error;
  }
  const datasetId = run.defaultDatasetId;
  const items = datasetId
    ? (await fetchJson(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=3`, {
      headers: { authorization: `Bearer ${token}` },
      maxBytes: 3 * 1024 * 1024,
    })).json
    : [];
  const item = Array.isArray(items) ? (items[0] || {}) : {};
  return {
    item,
    apify: {
      status: "completed",
      actor_id: config.actorId,
      run_id: run.id,
      dataset_id: datasetId || "",
      status_url: `https://console.apify.com/actors/runs/${run.id}`,
      pricing_label: config.pricingLabel,
      cost_usd: Number.isFinite(Number(run.usageTotalUsd)) ? Number(run.usageTotalUsd) : null,
      item_count: Array.isArray(items) ? items.length : 0,
    },
  };
}

async function fetchInstagramPublicProfile(username) {
  const endpoint = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const result = await fetchJson(endpoint, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "X-IG-App-ID": "936619743392459",
    },
    timeoutMs: 12000,
    maxBytes: 3 * 1024 * 1024,
  });
  return result.json?.data?.user || {};
}

function profileField(item, keys, fallback = "") {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], item);
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function normalizeProfile(username, raw, source, apify = null) {
  const latestPosts = Array.isArray(raw.latestPosts) ? raw.latestPosts : [];
  return {
    username: profileField(raw, ["username", "userName", "ownerUsername"], username),
    full_name: profileField(raw, ["fullName", "full_name", "full_name", "name"], ""),
    biography: profileField(raw, ["biography", "bio", "description"], ""),
    external_url: profileField(raw, ["externalUrl", "external_url", "url"], ""),
    followers: Number(profileField(raw, ["followersCount", "followers", "edge_followed_by.count"], 0)) || 0,
    following: Number(profileField(raw, ["followsCount", "followingCount", "edge_follow.count"], 0)) || 0,
    posts: Number(profileField(raw, ["postsCount", "mediaCount", "edge_owner_to_timeline_media.count"], 0)) || 0,
    highlights: Number(profileField(raw, ["highlightReelCount", "highlight_reel_count"], 0)) || 0,
    category: profileField(raw, ["businessCategoryName", "business_category_name", "categoryName"], ""),
    is_business: Boolean(profileField(raw, ["isBusinessAccount", "is_business_account"], false)),
    is_professional: Boolean(profileField(raw, ["isProfessionalAccount", "is_professional_account"], false)),
    latest_posts: latestPosts.slice(0, 8).map((post) => ({
      url: profileField(post, ["url", "displayUrl", "shortCode"], ""),
      caption: compactText(profileField(post, ["caption", "text", "description"], ""), 220),
      likes: Number(profileField(post, ["likesCount", "likeCount", "likes"], 0)) || 0,
      comments: Number(profileField(post, ["commentsCount", "commentCount", "comments"], 0)) || 0,
    })),
    source,
    apify,
    captured_at: new Date().toISOString(),
  };
}

function profileStrategy(profile) {
  const bio = profile.biography || "";
  return {
    positioning: "AIMAX를 'AI 직원 만드는 공장'으로 보여주는 대표자/교육형 채널",
    target: "AI 자동화와 직원형 AI 도입에 관심 있는 대표, 1인 사업자, 소상공인, 교육 수강 후보",
    promise: bio.includes("1,000만원") ? "매월 인건비 1,000만원 절감이라는 비용 절감 약속" : "AI 직원으로 반복 업무를 줄이는 실무형 약속",
    tone: "대표가 직접 보여주는 실험실/라이브/제작기 톤. 과장된 미래담보다 실제 만들어지는 직원과 결과물을 보여주는 쪽이 강함",
    content_pillars: [
      "AI 직원 제작 과정",
      "대표/소상공인 반복 업무 절감 사례",
      "라이브 강의/워크숍 전후 변화",
      "예리/현주/송이 같은 직원별 실제 작업 장면",
      "비용 절감 숫자와 Before/After",
    ],
    benchmark_conversion_rule: "벤치마킹 영상의 외형을 그대로 복제하지 말고, 훅/구도/리듬/자막 장치를 AIMAX의 'AI 직원 제작/업무 절감' 메시지로 변환한다.",
  };
}

function renderProfileMarkdown(profile) {
  const strategy = profileStrategy(profile);
  const apifyCost = profile.apify?.cost_usd == null ? "unknown" : `$${profile.apify.cost_usd}`;
  return `# 송이 기준 프로필 - @${profile.username}

생성: ${profile.captured_at}
수집: ${profile.source}

## 프로필 스냅샷
- 이름: ${profile.full_name || ""}
- 소개: ${String(profile.biography || "").replace(/\n/g, " / ")}
- 링크: ${profile.external_url || ""}
- 팔로워: ${profile.followers.toLocaleString("ko-KR")}
- 팔로잉: ${profile.following.toLocaleString("ko-KR")}
- 게시물: ${profile.posts.toLocaleString("ko-KR")}
- 하이라이트: ${profile.highlights.toLocaleString("ko-KR")}
- 비즈니스/프로페셔널: ${profile.is_business ? "business" : "non-business"} / ${profile.is_professional ? "professional" : "personal"}

## 채널 기준
- 포지셔닝: ${strategy.positioning}
- 타깃: ${strategy.target}
- 핵심 약속: ${strategy.promise}
- 톤: ${strategy.tone}

## 콘텐츠 기둥
${mdList(strategy.content_pillars)}

## 벤치마킹 변환 규칙
${strategy.benchmark_conversion_rule}

## 앞으로 송이가 벤치마킹 영상을 분석할 때 붙일 항목
- 이 영상의 훅을 @${profile.username} 채널식으로 바꾸면?
- 이 장면/구도를 AI 직원 제작 과정으로 치환하면?
- 자막 첫 문장을 대표님 타깃의 문제 제기로 바꾸면?
- CTA를 라이브/상담/자료 신청으로 연결하면?
- 비용 절감, 시간 절감, 직원 대체 가능성을 어떻게 증거화하면?

## 최근 게시물 샘플
${profile.latest_posts.length ? profile.latest_posts.map((post, index) => `- ${index + 1}. ${post.caption || post.url || "내용 없음"}${post.likes ? ` · 좋아요 ${post.likes}` : ""}${post.comments ? ` · 댓글 ${post.comments}` : ""}`).join("\n") : "- Apify 결과에 최근 게시물 상세가 없거나 공개 API 스냅샷만 사용했습니다."}

## 비용
- Apify: ${profile.apify ? apifyCost : "$0, 사용 안 함"}
- Gemini: $0, 사용 안 함
`;
}

function saveProfileBaseline(profile, flags) {
  const dir = path.join(flags.out, "profile-baselines", profile.username || "instagram");
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "profile-baseline.json");
  const mdPath = path.join(dir, "profile-baseline.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, renderProfileMarkdown(profile), "utf8");
  return { ...profile, files: { json: jsonPath, markdown: mdPath, dir } };
}

async function handleProfile(flags) {
  const username = instagramUsername(flags.urls[0] || "");
  if (!username) throw codedError("instagram_username_required", "Instagram 프로필 URL 또는 사용자명을 넣어주세요.");
  let profile = null;
  if (flags.apify) {
    const result = await runApifyProfile(username, flags);
    profile = normalizeProfile(username, result.item, "apify_profile_scraper", result.apify);
  } else {
    const raw = await fetchInstagramPublicProfile(username);
    profile = normalizeProfile(username, raw, "instagram_public_web_profile", null);
  }
  const saved = saveProfileBaseline(profile, flags);
  return { ok: true, profile: saved };
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = codedError(options.timeoutCode || "process_timeout", `${command} 시간이 초과되었습니다.`);
      error.stderr = stderr.slice(-4000);
      reject(error);
    }, options.timeoutMs || 120000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk.toString("utf8")}`.slice(-12000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-12000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = codedError(options.errorCode || "process_failed", `${command} 실패`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function findDownloadedMedia(basePath) {
  const dir = path.dirname(basePath);
  const base = path.basename(basePath);
  if (!fs.existsSync(dir)) return "";
  return fs.readdirSync(dir)
    .filter((file) => file.startsWith(base) && [".mp4", ".webm", ".mov", ".mkv"].includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(dir, file))
    .filter((file) => fs.statSync(file).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || "";
}

async function prepareVideoContext(source, runDir, flags) {
  const platform = inferPlatform(source.url);
  if (!["YouTube", "Instagram", "TikTok"].includes(platform)) {
    return { parts: [], media: { status: "unsupported", note: "영상 첨부는 YouTube/Instagram/TikTok 링크만 지원" } };
  }
  const ytdlp = executable("yt-dlp");
  if (!ytdlp.available) return { parts: [], media: { status: "failed", error: "yt_dlp_missing" } };
  const mediaDir = path.join(runDir, "media");
  fs.mkdirSync(mediaDir, { recursive: true });
  const basePath = path.join(mediaDir, crypto.createHash("sha256").update(source.url).digest("hex").slice(0, 16));
  const output = `${basePath}.%(ext)s`;
  const maxMb = Math.max(4, Math.ceil(VIDEO_MAX_BYTES / 1024 / 1024));
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--force-overwrites",
    "--max-filesize", `${maxMb}m`,
    "--download-sections", `*0-${Math.max(15, VIDEO_MAX_SECONDS)}`,
    "-f", VIDEO_FORMAT,
    "--merge-output-format", "mp4",
    "-o", output,
  ];
  if (flags.cookiesFromBrowser) args.push("--cookies-from-browser", flags.cookiesFromBrowser);
  args.push(source.url);
  await runProcess("yt-dlp", args, {
    timeoutMs: Math.max(70000, VIDEO_MAX_SECONDS * 2500),
    errorCode: "video_download_failed",
  });
  const filePath = findDownloadedMedia(basePath);
  if (!filePath) return { parts: [], media: { status: "failed", error: "video_file_missing" } };
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > VIDEO_MAX_BYTES) {
    return { parts: [], media: { status: "failed", error: "video_too_large", bytes: bytes.length } };
  }
  return {
    parts: [{ inlineData: { data: bytes.toString("base64"), mimeType: "video/mp4" } }],
    media: {
      status: "attached",
      source: `${platform.toLowerCase()}_yt_dlp`,
      file_path: filePath,
      bytes: bytes.length,
      duration_cap_seconds: VIDEO_MAX_SECONDS,
    },
  };
}

function geminiPricing(model) {
  const id = String(model || "").toLowerCase();
  if (id.includes("2.5-flash-lite")) return { input: 0.10, output: 0.40, source: "Google Gemini API pricing, standard paid tier" };
  if (id.includes("2.5-flash")) return { input: 0.30, output: 2.50, source: "Google Gemini API pricing, standard paid tier" };
  if (id.includes("2.5-pro")) return { input: 2.25, output: 18.00, source: "Google Gemini API pricing, <=200k tokens standard paid tier" };
  return { input: 0, output: 0, source: "unknown_model_pricing" };
}

function estimateGeminiCost(model, usage = {}) {
  const pricing = geminiPricing(model);
  const inputTokens = Number(usage.promptTokenCount || usage.inputTokenCount || 0);
  const outputTokens = Number(usage.candidatesTokenCount || usage.outputTokenCount || 0);
  const inputUsd = inputTokens * pricing.input / 1_000_000;
  const outputUsd = outputTokens * pricing.output / 1_000_000;
  const totalUsd = inputUsd + outputUsd;
  return {
    currency: "USD",
    estimated_usd: Number.isFinite(totalUsd) ? Number(totalUsd.toFixed(6)) : null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_price_per_1m: pricing.input,
    output_price_per_1m: pricing.output,
    pricing_source: pricing.source,
  };
}

function geminiPrompt(source, fallback) {
  return [
    "너는 AIMAX 자료조사원 송이다. 아래 자료를 숏폼 제작자가 바로 활용할 수 있는 콘텐츠 기획 브리프로 정리해라.",
    "규칙: 확인되지 않은 성과 수치를 만들지 말고, 숫자는 원문에 있을 때만 언급한다. 한국어로 답한다. Markdown 없이 JSON 객체만 출력한다.",
    "영상이 첨부되어 있으면 화면 전환, 자막/오버레이, 장면 밀도, 초반 3초 후킹을 우선 분석한다.",
    "JSON 스키마: {\"summary\":\"...\",\"transcript\":\"...\",\"tags\":[\"...\"],\"insights\":[\"...\"],\"hooks\":[\"...\"],\"flow\":[{\"timestamp\":\"0:00-0:03\",\"description\":\"...\"}],\"benchmarking\":[\"...\"],\"copywriting_points\":[\"...\"],\"visual_cues\":[\"...\"],\"performance_reasons\":{\"views\":\"...\",\"likes\":\"...\",\"comments\":\"...\",\"saves\":\"...\"},\"hook_note\":\"...\",\"copy_note\":\"...\",\"structure_note\":\"...\",\"performance_note\":\"...\",\"personalized_plan\":\"...\",\"script_brief\":\"...\"}",
    "",
    `제목: ${source.title || ""}`,
    `URL: ${source.url || ""}`,
    `플랫폼: ${source.platform || ""}`,
    "",
    "자료 원문:",
    cleanMultiline(source.source_text || "", 6500) || "(원문 없음)",
    "",
    "1차 로컬 분석:",
    JSON.stringify(fallback, null, 2),
  ].join("\n");
}

function parseJsonFromText(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch (__error) {
        return null;
      }
    }
  }
  return null;
}

function sanitizeAnalysis(data, fallback) {
  const value = data && typeof data === "object" ? data : {};
  return {
    ...fallback,
    ...Object.fromEntries(Object.entries(value).filter(([_, v]) => v != null)),
    tags: normalizeTags(value.tags?.length ? value.tags : fallback.tags),
    insights: Array.isArray(value.insights) ? value.insights.slice(0, 6).map((x) => compactText(x, 240)) : fallback.insights,
    hooks: Array.isArray(value.hooks) ? value.hooks.slice(0, 6).map((x) => compactText(x, 240)) : fallback.hooks,
    benchmarking: Array.isArray(value.benchmarking) ? value.benchmarking.slice(0, 6).map((x) => compactText(x, 260)) : fallback.benchmarking,
    copywriting_points: Array.isArray(value.copywriting_points) ? value.copywriting_points.slice(0, 6).map((x) => compactText(x, 240)) : fallback.copywriting_points,
    visual_cues: Array.isArray(value.visual_cues) ? value.visual_cues.slice(0, 6).map((x) => compactText(x, 240)) : fallback.visual_cues,
  };
}

async function runGemini(source, fallback, flags, runDir) {
  if (!flags.confirmPaid) throw codedError("paid_confirmation_required", PAID_NOTICE);
  const apiKey = secret("GEMINI_API_KEY");
  if (!apiKey) throw codedError("gemini_key_missing", "GEMINI_API_KEY 또는 Keychain AIMAX/gemini_api_key가 필요합니다.");
  let media = { parts: [], media: { status: "skipped", note: "영상 첨부 안 함" } };
  if (flags.includeVideo) {
    media = await prepareVideoContext(source, runDir, flags);
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(flags.model)}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [...media.parts, { text: geminiPrompt(source, fallback) }],
      },
    ],
    generationConfig: {
      temperature: 0.25,
      responseMimeType: "application/json",
    },
  };
  const response = await fetchJson(endpoint, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey },
    body,
    timeoutMs: 90000,
    maxBytes: 1024 * 1024,
  });
  const text = (response.json?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n").trim();
  const parsed = parseJsonFromText(text);
  if (!parsed) throw codedError("gemini_invalid_json", "Gemini 응답 JSON을 해석하지 못했습니다.");
  return {
    analysis: sanitizeAnalysis(parsed, fallback),
    ai_analysis: {
      status: "completed",
      provider: "gemini",
      model: flags.model,
      usage: response.json?.usageMetadata || {},
      cost: estimateGeminiCost(flags.model, response.json?.usageMetadata || {}),
      media: media.media,
    },
  };
}

function costSummary(result) {
  const geminiUsd = Number(result.ai_analysis?.cost?.estimated_usd);
  const apifyUsd = Number(result.apify?.cost_usd);
  const known = [];
  if (Number.isFinite(geminiUsd)) known.push(geminiUsd);
  if (Number.isFinite(apifyUsd)) known.push(apifyUsd);
  return {
    currency: "USD",
    total_known_usd: known.length ? Number(known.reduce((sum, value) => sum + value, 0).toFixed(6)) : 0,
    gemini_estimated_usd: Number.isFinite(geminiUsd) ? geminiUsd : null,
    apify_reported_usd: Number.isFinite(apifyUsd) ? apifyUsd : null,
    note: known.length ? "Gemini는 usageMetadata 기반 추정치입니다. 무료 티어/프로모션/세금은 계정 청구서와 다를 수 있습니다." : "유료 API를 사용하지 않았습니다.",
  };
}

function mdList(items) {
  return (items || []).filter(Boolean).map((item) => `- ${item}`).join("\n");
}

function renderMarkdown(result) {
  const a = result.analysis || {};
  return `# 송이 로컬 리서치 결과

프로젝트: ${result.project}
생성: ${result.created_at}
플랫폼: ${result.platform}
URL: ${result.url}

## 요약
${a.summary || ""}

## 태그
${(a.tags || []).map((tag) => `#${tag}`).join(" ")}

## 인사이트
${mdList(a.insights)}

## 후킹
${mdList(a.hooks)}

## 흐름
${(a.flow || []).map((item) => `- ${item.timestamp || ""}: ${item.description || item.text || item}`).join("\n")}

## 카피라이팅 포인트
${mdList(a.copywriting_points)}

## 비주얼 단서
${mdList(a.visual_cues)}

## 성과 원인
- 조회: ${a.performance_reasons?.views || ""}
- 좋아요: ${a.performance_reasons?.likes || ""}
- 댓글: ${a.performance_reasons?.comments || ""}
- 저장: ${a.performance_reasons?.saves || ""}

## 벤치마킹 메모
${mdList(a.benchmarking)}

## 다음 제작 브리프
${a.script_brief || ""}

## 원문/수집 상태
- 제목: ${result.title || ""}
- 수집: ${result.fetch_status || ""}
- Apify: ${result.apify?.status || "not_used"}
- Gemini: ${result.ai_analysis?.status || "not_used"}
${result.ai_analysis?.media ? `- 영상 첨부: ${result.ai_analysis.media.status || ""}` : ""}

## 비용
- 총 추정: $${result.cost?.total_known_usd ?? 0}
- Gemini 추정: ${result.cost?.gemini_estimated_usd == null ? "not_used" : `$${result.cost.gemini_estimated_usd}`}
- Apify 보고: ${result.cost?.apify_reported_usd == null ? "not_used" : `$${result.cost.apify_reported_usd}`}
`;
}

function saveResult(result, flags, runDir) {
  if (!flags.save) return result;
  fs.mkdirSync(runDir, { recursive: true });
  const jsonPath = path.join(runDir, "result.json");
  const mdPath = path.join(runDir, "result.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(result), "utf8");
  result.files = { json: jsonPath, markdown: mdPath, run_dir: runDir };
  return result;
}

async function analyzeUrl(url, flags, index = 0) {
  const createdAt = new Date().toISOString();
  const stamp = `${nowStamp()}-${String(index + 1).padStart(2, "0")}`;
  const runDir = path.join(flags.out, safeSlug(flags.project), "runs", `${stamp}-${safeSlug(url, "link")}`);
  log(flags, `송이: 링크 읽는 중: ${url}`);
  let source = await fetchBasicSource(url);
  source.url = url;
  source.project = flags.project;
  let apify = null;
  if (flags.apify) {
    log(flags, "송이: Apify 수집 준비");
    const apifyResult = await runApify(url, flags);
    apify = apifyResult.apify;
    source = {
      ...source,
      ...apifyResult,
      source_text: cleanMultiline([apifyResult.source_text, source.source_text].filter(Boolean).join("\n\n"), 8000),
    };
  }
  const fallback = deterministicAnalysis(source);
  let analysis = fallback;
  let aiAnalysis = null;
  if (flags.gemini) {
    log(flags, `송이: Gemini 심화 분석 준비 (${flags.model}${flags.includeVideo ? ", video" : ", text"})`);
    const gemini = await runGemini(source, fallback, flags, runDir);
    analysis = gemini.analysis;
    aiAnalysis = gemini.ai_analysis;
  }
  const result = {
    ok: true,
    project: flags.project,
    created_at: createdAt,
    title: source.title || url,
    url,
    platform: source.platform || inferPlatform(url),
    final_url: source.final_url || url,
    fetch_status: source.meta?.provider || "fetched",
    source_text: source.source_text,
    analysis,
    apify,
    ai_analysis: aiAnalysis,
    cost: null,
    cost_guard: {
      apify_requested: flags.apify,
      gemini_requested: flags.gemini,
      include_video: flags.includeVideo,
      confirm_paid: flags.confirmPaid,
      model: flags.model,
    },
  };
  result.cost = costSummary(result);
  return saveResult(result, flags, runDir);
}

function statusPayload() {
  return {
    ok: true,
    project_root: PROJECT_ROOT,
    data_dir: DATA_DIR,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    tools: {
      yt_dlp: executable("yt-dlp"),
      ffmpeg: executable("ffmpeg", ["-version"]),
    },
    secrets: {
      gemini: Boolean(secret("GEMINI_API_KEY")),
      apify: Boolean(secret("APIFY_API_TOKEN")),
    },
    paid_guard: "Apify/Gemini calls require --confirm-paid.",
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.command === "help" || !flags.command) {
    process.stdout.write(usage());
    return;
  }
  if (flags.command === "status") {
    const payload = statusPayload();
    process.stdout.write(flags.json ? `${JSON.stringify(payload, null, 2)}\n` : `${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  if (flags.command === "profile") {
    if ((flags.apify || flags.gemini || flags.includeVideo) && !flags.confirmPaid) {
      throw codedError("paid_confirmation_required", PAID_NOTICE);
    }
    const payload = await handleProfile(flags);
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderProfileMarkdown(payload.profile)}\n`);
      if (payload.profile.files?.markdown) process.stdout.write(`저장: ${payload.profile.files.markdown}\n`);
    }
    return;
  }
  if (flags.command !== "analyze") throw codedError("unknown_command", `알 수 없는 명령: ${flags.command}`);
  if (!flags.urls.length) throw codedError("url_required", "분석할 URL을 1개 이상 넣어주세요.");
  if ((flags.apify || flags.gemini || flags.includeVideo) && !flags.confirmPaid) {
    throw codedError("paid_confirmation_required", PAID_NOTICE);
  }
  const results = [];
  for (const [index, url] of flags.urls.entries()) {
    results.push(await analyzeUrl(url, flags, index));
  }
  const payload = { ok: true, count: results.length, results };
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    for (const result of results) {
      process.stdout.write(`\n${renderMarkdown(result)}\n`);
      if (result.files?.markdown) process.stdout.write(`저장: ${result.files.markdown}\n`);
    }
  }
}

main().catch((error) => {
  const payload = {
    ok: false,
    error: error.code || "songi_local_failed",
    message: error.message || String(error),
    run_id: error.run?.id || "",
    status_url: error.run?.id ? `https://console.apify.com/actors/runs/${error.run.id}` : "",
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
});
