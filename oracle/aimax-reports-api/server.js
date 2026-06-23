Total output lines: 14683

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");
const zlib = require("node:zlib");
const childProcess = require("node:child_process");

const HOST = process.env.AIMAX_REPORT_HOST || "127.0.0.1";
const PORT = Number(process.env.AIMAX_REPORT_PORT || 18988);
const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || defaultReportDataDir();
const AUTH_TOKEN = (process.env.AIMAX_REPORT_TOKEN || "").trim();
const ADMIN_TOKEN = (process.env.AIMAX_ADMIN_TOKEN || "").trim();
const ADMIN_PASSWORD = (process.env.AIMAX_ADMIN_PASSWORD || "").trim();
const MAX_BODY_BYTES = Number(process.env.AIMAX_REPORT_MAX_BODY_BYTES || 3 * 1024 * 1024);
const RESEARCH_FETCH_TIMEOUT_MS = Number(process.env.AIMAX_RESEARCH_FETCH_TIMEOUT_MS || 7000);
const RESEARCH_FETCH_MAX_BYTES = Number(process.env.AIMAX_RESEARCH_FETCH_MAX_BYTES || 1024 * 1024);
const RESEARCH_PAID_LOCK_TTL_MS = Number(process.env.AIMAX_RESEARCH_PAID_LOCK_TTL_MS || 10 * 60 * 1000);
const SESSION_TTL_DAYS = Number(process.env.AIMAX_SESSION_TTL_DAYS || 30);
const ADMIN_SESSION_TTL_HOURS = Number(process.env.AIMAX_ADMIN_SESSION_TTL_HOURS || 12);
const SETUP_TOKEN_TTL_DAYS = Number(process.env.AIMAX_SETUP_TOKEN_TTL_DAYS || 7);
const AGENT_JOB_CLAIM_TTL_SECONDS = Number(process.env.AIMAX_AGENT_JOB_CLAIM_TTL_SECONDS || 24 * 60 * 60);
const AGENT_JOB_START_TIMEOUT_SECONDS = Number(process.env.AIMAX_AGENT_JOB_START_TIMEOUT_SECONDS || 3 * 60);
const YERI_GENERATING_STALE_MS = Number(process.env.AIMAX_YERI_GENERATING_STALE_MS || 30 * 60 * 1000);
// running/ready_for_publish 잡이 러너 중단으로 좀비가 되는 것을 막는 스윕 임계값.
// updated_at(모든 로그/상태 갱신 시 전진) 기준 무진행 한계 + 러너 하트비트 끊김 유예.
const YERI_RUNNING_STALE_MS = Number(process.env.AIMAX_YERI_RUNNING_STALE_MS || 45 * 60 * 1000);
const YERI_RUNNER_HEARTBEAT_GRACE_MS = Number(process.env.AIMAX_YERI_RUNNER_HEARTBEAT_GRACE_MS || 10 * 60 * 1000);
const YERI_RETRY_LIMIT = Number(process.env.AIMAX_YERI_RETRY_LIMIT || 3);
const YERI_SERVER_GENERATION_ENABLED = envFlag("AIMAX_YERI_SERVER_GENERATION_ENABLED");
const YERI_SERVER_GENERATION_MOCK = envFlag("AIMAX_YERI_SERVER_GENERATION_MOCK");
const YERI_SERVER_GENERATION_MODEL = String(process.env.AIMAX_YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash").trim();
const YERI_SERVER_GENERATION_CLAUDE_MODEL = String(process.env.AIMAX_YERI_SERVER_GENERATION_CLAUDE_MODEL || "claude-sonnet-4-6").trim();
const YERI_SERVER_GENERATION_TIMEOUT_MS = Number(process.env.AIMAX_YERI_SERVER_GENERATION_TIMEOUT_MS || 60000);
const YERI_SERVER_GENERATION_MAX_ATTEMPTS = Number(process.env.AIMAX_YERI_SERVER_GENERATION_MAX_ATTEMPTS || 3);
const YERI_SERVER_GENERATION_ALLOWED_USER_IDENTIFIERS = new Set(
  String(process.env.AIMAX_YERI_SERVER_GENERATION_ALLOWED_USERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap(accessIdentifierVariants),
);
const YERI_SERVER_GENERATION_REAL_TEST_ONLY = envFlag("AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY");
const YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT = Number(process.env.AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT || 500);
const YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT = Number(process.env.AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT || 1);
const YERI_READY_FOR_PUBLISH_CLAIM_ENABLED = envFlag("AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED");
const PUBLIC_BASE_URL = String(process.env.AIMAX_PUBLIC_BASE_URL || "https://api.aimax.ai.kr").replace(/\/+$/, "");
const MAIL_WEBHOOK_URL = String(process.env.AIMAX_MAIL_WEBHOOK_URL || "").trim();
const MAIL_WEBHOOK_SECRET = String(process.env.AIMAX_MAIL_WEBHOOK_SECRET || "").trim();
const RESEND_API_KEY = String(process.env.AIMAX_RESEND_API_KEY || process.env.RESEND_API_KEY || "").trim();
const MAIL_FROM = String(process.env.AIMAX_MAIL_FROM || "AIMAX <naminsoo@aixlife.co.kr>").trim();
const MAIL_REPLY_TO = String(process.env.AIMAX_MAIL_REPLY_TO || "naminsoo@aixlife.co.kr").trim();
const CAFE24_WEBHOOK_SECRET = String(process.env.AIMAX_CAFE24_WEBHOOK_SECRET || "").trim();
const TELEGRAM_BOT_TOKEN = String(process.env.AIMAX_TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID = String(process.env.AIMAX_TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_MESSAGE_THREAD_ID = String(process.env.AIMAX_TELEGRAM_MESSAGE_THREAD_ID || "").trim();
const TELEGRAM_ALERTS_ENABLED = String(process.env.AIMAX_TELEGRAM_ALERTS_ENABLED || "1").trim() !== "0";
const CAFE24_REVIEW_ALERTS_ENABLED = String(process.env.AIMAX_CAFE24_REVIEW_ALERTS_ENABLED || "1").trim() !== "0";
const CAFE24_TELEGRAM_MESSAGE_THREAD_ID = String(process.env.AIMAX_CAFE24_TELEGRAM_MESSAGE_THREAD_ID || TELEGRAM_MESSAGE_THREAD_ID).trim();
const CAFE24_AUTO_SEND_ENABLED = String(process.env.AIMAX_CAFE24_AUTO_SEND_ENABLED || "1").trim() !== "0";
const CAFE24_AUTO_PROCESS_LOCK_MS = Number(process.env.AIMAX_CAFE24_AUTO_PROCESS_LOCK_MS || 10 * 60 * 1000);
const KEYCHAIN_ACCOUNT = String(process.env.AIMAX_KEYCHAIN_ACCOUNT || "minsu-api").trim();
const LOCAL_KEYRING_SERVICE = String(process.env.AIMAX_KEYRING_SERVICE || "AIMAX").trim();
const LEGACY_KEYRING_SERVICE = String(process.env.AIMAX_LEGACY_KEYRING_SERVICE || "NaverBlogAuto").trim();
const SONGI_GEMINI_MODEL = String(process.env.AIMAX_SONGI_GEMINI_MODEL || "gemini-2.5-flash").trim();
// 기본 fallback 은 무료 등급에서 동작하는 flash. 명시적 "Gemini 2.5 Pro" 선택은
// normalizeYunmiAiModel 가 가격표 passthrough 로 그대로 honor 하므로 유료 옵션은 보존된다.
// (모델 없는/레거시 API payload 가 유료 기본값으로 떨어져 무료키 사용자가 실패하던 문제 방지)
const YUNMI_DEFAULT_AI_MODEL = String(process.env.AIMAX_YUNMI_DEFAULT_AI_MODEL || "gemini-2.5-flash").trim();
const YUNMI_AI_MOCK_ENABLED = envFlag("AIMAX_YUNMI_AI_MOCK");
const YUNMI_PUBLIC_ENABLED = envFlag("AIMAX_YUNMI_PUBLIC_ENABLED");
const YUNMI_DEFAULT_ALLOWED_USERS = [
  "demo@aimax.ai.kr",
  "AIMAX Demo",
  "메이크패밀리 1",
  "메이크패밀리1",
  "메이크패밀리 2",
  "메이크패밀리2",
];
const YUNMI_ALLOWED_USER_IDENTIFIERS = new Set(
  [
    ...YUNMI_DEFAULT_ALLOWED_USERS,
    ...String(process.env.AIMAX_YUNMI_ALLOWED_USERS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ].flatMap(accessIdentifierVariants),
);
const USD_KRW_RATE = Number(process.env.AIMAX_USD_KRW_RATE || 1476);
const USD_KRW_RATE_LABEL = String(process.env.AIMAX_USD_KRW_RATE_LABEL || "2026-05-06 Wise/Investing.com spot").trim();
const SONGI_APIFY_INSTAGRAM_ACTOR = String(process.env.AIMAX_SONGI_APIFY_INSTAGRAM_ACTOR || "apify/instagram-reel-scraper").trim();
const SONGI_APIFY_INSTAGRAM_PROFILE_ACTOR = String(process.env.AIMAX_SONGI_APIFY_INSTAGRAM_PROFILE_ACTOR || "apify/instagram-profile-scraper").trim();
const SONGI_APIFY_TIKTOK_ACTOR = String(process.env.AIMAX_SONGI_APIFY_TIKTOK_ACTOR || "clockworks/tiktok-video-scraper").trim();
const SONGI_APIFY_DISCOVERY_ACTORS = {
  instagram: String(process.env.AIMAX_SONGI_APIFY_DISCOVERY_INSTAGRAM_ACTOR || "apify/instagram-hashtag-scraper").trim(),
  tiktok: String(process.env.AIMAX_SONGI_APIFY_DISCOVERY_TIKTOK_ACTOR || "clockworks/tiktok-scraper").trim(),
  threads: String(process.env.AIMAX_SONGI_APIFY_DISCOVERY_THREADS_ACTOR || "automation-lab/threads-scraper").trim(),
  meta_ads: String(process.env.AIMAX_SONGI_APIFY_DISCOVERY_META_ADS_ACTOR || "curious_coder/facebook-ads-library-scraper").trim(),
};
const SONGI_APIFY_DISCOVERY_PRICING_USD = (() => {
  const defaults = {
    instagram: { start: 0.005, per_result: 0.0026 },
    tiktok: { start: 0.012, per_result: 0.0017 },
    threads: { start: 0.01, per_result: 0.002 },
    meta_ads: { start: 0.005, per_result: 0.00075 },
  };
  const raw = String(process.env.AIMAX_SONGI_APIFY_DISCOVERY_PRICING_USD || "").trim();
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    for (const key of Object.keys(defaults)) {
      if (parsed[key] && typeof parsed[key] === "object") {
        defaults[key] = {
          start: Number(parsed[key].start ?? defaults[key].start) || 0,
          per_result: Number(parsed[key].per_result ?? defaults[key].per_result) || 0,
        };
      }
    }
  } catch (_error) {
    console.warn("[songi] AIMAX_SONGI_APIFY_DISCOVERY_PRICING_USD JSON 파싱 실패, 기본 단가 사용");
  }
  return defaults;
})();
const SONGI_APIFY_DISCOVERY_PLATFORMS = new Set(Object.keys(SONGI_APIFY_DISCOVERY_ACTORS));
const SONGI_META_ADS_MIN_RESULTS = 10;
const SONGI_DISCOVERY_SUBSCRIPTION_POLL_MS = Number(process.env.AIMAX_SONGI_DISCOVERY_SUBSCRIPTION_POLL_MS || 5 * 60 * 1000);
const SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_USER = Number(process.env.AIMAX_SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_USER || 10);
const SONGI_DISCOVERY_SUBSCRIPTION_RETRY_MS = Number(process.env.AIMAX_SONGI_DISCOVERY_SUBSCRIPTION_RETRY_MS || 30 * 60 * 1000);
const SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_TICK = Number(process.env.AIMAX_SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_TICK || 3);
const SONGI_DISCOVERY_SUBSCRIPTION_SEEN_URL_LIMIT = Number(process.env.AIMAX_SONGI_DISCOVERY_SUBSCRIPTION_SEEN_URL_LIMIT || 600);
const SONGI_DISCOVERY_SUBSCRIPTION_MAX_CONSECUTIVE_FAILURES = 5;
const SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES = {
  daily: { interval_ms: 24 * 60 * 60 * 1000, runs_per_month: 30.4, label: "매일" },
  weekly: { interval_ms: 7 * 24 * 60 * 60 * 1000, runs_per_month: 4.35, label: "매주" },
};
const SONGI_DISCOVERY_RUNS_PER_USER = Number(process.env.AIMAX_SONGI_DISCOVERY_RUNS_PER_USER || 80);
const SONGI_DISCOVERY_CANDIDATES_PER_USER = Number(process.env.AIMAX_SONGI_DISCOVERY_CANDIDATES_PER_USER || 1200);
const SONGI_YTDLP_FALLBACK = "yt-dlp";
const SONGI_FFMPEG_FALLBACK = "ffmpeg";
const SONGI_SERVER_YTDLP_DISCOVERY_ENABLED = String(process.env.AIMAX_SONGI_SERVER_YTDLP_DISCOVERY_ENABLED || "1").trim() !== "0";
const SONGI_YTDLP_DISCOVERY_TIMEOUT_MS = Number(process.env.AIMAX_SONGI_YTDLP_DISCOVERY_TIMEOUT_MS || 60000);
const SONGI_VIDEO_MAX_SECONDS = Number(process.env.AIMAX_SONGI_VIDEO_MAX_SECONDS || 90);
const SONGI_VIDEO_MAX_BYTES = Number(process.env.AIMAX_SONGI_VIDEO_MAX_BYTES || 18 * 1024 * 1024);
const SONGI_FRAME_MAX_WIDTH = Number(process.env.AIMAX_SONGI_FRAME_MAX_WIDTH || 720);
const SONGI_MEDIA_TOOL_CHECK_TIMEOUT_MS = Number(process.env.AIMAX_SONGI_MEDIA_TOOL_CHECK_TIMEOUT_MS || 10000);
const SONGI_VIDEO_FORMAT = String(process.env.AIMAX_SONGI_VIDEO_FORMAT || "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]/best").trim();
const ALLOWED_ORIGINS = String(process.env.AIMAX_ALLOWED_ORIGINS || "https://aimax.ai.kr,http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const AUTOMATION_TICKETS_PATH = path.join(DATA_DIR, "automation-tickets.jsonl");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");
const USER_SECRETS_PATH = path.join(DATA_DIR, "user-secrets.json");
const USER_SECRET_KEY_PATH = path.join(DATA_DIR, "user-secret-master.key");
const SETUP_TOKENS_PATH = path.join(DATA_DIR, "setup-tokens.json");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");
const AGENTS_PATH = path.join(DATA_DIR, "agents.json");
const COMMANDS_PATH = path.join(DATA_DIR, "agent-commands.json");
const CAFE24_ORDERS_PATH = path.join(DATA_DIR, "cafe24-orders.json");
const RESEARCH_STORAGE_CONFIG_PATH = path.join(DATA_DIR, "research-storage.json");
let RESEARCH_DATA_DIR = configuredResearchDataDir();
let RESEARCH_PATH = path.join(RESEARCH_DATA_DIR, "research.json");
const STATIC_DIR = path.join(__dirname, "static");
const APP_HTML_PATH = path.join(STATIC_DIR, "app.html");
const ADMIN_HTML_PATH = path.join(STATIC_DIR, "admin.html");
const SETUP_HTML_PATH = path.join(STATIC_DIR, "setup.html");
const ADMIN_COOKIE_NAME = "aimax_admin_session";
const EUNSEO_ACCESS_COOKIE_NAME = "aimax_eunseo_access";
const EUNSEO_ACCESS_TTL_MS = Number(process.env.AIMAX_EUNSEO_ACCESS_TTL_MS || 6 * 60 * 60 * 1000);
const PRODUCT_ORDER = ["yeri", "hyunju", "songi", "yunmi", "jieun", "nakyung", "hyojin", "sangsu", "eunseo", "blog_team", "bundle"];
const PRODUCTS = new Set(PRODUCT_ORDER);
const MEMBER_ONLY_PRODUCTS = new Set(["eunseo"]);
const BUNDLE_PRODUCTS = PRODUCT_ORDER.filter((product) => !MEMBER_ONLY_PRODUCTS.has(product));
const ACCOUNT_SEGMENTS = new Set(["paid_buyer", "makefamily_member", "member_and_buyer", "test", "operator"]);
const ACCOUNT_SEGMENT_LABELS = {
  paid_buyer: "AIMAX 유료 구매자",
  makefamily_member: "메이크패밀리 원회원",
  member_and_buyer: "원회원+구매자",
  test: "테스트/운영",
  operator: "운영자",
};
const REPORT_STATUS_META = {
  new: {
    label: "접수됨",
    publicMessage: "오류 보고가 접수되었습니다. 운영팀 알림이 전달되었습니다. 같은 오류를 다시 보내지 않아도 됩니다.",
    nextUpdateMessage: "영업시간 기준 24시간 안에 1차 확인 상태로 바뀝니다.",
  },
  reviewing: {
    label: "확인 중",
    publicMessage: "운영자가 오류 보고를 확인 중입니다.",
    nextUpdateMessage: "원인 확인 중입니다. 추가 안내가 필요하면 이 화면에 표시됩니다.",
  },
  working: {
    label: "조치 중",
    publicMessage: "수정, 설정 확인, 배포 준비 중입니다.",
    nextUpdateMessage: "조치가 끝나면 이 화면의 상태가 완료 또는 사용자 확인 필요로 바뀝니다.",
  },
  waiting_user: {
    label: "사용자 확인 필요",
    publicMessage: "사용자 확인이 필요합니다. 아래 안내를 확인한 뒤 다시 시도해주세요.",
    nextUpdateMessage: "안내대로 진행한 뒤 같은 문제가 계속되면 접수 ID와 함께 카카오채널로 알려주세요.",
  },
  done: {
    label: "완료",
    publicMessage: "오류 보고 확인이 완료되었습니다.",
    nextUpdateMessage: "같은 문제가 계속되면 이 접수 ID와 함께 다시 알려주세요.",
  },
};
const REPORT_STATUS_ALIASES = {
  checking: "reviewing",
  fixed: "done",
  resolved: "done",
  need_user_info: "waiting_user",
};
const USER_SECRET_PROVIDERS = {
  gemini: { provider: "gemini", secretName: "GEMINI_API_KEY", label: "Gemini API Key" },
  openai: { provider: "openai", secretName: "OPENAI_API_KEY", label: "OpenAI API Key" },
  claude: { provider: "claude", secretName: "CLAUDE_API_KEY", label: "Claude API Key" },
  apify: { provider: "apify", secretName: "APIFY_API_TOKEN", label: "Apify API Token" },
  youtube: { provider: "youtube", secretName: "YOUTUBE_API_KEY", label: "YouTube Data API Key" },
};
const YUNMI_AI_MODEL_PRICES = {
  "gemini-3.5-flash": { provider: "gemini", inputUsdPer1m: 1.50, outputUsdPer1m: 9.00, label: "Gemini 3.5 Flash" },
  "gemini-3.1-pro-preview": { provider: "gemini", inputUsdPer1m: 1.25, outputUsdPer1m: 10.00, label: "Gemini 3.1 Pro Preview" },
  "gemini-2.5-pro": { provider: "gemini", inputUsdPer1m: 1.25, outputUsdPer1m: 10.00, label: "Gemini 2.5 Pro" },
  "gemini-2.5-flash": { provider: "gemini", inputUsdPer1m: 0.30, outputUsdPer1m: 2.50, label: "Gemini 2.5 Flash" },
  "gpt-5.4-mini": { provider: "openai", inputUsdPer1m: 0.75, outputUsdPer1m: 4.50, label: "GPT-5.4 mini" },
  "gpt-5-mini": { provider: "openai", inputUsdPer1m: 0.25, outputUsdPer1m: 2.00, label: "GPT-5 mini" },
  claude: { provider: "claude", inputUsdPer1m: 3.00, outputUsdPer1m: 15.00, label: "Claude Sonnet" },
};
const IMPORTABLE_USER_SECRET_PROVIDERS = ["gemini", "apify", "openai", "claude"];
const AGENT_COMMAND_TYPES = new Set(["open_settings", "import_local_provider_secrets", "songi_youtube_discovery"]);
const LATEST_AGENT_VERSION = String(process.env.AIMAX_LATEST_AGENT_VERSION || "v1.0.51").trim();
const MIN_AGENT_VERSION = String(process.env.AIMAX_MIN_AGENT_VERSION || "v1.0.44").trim();
const PLATFORM_AGENT_VERSIONS = {
  windows: {
    latest: String(process.env.AIMAX_WINDOWS_LATEST_AGENT_VERSION || "v1.0.51").trim(),
    min: String(process.env.AIMAX_WINDOWS_MIN_AGENT_VERSION || "v1.0.44").trim(),
  },
  macos: {
    latest: String(process.env.AIMAX_MACOS_LATEST_AGENT_VERSION || "v1.0.51").trim(),
    min: String(process.env.AIMAX_MACOS_MIN_AGENT_VERSION || "v1.0.36").trim(),
  },
};
const AGENT_DOWNLOAD_URL = String(process.env.AIMAX_AGENT_DOWNLOAD_URL || "").trim();
const AGENT_RELEASE_NOTES = String(process.env.AIMAX_AGENT_RELEASE_NOTES || "AIMAX 실행기 업데이트를 확인해주세요.").trim();
const PLATFORM_AGENT_RELEASE_NOTES = {
  windows: String(process.env.AIMAX_WINDOWS_AGENT_RELEASE_NOTES || AGENT_RELEASE_NOTES).trim(),
  macos: String(process.env.AIMAX_MACOS_AGENT_RELEASE_NOTES || "macOS 실행기는 최신 상태입니다.").trim(),
};
const DOWNLOAD_DIR = process.env.AIMAX_DOWNLOAD_DIR || path.join(__dirname, "downloads");
const DOWNLOAD_TICKET_TTL_MS = Number(process.env.AIMAX_DOWNLOAD_TICKET_TTL_MS || 10 * 60 * 1000);
const WORKERS = {
  yeri_writer: {
    code: "yeri_writer",
    staffCode: "yeri",
    name: "예리",
    label: "예리",
    role: "블로그 글쓰기 직원",
    category: "content",
    product: "yeri",
    jobKind: "yeri_write",
    execution: "local_agent",
    type: "local_agent",
    requiredSettings: ["naver_account", "ai_key"],
    profileImage: "/assets/avatar_yeri.jpg",
    avatarImage: "/assets/avatar_yeri_circle.png",
    shortDescription: "키워드와 CTA를 받아 검색에 걸리는 블로그 글로 정리하고, 임시 저장·즉시 발행·예약 발행 흐름까지 넘깁니다.",
    capabilities: ["글쓰기", "CTA", "예약 발행"],
  },
  hyunju_sales: {
    code: "hyunju_sales",
    staffCode: "hyunju",
    name: "현주",
    label: "현주",
    role: "영업사원 직원",
    category: "sales",
    product: "hyunju",
    jobKind: "hyunju_find",
    execution: "local_agent",
    type: "local_agent",
    requiredSettings: ["naver_account", "neighbor_messages"],
    profileImage: "/assets/avatar_hyunju.jpg",
    avatarImage: "/assets/avatar_hyunju_circle.png",
    shortDescription: "검색 키워드에서 잠재 고객을 찾고, 설정한 신청 수와 안전 속도에 맞춰 서로이웃 첫인사를 보냅니다.",
    capabilities: ["고객 찾기", "서로이웃", "안전 속도"],
  },
  nakyung_pencil: {
    code: "nakyung_pencil",
    staffCode: "nakyung",
    name: "나경",
    label: "나경",
    role: "판서",
    category: "education",
    product: "nakyung",
    jobKind: "",
    execution: "external_download",
    type: "desktop_app",
    status: "available",
    requiredSettings: [],
    moduleKey: "pencil",
    profileImage: "/assets/avatar_nakyung.jpg",
    avatarImage: "/assets/avatar_nakyung.jpg",
    repoUrl: "https://github.com/makefriendscoltd-design/pencil",
    releaseUrl: "",
    setupDownloadUrl: `${PUBLIC_BASE_URL}/downloads/Pencil-Setup-1.0.0.exe`,
    portableDownloadUrl: `${PUBLIC_BASE_URL}/downloads/Pencil-portable.exe`,
    downloadLabel: "Setup exe 다운로드",
    supportedPlatforms: ["windows"],
    version: "1.0.0",
    shortDescription: "강의와 회의 화면 위에 바로 밑줄을 긋고, 같은 와이파이에서 실시간으로 공유하는 Windows 판서 직원입니다.",
    capabilities: ["전체화면 판서", "실시간 공유", "형광펜/도형/텍스트", "스포트라이트"],
  },
  hyunseong_pm: {
    code: "hyunseong_pm",
    staffCode: "hyunseong",
    name: "현성",
    label: "현성",
    role: "PM",
    category: "operations",
    product: "bundle",
    jobKind: "",
    execution: "planned",
    type: "planned",
    status: "needs_setup"…141148 tokens truncated…    const access = eunseoAccessFromTicket(queryTicket || cookieTicket);
    if (access) {
      allowed = true;
      if (queryTicket) {
        accessCookie = eunseoAccessCookie(req, queryTicket, Math.ceil((Number(access.expires_at_ms || 0) - Date.now()) / 1000));
      }
    }
  }
  if (!allowed) {
    if (req.method === "GET" && rawPath === "index.html") {
      redirect(res, "/app#staff");
      return;
    }
    json(req, res, 403, { ok: false, error: "eunseo_not_allowed" });
    return;
  }
  const appRoot = path.join(STATIC_DIR, "eunseo");
  const filePath = path.normalize(path.join(appRoot, rawPath));
  if (!filePath.startsWith(`${appRoot}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const stat = fs.statSync(filePath);
  const isHtml = filePath.endsWith(".html");
  res.writeHead(200, {
    "content-type": downloadContentType(filePath),
    "content-length": stat.size,
    "cache-control": isHtml ? "no-store" : "public, max-age=300",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    ...(accessCookie ? { "set-cookie": accessCookie } : {}),
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function serveResearchHtml(req, res, url) {
  const queryToken = String(url.searchParams.get("token") || url.searchParams.get("session_token") || "").trim();
  if (queryToken && !req.headers.authorization && !req.headers["x-aimax-session-token"]) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  let rawPath = "";
  try {
    rawPath = decodeURIComponent(url.pathname.replace(/^\/research-html\/?/, "")) || "index.html";
  } catch (_error) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  if (!rawPath || rawPath.includes("\0")) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const htmlDir = researchHtmlDir();
  const filePath = path.normalize(path.join(htmlDir, rawPath));
  if (!filePath.startsWith(`${htmlDir}${path.sep}`) && filePath !== htmlDir) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  writeResearchHtmlExports(loadResearch());
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "content-type": downloadContentType(filePath),
    "content-length": stat.size,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  fs.createReadStream(filePath).pipe(res);
}

function route(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/") {
    redirect(res, "/app");
    return;
  }
  if (req.method === "GET" && (url.pathname === "/app" || url.pathname === "/app/")) {
    serveApp(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/favicon.ico") {
    res.writeHead(204, { "cache-control": "public, max-age=86400" });
    res.end();
    return;
  }
  if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    serveAdmin(req, res);
    return;
  }
  if (req.method === "GET" && (url.pathname === "/setup" || url.pathname === "/setup/")) {
    serveSetup(req, res);
    return;
  }
  if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/eunseo" || url.pathname.startsWith("/eunseo/"))) {
    serveEunseoWebApp(req, res, url);
    return;
  }
  if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/downloads/")) {
    handlePublicDownload(req, res, url);
    return;
  }
  if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/")) {
    serveStaticAsset(req, res, url);
    return;
  }
  if (req.method === "GET" && (url.pathname === "/research-html" || url.pathname.startsWith("/research-html/"))) {
    serveResearchHtml(req, res, url);
    return;
  }
  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/reports/health")) {
    handleHealth(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/version") {
    handleVersion(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/workers") {
    handleWorkers(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/user/secrets") {
    handleUserSecrets(req, res);
    return;
  }
  if (req.method === "PUT" && url.pathname.startsWith("/api/user/secrets/")) {
    handlePutUserSecret(req, res, decodeURIComponent(url.pathname.slice("/api/user/secrets/".length)));
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/user/secrets/")) {
    handleDeleteUserSecret(req, res, decodeURIComponent(url.pathname.slice("/api/user/secrets/".length)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/research/projects") {
    handleListResearchProjects(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/research/integrations") {
    handleResearchIntegrations(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/research/storage") {
    handleUpdateResearchStorage(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/research/discovery") {
    handleListResearchDiscovery(req, res, url);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/research/discovery/search") {
    handleRunResearchDiscovery(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/research/discovery/subscriptions") {
    handleListResearchDiscoverySubscriptions(req, res, url);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/research/discovery/subscriptions") {
    handleCreateResearchDiscoverySubscription(req, res);
    return;
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/research/discovery/subscriptions/")) {
    handleUpdateResearchDiscoverySubscription(req, res, decodeURIComponent(url.pathname.slice("/api/research/discovery/subscriptions/".length)));
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/research/discovery/subscriptions/")) {
    handleDeleteResearchDiscoverySubscription(req, res, decodeURIComponent(url.pathname.slice("/api/research/discovery/subscriptions/".length)));
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/research/discovery/candidates/") && url.pathname.endsWith("/import")) {
    const candidateId = decodeURIComponent(url.pathname.slice("/api/research/discovery/candidates/".length, -"/import".length));
    handleImportResearchDiscoveryCandidate(req, res, candidateId);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/research/projects") {
    handleCreateResearchProject(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/research/projects/") && url.pathname.endsWith("/profile/apify")) {
    const projectId = decodeURIComponent(url.pathname.slice("/api/research/projects/".length, -"/profile/apify".length));
    handleRunResearchProfileApify(req, res, projectId);
    return;
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/research/projects/")) {
    handleUpdateResearchProject(req, res, decodeURIComponent(url.pathname.slice("/api/research/projects/".length)));
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/research/projects/")) {
    handleDeleteResearchProject(req, res, decodeURIComponent(url.pathname.slice("/api/research/projects/".length)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/research/items") {
    handleListResearchItems(req, res, url);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/research/items") {
    handleCreateResearchItem(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/research/brief") {
    handleResearchBrief(req, res, url);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/research/items/") && url.pathname.endsWith("/yunmi-script")) {
    const itemId = decodeURIComponent(url.pathname.slice("/api/research/items/".length, -"/yunmi-script".length));
    handleCreateYunmiFromResearchItem(req, res, itemId);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/research/items/") && url.pathname.endsWith("/apify")) {
    const itemId = decodeURIComponent(url.pathname.slice("/api/research/items/".length, -"/apify".length));
    handleRunResearchApify(req, res, itemId);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/research/items/") && url.pathname.endsWith("/ai-analysis")) {
    const itemId = decodeURIComponent(url.pathname.slice("/api/research/items/".length, -"/ai-analysis".length));
    handleRunResearchAiAnalysis(req, res, itemId);
    return;
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/research/items/")) {
    handleUpdateResearchItem(req, res, decodeURIComponent(url.pathname.slice("/api/research/items/".length)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/downloads/options") {
    handleDownloadOptions(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/downloads/tickets") {
    handleCreateDownloadTicket(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/eunseo/launch") {
    handleCreateEunseoLaunch(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/downloads/agent") {
    handleDownloadAgent(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/reports") {
    handleList(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/reports/mine") {
    handleMyReports(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/reports/") && url.pathname.endsWith("/response")) {
    const rawId = url.pathname.slice("/api/reports/".length, -"/response".length);
    handleReportUserResponse(req, res, decodeURIComponent(rawId));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/reports") {
    handleReport(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/integrations/cafe24/orders") {
    handleCafe24OrderWebhook(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/provision") {
    handleAdminProvisionUser(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/send-guide") {
    handleAdminSendGuideEmail(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/provision-batch") {
    handleAdminProvisionBatch(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/grant-product") {
    handleAdminGrantProduct(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/secret-status") {
    handleAdminUserSecretStatus(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/setup-links") {
    handleAdminCreateSetupLinks(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/expire") {
    handleAdminExpireUser(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/delete") {
    handleAdminDeleteUser(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    handleAdminListUsers(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/cafe24-orders") {
    handleAdminListCafe24Orders(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/cafe24-orders/update") {
    handleAdminUpdateCafe24Order(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/cafe24-orders/retry") {
    handleAdminRetryCafe24Orders(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/cafe24-orders/provision") {
    handleAdminProvisionCafe24Orders(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/cafe24-orders/send-guides") {
    handleAdminSendCafe24Guides(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    handleAdminLogin(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    handleAdminLogout(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/me") {
    handleAdminMe(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/catalog") {
    handleAdminCatalog(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/admin/alerts/telegram/test") {
    handleAdminTelegramTest(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/automation-tickets") {
    handleAdminListAutomationTickets(req, res, url);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/admin/reports") {
    handleAdminListReports(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/admin/reports/") && url.pathname.endsWith("/status")) {
    const rawId = url.pathname.slice("/api/admin/reports/".length, -"/status".length);
    handleAdminUpdateReportStatus(req, res, decodeURIComponent(rawId));
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/admin/reports/")) {
    handleAdminGetReport(req, res, decodeURIComponent(url.pathname.slice("/api/admin/reports/".length)));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    handleLogin(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    handleMe(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/auth/setup-token") {
    handleSetupTokenInfo(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/auth/setup-password") {
    handleSetupPassword(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
    handleChangePassword(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    handleLogout(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/agent/status") {
    handleAgentStatus(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/agent/heartbeat") {
    handleAgentHeartbeat(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/agent/commands") {
    handleCreateAgentCommand(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/agent/commands/")) {
    handleGetAgentCommand(req, res, decodeURIComponent(url.pathname.slice("/api/agent/commands/".length)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/agent/next-command") {
    handleAgentNextCommand(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/agent/commands/update") {
    handleAgentCommandUpdate(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/agent/next-job") {
    handleAgentNextJob(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/agent/jobs/update") {
    handleAgentJobUpdate(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/jobs/") && url.pathname.endsWith("/retry")) {
    const rawId = url.pathname.slice("/api/jobs/".length, -"/retry".length);
    handleRetryJob(req, res, decodeURIComponent(rawId));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/jobs") {
    handleListJobs(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/jobs") {
    handleCreateJob(req, res);
    return;
  }
  json(req, res, 404, { ok: false, error: "not_found" });
}

function startServer() {
  ensureDirs();
  recoverStaleGeneratingJobs();
  // 기존 running/ready_for_publish 좀비(러너 중단)도 부팅 시 1회 정리
  try {
    const bootJobs = loadJobs();
    if (failStaleRunningJobs(bootJobs)) saveJobs(bootJobs);
  } catch (error) {
    console.error("failStaleRunningJobs boot sweep failed", error);
  }
  const server = http.createServer((req, res) => {
    Promise.resolve(route(req, res)).catch((error) => {
      console.error("request_error", error);
      if (res.headersSent) return;
      if (isJsonStorageError(error)) {
        json(req, res, 503, {
          ok: false,
          error: "storage_unavailable",
          code: error.code || "json_storage_error",
          file: error.file_label || "unknown",
        });
        return;
      }
      json(req, res, 500, { ok: false, error: "internal_error" });
    });
  });

  startSongiDiscoverySubscriptionPoller();
  server.listen(PORT, HOST, () => {
    console.log(`aimax-reports-api listening on http://${HOST}:${PORT}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  __storageTest: {
    appendJsonLineDurable,
    arrayFieldOrThrow,
    jsonStorageHealth,
    loadUsers,
    readJsonFile,
    saveUsers,
    startServer,
    writeJsonAtomic,
    writeJsonLinesAtomic,
  },
  __catalogTest: {
    JOB_KINDS,
    WORKERS,
    adminProductCatalog,
    adminUserRow,
    canAccessEunseo,
    grantProductToUser,
    isJobAllowed,
    primaryProductForEntitlements,
    provisionAdminUser,
    productList,
    publicJobKind,
    publicWorker,
    workerCatalogContractIssues,
  },
  __cafe24Test: {
    adminCafe24OrderRow,
    buildCafe24Order,
    cafe24AutoStageLabel,
    cafe24GuideForProvision,
    cafe24ReviewIssueLabel,
    createSetupLinkForUser,
    inferCafe24Product,
    onboardingSetupLinkText,
    shouldAutoProcessCafe24Order,
    shouldSendCafe24ReviewAlert,
    telegramCafe24AutoFailureAlertText,
    telegramCafe24ReviewAlertText,
  },
  __automationTest: {
    AUTOMATION_TICKETS_PATH,
    applyReportAutoGuidance,
    appendAutomationTicket,
    appendAutomationTicketStatusUpdate,
    automationTicketCategory,
    automationTicketId,
    automationTicketStatusForReportStatus,
    buildAutomationTicketForReport,
    latestAutomationTickets,
    loadAutomationTickets,
    telegramReportAlertText,
  },
  __yeriHybridTest: {
    ARTIFACTS_DIR,
    JOB_STATUSES,
    agentYeriArtifactPayload,
    attachYeriArtifactToJob,
    buildYeriGenerationPrompt,
    buildYeriMockArtifact,
    buildFailureDiagnostic,
    generateYeriArtifactForJob,
    jobFailureDiagnostic,
    loadJobs,
    loadYeriArtifact,
    publicJob,
    recoverStaleGeneratingJobs,
    safeArtifactId,
    sanitizeFailedStage,
    sanitizeYeriGeneratedArtifact,
    saveJobs,
    saveYeriArtifact,
    AGENT_CLAIMABLE_JOB_STATUSES,
    yeriServerGenerationMode,
    yeriGeminiFallbackModel,
    markRunnerStartTimeouts,
    failStaleRunningJobs,
    findHeartbeatAgent,
    imageCompletionIssue,
    requestedImageCount,
    versionPayload,
  },
  __songiSubscriptionTest: {
    SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES,
    loadResearch,
    saveResearch,
    pruneResearchDiscovery,
    publicResearchDiscoverySubscription,
    runDueSongiDiscoverySubscriptions,
    runSongiDiscoverySubscriptionOnce,
    songiDiscoveryRunCostUsd,
    songiDiscoverySubscriptionEstimates,
  },
  __yunmiTest: {
    buildYunmiGenerationPrompt,
    buildYunmiScriptResult,
    buildYunmiInvalidJsonFallbackResult,
    normalizeYunmiScriptPayload,
  },
};
