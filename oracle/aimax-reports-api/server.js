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
const NAVER_SEARCH_CLIENT_ID = String(process.env.AIMAX_NAVER_SEARCH_CLIENT_ID || "").trim();
const NAVER_SEARCH_CLIENT_SECRET = String(process.env.AIMAX_NAVER_SEARCH_CLIENT_SECRET || "").trim();
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
const JOB_GUARDS_PATH = path.join(DATA_DIR, "job-guards.json");
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
const AGENT_COMMAND_TYPES = new Set(["open_settings", "import_local_provider_secrets", "songi_youtube_discovery", "stop_current_job"]);
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
    status: "needs_setup",
    requiredSettings: ["future_staff_setup"],
    profileImage: "/assets/avatar_hyunseong.jpg",
    avatarImage: "/assets/avatar_hyunseong.jpg",
    repoUrl: "https://github.com/makefamily/Project-manager",
    shortDescription: "흩어진 할 일과 진행 상황을 줄 세우는 PM 직원입니다. 정식 배치 전이라 기능 연결을 준비 중입니다.",
    capabilities: ["프로젝트 관리", "일정 정리", "기능 준비 중"],
  },
  sangsu_quote_generator: {
    code: "sangsu_quote_generator",
    staffCode: "sangsu",
    name: "상수",
    label: "상수",
    role: "경리",
    category: "finance",
    product: "sangsu",
    jobKind: "sangsu_quote",
    execution: "web_module",
    type: "web_module",
    status: "available",
    requiredSettings: [],
    moduleKey: "quote_generator",
    profileImage: "/assets/avatar_sangsu.jpg",
    avatarImage: "/assets/avatar_sangsu.jpg",
    shortDescription: "상호, 작업 항목, 금액, 유의사항을 보기 좋은 견적서로 정리하고 PDF 저장용 인쇄 화면으로 넘깁니다.",
    capabilities: ["견적서 작성", "로고 업로드", "PDF 저장"],
  },
  yunmi_script_writer: {
    code: "yunmi_script_writer",
    staffCode: "yunmi",
    name: "윤미",
    label: "윤미",
    role: "스크립트작가",
    category: "content",
    product: "yunmi",
    jobKind: "yunmi_script",
    execution: "web_module",
    type: "web_module",
    status: "beta",
    requiredSettings: [],
    moduleKey: "script_writer",
    profileImage: "/assets/avatar_yunmi.jpg",
    avatarImage: "/assets/avatar_yunmi.jpg",
    repoUrl: "https://github.com/makefamily/script-writer",
    shortDescription: "주제와 목적을 받아 A/B/C 타깃별 숏폼 대본, 촬영 가이드, CTA 후보를 나눠 쓰는 스크립트작가입니다.",
    capabilities: ["숏폼 후킹 설계", "시간대별 대본", "촬영 가이드", "CTA 후보"],
  },
  songi_data_research: {
    code: "songi_data_research",
    staffCode: "songi",
    name: "송이",
    label: "송이",
    role: "자료조사원",
    category: "research",
    product: "songi",
    jobKind: "songi_research",
    execution: "web_module",
    type: "web_module",
    status: "available",
    requiredSettings: [],
    moduleKey: "research",
    profileImage: "/assets/avatar_songi.jpg",
    avatarImage: "/assets/avatar_songi.jpg",
    repoUrl: "https://github.com/makefamily/data-research",
    shortDescription: "URL과 메모를 읽고 근거, 태그, 핵심 포인트를 정리해 다음 제작 직원이 바로 쓰는 브리프로 넘깁니다.",
    capabilities: ["자료조사", "태그 정리", "브리프 생성"],
  },
  jieun_office_support: {
    code: "jieun_office_support",
    staffCode: "jieun",
    name: "지은",
    label: "지은",
    role: "AI 오피스 지원",
    category: "operations",
    product: "jieun",
    jobKind: "",
    execution: "external_download",
    type: "desktop_app",
    status: "available",
    requiredSettings: [],
    moduleKey: "office_support",
    profileImage: "/assets/avatar_jieun.jpg",
    avatarImage: "/assets/avatar_jieun.jpg",
    repoUrl: "https://github.com/aixlife/aimax-viseo",
    releaseUrl: "",
    setupDownloadUrl: `${PUBLIC_BASE_URL}/downloads/AIMAX-Office-Manager-Setup-0.1.6.exe`,
    portableDownloadUrl: `${PUBLIC_BASE_URL}/downloads/AIMAX-Office-Manager-portable.exe`,
    downloadLabel: "Setup exe 다운로드",
    supportedPlatforms: ["windows"],
    version: "0.1.6",
    shortDescription: "캡처, 모자이크, OCR, 화면 녹화, Windows 종료처럼 자주 쓰는 사무 작업을 조용히 처리하는 데스크톱 직원입니다.",
    capabilities: ["화면 캡처", "캡처 이미지 모자이크", "Windows 종료", "OCR 텍스트 캡처", "화면 녹화", "블로그 글쓰기 진입"],
  },
  eunseo: {
    code: "eunseo",
    staffCode: "eunseo",
    name: "은서",
    label: "은서",
    role: "녹화 프롬프터",
    category: "content",
    product: "eunseo",
    jobKind: "",
    execution: "external_tool",
    type: "multi_channel",
    status: "available",
    accessPolicy: "makefamily_member",
    requiredSettings: [],
    moduleKey: "prompter",
    profileImage: "/assets/avatar_eunseo.jpg",
    avatarImage: "/assets/avatar_eunseo.jpg",
    shortDescription: "모바일에서는 카메라 근처 대본을 띄우고, PC에서는 화면녹화용 프롬프터로 출근하는 다중 실행형 직원입니다.",
    capabilities: ["웹 프롬프터", "Mac 앱", "모바일 촬영", "Toss 미니앱 준비"],
    executionOptions: [
      {
        kind: "web_app",
        label: "웹에서 바로 사용",
        platforms: ["web"],
        status: "available",
        url: "/eunseo",
        primary: true,
        description: "브라우저에서 바로 여는 모바일/PC 공용 프롬프터입니다.",
      },
      {
        kind: "mac_download",
        label: "Mac 앱 다운로드",
        platforms: ["macos"],
        status: "available",
        url: "/api/downloads/agent?platform=macos&product=eunseo",
        primary: false,
        description: "Mac 화면녹화용 로컬 앱입니다. 숨김 여부는 녹화 프로그램별로 실측 확인이 필요합니다.",
      },
      {
        kind: "windows_download",
        label: "Windows 앱",
        platforms: ["windows"],
        status: "coming_soon",
        url: "",
        primary: false,
        description: "Windows 화면녹화용 앱은 준비 중입니다.",
      },
      {
        kind: "android_apk",
        label: "Android APK",
        platforms: ["android"],
        status: "testing",
        url: "",
        primary: false,
        description: "Android 설치 파일은 실기기 검증 후 공개 다운로드로 연결합니다.",
      },
      {
        kind: "toss_mini",
        label: "Toss 미니앱",
        platforms: ["ios", "android"],
        status: "coming_soon",
        url: "",
        primary: false,
        description: "토스 앱 안에서 실행하는 미니앱 버전입니다. 앱인토스 검수 후 활성화됩니다.",
      },
    ],
  },
};
const JOB_KINDS = {
  yeri_write: {
    label: "예리 블로그 글쓰기",
    requiredProduct: "yeri",
    workerCode: "yeri_writer",
  },
  hyunju_find: {
    label: "현주 영업사원",
    requiredProduct: "hyunju",
    workerCode: "hyunju_sales",
  },
  yunmi_script: {
    label: "윤미 숏폼 스크립트",
    requiredProduct: "yunmi",
    workerCode: "yunmi_script_writer",
    apiMode: "job_api",
  },
  songi_research: {
    label: "송이 자료조사",
    requiredProduct: "songi",
    workerCode: "songi_data_research",
    apiMode: "research_api",
    queue: false,
  },
  sangsu_quote: {
    label: "상수 경리",
    requiredProduct: "sangsu",
    workerCode: "sangsu_quote_generator",
    apiMode: "client_only",
    queue: false,
  },
};
const DOWNLOAD_CATALOG = {
  macos: {
    bundle: { filename: "aimax-bundle-macos.dmg", label: "AIMAX 통합 macOS 설치 파일" },
    yeri: { filename: "aimax-yeri-macos.dmg", label: "AIMAX 예리 macOS 설치 파일" },
    hyunju: { filename: "aimax-hyunju-macos.dmg", label: "AIMAX 현주 macOS 설치 파일" },
    eunseo: { filename: "EunseoPrompter-mac-0.1.0.zip", label: "은서 Mac 프롬프터 앱" },
  },
  windows: {
    bundle: { filename: "aimax-bundle-windows.exe", label: "AIMAX 통합 Windows 설치 파일" },
    yeri: { filename: "aimax-yeri-windows.exe", label: "AIMAX 예리 Windows 설치 파일" },
    hyunju: { filename: "aimax-hyunju-windows.exe", label: "AIMAX 현주 Windows 설치 파일" },
  },
};
const PUBLIC_DOWNLOAD_FILES = new Set([
  "AIMAX-Office-Manager-Setup-0.1.4.exe",
  "AIMAX-Office-Manager-Setup-0.1.5.exe",
  "AIMAX-Office-Manager-Setup-0.1.6.exe",
  "AIMAX-Office-Manager-portable.exe",
  "Pencil-Setup-1.0.0.exe",
  "Pencil-portable.exe",
]);
const researchPaidLocks = new Map();
const downloadTickets = new Map();
const eunseoLaunchTickets = new Map();
const JOB_STATUSES = new Set(["queued", "generating", "ready_for_publish", "running", "done", "failed", "cancelled"]);
const TERMINAL_JOB_STATUSES = new Set(["done", "failed", "cancelled"]);
const AGENT_CLAIMABLE_JOB_STATUSES = new Set([
  "queued",
  ...(YERI_READY_FOR_PUBLISH_CLAIM_ENABLED ? ["ready_for_publish"] : []),
]);
const YERI_CONTENT_GENERATION_STAGE = "content_generation";

function nowIso() {
  return new Date().toISOString();
}

function researchPaidLockKey(userId, scope, id) {
  return [userId, scope, id].map((part) => String(part || "").replace(/:/g, "_")).join(":");
}

function acquireResearchPaidLock(key) {
  if (researchPaidLocks.has(key)) return false;
  const timeout = setTimeout(() => researchPaidLocks.delete(key), RESEARCH_PAID_LOCK_TTL_MS);
  if (typeof timeout.unref === "function") timeout.unref();
  researchPaidLocks.set(key, { started_at: nowIso(), timeout });
  return true;
}

function releaseResearchPaidLock(key) {
  const lock = researchPaidLocks.get(key);
  if (lock?.timeout) clearTimeout(lock.timeout);
  researchPaidLocks.delete(key);
}

function ensureDirs() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.mkdirSync(RESEARCH_DATA_DIR, { recursive: true });
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-aimax-admin-token, x-aimax-cafe24-secret, x-aimax-report-token, x-aimax-session-token",
    "access-control-max-age": "86400",
  };
  if (origin && (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin))) {
    headers["access-control-allow-origin"] = ALLOWED_ORIGINS.includes("*") ? "*" : origin;
    headers.vary = "Origin";
  }
  return headers;
}

function json(req, res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    ...corsHeaders(req),
    ...extraHeaders,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("payload_too_large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function tokenFromReq(req) {
  const direct = req.headers["x-aimax-report-token"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function timingSafeEqual(a, b) {
  const aa = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function requireAuth(req, res) {
  if (!AUTH_TOKEN) return true;
  if (hasReportAuth(req)) return true;
  json(req, res, 401, { ok: false, error: "unauthorized" });
  return false;
}

function hasReportAuth(req) {
  if (!AUTH_TOKEN) return true;
  return timingSafeEqual(tokenFromReq(req), AUTH_TOKEN);
}

function adminTokenFromReq(req) {
  const direct = req.headers["x-aimax-admin-token"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function cafe24SecretFromReq(req) {
  const direct = req.headers["x-aimax-cafe24-secret"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function adminSecret() {
  return ADMIN_PASSWORD || ADMIN_TOKEN;
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  const result = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch (_error) {
      result[key] = value;
    }
  }
  return result;
}

function isSecureRequest(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const host = String(req.headers.host || "").toLowerCase();
  return proto === "https" || (!host.startsWith("localhost") && !host.startsWith("127.0.0.1"));
}

function signAdminPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", adminSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyAdminPayload(token) {
  if (!adminSecret()) return null;
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", adminSecret()).update(encoded).digest("base64url");
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (Number(payload.exp || 0) <= Date.now()) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function adminCookie(req, value, maxAgeSeconds) {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, maxAgeSeconds)}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function hasAdminSession(req) {
  const token = parseCookies(req)[ADMIN_COOKIE_NAME];
  return Boolean(verifyAdminPayload(token));
}

function requireAdmin(req, res) {
  if (!adminSecret()) {
    json(req, res, 503, { ok: false, error: "admin_auth_not_configured" });
    return false;
  }
  if (ADMIN_TOKEN && timingSafeEqual(adminTokenFromReq(req), ADMIN_TOKEN)) return true;
  if (hasAdminSession(req)) return true;
  json(req, res, 401, { ok: false, error: "unauthorized" });
  return false;
}

function requireCafe24Webhook(req, res) {
  if (!CAFE24_WEBHOOK_SECRET) {
    json(req, res, 503, { ok: false, error: "cafe24_webhook_not_configured" });
    return false;
  }
  if (timingSafeEqual(cafe24SecretFromReq(req), CAFE24_WEBHOOK_SECRET)) return true;
  json(req, res, 401, { ok: false, error: "invalid_cafe24_secret" });
  return false;
}

function defaultReportDataDir() {
  const homeDir = os.homedir() || process.env.HOME || process.env.USERPROFILE || ".";
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    return path.join(localAppData, "AIMAX", "reports", "data");
  }
  return path.join(homeDir, "aimax-reports", "data");
}

function defaultMediaToolsDir() {
  const explicit = String(process.env.AIMAX_MEDIA_TOOLS_DIR || "").trim();
  if (explicit) return explicit;
  const homeDir = os.homedir() || process.env.HOME || process.env.USERPROFILE || ".";
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    return path.join(localAppData, "AIMAX", "media-tools");
  }
  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "AIMAX", "media-tools");
  }
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, ".local", "share");
  return path.join(xdgDataHome, "AIMAX", "media-tools");
}

function normalizeExecutableCommand(value, fallback) {
  const raw = String(value || fallback || "").trim();
  return raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function platformExecutableName(command) {
  const normalized = normalizeExecutableCommand(command, command);
  if (!normalized) return "";
  if (process.platform === "win32" && !/\.exe$/i.test(normalized)) return `${normalized}.exe`;
  return normalized;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function bundledMediaToolCandidates(command) {
  const executable = platformExecutableName(command);
  if (!executable || path.basename(executable) !== executable) return [];
  const platform = process.platform;
  const arch = process.arch;
  const baseDirs = [
    path.join(defaultMediaToolsDir(), platform, arch),
    path.join(defaultMediaToolsDir(), platform),
    path.join(__dirname, "vendor", "media-tools", platform, arch),
    path.join(__dirname, "vendor", "media-tools", platform),
    path.join(__dirname, "tools", platform, arch),
    path.join(__dirname, "tools", platform),
    path.join(__dirname, "bin"),
    path.join(process.cwd(), "oracle", "aimax-reports-api", "vendor", "media-tools", platform, arch),
    path.join(process.cwd(), "oracle", "aimax-reports-api", "vendor", "media-tools", platform),
  ];
  if (typeof process.resourcesPath === "string" && process.resourcesPath) {
    baseDirs.push(
      path.join(process.resourcesPath, "oracle", "aimax-reports-api", "vendor", "media-tools", platform, arch),
      path.join(process.resourcesPath, "vendor", "media-tools", platform, arch),
    );
  }
  return uniqueStrings(baseDirs.map((dir) => path.join(dir, executable)));
}

function resolveMediaToolCommand(value, fallback) {
  const explicit = normalizeExecutableCommand(value, "");
  if (explicit) return explicit;
  for (const candidate of bundledMediaToolCandidates(fallback)) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch (_error) {}
  }
  return normalizeExecutableCommand(fallback, fallback);
}

function songiYtDlpPath() {
  return resolveMediaToolCommand(process.env.AIMAX_SONGI_YTDLP_PATH, SONGI_YTDLP_FALLBACK);
}

function songiFfmpegPath() {
  return resolveMediaToolCommand(process.env.AIMAX_SONGI_FFMPEG_PATH, SONGI_FFMPEG_FALLBACK);
}

const RECENT_STORAGE_ISSUE_LIMIT = 20;
const recentStorageIssues = [];

function jsonStorageFileSpecs() {
  return [
    { filePath: USERS_PATH, arrayFields: ["users"] },
    { filePath: SESSIONS_PATH, arrayFields: ["sessions"] },
    { filePath: USER_SECRETS_PATH, arrayFields: ["secrets"] },
    { filePath: SETUP_TOKENS_PATH, arrayFields: ["tokens"] },
    { filePath: JOBS_PATH, arrayFields: ["jobs"] },
    { filePath: AGENTS_PATH, arrayFields: ["agents"] },
    { filePath: COMMANDS_PATH, arrayFields: ["commands"] },
    { filePath: CAFE24_ORDERS_PATH, arrayFields: ["orders"] },
    { filePath: RESEARCH_STORAGE_CONFIG_PATH, arrayFields: [] },
    { filePath: RESEARCH_PATH, arrayFields: ["projects", "items"] },
  ];
}

function storageFileLabel(filePath) {
  return path.basename(String(filePath || ""));
}

function recordStorageIssue(filePath, code, error) {
  const issue = {
    at: nowIso(),
    file: storageFileLabel(filePath),
    code: String(code || "json_storage_error"),
    message: String(error?.message || error || code || "json_storage_error").slice(0, 240),
  };
  recentStorageIssues.push(issue);
  while (recentStorageIssues.length > RECENT_STORAGE_ISSUE_LIMIT) recentStorageIssues.shift();
  console.error("[json storage]", issue.code, issue.file, issue.message);
}

function makeJsonStorageError(filePath, code, message, cause) {
  const error = new Error(message || code || "json_storage_error");
  error.code = code || "json_storage_error";
  error.file_label = storageFileLabel(filePath);
  if (cause) error.cause = cause;
  return error;
}

function isJsonStorageError(error) {
  return Boolean(error && String(error.code || "").startsWith("json_"));
}

function parseJsonFileStrict(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    recordStorageIssue(filePath, "json_read_failed", error);
    throw makeJsonStorageError(filePath, "json_read_failed", "json_read_failed", error);
  }
}

function readJsonFile(filePath, fallback, options = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    recordStorageIssue(filePath, "json_read_failed", error);
    if (options.allowFallbackOnError) return fallback;
    throw makeJsonStorageError(filePath, "json_read_failed", "json_read_failed", error);
  }
}

function arrayFieldOrThrow(filePath, data, fieldName) {
  if (Array.isArray(data?.[fieldName])) return data[fieldName];
  const error = makeJsonStorageError(filePath, "json_shape_invalid", `${fieldName}_must_be_array`);
  recordStorageIssue(filePath, error.code, error);
  throw error;
}

function fsyncDirBestEffort(dirPath) {
  try {
    const fd = fs.openSync(dirPath, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch (_error) {
    // Some platforms/filesystems do not allow directory fsync. Atomic rename still protects the file.
  }
}

function writeTextAtomic(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const backupPath = `${filePath}.bak`;
  let fd = null;
  try {
    fd = fs.openSync(tmpPath, "w", 0o600);
    fs.writeFileSync(fd, body, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
    fs.renameSync(tmpPath, filePath);
    fsyncDirBestEffort(path.dirname(filePath));
  } catch (error) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_closeError) {}
    }
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch (_rmError) {}
    recordStorageIssue(filePath, "json_write_failed", error);
    throw makeJsonStorageError(filePath, "json_write_failed", "json_write_failed", error);
  }
}

function writeJsonAtomic(filePath, payload) {
  const serialized = JSON.stringify(payload, null, 2);
  if (typeof serialized !== "string") {
    throw makeJsonStorageError(filePath, "json_write_failed", "json_payload_not_serializable");
  }
  JSON.parse(serialized);
  writeTextAtomic(filePath, `${serialized}\n`);
}

function expandHomePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "~") return process.env.HOME || raw;
  if (raw.startsWith("~/")) return path.join(process.env.HOME || ".", raw.slice(2));
  return raw;
}

function normalizeResearchDataDir(value) {
  const raw = expandHomePath(value);
  if (!raw || raw.includes("\0")) {
    throw Object.assign(new Error("research_storage_path_required"), { code: "research_storage_path_required" });
  }
  return path.resolve(raw);
}

function configuredResearchDataDir() {
  const envDir = String(process.env.AIMAX_RESEARCH_DATA_DIR || "").trim();
  if (envDir) {
    try {
      return normalizeResearchDataDir(envDir);
    } catch (_error) {
      return DATA_DIR;
    }
  }
  try {
    const data = readJsonFile(RESEARCH_STORAGE_CONFIG_PATH, {});
    if (data?.data_dir) return normalizeResearchDataDir(data.data_dir);
  } catch (_error) {}
  return DATA_DIR;
}

function researchStoragePayload() {
  const handoffDir = path.join(RESEARCH_DATA_DIR, "handoff-md");
  return {
    mode: "local",
    label: "이 컴퓨터 로컬 저장",
    data_dir: RESEARCH_DATA_DIR,
    research_file: RESEARCH_PATH,
    handoff_dir: handoffDir,
    handoff_index_file: path.join(handoffDir, "index.md"),
    config_file: RESEARCH_STORAGE_CONFIG_PATH,
  };
}

function saveResearchStorageConfig() {
  writeJsonAtomic(RESEARCH_STORAGE_CONFIG_PATH, {
    version: 1,
    data_dir: RESEARCH_DATA_DIR,
    research_file: RESEARCH_PATH,
    updated_at: nowIso(),
  });
}

function setResearchStorageDir(nextDirRaw) {
  const nextDir = normalizeResearchDataDir(nextDirRaw);
  const nextPath = path.join(nextDir, "research.json");
  fs.mkdirSync(nextDir, { recursive: true });
  try {
    fs.accessSync(nextDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch (_error) {
    throw Object.assign(new Error("research_storage_not_writable"), { code: "research_storage_not_writable" });
  }
  if (path.resolve(nextPath) !== path.resolve(RESEARCH_PATH) && !fs.existsSync(nextPath)) {
    writeJsonAtomic(nextPath, loadResearch());
  }
  RESEARCH_DATA_DIR = nextDir;
  RESEARCH_PATH = nextPath;
  saveResearchStorageConfig();
  return researchStoragePayload();
}

function writeJsonLinesAtomic(filePath, rows) {
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeTextAtomic(filePath, body ? `${body}\n` : "");
}

function appendJsonLineDurable(filePath, row) {
  const body = `${JSON.stringify(row)}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let fd = null;
  try {
    fd = fs.openSync(filePath, "a", 0o600);
    fs.writeFileSync(fd, body, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
  } catch (error) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_closeError) {}
    }
    recordStorageIssue(filePath, "json_write_failed", error);
    throw makeJsonStorageError(filePath, "json_write_failed", "json_write_failed", error);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function productList(product) {
  if (product === "blog_team") return ["yeri", "hyunju", "blog_team"];
  if (product === "bundle") return [...BUNDLE_PRODUCTS];
  return [product];
}

function normalizeAccountSegment(value, fallback = "paid_buyer") {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!raw) return ACCOUNT_SEGMENTS.has(fallback) ? fallback : "paid_buyer";
  if (["buyer", "paid", "paid_user", "paid_buyer", "유료", "유료구매자", "구매자"].includes(raw)) return "paid_buyer";
  if (["makefamily", "makefamily_member", "member", "student", "course", "course_member", "원회원", "수강생", "메이크패밀리", "메이크패밀리회원", "메이크패밀리원회원"].includes(raw)) return "makefamily_member";
  if (["both", "member_and_buyer", "makefamily_buyer", "원회원+구매자", "수강생+구매자"].includes(raw)) return "member_and_buyer";
  if (["test", "demo", "테스트", "운영테스트"].includes(raw)) return "test";
  if (["operator", "admin", "운영자"].includes(raw)) return "operator";
  return ACCOUNT_SEGMENTS.has(raw) ? raw : (ACCOUNT_SEGMENTS.has(fallback) ? fallback : "paid_buyer");
}

function defaultAccountSegmentForSource(source) {
  const normalized = String(source || "").toLowerCase();
  if (/makefamily|member|student|course|수강|원회원|메이크패밀리/.test(normalized)) return "makefamily_member";
  if (/test|demo|operator|운영테스트/.test(normalized)) return "test";
  if (/운영자/.test(normalized)) return "operator";
  return "paid_buyer";
}

function accountSegmentLabel(segment) {
  return ACCOUNT_SEGMENT_LABELS[normalizeAccountSegment(segment)] || ACCOUNT_SEGMENT_LABELS.paid_buyer;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function setupUrl(token) {
  return `${PUBLIC_BASE_URL}/setup?token=${encodeURIComponent(token)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(password), salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
  });
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password, encoded) {
  const parts = String(encoded || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  const derived = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
  });
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function generateTemporaryPassword() {
  return `Aim-${crypto.randomBytes(12).toString("base64url")}`;
}

function validateNewPassword(password, email) {
  const value = String(password || "");
  if (value !== value.trim()) return "password_has_outer_whitespace";
  if (!/^[\x21-\x7E]+$/.test(value)) return "password_requires_ascii";
  if (value.length < 10) return "password_too_short";
  const localPart = normalizeEmail(email).split("@")[0];
  if (localPart && value.toLowerCase().includes(localPart.slice(0, Math.min(localPart.length, 5)))) {
    return "password_contains_email";
  }
  return "";
}

function loadUsers() {
  const data = readJsonFile(USERS_PATH, { version: 1, users: [] });
  return {
    version: 1,
    users: arrayFieldOrThrow(USERS_PATH, data, "users"),
  };
}

function saveUsers(data) {
  writeJsonAtomic(USERS_PATH, { version: 1, users: arrayFieldOrThrow(USERS_PATH, data, "users") });
}

function loadSessions() {
  const now = Date.now();
  const data = readJsonFile(SESSIONS_PATH, { version: 1, sessions: [] });
  const sessions = arrayFieldOrThrow(SESSIONS_PATH, data, "sessions");
  return {
    version: 1,
    sessions: sessions.filter((session) => Date.parse(session.expires_at || "") > now),
  };
}

function saveSessions(data) {
  writeJsonAtomic(SESSIONS_PATH, { version: 1, sessions: arrayFieldOrThrow(SESSIONS_PATH, data, "sessions") });
}

function loadUserSecrets() {
  const data = readJsonFile(USER_SECRETS_PATH, { version: 1, secrets: [] });
  return {
    version: 1,
    secrets: arrayFieldOrThrow(USER_SECRETS_PATH, data, "secrets"),
  };
}

function saveUserSecrets(data) {
  writeJsonAtomic(USER_SECRETS_PATH, { version: 1, secrets: arrayFieldOrThrow(USER_SECRETS_PATH, data, "secrets") });
}

let cachedUserSecretKey = null;

function parseUserSecretKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const candidates = [];
  if (raw.startsWith("base64:")) candidates.push(Buffer.from(raw.slice(7), "base64"));
  if (raw.startsWith("hex:")) candidates.push(Buffer.from(raw.slice(4), "hex"));
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) candidates.push(Buffer.from(raw, "hex"));
  candidates.push(Buffer.from(raw, "base64"));
  for (const candidate of candidates) {
    if (candidate.length >= 32) return candidate.subarray(0, 32);
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function getUserSecretKey() {
  if (cachedUserSecretKey) return cachedUserSecretKey;
  const configured = process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY || process.env.USER_SECRET_ENCRYPTION_KEY || "";
  const parsed = parseUserSecretKey(configured);
  if (parsed) {
    cachedUserSecretKey = parsed;
    return cachedUserSecretKey;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    if (fs.existsSync(USER_SECRET_KEY_PATH)) {
      const stored = parseUserSecretKey(fs.readFileSync(USER_SECRET_KEY_PATH, "utf8"));
      if (stored) {
        cachedUserSecretKey = stored;
        return cachedUserSecretKey;
      }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(USER_SECRET_KEY_PATH, `${generated.toString("base64")}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      fs.chmodSync(USER_SECRET_KEY_PATH, 0o600);
    } catch (_error) {}
    cachedUserSecretKey = generated;
    return cachedUserSecretKey;
  } catch (error) {
    const fallbackSeed = `${AUTH_TOKEN || ADMIN_TOKEN || os.hostname()}:${DATA_DIR}`;
    cachedUserSecretKey = crypto.createHash("sha256").update(fallbackSeed).digest();
    return cachedUserSecretKey;
  }
}

function userSecretAad(userId, secretName) {
  return Buffer.from(`aimax-user-secret:v1:${userId}:${secretName}`, "utf8");
}

function encryptUserSecret(userId, secretName, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getUserSecretKey(), iv);
  cipher.setAAD(userSecretAad(userId, secretName));
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptUserSecret(userId, secretName, encrypted) {
  if (!encrypted || encrypted.v !== 1 || encrypted.alg !== "aes-256-gcm") return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getUserSecretKey(), Buffer.from(encrypted.iv, "base64"));
    decipher.setAAD(userSecretAad(userId, secretName));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (_error) {
    return "";
  }
}

function normalizeSecretProvider(provider) {
  const value = String(provider || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  const aliases = {
    "gemini-api-key": "gemini",
    google: "gemini",
    "google-gemini": "gemini",
    "openai-api-key": "openai",
    anthropic: "claude",
    "claude-api-key": "claude",
    "apify-api-token": "apify",
    "apify-token": "apify",
  };
  return aliases[value] || value;
}

function secretProviderConfig(provider) {
  return USER_SECRET_PROVIDERS[normalizeSecretProvider(provider)] || null;
}

function userSecretFingerprint(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function findUserSecretRow(data, userId, provider) {
  const normalized = normalizeSecretProvider(provider);
  return (data.secrets || []).find((row) => row.user_id === userId && row.provider === normalized) || null;
}

function getUserSecret(userId, secretNameOrProvider) {
  const config = secretProviderConfig(secretNameOrProvider)
    || Object.values(USER_SECRET_PROVIDERS).find((item) => item.secretName === secretNameOrProvider);
  if (!userId || !config) return "";
  const data = loadUserSecrets();
  const row = findUserSecretRow(data, userId, config.provider);
  if (!row) return "";
  return decryptUserSecret(userId, config.secretName, row.encrypted);
}

function hasUserSecret(userId, secretNameOrProvider) {
  return Boolean(getUserSecret(userId, secretNameOrProvider));
}

function getUserOrStoredSecret(userId, secretNameOrProvider) {
  const config = secretProviderConfig(secretNameOrProvider)
    || Object.values(USER_SECRET_PROVIDERS).find((item) => item.secretName === secretNameOrProvider);
  if (!config) return "";
  return getUserSecret(userId, config.provider) || getStoredSecret(config.secretName);
}

function hasUserOrStoredSecret(userId, secretNameOrProvider) {
  return Boolean(getUserOrStoredSecret(userId, secretNameOrProvider));
}

function setUserSecret(userId, provider, value) {
  const config = secretProviderConfig(provider);
  const secretValue = String(value || "").trim();
  if (!config) return { error: "invalid_secret_provider" };
  if (!secretValue) return { error: "empty_secret_value" };
  if (secretValue.length > 12000) return { error: "secret_value_too_large" };
  const data = loadUserSecrets();
  const now = nowIso();
  let row = findUserSecretRow(data, userId, config.provider);
  if (!row) {
    row = {
      user_id: userId,
      provider: config.provider,
      secret_name: config.secretName,
      created_at: now,
    };
    data.secrets.push(row);
  }
  row.secret_name = config.secretName;
  row.encrypted = encryptUserSecret(userId, config.secretName, secretValue);
  row.fingerprint = userSecretFingerprint(secretValue);
  row.updated_at = now;
  saveUserSecrets(data);
  return { row, config };
}

function deleteUserSecret(userId, provider) {
  const config = secretProviderConfig(provider);
  if (!config) return { error: "invalid_secret_provider" };
  const data = loadUserSecrets();
  const before = data.secrets.length;
  data.secrets = data.secrets.filter((row) => !(row.user_id === userId && row.provider === config.provider));
  saveUserSecrets(data);
  return { deleted: before - data.secrets.length, config };
}

function deleteUserSecretsForUser(userId) {
  if (!userId) return 0;
  const data = loadUserSecrets();
  const before = data.secrets.length;
  data.secrets = data.secrets.filter((row) => row.user_id !== userId);
  saveUserSecrets(data);
  return before - data.secrets.length;
}

function publicUserSecretStatus(userId, provider, data = loadUserSecrets()) {
  const config = secretProviderConfig(provider);
  if (!config) return null;
  const row = findUserSecretRow(data, userId, config.provider);
  const globalConfigured = hasStoredSecret(config.secretName);
  const webConfigured = Boolean(row && decryptUserSecret(userId, config.secretName, row.encrypted));
  return {
    provider: config.provider,
    label: config.label,
    configured: webConfigured || globalConfigured,
    web_configured: webConfigured,
    server_configured: globalConfigured,
    source: webConfigured ? "web_user" : globalConfigured ? "server_global" : "missing",
    fingerprint: webConfigured ? row.fingerprint || "" : "",
    updated_at: webConfigured ? row.updated_at || row.created_at || "" : "",
  };
}

function publicUserSecretStatuses(userId) {
  const data = loadUserSecrets();
  const providers = {};
  for (const provider of Object.keys(USER_SECRET_PROVIDERS)) {
    providers[provider] = publicUserSecretStatus(userId, provider, data);
  }
  return {
    providers,
    encryption: {
      enabled: true,
      mode: (process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY || process.env.USER_SECRET_ENCRYPTION_KEY) ? "env_key" : "local_key_file",
    },
  };
}

function loadSetupTokens() {
  const now = Date.now();
  const data = readJsonFile(SETUP_TOKENS_PATH, { version: 1, tokens: [] });
  const tokens = arrayFieldOrThrow(SETUP_TOKENS_PATH, data, "tokens");
  return {
    version: 1,
    tokens: tokens.filter((token) => token.used_at || Date.parse(token.expires_at || "") > now),
  };
}

function saveSetupTokens(data) {
  writeJsonAtomic(SETUP_TOKENS_PATH, { version: 1, tokens: arrayFieldOrThrow(SETUP_TOKENS_PATH, data, "tokens") });
}

function loadJobs() {
  const data = readJsonFile(JOBS_PATH, { version: 1, jobs: [] });
  return {
    version: 1,
    jobs: arrayFieldOrThrow(JOBS_PATH, data, "jobs"),
  };
}

function saveJobs(data) {
  writeJsonAtomic(JOBS_PATH, { version: 1, jobs: arrayFieldOrThrow(JOBS_PATH, data, "jobs") });
}

function safeArtifactId(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function yeriArtifactPath(artifactId) {
  const safeId = safeArtifactId(artifactId);
  if (!safeId) return "";
  return path.join(ARTIFACTS_DIR, `${safeId}.json`);
}

function sanitizeYeriArtifact(raw) {
  const artifact = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    title: redactText(String(artifact.title || "")).trim().slice(0, 300),
    content_markdown: redactText(String(artifact.content_markdown || artifact.markdown || artifact.content || "")).slice(0, 100000),
    generated_at: String(artifact.generated_at || nowIso()).slice(0, 40),
    text_model: String(artifact.text_model || artifact.model || "").trim().slice(0, 80),
    usage: sanitizeUsage(artifact.usage),
  };
}

function yeriArtifactMeta(artifactId, artifact) {
  const normalized = sanitizeYeriArtifact(artifact || {});
  return {
    artifact_id: safeArtifactId(artifactId),
    ready: Boolean(normalized.content_markdown || normalized.title),
    generated_at: normalized.generated_at || null,
    text_model: normalized.text_model || "",
    content_char_count: normalized.content_markdown.length,
  };
}

function saveYeriArtifact(jobId, rawArtifact) {
  const artifactId = safeArtifactId(jobId);
  if (!artifactId) {
    throw makeJsonStorageError(ARTIFACTS_DIR, "json_write_failed", "artifact_id_required");
  }
  const artifact = sanitizeYeriArtifact(rawArtifact);
  const payload = {
    version: 1,
    kind: "yeri_write",
    job_id: artifactId,
    artifact,
    saved_at: nowIso(),
  };
  writeJsonAtomic(yeriArtifactPath(artifactId), payload);
  return yeriArtifactMeta(artifactId, artifact);
}

function loadYeriArtifact(jobOrArtifactId) {
  const artifactId = safeArtifactId(
    typeof jobOrArtifactId === "object" && jobOrArtifactId
      ? jobOrArtifactId.artifact_id || jobOrArtifactId.id
      : jobOrArtifactId,
  );
  const filePath = yeriArtifactPath(artifactId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const data = readJsonFile(filePath, null);
  if (data?.version !== 1 || data?.kind !== "yeri_write") return null;
  return sanitizeYeriArtifact(data.artifact);
}

function attachYeriArtifactToJob(job, rawArtifact) {
  if (!job || typeof job !== "object") return null;
  const meta = saveYeriArtifact(job.id, rawArtifact);
  job.artifact_id = meta.artifact_id;
  job.artifact_generated_at = meta.generated_at;
  job.artifact_text_model = meta.text_model;
  job.artifact_char_count = meta.content_char_count;
  return meta;
}

function publicYeriArtifactMeta(job) {
  if (job?.kind !== "yeri_write" || !job.artifact_id) return null;
  return {
    artifact_id: safeArtifactId(job.artifact_id),
    ready: true,
    generated_at: job.artifact_generated_at || null,
    text_model: job.artifact_text_model || "",
    content_char_count: safeInt(job.artifact_char_count, 0, 100000),
  };
}

function agentYeriArtifactPayload(job) {
  if (job?.kind !== "yeri_write" || !job.artifact_id) return null;
  return loadYeriArtifact(job);
}

function yeriServerGenerationMode() {
  if (YERI_SERVER_GENERATION_MOCK) return "mock";
  if (YERI_SERVER_GENERATION_ENABLED) return "gemini";
  return "";
}

function yeriAiProviderForModel(modelValue) {
  const model = String(modelValue || "").trim().toLowerCase();
  if (!model) return "gemini";
  if (model === "claude" || model.startsWith("claude") || model.includes("anthropic")) return "claude";
  if (model.startsWith("gpt-") || model.startsWith("openai") || model.includes("openai")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  return "unknown";
}

function yeriSelectedModel(payload = {}) {
  return String(payload?.ai_model || payload?.model || "").trim();
}

function normalizeYeriGeminiModel(model) {
  const value = String(model || "").trim();
  // 기본/제네릭/접미사 없는 레거시값(2.5 Pro, 3.1 Pro)은 검증된 무료 등급 2.5 Flash 로 통일.
  // UI 선택지 값은 "gemini-3.1-pro-preview"(접미사 포함)라, 접미사 없는 "gemini-3.1-pro"는
  // 명시 선택이 아니라 자동/레거시값 → flash 안전 (runner app.py/_LEGACY_AI_MODEL_MAP 과 일치).
  const aliases = {
    gemini: YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash",
    "gemini-pro": "gemini-3.1-pro-preview",
    "gemini-flash": YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash",
    "gemini-2.5-pro": YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash",
    "gemini-3.1-pro": YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash",
  };
  return aliases[value] || (value.startsWith("gemini-") ? value : (YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash"));
}

function yeriServerGenerationProviderIssue(payload = {}, mode = yeriServerGenerationMode()) {
  if (mode !== "gemini") return null;
  const model = yeriSelectedModel(payload);
  const provider = yeriAiProviderForModel(model);
  if (["gemini", "openai", "claude"].includes(provider)) return null;
  return {
    provider,
    model: model || "default",
  };
}

function yeriServerGenerationTextModel(payload = {}) {
  const selected = yeriSelectedModel(payload);
  const provider = yeriAiProviderForModel(selected);
  if (provider === "openai") return selected || "gpt-5.4-mini";
  if (provider === "claude") return YERI_SERVER_GENERATION_CLAUDE_MODEL || "claude-sonnet-4-6";
  return normalizeYeriGeminiModel(selected);
}

function yeriGeminiFallbackModel(model) {
  const primary = String(model || "").trim();
  const fallback = String(YERI_SERVER_GENERATION_MODEL || "gemini-2.5-flash").trim() || "gemini-2.5-flash";
  return primary && primary !== fallback ? fallback : "";
}

function canUseYeriServerGeneration(user) {
  if (!YERI_SERVER_GENERATION_ALLOWED_USER_IDENTIFIERS.size) return true;
  if (userAccessIdentifierVariants(user).some((identifier) => (
    YERI_SERVER_GENERATION_ALLOWED_USER_IDENTIFIERS.has(identifier)
  ))) return true;
  // 목표: "웹에 저장한 키로 모두가 사용". 허용목록 외에도, 본인 웹 AI 키를 저장한 사용자는
  // 서버생성 허용(그 웹키로 생성). 키 없는 사용자는 false → 러너 로컬생성으로 폴백(안 깨짐).
  const userId = user && user.id;
  if (!userId) return false;
  return hasUserSecret(userId, "gemini") || hasUserSecret(userId, "openai") || hasUserSecret(userId, "claude");
}

function hasYeriServerGenerationSecret(user) {
  const userId = user && user.id;
  if (!userId) return false;
  return hasUserSecret(userId, "gemini") || hasUserSecret(userId, "openai") || hasUserSecret(userId, "claude");
}

function yeriServerGenerationModeForUser(user) {
  const mode = yeriServerGenerationMode();
  if (!mode || mode === "mock") return mode;
  return canUseYeriServerGeneration(user) ? mode : "";
}

function requestedYeriServerGenerationMode(kind, body, user) {
  if (kind !== "yeri_write" || body?.server_generation !== true) return "";
  return yeriServerGenerationModeForUser(user);
}

function publicYeriServerGenerationConfig(user) {
  const mode = yeriServerGenerationModeForUser(user);
  return {
    enabled: mode === "gemini",
    mode,
    provider: mode === "gemini" ? "selected" : "",
    supported_providers: mode === "gemini" ? ["gemini", "openai", "claude"] : [],
    model: mode === "gemini" ? YERI_SERVER_GENERATION_MODEL : "",
    confirm_paid_required: mode === "gemini",
    real_test_only: Boolean(mode === "gemini" && YERI_SERVER_GENERATION_REAL_TEST_ONLY),
    max_word_count: mode === "gemini" && YERI_SERVER_GENERATION_REAL_TEST_ONLY ? YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT : 0,
    max_image_count: mode === "gemini" && YERI_SERVER_GENERATION_REAL_TEST_ONLY ? YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT : 0,
  };
}

function yeriRealTestLimitIssue(payload) {
  if (!YERI_SERVER_GENERATION_REAL_TEST_ONLY) return null;
  const wordCount = yeriPayloadWordCount(payload);
  const imageCount = yeriPayloadImageCount(payload);
  if (wordCount > YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT) {
    return {
      field: "word_count",
      limit: YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT,
      value: wordCount,
    };
  }
  if (imageCount > YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT) {
    return {
      field: "image_count",
      limit: YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT,
      value: imageCount,
    };
  }
  return null;
}

function yeriPayloadKeywords(payload) {
  const source = payload?.keywords ?? payload?.keyword ?? payload?.topic ?? payload?.query ?? "";
  const rows = Array.isArray(source)
    ? source
    : String(source || "").split(/[\n,]+/);
  return rows
    .map((item) => compactText(item, 120))
    .filter(Boolean)
    .slice(0, 10);
}

function yeriPayloadFirstKeyword(payload) {
  return yeriPayloadKeywords(payload)[0] || "AIMAX 블로그 글";
}

function yeriPayloadImageCount(payload) {
  return safeInt(payload?.image_count ?? payload?.images ?? 3, 0, 8);
}

function yeriPayloadWordCount(payload) {
  return safeInt(payload?.word_count ?? payload?.wordcount ?? 1500, 300, 6000);
}

function yeriPayloadStyle(payload) {
  const style = String(payload?.style_id || payload?.style || "info").trim();
  if (style === "buy") return "구매 전환형";
  if (style === "ad") return "광고/홍보형";
  return "정보성";
}

function yeriSeoResearchEnabled(payload = {}) {
  return payload?.seo_research_enabled !== false && payload?.seo_research_enabled !== "0";
}

function stripInlineHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function yeriReferenceTextChunks(text) {
  const clean = cleanMultilineText(text, 12000);
  if (!clean) return [];
  const chunks = clean.split(/\n\s*---+\s*\n/).map((item) => item.trim()).filter(Boolean);
  return (chunks.length ? chunks : [clean]).slice(0, 8);
}

function yeriCoerceSeoReferencePost(item, rank) {
  if (typeof item === "string") {
    const text = cleanMultilineText(item, 6000);
    if (!text) return null;
    return {
      rank,
      title: compactText(text.split(/\n/).find(Boolean) || "사용자 참고글", 160),
      body_text: text,
      headings: text.split(/\n/).filter((line) => /^#+\s+/.test(line.trim())).map((line) => compactText(line.replace(/^#+\s+/, ""), 120)).slice(0, 10),
      images: [],
    };
  }
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const title = compactText(item.title || "", 160);
  const bodyText = cleanMultilineText(item.body_text || item.text || item.content || item.description || "", 6000);
  if (!title && !bodyText) return null;
  return {
    rank: safeInt(item.rank, rank, 1, 100),
    title,
    url: compactText(item.url || item.link || "", 300),
    body_text: bodyText,
    headings: Array.isArray(item.headings) ? item.headings.map((line) => compactText(line, 120)).filter(Boolean).slice(0, 10) : [],
    images: Array.isArray(item.images) ? item.images.slice(0, 12) : [],
  };
}

async function fetchYeriReferenceUrlPost(rawUrl, rank) {
  try {
    const response = await requestResearchUrl(rawUrl, { timeoutMs: 5000, maxBytes: 512 * 1024 });
    const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
    if (contentType.includes("text/html") || /<html|<title|<meta/i.test(response.text)) {
      const title = extractHtmlMeta(response.text, ["og:title", "twitter:title"]) || extractHtmlTitle(response.text);
      const description = extractHtmlMeta(response.text, ["description", "og:description", "twitter:description"]);
      const bodyText = htmlToResearchText(response.text);
      return {
        rank,
        title: title || compactText(rawUrl, 160),
        url: response.finalUrl || rawUrl,
        body_text: cleanMultilineText([description, bodyText].filter(Boolean).join("\n\n"), 6000),
        headings: [],
        images: [],
      };
    }
    return {
      rank,
      title: compactText(rawUrl, 160),
      url: response.finalUrl || rawUrl,
      body_text: cleanMultilineText(response.text, 6000),
      headings: [],
      images: [],
    };
  } catch (_error) {
    return null;
  }
}

async function fetchNaverSearchSeoPosts(keyword) {
  if (!NAVER_SEARCH_CLIENT_ID || !NAVER_SEARCH_CLIENT_SECRET || !keyword) return [];
  const url = new URL("https://openapi.naver.com/v1/search/blog.json");
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", "5");
  url.searchParams.set("sort", "sim");
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: "GET",
      timeout: 5000,
      headers: {
        "X-Naver-Client-Id": NAVER_SEARCH_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_SEARCH_CLIENT_SECRET,
        "User-Agent": "AIMAX-YeriSEO/1.0",
        accept: "application/json",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        if (Number(res.statusCode || 0) < 200 || Number(res.statusCode || 0) >= 300) {
          resolve([]);
          return;
        }
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve((Array.isArray(data.items) ? data.items : []).slice(0, 5).map((item, index) => ({
            rank: index + 1,
            title: stripInlineHtml(item.title || ""),
            url: compactText(item.link || "", 300),
            body_text: stripInlineHtml(item.description || ""),
            headings: [],
            images: [],
          })).filter((item) => item.title || item.body_text));
        } catch (_error) {
          resolve([]);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("naver_search_timeout")));
    req.on("error", () => resolve([]));
    req.end();
  });
}

function yeriWordCount(text) {
  return (String(text || "").match(/[0-9A-Za-z가-힣]+/g) || []).length;
}

function yeriKeywordCount(keyword, text) {
  if (!keyword) return 0;
  return (String(text || "").match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
}

function buildYeriSeoBrief(keyword, posts) {
  const rows = (posts || []).filter(Boolean).slice(0, 8).map((post, index) => {
    const text = `${post.title || ""}\n${post.body_text || ""}`;
    const headings = Array.isArray(post.headings) ? post.headings.filter(Boolean) : [];
    const images = Array.isArray(post.images) ? post.images : [];
    return {
      rank: safeInt(post.rank, index + 1, 1, 100),
      title: compactText(post.title || "", 160),
      url: compactText(post.url || "", 240),
      word_count: yeriWordCount(text),
      heading_count: headings.length,
      image_count: images.length,
      keyword_count: yeriKeywordCount(keyword, text),
      title_has_keyword: Boolean(keyword && String(post.title || "").toLowerCase().includes(String(keyword).toLowerCase())),
      image_roles: [],
    };
  });
  if (!rows.length) return null;
  const average = (key) => Math.round(rows.reduce((sum, row) => sum + safeInt(row[key], 0, 100000), 0) / rows.length);
  const recommendedImages = Math.max(1, Math.min(6, average("image_count") || 3));
  return {
    keyword,
    source_count: rows.length,
    recommended_image_count: recommendedImages,
    averages: {
      word_count: average("word_count"),
      heading_count: average("heading_count"),
      image_count: average("image_count"),
      keyword_count: average("keyword_count"),
    },
    top_posts: rows,
    writing_guidance: [
      `정확한 키워드 '${keyword}'는 제목과 첫 문단에 자연스럽게 넣되 과반복하지 마세요.`,
      "상위 글의 제목과 문장을 복사하지 말고 검색 의도와 구조만 참고하세요.",
      "상위 글보다 더 구체적인 경험, 기준, 체크포인트를 추가하세요.",
    ],
    source: {
      mode: "safe_auto",
      official_search_api: Boolean(NAVER_SEARCH_CLIENT_ID && NAVER_SEARCH_CLIENT_SECRET),
      browser_scraping: false,
    },
  };
}

async function buildYeriSeoBriefFromPayload(payload) {
  if (payload?.seo_brief && typeof payload.seo_brief === "object" && !Array.isArray(payload.seo_brief)) {
    return payload.seo_brief;
  }
  if (!yeriSeoResearchEnabled(payload)) return null;
  const keyword = yeriPayloadFirstKeyword(payload);
  const posts = [];
  if (Array.isArray(payload?.seo_reference_posts)) {
    payload.seo_reference_posts.slice(0, 8).forEach((item, index) => {
      const post = yeriCoerceSeoReferencePost(item, index + 1);
      if (post) posts.push(post);
    });
  }
  for (const chunk of yeriReferenceTextChunks(payload?.seo_reference_text || "")) {
    const post = yeriCoerceSeoReferencePost(chunk, posts.length + 1);
    if (post) posts.push(post);
  }
  const urls = Array.isArray(payload?.seo_reference_urls)
    ? payload.seo_reference_urls
    : String(payload?.seo_reference_urls || "").split(/[\n,]+/);
  for (const rawUrl of urls.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)) {
    const post = await fetchYeriReferenceUrlPost(rawUrl, posts.length + 1);
    if (post) posts.push(post);
  }
  posts.push(...await fetchNaverSearchSeoPosts(keyword));
  return buildYeriSeoBrief(keyword, posts);
}

function yeriExtractTitleFromMarkdown(markdown) {
  const lines = String(markdown || "").split(/\n/);
  for (const line of lines) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match) return compactText(match[1], 180);
  }
  return "";
}

function yeriEnsureMarkdownTitle(title, markdown) {
  const cleanTitle = compactText(title || yeriExtractTitleFromMarkdown(markdown) || "블로그 글", 180);
  const cleanMarkdown = cleanMultilineText(markdown, 100000);
  if (/^#\s+/m.test(cleanMarkdown)) return { title: cleanTitle, content_markdown: cleanMarkdown };
  return {
    title: cleanTitle,
    content_markdown: `# ${cleanTitle}\n\n${cleanMarkdown}`.trim(),
  };
}

function redistributeConsecutiveImageLines(markdown) {
  const chunks = String(markdown || "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const hasConsecutiveImages = chunks.some((chunk, index) => (
    index > 0 && /^\[이미지\]/.test(chunk) && /^\[이미지\]/.test(chunks[index - 1] || "")
  ));
  if (!hasConsecutiveImages) return markdown;

  const imageChunks = chunks.filter((chunk) => /^\[이미지\]/.test(chunk));
  const contentChunks = chunks.filter((chunk) => !/^\[이미지\]/.test(chunk));
  if (imageChunks.length < 2 || contentChunks.length < 2) return markdown;

  const targetable = contentChunks
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => !/^#\s+/.test(chunk));
  if (!targetable.length) return markdown;

  const targets = [];
  const slots = targetable.slice(0, Math.max(1, targetable.length - 1));
  for (let imageIndex = 0; imageIndex < imageChunks.length; imageIndex += 1) {
    const slotIndex = Math.min(slots.length - 1, Math.floor((imageIndex * slots.length) / imageChunks.length));
    targets.push(slots[slotIndex]?.index ?? targetable[targetable.length - 1].index);
  }

  const imagesByContentIndex = new Map();
  for (let imageIndex = 0; imageIndex < imageChunks.length; imageIndex += 1) {
    const targetIndex = targets[imageIndex];
    if (!imagesByContentIndex.has(targetIndex)) imagesByContentIndex.set(targetIndex, []);
    imagesByContentIndex.get(targetIndex).push(imageChunks[imageIndex]);
  }

  const rebuilt = [];
  for (let index = 0; index < contentChunks.length; index += 1) {
    rebuilt.push(contentChunks[index]);
    const images = imagesByContentIndex.get(index) || [];
    rebuilt.push(...images);
  }
  return rebuilt.join("\n\n");
}

function sanitizeYeriGeneratedArtifact(raw, payload, model, usage = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const fallbackTitle = `${yeriPayloadFirstKeyword(payload)} 정리`;
  const title = compactText(source.title || yeriExtractTitleFromMarkdown(source.content_markdown || source.markdown || source.content) || fallbackTitle, 180);
  const markdown = cleanMultilineText(source.content_markdown || source.markdown || source.content || "", 100000);
  const normalized = yeriEnsureMarkdownTitle(title, redistributeConsecutiveImageLines(markdown));
  return {
    title: normalized.title,
    content_markdown: normalized.content_markdown,
    generated_at: nowIso(),
    text_model: String(model || "").slice(0, 80),
    usage: sanitizeUsage(usage),
  };
}

function buildYeriMockArtifact(job) {
  const payload = job?.payload || {};
  const keyword = yeriPayloadFirstKeyword(payload);
  const imageCount = yeriPayloadImageCount(payload);
  const imageLines = Array.from({ length: imageCount }, (_item, index) => (
    `[이미지] ${keyword} 주제를 설명하는 실제 블로그용 사진 ${index + 1}, 자연광, 과장 없는 구도`
  ));
  const markdown = [
    `# ${keyword} 실전 정리`,
    "",
    "## 핵심 요약",
    `${keyword}를 처음 확인하는 독자가 바로 이해할 수 있도록 핵심 맥락과 선택 기준을 정리합니다.`,
    "",
    ...imageLines.flatMap((line) => [line, ""]),
    "## 확인 포인트",
    "현재 상황에서 중요한 것은 정보의 정확성, 실제 적용 가능성, 그리고 다음 행동으로 이어지는 명확한 판단 기준입니다.",
    "",
    "## 마무리",
    "위 내용을 바탕으로 필요한 자료를 한 번 더 점검한 뒤 실행 순서를 정하면 시행착오를 줄일 수 있습니다.",
  ].join("\n");
  return sanitizeYeriGeneratedArtifact(
    { title: `${keyword} 실전 정리`, content_markdown: markdown },
    payload,
    "mock-no-paid",
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  );
}

function buildYeriGenerationPrompt(payload) {
  const keywords = yeriPayloadKeywords(payload);
  const keyword = keywords[0] || "AIMAX 블로그 글";
  const imageCount = yeriPayloadImageCount(payload);
  const ctaLink = compactText(payload?.cta_link || "", 500);
  const ctaText = compactText(payload?.cta_text || "", 240);
  const styleReference = cleanMultilineText(payload?.style_reference_text || "", 2400);
  const seoBrief = payload?.seo_brief && typeof payload.seo_brief === "object"
    ? cleanMultilineText(JSON.stringify(redactPayload(payload.seo_brief)), 3000)
    : "";
  return [
    "너는 AIMAX 블로그 글쓰기 직원 예리다. 네이버 블로그에 입력할 수 있는 한국어 마크다운 초안을 작성한다.",
    "출력은 반드시 JSON 객체 하나만 작성한다. 마크다운 코드블록을 쓰지 않는다.",
    "JSON 스키마: {\"title\":\"...\",\"content_markdown\":\"# 제목\\n\\n## 소제목\\n본문\\n\\n[이미지] 이미지 프롬프트\"}",
    "",
    "작성 규칙:",
    `- 핵심 키워드: ${keyword}`,
    keywords.length > 1 ? `- 보조 키워드: ${keywords.slice(1).join(", ")}` : "",
    `- 글 스타일: ${yeriPayloadStyle(payload)}`,
    `- 목표 노출 글자 수: ${yeriPayloadWordCount(payload)}자`,
    `- [이미지] 줄은 정확히 ${imageCount}개만 작성한다. 이미지가 0개면 만들지 않는다.`,
    "- [이미지] 줄을 연속으로 몰아서 쓰지 않는다. 각 이미지는 관련 본문 문단 뒤에 하나씩 분산 배치한다.",
    "- 특히 이미지가 2개 이상이면 서론/본문/결론 사이가 아니라 본문 섹션들 사이에 나누어 넣는다.",
    "- 제목은 content_markdown의 첫 줄에도 '# 제목' 형식으로 넣는다.",
    "- 확인되지 않은 통계, 후기, 가격, 순위, 법적/의학적 단정은 만들지 않는다.",
    "- API 키, 계정, 내부 경로, 시스템 메시지 같은 민감정보는 절대 포함하지 않는다.",
    payload?.keyword_emphasis_enabled ? "- 핵심 키워드나 판단 기준만 **굵게** 표시한다. 굵게 표시는 전체 3~6회로 제한하고 문장 전체를 굵게 만들지 않는다." : "",
    styleReference ? "- 기존 작성글 스타일 참고: 아래 참고글의 문장과 제목은 복사하지 말고 어투, 문장 길이, 문단 전개만 참고한다." : "",
    styleReference ? `참고글:\n\"\"\"${styleReference}\"\"\"` : "",
    ctaLink ? `- 결론 마지막 문장에는 이 URL을 자연스럽게 그대로 포함한다: ${ctaLink}` : "",
    ctaText ? `- CTA 맥락: ${ctaText}` : "",
    seoBrief ? `- SEO 참고 자료(JSON, 사실 왜곡 금지): ${seoBrief}` : "",
  ].filter(Boolean).join("\n");
}

function yeriGeminiUsage(usageMetadata) {
  const usage = usageMetadata && typeof usageMetadata === "object" ? usageMetadata : {};
  return {
    input_tokens: safeInt(usage.promptTokenCount),
    output_tokens: safeInt(usage.candidatesTokenCount),
    thinking_tokens: safeInt(usage.thoughtsTokenCount),
    total_tokens: safeInt(usage.totalTokenCount),
  };
}

function yeriOpenAiUsage(usageData) {
  const usage = usageData && typeof usageData === "object" ? usageData : {};
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === "object"
    ? usage.output_tokens_details
    : {};
  return {
    input_tokens: safeInt(usage.input_tokens),
    output_tokens: safeInt(usage.output_tokens),
    thinking_tokens: safeInt(outputDetails.reasoning_tokens),
    billable_output_tokens: safeInt(usage.output_tokens),
    total_tokens: safeInt(usage.total_tokens),
  };
}

function yeriClaudeUsage(usageData) {
  const usage = usageData && typeof usageData === "object" ? usageData : {};
  const inputTokens = safeInt(usage.input_tokens);
  const outputTokens = safeInt(usage.output_tokens);
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    thinking_tokens: 0,
    billable_output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };
}

function extractOpenAiText(response) {
  if (!response || typeof response !== "object") return "";
  if (response.output_text) return String(response.output_text || "").trim();
  const chunks = [];
  for (const item of response.output || []) {
    if (!item || typeof item !== "object") continue;
    for (const content of item.content || []) {
      if (!content || typeof content !== "object") continue;
      if (content.type === "output_text" && content.text) chunks.push(String(content.text));
    }
  }
  return chunks.join("\n").trim();
}

function extractClaudeText(response) {
  if (!response || typeof response !== "object") return "";
  const chunks = [];
  for (const item of response.content || []) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "text" && item.text) chunks.push(String(item.text));
  }
  return chunks.join("\n").trim();
}

function parseYeriGeneratedJson(text, codePrefix) {
  const parsed = parseJsonObjectFromText(text);
  if (!parsed) {
    const error = new Error(`${codePrefix}_invalid_json`);
    error.code = `${codePrefix}_invalid_json`;
    throw error;
  }
  const parsedMarkdown = String(parsed.content_markdown || parsed.markdown || parsed.content || "").trim();
  if (!parsedMarkdown) {
    const error = new Error(`${codePrefix}_empty_content`);
    error.code = `${codePrefix}_empty_content`;
    throw error;
  }
  return parsed;
}

function yeriProviderLabel(provider) {
  const value = String(provider || "").trim().toLowerCase();
  if (value === "claude") return "Claude";
  if (value === "openai") return "OpenAI";
  if (value === "gemini") return "Gemini";
  return compactText(provider || "AI", 40);
}

function yeriProviderError(provider, code, userMessage, options = {}) {
  const error = new Error(userMessage || code || "server_generation_failed");
  error.code = code || "server_generation_failed";
  error.provider = String(provider || "").slice(0, 40);
  error.user_message = String(userMessage || "").slice(0, 500);
  error.status = Number(options.status || 0);
  error.detail = redactText(String(options.detail || "")).slice(0, 500);
  error.transient = Boolean(options.transient);
  return error;
}

function classifyYeriProviderError(provider, error) {
  const label = yeriProviderLabel(provider);
  const status = Number(error?.status || error?.statusCode || 0);
  const raw = [
    error?.code,
    error?.detail,
    error?.message,
  ].filter(Boolean).join(" ");
  const detail = redactText(raw).slice(0, 500);
  const low = detail.toLowerCase();

  if (status === 404 || /(model.*not found|not found.*model|model_not_found|not supported|unsupported model|permission.*model|모델.*없|모델.*사용할 수 없)/i.test(detail)) {
    return yeriProviderError(provider, "server_generation_model_not_found", `${label} 모델을 찾을 수 없거나 이 계정에서 사용할 수 없습니다. AIMAX 기본 모델로 전환해주세요.`, {
      status,
      detail,
      transient: false,
    });
  }

  if (status === 401 || status === 403 || /(authentication|unauthorized|invalid x-api-key|api[_ -]?key|permission)/i.test(detail)) {
    return yeriProviderError(provider, "server_generation_auth_failed", `${label} API 키 인증 실패 - 키를 확인/갱신해주세요.`, {
      status,
      detail,
      transient: false,
    });
  }

  if (status === 429 || /(quota|insufficient|credit|billing|rate limit|resource_exhausted|limit: 0)/i.test(detail)) {
    // 진짜 결제 고갈(유료 크레딧 소진)만 hard quota 로 분류한다. 무료 티어 일일/분당 한도
    // (quota exceeded / RESOURCE_EXHAUSTED / limit: 0)는 결제 문제가 아니므로 '결제 확인'으로
    // 오안내하지 않고 대기/유료키 등록 안내로 보낸다(무료 사용자 혼란·중복 보고 방지).
    const billingDead = /(insufficient_quota|billing|payment|balance|out of credit|결제)/i.test(detail);
    if (billingDead) {
      return yeriProviderError(
        provider,
        "server_generation_quota_exceeded",
        `${label} 결제/요금제 한도 초과 - 결제/크레딧 상태를 확인해주세요.`,
        { status, detail, transient: false },
      );
    }
    return yeriProviderError(
      provider,
      "server_generation_rate_limited",
      `${label} 무료 사용량 한도에 도달했습니다. 분당 한도면 잠시 후, 일일 한도면 내일 다시 시도하거나, 본인 유료 API 키를 등록하면 해소됩니다. (여러 글을 한 번에 몰아 보내면 한도에 더 빨리 도달합니다)`,
      { status, detail, transient: true },
    );
  }

  if (error?.code === "external_timeout" || [500, 502, 503, 529].includes(status) || /(overloaded|unavailable|timeout|timed out|temporarily|try again)/i.test(detail)) {
    return yeriProviderError(provider, "server_generation_provider_transient", `${label} 일시적 오류 - 잠시 후 다시 시도해주세요.`, {
      status,
      detail,
      transient: true,
    });
  }

  return yeriProviderError(provider, "server_generation_provider_error", `${label} 글 생성 오류가 발생했습니다. 모델/API 설정을 확인해주세요.`, {
    status,
    detail,
    transient: false,
  });
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// transient(일시 오류/타임아웃/5xx/과부하) 분류 시에만 자동 재시도. 대기는 2초, 8초.
// 인증 실패·결제/한도 오류는 classifyYeriProviderError 가 transient=false 로 분류하므로
// 이 경로에서 절대 재시도되지 않는다.
const YERI_PROVIDER_RETRY_DELAYS_MS = [2000, 8000];

async function requestYeriProviderJson(provider, rawUrl, options = {}) {
  const { onTransientRetry, ...requestOptions } = options;
  const maxAttemptsRaw = Number(YERI_SERVER_GENERATION_MAX_ATTEMPTS || 3);
  const maxAttempts = Math.max(1, Math.min(5, Number.isFinite(maxAttemptsRaw) ? maxAttemptsRaw : 3));
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestExternalJson(rawUrl, requestOptions);
    } catch (error) {
      const classified = classifyYeriProviderError(provider, error);
      lastError = classified;
      if (classified.transient && attempt < maxAttempts) {
        const delay = YERI_PROVIDER_RETRY_DELAYS_MS[Math.min(attempt - 1, YERI_PROVIDER_RETRY_DELAYS_MS.length - 1)];
        console.warn("[yeri-hybrid] provider retry", {
          provider,
          attempt,
          max_attempts: maxAttempts,
          code: classified.code,
          status: classified.status || 0,
          delay_ms: delay,
        });
        if (typeof onTransientRetry === "function") {
          try {
            onTransientRetry({ attempt, maxAttempts, delayMs: delay, error: classified });
          } catch (_noticeError) {
            // 재시도 로그 기록 실패가 생성 재시도 자체를 막으면 안 된다.
          }
        }
        await sleepMs(delay);
        continue;
      }
      throw classified;
    }
  }
  throw lastError || yeriProviderError(provider, "server_generation_provider_error", "AI 글 생성 오류가 발생했습니다.");
}

// 서버 글 생성 재시도 내역을 잡 logs 에 남기기 위한 헬퍼.
// load-mutate-save 가 완전 동기라 다른 jobs.json 쓰기 경로와의 lost-update 창을 넓히지 않는다.
function appendJobLogById(jobId, userId, level, message) {
  try {
    const jobs = loadJobs();
    const job = jobs.jobs.find((item) => item.id === jobId && (!userId || item.user_id === userId));
    if (!job) return false;
    const now = nowIso();
    appendJobLog(job, level, message, now);
    job.updated_at = now;
    saveJobs(jobs);
    return true;
  } catch (error) {
    console.warn("[job-log] append by id failed", error?.code || error?.message || error);
    return false;
  }
}

function yeriTransientRetryLogger(provider, job, userId) {
  const label = yeriProviderLabel(provider);
  return ({ attempt, maxAttempts, delayMs }) => {
    const totalRetries = Math.max(1, maxAttempts - 1);
    appendJobLogById(
      job?.id,
      userId,
      "warn",
      `${label} 일시 오류 - ${Math.round(delayMs / 1000)}초 후 자동 재시도 ${attempt}/${totalRetries}`,
    );
  };
}

async function generateYeriGeminiArtifact(job, userId) {
  const apiKey = getUserOrStoredSecret(userId, "gemini");
  if (!apiKey) {
    const error = new Error("yeri_gemini_key_missing");
    error.code = "yeri_gemini_key_missing";
    throw error;
  }
  const model = yeriServerGenerationTextModel(job.payload || {});
  let response;
  let usedModel = model;
  const requestGemini = (targetModel) => requestYeriProviderJson("gemini", `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey },
    body: {
      contents: [
        {
          role: "user",
          parts: [{ text: buildYeriGenerationPrompt(job.payload || {}) }],
        },
      ],
      generationConfig: {
        temperature: 0.45,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content_markdown: { type: "string" },
          },
          required: ["title", "content_markdown"],
        },
      },
    },
    timeoutMs: YERI_SERVER_GENERATION_TIMEOUT_MS,
    maxBytes: 1024 * 1024,
    onTransientRetry: yeriTransientRetryLogger("gemini", job, userId),
  });
  try {
    response = await requestGemini(model);
  } catch (error) {
    const fallbackModel = yeriGeminiFallbackModel(model);
    if (!fallbackModel || !["server_generation_provider_transient", "server_generation_model_not_found"].includes(String(error?.code || ""))) {
      throw error;
    }
    console.warn("[yeri-hybrid] gemini fallback", {
      primary_model: model,
      fallback_model: fallbackModel,
      code: error.code || "",
      status: Number(error.status || 0),
    });
    usedModel = fallbackModel;
    response = await requestGemini(fallbackModel);
  }
  const text = extractGeminiText(response.json);
  const parsed = parseYeriGeneratedJson(text, "yeri_gemini");
  return sanitizeYeriGeneratedArtifact(parsed, job.payload || {}, usedModel, yeriGeminiUsage(response.json?.usageMetadata));
}

async function generateYeriOpenAiArtifact(job, userId) {
  const apiKey = getUserOrStoredSecret(userId, "openai");
  if (!apiKey) {
    const error = new Error("yeri_openai_key_missing");
    error.code = "yeri_openai_key_missing";
    throw error;
  }
  const model = yeriServerGenerationTextModel(job.payload || {});
  const response = await requestYeriProviderJson("openai", "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
      input: buildYeriGenerationPrompt(job.payload || {}),
      max_output_tokens: 8000,
      reasoning: { effort: "low" },
      store: false,
    },
    timeoutMs: YERI_SERVER_GENERATION_TIMEOUT_MS,
    maxBytes: 1024 * 1024,
    onTransientRetry: yeriTransientRetryLogger("openai", job, userId),
  });
  const text = extractOpenAiText(response.json);
  const parsed = parseYeriGeneratedJson(text, "yeri_openai");
  return sanitizeYeriGeneratedArtifact(parsed, job.payload || {}, model, yeriOpenAiUsage(response.json?.usage));
}

async function generateYeriClaudeArtifact(job, userId) {
  const apiKey = getUserOrStoredSecret(userId, "claude");
  if (!apiKey) {
    const error = new Error("yeri_claude_key_missing");
    error.code = "yeri_claude_key_missing";
    throw error;
  }
  const model = yeriServerGenerationTextModel(job.payload || {});
  const response = await requestYeriProviderJson("claude", "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: {
      model,
      max_tokens: 8000,
      messages: [{ role: "user", content: buildYeriGenerationPrompt(job.payload || {}) }],
    },
    timeoutMs: YERI_SERVER_GENERATION_TIMEOUT_MS,
    maxBytes: 1024 * 1024,
    onTransientRetry: yeriTransientRetryLogger("claude", job, userId),
  });
  const text = extractClaudeText(response.json);
  const parsed = parseYeriGeneratedJson(text, "yeri_claude");
  return sanitizeYeriGeneratedArtifact(parsed, job.payload || {}, model, yeriClaudeUsage(response.json?.usage));
}

async function generateYeriSelectedModelArtifact(job, userId) {
  const provider = yeriAiProviderForModel(yeriSelectedModel(job.payload || {}));
  if (provider === "openai") return generateYeriOpenAiArtifact(job, userId);
  if (provider === "claude") return generateYeriClaudeArtifact(job, userId);
  return generateYeriGeminiArtifact(job, userId);
}

function yeriGenerationFailureCode(error) {
  const rawCode = error?.code || error?.message || "server_generation_failed";
  const code = sanitizeFailedStage(rawCode) || "server_generation_failed";
  if (code.includes("yeri_claude_key_missing")) return "yeri_claude_key_missing";
  if (code.includes("yeri_openai_key_missing")) return "yeri_openai_key_missing";
  if (code.includes("key_missing")) return "yeri_gemini_key_missing";
  if (code.includes("server_generation_auth_failed")) return "server_generation_auth_failed";
  if (code.includes("server_generation_quota_exceeded")) return "server_generation_quota_exceeded";
  if (code.includes("server_generation_rate_limited")) return "server_generation_rate_limited";
  if (code.includes("server_generation_model_not_found")) return "server_generation_model_not_found";
  if (code.includes("server_generation_provider_transient")) return "server_generation_provider_transient";
  if (code.includes("server_generation_provider_error")) return "server_generation_provider_error";
  if (code.includes("timeout")) return "server_generation_timeout";
  if (code.includes("invalid_json")) return "server_generation_invalid_response";
  if (code.includes("external_http_error")) return "server_generation_http_error";
  return code.slice(0, 80);
}

function yeriGenerationFailureMessage(error) {
  const direct = String(error?.user_message || "").trim();
  if (direct) return direct.slice(0, 500);
  const code = yeriGenerationFailureCode(error);
  if (code === "yeri_claude_key_missing") return "Claude API 키가 아직 웹 AI/API 연결에 저장되어 있지 않습니다.";
  if (code === "yeri_openai_key_missing") return "OpenAI API 키가 아직 웹 AI/API 연결에 저장되어 있지 않습니다.";
  if (code === "yeri_gemini_key_missing") return "Gemini API 키가 아직 웹 AI/API 연결에 저장되어 있지 않습니다.";
  if (code === "server_generation_auth_failed") return "API 키 인증 실패입니다. 웹 설정의 AI/API 연결에서 키를 확인하거나 갱신해주세요.";
  if (code === "server_generation_quota_exceeded") return "결제/요금제 한도 초과입니다. 결제/크레딧 상태를 확인해주세요.";
  if (code === "server_generation_rate_limited") return "AI 무료 사용량 한도에 도달했습니다. 분당 한도면 잠시 후, 일일 한도면 내일 다시 시도하거나 본인 유료 API 키를 등록해주세요. 여러 글을 한 번에 몰아 보내면 한도에 빨리 도달합니다.";
  if (code === "server_generation_model_not_found") return "선택한 AI 모델을 찾을 수 없거나 이 계정에서 사용할 수 없습니다. AIMAX 기본 모델로 전환해주세요.";
  if (code === "server_generation_provider_transient") return "AI 제공자 일시적 오류입니다. 잠시 뒤 다시 시도해주세요.";
  if (code === "server_generation_timeout") return "AI 글 생성 시간이 초과되었습니다. 글 분량을 줄이거나 잠시 뒤 다시 시도해주세요.";
  if (code === "server_generation_invalid_response") return "AI 응답을 글 형식으로 해석하지 못했습니다. 모델을 바꾸거나 다시 시도해주세요.";
  return "AI 글 생성 오류가 발생했습니다. 모델, API 키, 사용량 한도를 확인해주세요.";
}

function buildFailureDiagnostic(input = {}) {
  if (input && typeof input === "object" && input.code && input.title && input.message) {
    return {
      code: sanitizeFailedStage(input.code) || "admin_action_required",
      title: redactText(String(input.title)).slice(0, 120),
      message: redactText(String(input.message)).slice(0, 300),
      user_actionable: Boolean(input.user_actionable),
      admin_action_required: Boolean(input.admin_action_required),
      action_label: redactText(String(input.action_label || (Array.isArray(input.actions) ? input.actions[0] : "") || "오류 보고 보내기")).slice(0, 80),
      actions: Array.isArray(input.actions) ? input.actions.slice(0, 4).map((item) => redactText(String(item)).slice(0, 80)) : ["오류 보고 보내기"],
      stage: sanitizeFailedStage(input.stage || ""),
      reason: sanitizeFailedStage(input.reason || ""),
    };
  }
  const stage = sanitizeFailedStage(input.stage || input.failed_stage || "");
  const reason = sanitizeFailedStage(input.reason || input.failed_reason || input.error || "");
  const rawText = [
    stage,
    reason,
    input.error,
    input.visible_error,
    input.message,
    input.context,
  ].filter(Boolean).join(" ");
  const text = rawText.toLowerCase();

  const diagnostic = {
    code: "admin_action_required",
    title: "AIMAX 관리자 조치 필요",
    message: "사용자 설정으로 해결하기 어려운 내부 처리 오류입니다.",
    user_actionable: false,
    admin_action_required: true,
    action_label: "오류 보고 보내기",
    actions: ["오류 보고 보내기"],
    stage,
    reason,
  };

  const user = (code, title, message, actions = []) => ({
    code,
    title,
    message,
    user_actionable: true,
    admin_action_required: false,
    action_label: actions[0] || "설정 열기",
    actions: actions.length ? actions : ["AI/API 연결 열기"],
    stage,
    reason,
  });
  const admin = (code, title, message, actions = []) => ({
    code,
    title,
    message,
    user_actionable: false,
    admin_action_required: true,
    action_label: actions[0] || "오류 보고 보내기",
    actions: actions.length ? actions : ["오류 보고 보내기"],
    stage,
    reason,
  });

  if (/yeri_(gemini|openai|claude)_key_missing|key_missing|api_key_missing|no api key|api key.*missing|no api key was provided|키가.*없|키.*저장/.test(text)) {
    return user(
      "api_key_missing",
      "AI/API 키 등록 필요",
      "작업에 필요한 AI API 키가 저장되어 있지 않습니다.",
      ["AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/server_generation_auth_failed|api_key_invalid|invalid.*api.*key|unauthorized|permission denied|authentication|키 인증 실패|인증 실패/.test(text)) {
    return user(
      "api_key_invalid",
      "API 키 인증 실패",
      "저장된 API 키가 유효하지 않거나 해당 제공자에서 거절되었습니다.",
      ["AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/server_generation_rate_limited|rate_limited|rate limit|resource_exhausted|429|무료 사용량|분당|일일/.test(text)) {
    return user(
      "rate_limited",
      "무료 사용량 한도 도달",
      "무료 티어의 분당 또는 일일 요청 한도에 도달했습니다.",
      ["잠시 후 다시 시도", "AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/runner_start_timeout|local_ui_queue_not_processed_after_claim|local_worker_not_started_after_claim/.test(text)) {
    return admin(
      "local_runner_start_timeout",
      "로컬 실행기 시작 지연",
      "로컬 실행기가 작업을 받았지만 내부 UI 큐 또는 작업자가 제때 시작하지 못했습니다. 실행기를 재시작한 뒤 다시 시도해주세요.",
      ["실행기 재시작", "오류 보고 보내기"],
    );
  }
  if (/browser_start|chromedriver|undetected_chromedriver|application control policy|애플리케이션 제어 정책|winerror 4551/.test(text)) {
    return user(
      "browser_driver_policy_blocked",
      "브라우저 드라이버 차단",
      "Windows 보안 또는 회사 보안 정책이 브라우저 드라이버 실행을 차단했습니다.",
      ["보안 프로그램 차단 허용", "오류 보고 보내기"],
    );
  }
  if (/server_generation_provider_transient|provider_transient|temporarily|temporary|unavailable|overloaded|timeout|timed out|일시적 오류|잠시 후/.test(text)) {
    return user(
      "provider_transient",
      "AI 제공자 일시 장애",
      "AI 제공자 서버가 일시적으로 응답하지 않았습니다. 같은 요청을 바로 반복하기보다 잠시 후 다시 시도하거나 다른 AI 모델/API 키로 전환해주세요.",
      ["잠시 후 다시 시도", "AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/server_generation_quota_exceeded|quota_exceeded|billing|payment|credit|balance|결제|크레딧|잔액/.test(text)) {
    return user(
      "quota_exceeded",
      "결제/크레딧 확인 필요",
      "유료 API의 결제 계정, 크레딧, 쿼터 상태 때문에 요청이 막혔습니다.",
      ["결제 상태 확인", "AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/server_generation_model_not_found|model_not_found|model.*not found|not found.*model|unsupported model|모델.*없|모델.*사용할 수 없/.test(text)) {
    return user(
      "model_not_found",
      "AI 모델 사용 불가",
      "모델명이 잘못되었거나 이 계정에서 선택한 모델을 사용할 수 없습니다.",
      ["AIMAX 기본 모델로 전환", "AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/image_paid_required|gemini.*image|이미지.*무료|이미지.*유료|nano banana|flash-image/.test(text)) {
    return user(
      "image_paid_required",
      "이미지 생성은 유료 키 필요",
      "Gemini 이미지 모델은 무료 티어에서 사용할 수 없어 이미지 생성이 건너뛰어졌습니다.",
      ["이미지 없이 다시 시도", "AI/API 연결 열기", "오류 보고 보내기"],
    );
  }
  if (/update_required|runner_stopped|old.*runner|version|업데이트|구버전/.test(text)) {
    return user(
      "runner_update_required",
      "실행기 업데이트 필요",
      "현재 실행기 버전이 웹 작업을 안정적으로 받을 수 없는 상태입니다.",
      ["실행기 업데이트", "오류 보고 보내기"],
    );
  }
  if (/naver_login|네이버 로그인|login|captcha|인증 화면|로그인/.test(text)) {
    return user(
      "naver_login_required",
      "네이버 로그인 필요",
      "네이버 로그인 또는 추가 인증 화면에서 자동 진행이 막혔습니다.",
      ["네이버 재로그인", "오류 보고 보내기"],
    );
  }
  if (/smart_editor|selector|셀렉터|image_upload_failed|image_insert_exception|no such window|chromedriver|chrome not reachable|browser_start/.test(text)) {
    return admin(
      "admin_action_required",
      "AIMAX 관리자 조치 필요",
      "네이버 에디터 구조, 실행기 연결, 저장/업로드 로직 중 코드 수정이 필요한 오류입니다.",
      ["오류 보고 보내기"],
    );
  }
  return diagnostic;
}

function jobFailureDiagnostic(job) {
  if (!job || typeof job !== "object") return null;
  if (job.diagnostic && typeof job.diagnostic === "object" && !Array.isArray(job.diagnostic)) {
    return buildFailureDiagnostic(job.diagnostic);
  }
  const result = job.result && typeof job.result === "object" ? job.result : {};
  const imageFailure = Array.isArray(result.images?.failures) ? result.images.failures.find(Boolean) : null;
  if (!job.failed_stage && !job.failed_reason && !result.error && !imageFailure) return null;
  return buildFailureDiagnostic({
    stage: job.failed_stage || result.stage || imageFailure?.stage || "",
    reason: job.failed_reason || result.error || imageFailure?.error_code || imageFailure?.error || "",
    error: result.error || imageFailure?.error_code || imageFailure?.error || "",
    visible_error: result.visible_error || imageFailure?.message || "",
    message: result.user_message || result.message || "",
  });
}

async function generateYeriArtifactForJob(jobId, userId, mode = yeriServerGenerationMode()) {
  const jobs = loadJobs();
  const job = jobs.jobs.find((item) => item.id === jobId && item.user_id === userId);
  if (!job || job.kind !== "yeri_write") return { ok: false, error: "job_not_found" };
  if (job.status !== "generating") return { ok: false, error: "job_not_generating", status: job.status };
  try {
    const artifact = mode === "mock"
      ? buildYeriMockArtifact(job)
      : await generateYeriSelectedModelArtifact(job, userId);
    // 긴 await 동안 다른 핸들러/스윕이 jobs.json 을 바꿨을 수 있으므로, 저장 직전 재로드해
    // 해당 잡만 in-place 패치한다(전체 스냅샷 덮어쓰기로 동시 변경을 잃거나 좀비를 되살리는 것 방지).
    const fresh = loadJobs();
    const target = fresh.jobs.find((item) => item.id === jobId && item.user_id === userId);
    if (!target) return { ok: false, error: "job_not_found" };
    if (target.status !== "generating") return { ok: false, error: "job_state_changed", status: target.status };
    const meta = attachYeriArtifactToJob(target, artifact);
    target.status = "ready_for_publish";
    target.updated_at = nowIso();
    appendJobLog(target, "info", `서버 글 생성이 완료되었습니다. artifact=${meta.artifact_id}`, target.updated_at);
    saveJobs(fresh);
    return { ok: true, job: target, artifact: meta };
  } catch (error) {
    const failureCode = yeriGenerationFailureCode(error);
    const failureMessage = yeriGenerationFailureMessage(error);
    const provider = error?.provider || yeriAiProviderForModel(yeriSelectedModel(job.payload || {}));
    const model = yeriServerGenerationTextModel(job.payload || {});
    const fresh = loadJobs();
    const target = fresh.jobs.find((item) => item.id === jobId && item.user_id === userId);
    if (!target) return { ok: false, error: failureCode };
    if (target.status !== "generating") return { ok: false, error: failureCode, status: target.status };
    target.status = "failed";
    target.failed_stage = YERI_CONTENT_GENERATION_STAGE;
    target.failed_reason = failureCode;
    target.diagnostic = buildFailureDiagnostic({
      stage: YERI_CONTENT_GENERATION_STAGE,
      reason: failureCode,
      error: failureCode,
      visible_error: failureMessage,
    });
    target.result = {
      ok: false,
      stage: YERI_CONTENT_GENERATION_STAGE,
      error: failureCode,
      visible_error: failureMessage,
      provider: String(provider || "").slice(0, 40),
      model: String(model || "").slice(0, 80),
      provider_status: Number(error?.status || 0),
      transient: Boolean(error?.transient),
      detail_code: String(error?.code || "").slice(0, 120),
      diagnostic: target.diagnostic,
    };
    target.finished_at = nowIso();
    target.updated_at = target.finished_at;
    delete target.claim_expires_at;
    appendJobLog(target, "error", `서버 글 생성에 실패했습니다: ${failureMessage}`, target.updated_at);
    saveJobs(fresh);
    recordJobFailureGuard(target);
    return { ok: false, error: failureCode, job: target };
  }
}

function scheduleYeriArtifactGeneration(job, user, mode = yeriServerGenerationMode()) {
  if (!mode || !job || job.kind !== "yeri_write" || !user?.id) return;
  const timer = setImmediate(() => {
    generateYeriArtifactForJob(job.id, user.id, mode).catch((error) => {
      console.error("[yeri-hybrid] artifact generation crashed", error?.message || error);
    });
  });
  if (typeof timer.unref === "function") timer.unref();
}

function appendJobLog(job, level, message, at = nowIso()) {
  job.logs = job.logs || [];
  job.logs.push({
    at,
    level: String(level || "info").slice(0, 20),
    message: redactText(String(message || "")).slice(0, 2000),
  });
}

function sanitizeFailedStage(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function failedStageFromJobUpdate(body) {
  return sanitizeFailedStage(
    body?.failed_stage ||
      body?.stage ||
      body?.result?.failed_stage ||
      body?.result?.stage ||
      body?.result?.posts?.find?.((post) => post?.stage)?.stage ||
      "",
  );
}

function failedReasonFromJobUpdate(body) {
  return redactText(String(body?.failed_reason || body?.error || body?.result?.error || body?.log || "")).slice(0, 500);
}

function recoverStaleGeneratingJobs(referenceMs = Date.now()) {
  const jobs = loadJobs();
  const now = nowIso();
  const cutoff = referenceMs - Math.max(1, YERI_GENERATING_STALE_MS);
  let recovered = 0;
  for (const job of jobs.jobs) {
    if (job.status !== "generating") continue;
    const updatedMs = Date.parse(job.updated_at || job.created_at || "");
    if (Number.isFinite(updatedMs) && updatedMs > cutoff) continue;
    job.status = "failed";
    job.failed_stage = YERI_CONTENT_GENERATION_STAGE;
    job.failed_reason = "server_generation_interrupted_or_timed_out";
    job.finished_at = now;
    job.updated_at = now;
    delete job.claim_expires_at;
    appendJobLog(job, "error", "서버 글 생성이 중단되어 작업을 실패 처리했습니다. 다시 시도할 수 있습니다.", now);
    recovered += 1;
  }
  if (recovered) saveJobs(jobs);
  return { recovered };
}

function jobRunnerEventFromUpdate(body) {
  return String(body?.runner_event || body?.result?.runner_event || "").trim().toLowerCase().slice(0, 80);
}

function markRunnerStartTimeouts(jobs, options = {}) {
  const nowMs = options.referenceMs || Date.now();
  const timeoutMs = Math.max(1, AGENT_JOB_START_TIMEOUT_SECONDS) * 1000;
  const now = new Date(nowMs).toISOString();
  let recovered = 0;
  for (const job of jobs.jobs || []) {
    if (job.status !== "running") continue;
    if (job.runner_started_at) continue;
    if (options.userId && job.user_id !== options.userId) continue;
    if (options.platform || options.deviceLabel) {
      if (!jobMatchesAgentTarget(job, options.platform || "", options.deviceLabel || "")) continue;
    }
    const assignedMs = Date.parse(job.assigned_at || job.updated_at || job.created_at || "");
    if (!Number.isFinite(assignedMs) || nowMs - assignedMs < timeoutMs) continue;
    job.status = "failed";
    job.failed_stage = "runner_start_timeout";
    job.failed_reason = "runner_start_not_reported";
    job.finished_at = now;
    job.updated_at = now;
    delete job.claim_expires_at;
    job.result = {
      ...(job.result || {}),
      ok: false,
      stage: "runner_start_timeout",
      error: "runner_start_not_reported",
    };
    appendJobLog(job, "error", "실행기가 작업을 받은 뒤 시작 상태를 보내지 않아 작업을 실패 처리했습니다. 실행기를 재시작한 뒤 다시 시도해주세요.", now);
    recordJobFailureGuard(job);
    recovered += 1;
  }
  return recovered;
}

// 시작은 보고했으나(runner_started_at 설정됨) 러너가 도중에 죽어 영원히 running 으로 남는
// 좀비 잡을 자동 실패 처리한다. markRunnerStartTimeouts(시작 미보고 3분용)와 별개의 추가 스윕.
//
// 안전 원칙(레드팀 반영):
//  - 대상은 status==="running" + runner_started_at 있는 '실제 진행 중' 잡만. ready_for_publish/
//    generating 은 건드리지 않는다(ready_for_publish 는 서버생성 산출물이 러너 발행을 기다리는
//    정상 대기 상태 — 시간만으로 죽이면 유료 산출물을 폐기하게 됨).
//  - 러너 생존은 '하트비트'가 1차 신호다(러너는 작업 중에도 ~20s 마다 하트비트). 소유 러너의
//    하트비트가 살아있으면(grace 내) 작업이 오래 걸려도 절대 죽이지 않는다 — 러너가 _worker_write
//    동안 중간 잡 업데이트를 안 보내 updated_at 이 멈추는 정상 케이스를 보호.
//  - agent 매칭은 잡이 실제로 들고 있는 target_platform/target_device_label 로 한다.
//  - 러너 기록 자체가 없을 때만(영영 사라짐) updated_at 무진행 시간 백스톱으로 정리.
function failStaleRunningJobs(jobs, options = {}) {
  const nowMs = options.referenceMs || Date.now();
  const now = new Date(nowMs).toISOString();
  const ceilingMs = Math.max(1, YERI_RUNNING_STALE_MS); // 러너 기록 부재 시 백스톱
  const graceMs = Math.max(1, YERI_RUNNER_HEARTBEAT_GRACE_MS); // 하트비트 끊김 판정 유예
  let agents = null; // lazy 로드
  let recovered = 0;
  for (const job of jobs.jobs || []) {
    if (job.status !== "running") continue; // ready_for_publish/generating 은 제외
    if (!job.runner_started_at) continue; // 시작 미보고는 markRunnerStartTimeouts 담당
    if (options.userId && job.user_id !== options.userId) continue;
    if (options.platform || options.deviceLabel) {
      if (!jobMatchesAgentTarget(job, options.platform || "", options.deviceLabel || "")) continue;
    }
    const progressMs = Date.parse(job.updated_at || job.runner_started_at || job.assigned_at || job.created_at || "");
    if (!Number.isFinite(progressMs)) continue; // 시각 불명 → 함부로 죽이지 않음
    const noProgressMs = nowMs - progressMs;
    // 소유 러너 생존 판정 — target 필드로 agent 조회(jobMatchesAgentTarget 와 동일 필드).
    if (!agents) agents = options.agents || loadAgents();
    const agent = findHeartbeatAgent(agents, job.user_id, job.target_platform || "", job.target_device_label || "");
    const agentSeenMs = agent ? Date.parse(agent.last_seen_at || agent.updated_at || "") : NaN;
    let runnerDead;
    if (Number.isFinite(agentSeenMs)) {
      // 러너가 살아있으면(grace 내 하트비트) 작업이 오래 걸려도 절대 죽이지 않는다.
      runnerDead = nowMs - agentSeenMs >= graceMs;
    } else {
      // 러너 기록 자체가 없음 → 넉넉한 무진행 시간 백스톱으로만 정리.
      runnerDead = noProgressMs >= ceilingMs;
    }
    // 러너가 죽었다고 판단돼도, 막 끊긴 직후 즉시 죽이지 않도록 최소 유예만큼 무진행을 확인.
    if (!runnerDead || noProgressMs < graceMs) continue;
    job.status = "failed";
    job.failed_stage = "runner_stopped";
    job.failed_reason = "runner_stopped_heartbeating_or_timed_out";
    job.finished_at = now;
    job.updated_at = now;
    delete job.claim_expires_at;
    job.result = {
      ...(job.result || {}),
      ok: false,
      stage: "runner_stopped",
      error: "runner_stopped_heartbeating_or_timed_out",
    };
    appendJobLog(job, "error", "실행기가 작업 도중 응답을 멈춰 작업을 실패 처리했습니다. 실행기를 재시작한 뒤 다시 시도해주세요.", now);
    recordJobFailureGuard(job);
    recovered += 1;
  }
  return recovered;
}

function loadAgents() {
  const data = readJsonFile(AGENTS_PATH, { version: 1, agents: [] });
  return {
    version: 1,
    agents: arrayFieldOrThrow(AGENTS_PATH, data, "agents"),
  };
}

function saveAgents(data) {
  writeJsonAtomic(AGENTS_PATH, { version: 1, agents: arrayFieldOrThrow(AGENTS_PATH, data, "agents") });
}

function loadCommands() {
  const data = readJsonFile(COMMANDS_PATH, { version: 1, commands: [] });
  return {
    version: 1,
    commands: arrayFieldOrThrow(COMMANDS_PATH, data, "commands"),
  };
}

function saveCommands(data) {
  writeJsonAtomic(COMMANDS_PATH, { version: 1, commands: arrayFieldOrThrow(COMMANDS_PATH, data, "commands") });
}

// ---------------------------------------------------------------------------
// 연속 실패 가드 (재시도 루프 차단)
// 같은 사용자·같은 잡 종류에서 같은 오류 시그니처가 연속되면 잡 생성/재시도를 잠시 멈추고
// 조치 안내를 돌려준다. 저장소는 독립 파일(job-guards.json)이라 jobs.json/users.json
// 쓰기 경로에 끼어들지 않는다.
// ---------------------------------------------------------------------------
const JOB_GUARD_PAUSE_THRESHOLD = 3;
const JOB_GUARD_RUNNER_NOT_STARTED_THRESHOLD = 5;
// I-2: 클라이언트가 기기 라벨을 매번 바꿔 잡을 실패시키면 가드 행이 무한 증식할 수 있다.
// 유저당 가드 행 상한을 두고 초과 시 오래된 행부터 축출해 남용/폭주로 인한 무한 성장을 방지한다.
const JOB_GUARD_MAX_ROWS_PER_USER = 30;

function loadJobGuards() {
  const data = readJsonFile(JOB_GUARDS_PATH, { version: 1, guards: [] });
  return {
    version: 1,
    guards: arrayFieldOrThrow(JOB_GUARDS_PATH, data, "guards"),
  };
}

function saveJobGuards(data) {
  writeJsonAtomic(JOB_GUARDS_PATH, { version: 1, guards: arrayFieldOrThrow(JOB_GUARDS_PATH, data, "guards") });
}

// 실패 메시지/스테이지를 정규화해 오류 시그니처 클래스로 분류한다(M-1 2단계 분류).
// 1단계: 구조화 필드(stage/reason/error/diagnostic_code)만으로 머신 코드 + 영문 일반 패턴 실행.
// 2단계: 1단계가 other 일 때만 자유텍스트(visible_error 등)를 강한 문구만으로 폴백 매칭.
// 사용자 화면 문구에 섞인 일반 단어(login/timeout/balance 등)의 오분류를 막는다.
function classifyStructuredFailureSignature(text) {
  if (!text.trim()) return "other";
  if (/naver_login|네이버 로그인|네이버.*(아이디|비밀번호|로그인|인증)|captcha|인증 화면/.test(text)) return "naver_login_failed";
  if (/server_generation_auth_failed|api_key_invalid|api_key_missing|key_missing|invalid.*api.*key|invalid x-api-key|unauthorized|permission denied|authentication|api 키 인증|키 인증 실패/.test(text)) return "ai_key_invalid";
  if (/server_generation_quota_exceeded|quota_exceeded|insufficient_quota|billing|payment|out of credit|balance|결제|크레딧|잔액|요금제/.test(text)) return "billing_quota";
  // runner_stopped_heartbeating_or_timed_out 은 timeout 이라는 단어 때문에 transient 로
  // 오분류되기 쉬워 transient 검사보다 먼저 실행기 계열로 분류한다(H-2).
  if (/runner_start_timeout|runner_start_not_reported|runner_stopped_heartbeating|local_ui_queue_not_processed_after_claim|local_worker_not_started_after_claim|실행기.*(멈춰|재시작|시작되지 않)/.test(text)) return "runner_not_started";
  if (/server_generation_provider_transient|provider_transient|server_generation_rate_limited|rate.?limit|resource_exhausted|temporar|unavailable|overloaded|timeout|timed.?out|try again|일시적|잠시 후|server_generation_interrupted/.test(text)) return "transient";
  return "other";
}

function classifyFreeTextFailureSignature(text) {
  if (!text.trim()) return "other";
  // 강한 문구만 매칭한다. bare login/timeout/balance/unauthorized 등은 화면 문구 오분류의 주범이라 제외.
  if (/네이버 로그인|네이버.*(아이디|비밀번호|인증)|captcha|인증 화면/.test(text)) return "naver_login_failed";
  if (/api 키 인증|키 인증 실패|invalid.*api.*key|invalid x-api-key/.test(text)) return "ai_key_invalid";
  if (/결제|크레딧|잔액|요금제|out of credit|insufficient_quota/.test(text)) return "billing_quota";
  // H-2 순서 보존: 실행기 계열을 transient 보다 먼저.
  if (/실행기.*(멈춰|재시작|시작되지 않)/.test(text)) return "runner_not_started";
  if (/일시적|잠시 후|rate.?limit|resource_exhausted|overloaded|try again/.test(text)) return "transient";
  return "other";
}

function classifyJobFailureSignature(input = {}) {
  const structuredText = [
    input.stage,
    input.reason,
    input.error,
    input.diagnostic_code,
  ].filter(Boolean).join(" ").toLowerCase();
  const structured = classifyStructuredFailureSignature(structuredText);
  if (structured !== "other") return structured;
  const freeText = [
    input.visible_error,
    input.diagnostic_message,
    input.message,
  ].filter(Boolean).join(" ").toLowerCase();
  return classifyFreeTextFailureSignature(freeText);
}

function jobFailureSignatureClass(job) {
  return classifyJobFailureSignature({
    stage: job?.failed_stage || "",
    reason: job?.failed_reason || "",
    error: job?.result?.error || "",
    visible_error: job?.result?.visible_error || "",
    diagnostic_code: job?.diagnostic?.code || "",
    diagnostic_message: job?.diagnostic?.message || "",
  });
}

function jobGuardPauseThreshold(signature) {
  // runner_not_started 는 실행기 기동 타이밍 문제일 수 있어 임계를 5회로 완화한다.
  return signature === "runner_not_started" ? JOB_GUARD_RUNNER_NOT_STARTED_THRESHOLD : JOB_GUARD_PAUSE_THRESHOLD;
}

function jobGuardMessage(guard) {
  const signature = String(guard?.signature || "other");
  const threshold = jobGuardPauseThreshold(signature);
  if (signature === "naver_login_failed") {
    return `네이버 아이디/비밀번호가 ${threshold}회 연속 거부되었습니다. 실행기 로컬 설정에서 네이버 계정을 다시 저장한 뒤, 이 안내의 '조치했어요, 다시 시도' 버튼을 눌러주세요.`;
  }
  if (signature === "ai_key_invalid") {
    return `AI API 키 인증이 ${threshold}회 연속 실패했습니다. 설정 탭의 AI/API 연결에서 키를 다시 저장한 뒤 재시도해주세요.`;
  }
  if (signature === "billing_quota") {
    return `결제/요금제 한도 오류가 ${threshold}회 연속 발생했습니다. AI 제공자의 결제/크레딧 상태를 확인한 뒤 재시도해주세요.`;
  }
  if (signature === "runner_not_started") {
    return `실행기가 작업을 ${threshold}회 연속 시작하지 못했습니다. 실행기를 완전히 종료했다가 다시 실행한 뒤 재시도해주세요.`;
  }
  return `같은 오류가 ${threshold}회 연속 발생했습니다. 업데이트 및 오류보고 탭의 안내를 확인하고 원인을 해결한 뒤 재시도해주세요.`;
}

function publicJobGuard(row) {
  const signature = String(row?.signature || "other");
  return {
    job_kind: String(row?.job_kind || ""),
    guard_class: signature,
    consecutive_count: safeInt(row?.consecutive_count, 0, 1000000),
    threshold: jobGuardPauseThreshold(signature),
    paused: Boolean(row?.paused),
    last_error_at: row?.last_error_at || "",
    last_message: redactText(String(row?.last_message || "")).slice(0, 300),
    message: row?.paused ? jobGuardMessage(row) : "",
  };
}

// M-4: 가드 스코프 분류. 키/결제는 유저 계정 자산이라 기기 무관(계정 단위),
// 네이버 로그인/실행기 미시작/기타는 기기 단위다. transient 는 가드 제외라 무관.
function jobGuardSignatureScope(signature) {
  return signature === "ai_key_invalid" || signature === "billing_quota" ? "account" : "device";
}

// M-4: 기기 식별 키. jobMatchesAgentTarget/findHeartbeatAgent 와 동일한 정규화 공간을 쓴다.
// 빈 타겟(platform·label 모두 없음)이면 "아무 기기나"를 뜻하는 "" 로 취급한다.
function jobDeviceKey(platformValue, deviceLabelValue) {
  const platform = normalizePlatform(platformValue || "");
  // 라벨은 클라이언트가 임의로 넣을 수 있어 정규화한다(I-2): trim → 내부 공백 축소 → 소문자 → 120자.
  // 가드 키는 내부 전용이며, 이 정규화로 잡 생성/하트비트 간 대소문자·공백 불일치도 함께 해소된다.
  const label = String(deviceLabelValue || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 120);
  if (!platform && !label) return "";
  return `${platform}|${label}`;
}

// 잡이 failed 로 확정될 때 호출. 같은 (user, kind, device_key) 행 내에서 같은 시그니처 연속이면
// count+1, 다른 시그니처면 1로 리셋. transient 는 1번(자동 재시도)이 흡수하므로 가드 대상에서 제외.
// 계정 단위 시그니처는 항상 device_key="" 로 기록해 기기 무관 차단을 만든다.
// 가드 기록 실패가 잡 실패 처리 자체를 막으면 안 되므로 내부에서 오류를 삼킨다.
function recordJobFailureGuard(job) {
  try {
    if (!job || !job.user_id || !job.kind) return null;
    const signature = jobFailureSignatureClass(job);
    if (signature === "transient") return null;
    const deviceKey = jobGuardSignatureScope(signature) === "account"
      ? ""
      : jobDeviceKey(job.target_platform || "", job.target_device_label || "");
    const data = loadJobGuards();
    const now = nowIso();
    let guard = data.guards.find((row) => row.user_id === job.user_id
      && row.job_kind === job.kind
      && String(row.device_key || "") === deviceKey);
    if (!guard) {
      // I-2: 새 행 추가 전 유저당 상한을 확인한다. 남용/폭주로 인한 무한 성장 방지 —
      // 상한 도달 시 오래된 행부터 축출하되, paused(사용자에게 노출 중인) 행은 최대한 보존한다:
      // paused 아닌 행 중 updated_at 가장 오래된 것부터, 전부 paused 면 paused 중 가장 오래된 것.
      const userRows = data.guards.filter((row) => row.user_id === job.user_id);
      while (userRows.length >= JOB_GUARD_MAX_ROWS_PER_USER) {
        const evictAt = (row) => Date.parse(row.updated_at || row.last_error_at || row.created_at || "") || 0;
        const nonPaused = userRows.filter((row) => row.paused !== true);
        const pool = nonPaused.length ? nonPaused : userRows;
        let victim = pool[0];
        for (const row of pool) {
          if (evictAt(row) < evictAt(victim)) victim = row;
        }
        const removeAt = data.guards.indexOf(victim);
        if (removeAt >= 0) data.guards.splice(removeAt, 1);
        const userRemoveAt = userRows.indexOf(victim);
        if (userRemoveAt >= 0) userRows.splice(userRemoveAt, 1);
        if (removeAt < 0 && userRemoveAt < 0) break; // 안전장치: 축출 대상 소실 시 무한루프 방지
      }
      guard = {
        user_id: job.user_id,
        job_kind: job.kind,
        device_key: deviceKey,
        signature,
        consecutive_count: 0,
        paused: false,
        created_at: now,
      };
      data.guards.push(guard);
    }
    if (guard.signature === signature) {
      guard.consecutive_count = safeInt(guard.consecutive_count, 0, 1000000) + 1;
    } else {
      guard.signature = signature;
      guard.consecutive_count = 1;
      guard.paused = false;
    }
    guard.device_key = deviceKey; // 레거시 행(device_key 없음) 보정
    guard.last_error_at = now;
    guard.last_message = redactText(String(job.failed_reason || job.result?.visible_error || job.diagnostic?.message || "")).slice(0, 300);
    guard.updated_at = now;
    if (guard.consecutive_count >= jobGuardPauseThreshold(signature)) guard.paused = true;
    saveJobGuards(data);
    return guard;
  } catch (error) {
    console.warn("[job-guard] record failed", error?.code || error?.message || error);
    return null;
  }
}

// 성공(done) 시 해당 user+kind 가드를 삭제한다.
function clearJobGuardOnSuccess(userId, kind) {
  try {
    if (!userId || !kind) return 0;
    const data = loadJobGuards();
    const before = data.guards.length;
    data.guards = data.guards.filter((row) => !(row.user_id === userId && row.job_kind === kind));
    if (data.guards.length === before) return 0;
    saveJobGuards(data);
    return before - data.guards.length;
  } catch (error) {
    console.warn("[job-guard] clear on success failed", error?.code || error?.message || error);
    return 0;
  }
}

// 사용자가 관련 시크릿을 저장했을 때 해당 클래스 가드를 자동 삭제한다.
// deviceKey 미지정(null/undefined): 유저 전체 삭제 — 시크릿 재저장은 계정 단위라 전체가 맞다.
// deviceKey 지정: 같은 기기(row.device_key === deviceKey) 또는 계정단위/레거시 행("")만 삭제 —
//   기기 B 의 전이/재시작이 기기 A 의 가드를 풀지 않게 한다(M-4).
function releaseJobGuardsForClasses(userId, classes = [], deviceKey = null) {
  try {
    if (!userId || !classes.length) return 0;
    const targets = new Set(classes);
    const scoped = deviceKey !== null && deviceKey !== undefined;
    const data = loadJobGuards();
    const before = data.guards.length;
    data.guards = data.guards.filter((row) => {
      if (row.user_id !== userId || !targets.has(String(row.signature || ""))) return true; // 유지
      if (!scoped) return false; // 미지정 → 삭제
      const rowKey = String(row.device_key || "");
      return !(rowKey === deviceKey || rowKey === ""); // 지정 시 같은 기기·계정단위/레거시만 삭제
    });
    if (data.guards.length === before) return 0;
    saveJobGuards(data);
    return before - data.guards.length;
  } catch (error) {
    console.warn("[job-guard] release failed", error?.code || error?.message || error);
    return 0;
  }
}

// M-2: saved_at 이 paused 된 naver_login_failed 가드의 last_error_at 보다 이후이면
// (마지막 실패 이후 자격증명이 재저장됨) 전이 없이도 해제 대상으로 본다.
// saved_at 미전송(null)이면 false → 전이 감지 + acknowledge 경로가 커버한다.
// 절대 "ready 면 해제"로 확장하지 않는다 — ready 는 자격증명 존재이지 로그인 성공이 아니라
// 하트비트마다 해제하면 가드가 무력화된다.
function naverCredentialResavedAfterFailure(userId, savedAtIso) {
  try {
    const savedMs = Date.parse(String(savedAtIso || ""));
    if (!Number.isFinite(savedMs)) return false;
    const data = loadJobGuards();
    return data.guards.some((row) => {
      if (row.user_id !== userId || row.paused !== true) return false;
      if (String(row.signature || "") !== "naver_login_failed") return false;
      const lastErrorMs = Date.parse(String(row.last_error_at || ""));
      return Number.isFinite(lastErrorMs) && lastErrorMs < savedMs;
    });
  } catch (error) {
    console.warn("[job-guard] naver resave check failed", error?.code || error?.message || error);
    return false;
  }
}

// 생성/재시도 차단 판정. 저장소 오류 시에는 기존 동작을 보존(차단하지 않음)한다.
// M-4 차단 규칙(안전 우선): paused 행 중 다음이면 차단한다.
//  - row.device_key === "" (계정 단위·레거시 행) 또는
//  - row.device_key === jobDeviceKey (같은 기기) 또는
//  - jobDeviceKey === "" (새 잡이 아무 기기나 갈 수 있어 어떤 paused 기기든 걸리면 차단)
function pausedJobGuard(userId, kind, deviceKey = "") {
  try {
    if (!userId || !kind) return null;
    const data = loadJobGuards();
    return data.guards.find((row) => {
      if (row.user_id !== userId || row.job_kind !== kind || row.paused !== true) return false;
      const rowKey = String(row.device_key || "");
      return rowKey === "" || rowKey === deviceKey || deviceKey === "";
    }) || null;
  } catch (error) {
    console.warn("[job-guard] lookup failed", error?.code || error?.message || error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 구버전 러너 차단 (preflight)
// 러너가 필요한 잡 종류에 한해, 사용자의 최신 agent 버전이 다운로드 카탈로그의 MIN 보다
// 낮으면 잡 생성을 차단한다. MIN 미설정/에이전트 정보 없음이면 기존 동작을 보존한다.
// ---------------------------------------------------------------------------
function jobKindRequiresRunner(kind) {
  const config = JOB_KINDS[kind] || {};
  if (config.queue === false) return false;
  const worker = WORKERS[config.workerCode || ""] || {};
  return worker.execution === "local_agent" || worker.type === "local_agent";
}

function runnerUpdateRequirement(userId, kind, platformValue = "") {
  try {
    if (!jobKindRequiresRunner(kind)) return null;
    const agents = loadAgents();
    const agent = findAgentForUser(agents, userId, platformValue);
    const currentVersion = String(agent?.version || "").trim();
    if (!currentVersion) return null; // 에이전트 정보 없음 → 차단하지 않음 (기존 동작 보존)
    const config = platformVersionConfig(agent.platform || platformValue || "");
    const minVersion = String(config.min || "").trim();
    if (!minVersion) return null; // MIN 미설정 → 차단하지 않음
    if (compareVersions(currentVersion, minVersion) >= 0) return null;
    return {
      current_version: currentVersion,
      min_version: minVersion,
      platform: config.platform || "",
      message: `실행기 버전(${currentVersion})이 최소 지원 버전(${minVersion})보다 낮아 작업을 시작할 수 없습니다. 업데이트 및 오류보고 탭에서 실행기를 업데이트한 뒤 다시 시도해주세요.`,
    };
  } catch (error) {
    console.warn("[job-guard] runner preflight failed", error?.code || error?.message || error);
    return null; // 판단 불가 시 기존 동작 보존
  }
}

function loadCafe24Orders() {
  const data = readJsonFile(CAFE24_ORDERS_PATH, { version: 1, orders: [] });
  return {
    version: 1,
    orders: arrayFieldOrThrow(CAFE24_ORDERS_PATH, data, "orders"),
  };
}

function saveCafe24Orders(data) {
  writeJsonAtomic(CAFE24_ORDERS_PATH, { version: 1, orders: arrayFieldOrThrow(CAFE24_ORDERS_PATH, data, "orders") });
}

function loadResearch() {
  const data = readJsonFile(RESEARCH_PATH, { version: 1, projects: [], items: [] });
  return {
    version: 1,
    projects: arrayFieldOrThrow(RESEARCH_PATH, data, "projects"),
    items: arrayFieldOrThrow(RESEARCH_PATH, data, "items"),
    discovery_runs: Array.isArray(data.discovery_runs) ? data.discovery_runs : [],
    discovery_candidates: Array.isArray(data.discovery_candidates) ? data.discovery_candidates : [],
    discovery_subscriptions: Array.isArray(data.discovery_subscriptions) ? data.discovery_subscriptions : [],
  };
}

function saveResearch(data) {
  writeJsonAtomic(RESEARCH_PATH, {
    version: 1,
    projects: arrayFieldOrThrow(RESEARCH_PATH, data, "projects"),
    items: arrayFieldOrThrow(RESEARCH_PATH, data, "items"),
    discovery_runs: Array.isArray(data.discovery_runs) ? data.discovery_runs : [],
    discovery_candidates: Array.isArray(data.discovery_candidates) ? data.discovery_candidates : [],
    discovery_subscriptions: Array.isArray(data.discovery_subscriptions) ? data.discovery_subscriptions : [],
  });
  try {
    writeResearchMarkdownExports(data);
  } catch (error) {
    console.warn("[research md] export failed", error.code || error.message || "research_md_export_failed");
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    status: user.status,
    account_segment: normalizeAccountSegment(user.account_segment || user.accountSegment || "", "paid_buyer"),
    account_segment_label: accountSegmentLabel(user.account_segment || user.accountSegment || ""),
    must_change_password: Boolean(user.must_change_password),
    entitlements: user.entitlements || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at || null,
  };
}

function canExecute(user) {
  if (!user || user.status !== "active") return false;
  if (user.must_change_password) return false;
  const entitlements = user.entitlements || {};
  if (entitlements.status !== "active") return false;
  if (entitlements.expires_at && Date.parse(entitlements.expires_at) <= Date.now()) return false;
  return true;
}

function isExpiredUser(user) {
  const entitlements = user?.entitlements || {};
  if (entitlements.status === "expired") return true;
  return Boolean(entitlements.expires_at && Date.parse(entitlements.expires_at) <= Date.now());
}

function adminProductCatalog() {
  return [
    {
      product: "yeri",
      label: "예리",
      price_won: 33000,
      products: productList("yeri"),
      job_kinds: ["yeri_write"],
      download_product: "yeri",
    },
    {
      product: "hyunju",
      label: "현주",
      price_won: 33000,
      products: productList("hyunju"),
      job_kinds: ["hyunju_find"],
      download_product: "hyunju",
    },
    {
      product: "songi",
      label: "송이",
      price_won: 3300,
      products: productList("songi"),
      job_kinds: ["songi_research"],
      download_product: "",
    },
    {
      product: "yunmi",
      label: "윤미",
      price_won: 9900,
      products: productList("yunmi"),
      job_kinds: ["yunmi_script"],
      download_product: "",
    },
    {
      product: "jieun",
      label: "지은",
      price_won: 5500,
      products: productList("jieun"),
      job_kinds: [],
      download_product: "",
    },
    {
      product: "nakyung",
      label: "나경",
      price_won: 9900,
      products: productList("nakyung"),
      job_kinds: [],
      download_product: "",
    },
    {
      product: "hyojin",
      label: "효진",
      price_won: 33000,
      products: productList("hyojin"),
      job_kinds: [],
      download_product: "",
    },
    {
      product: "sangsu",
      label: "상수",
      products: productList("sangsu"),
      job_kinds: ["sangsu_quote"],
      download_product: "",
    },
    {
      product: "eunseo",
      label: "은서",
      price_won: 0,
      products: productList("eunseo"),
      job_kinds: [],
      download_product: "eunseo",
      access_policy: "makefamily_member",
      member_only: true,
    },
    {
      product: "blog_team",
      label: "블로그팀",
      price_won: 66000,
      products: productList("blog_team"),
      job_kinds: ["yeri_write", "hyunju_find"],
      download_product: "bundle",
    },
    {
      product: "bundle",
      label: "전체 통합",
      products: productList("bundle"),
      job_kinds: Object.keys(JOB_KINDS),
      download_product: "bundle",
    },
  ];
}

function adminUserRow(user, agent) {
  const entitlement = user.entitlements || {};
  const product = primaryProductForEntitlements(entitlement);
  const emailEvents = Array.isArray(user.email_events) ? user.email_events : [];
  return {
    ...publicUser(user),
    can_execute: canExecute(user),
    product,
    product_label: productLabel(product),
    products_label: orderedProducts(entitlementProductsForMerge(entitlement)).map(productLabel),
    account_segment: normalizeAccountSegment(user.account_segment || user.accountSegment || "", "paid_buyer"),
    account_segment_label: accountSegmentLabel(user.account_segment || user.accountSegment || ""),
    entitlement_status: entitlement.status || "",
    yunmi_access: canAccessYunmi(user),
    expires_at: entitlement.expires_at || null,
    admin_note: user.admin_note || "",
    last_email_event: emailEvents[emailEvents.length - 1] || null,
    agent: publicAgent(agent),
  };
}

function productLabel(product) {
  return adminProductCatalog().find((item) => item.product === product)?.label || product || "";
}

function rememberUserEmailEvent(user, event) {
  const events = Array.isArray(user.email_events) ? user.email_events : [];
  events.push({
    type: String(event.type || "onboarding_guide").slice(0, 80),
    provider: String(event.provider || "").slice(0, 40),
    provider_message_id: event.provider_message_id ? String(event.provider_message_id).slice(0, 160) : "",
    to: normalizeEmail(event.to || user.email),
    subject: String(event.subject || "").slice(0, 200),
    sent_at: event.sent_at || nowIso(),
  });
  user.email_events = events.slice(-30);
  user.updated_at = nowIso();
}

function compactText(value, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanMultilineText(value, limit = 8000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : match;
  });
}

function blockedResearchFetchError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function isBlockedResearchHostname(hostname) {
  const value = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
  return !value || value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local");
}

function isBlockedResearchAddress(address) {
  const value = String(address || "").toLowerCase();
  if (value.startsWith("::ffff:")) return isBlockedResearchAddress(value.slice(7));
  if (net.isIP(value) === 4) {
    const [a, b, c] = value.split(".").map((part) => Number(part));
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    return false;
  }
  if (net.isIP(value) === 6) {
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:") || value.startsWith("ff");
  }
  return true;
}

async function assertResearchFetchUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ""));
  } catch (_error) {
    throw blockedResearchFetchError("research_invalid_url", "URL 형식이 올바르지 않습니다.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw blockedResearchFetchError("research_url_protocol_not_allowed", "http/https 링크만 읽을 수 있습니다.");
  }
  if (parsed.username || parsed.password) {
    throw blockedResearchFetchError("research_url_credentials_not_allowed", "계정 정보가 포함된 URL은 읽지 않습니다.");
  }
  if (isBlockedResearchHostname(parsed.hostname)) {
    throw blockedResearchFetchError("research_url_not_public", "공개 웹 주소만 읽을 수 있습니다.");
  }
  let addresses = [];
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch (_error) {
    throw blockedResearchFetchError("research_url_lookup_failed", "링크 주소를 찾지 못했습니다.");
  }
  if (!addresses.length || addresses.some((entry) => isBlockedResearchAddress(entry.address))) {
    throw blockedResearchFetchError("research_url_not_public", "공개 웹 주소만 읽을 수 있습니다.");
  }
  return parsed;
}

function safeResearchLookup(hostname, options, callback) {
  require("node:dns").lookup(hostname, options, (error, address, family) => {
    if (error) {
      callback(error);
      return;
    }
    if (Array.isArray(address)) {
      if (address.some((entry) => isBlockedResearchAddress(entry.address))) {
        callback(blockedResearchFetchError("research_url_not_public", "공개 웹 주소만 읽을 수 있습니다."));
        return;
      }
      callback(null, address, family);
      return;
    }
    if (isBlockedResearchAddress(address)) {
      callback(blockedResearchFetchError("research_url_not_public", "공개 웹 주소만 읽을 수 있습니다."));
      return;
    }
    callback(null, address, family);
  });
}

function decodeResearchBody(buffer, headers = {}) {
  const encoding = String(headers["content-encoding"] || "").toLowerCase();
  try {
    if (encoding.includes("br")) return zlib.brotliDecompressSync(buffer).toString("utf8");
    if (encoding.includes("gzip")) return zlib.gunzipSync(buffer).toString("utf8");
    if (encoding.includes("deflate")) return zlib.inflateSync(buffer).toString("utf8");
  } catch (_error) {
    return buffer.toString("utf8");
  }
  return buffer.toString("utf8");
}

async function requestResearchUrl(rawUrl, options = {}) {
  const parsed = await assertResearchFetchUrl(rawUrl);
  const redirectLimit = Number.isFinite(options.redirects) ? options.redirects : 3;
  return new Promise((resolve, reject) => {
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(parsed, {
      method: "GET",
      lookup: safeResearchLookup,
      timeout: options.timeoutMs || RESEARCH_FETCH_TIMEOUT_MS,
      headers: {
        accept: options.accept || "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
        "accept-encoding": "identity",
        "user-agent": "AIMAX-SongiResearch/1.0 (+https://aimax.ai.kr)",
      },
    }, (res) => {
      const status = Number(res.statusCode || 0);
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        if (redirectLimit <= 0) {
          reject(blockedResearchFetchError("research_link_redirect_limit", "리다이렉트가 너무 많습니다."));
          return;
        }
        requestResearchUrl(new URL(location, parsed).toString(), { ...options, redirects: redirectLimit - 1 }).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(blockedResearchFetchError("research_link_http_error", `링크 응답이 ${status}입니다.`));
        return;
      }
      const chunks = [];
      let total = 0;
      const maxBytes = options.maxBytes || RESEARCH_FETCH_MAX_BYTES;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy(blockedResearchFetchError("research_link_too_large", "읽을 수 있는 링크 크기를 넘었습니다."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status,
          headers: res.headers,
          finalUrl: parsed.toString(),
          text: decodeResearchBody(buffer, res.headers),
        });
      });
    });
    req.on("timeout", () => req.destroy(blockedResearchFetchError("research_link_timeout", "링크 읽기 시간이 초과되었습니다.")));
    req.on("error", reject);
    req.end();
  });
}

function htmlAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>` + "`" + `]+))`, "i");
  const match = String(tag || "").match(pattern);
  return decodeHtmlEntities(match?.[2] || match?.[3] || match?.[4] || "");
}

function extractHtmlTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return compactText(decodeHtmlEntities(match?.[1] || ""), 180);
}

function extractHtmlMeta(html, names) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of tags) {
    const key = (htmlAttribute(tag, "property") || htmlAttribute(tag, "name")).toLowerCase();
    if (wanted.has(key)) return compactText(htmlAttribute(tag, "content"), 500);
  }
  return "";
}

function htmlToResearchText(html) {
  const bodyMatch = String(html || "").match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let text = bodyMatch?.[1] || String(html || "");
  text = text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(article|section|main|p|div|li|br|h[1-6]|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return cleanMultilineText(decodeHtmlEntities(text), 5000);
}

function extractJsonBlockAfter(text, startIndex, openChar, closeChar) {
  const source = String(text || "");
  const start = source.indexOf(openChar, Math.max(0, startIndex));
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return "";
}

function parseJsonBlock(block) {
  if (!block) return null;
  try {
    return JSON.parse(block);
  } catch (_error) {
    return null;
  }
}

function extractYouTubePlayerResponse(html) {
  const source = String(html || "");
  const markers = ["ytInitialPlayerResponse =", "ytInitialPlayerResponse=", "ytInitialPlayerResponse\\u0022:"];
  for (const marker of markers) {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) continue;
    const block = extractJsonBlockAfter(source, markerIndex + marker.length, "{", "}");
    const parsed = parseJsonBlock(block);
    if (parsed) return parsed;
  }
  return null;
}

function extractYouTubeCaptionTracks(html) {
  const playerResponse = extractYouTubePlayerResponse(html);
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (Array.isArray(tracks) && tracks.length) return tracks;
  const keyIndex = String(html || "").indexOf("\"captionTracks\"");
  if (keyIndex < 0) return [];
  const parsed = parseJsonBlock(extractJsonBlockAfter(html, keyIndex, "[", "]"));
  return Array.isArray(parsed) ? parsed : [];
}

function selectYouTubeCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  return tracks.find((track) => String(track.languageCode || "").toLowerCase().startsWith("ko"))
    || tracks.find((track) => String(track.vssId || "").toLowerCase().includes(".ko"))
    || tracks.find((track) => String(track.languageCode || "").toLowerCase().startsWith("en"))
    || tracks.find((track) => String(track.vssId || "").toLowerCase().includes(".en"))
    || tracks.find((track) => track.kind !== "asr")
    || tracks[0];
}

function sortYouTubeCaptionTracks(tracks) {
  const list = Array.isArray(tracks) ? [...tracks] : [];
  return list.sort((a, b) => {
    const score = (track) => {
      const language = String(track.languageCode || "").toLowerCase();
      const vssId = String(track.vssId || "").toLowerCase();
      if (language.startsWith("ko") || vssId.includes(".ko")) return 0;
      if (language.startsWith("en") || vssId.includes(".en")) return 1;
      if (track.kind !== "asr") return 2;
      return 3;
    };
    return score(a) - score(b);
  });
}

function parseYouTubeJson3Transcript(text) {
  const payload = JSON.parse(text);
  const lines = [];
  for (const event of payload.events || []) {
    const line = (event.segs || []).map((seg) => seg.utf8 || "").join("").trim();
    if (line) lines.push(line);
  }
  return cleanMultilineText(lines.join(" "), 8000);
}

function parseYouTubeXmlTranscript(text) {
  const matches = String(text || "").match(/<text\b[^>]*>[\s\S]*?<\/text>/gi) || [];
  const lines = matches.map((entry) => {
    const inner = entry.replace(/^<text\b[^>]*>/i, "").replace(/<\/text>$/i, "");
    return decodeHtmlEntities(inner.replace(/<[^>]+>/g, " ")).trim();
  }).filter(Boolean);
  return cleanMultilineText(lines.join(" "), 8000);
}

async function fetchYouTubeTranscript(url) {
  const page = await requestResearchUrl(url, {
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    maxBytes: 3 * 1024 * 1024,
  });
  const tracks = extractYouTubeCaptionTracks(page.text);
  const orderedTracks = sortYouTubeCaptionTracks(tracks);
  if (!orderedTracks.length) return { transcript: "", language: "", status: "youtube_no_captions" };
  let lastLanguage = selectYouTubeCaptionTrack(orderedTracks)?.languageCode || "";
  for (const track of orderedTracks.slice(0, 8)) {
    if (!track?.baseUrl) continue;
    lastLanguage = track.languageCode || lastLanguage;
    const transcriptUrl = `${track.baseUrl}${track.baseUrl.includes("?") ? "&" : "?"}fmt=json3`;
    let transcript = "";
    try {
      const transcriptResponse = await requestResearchUrl(transcriptUrl, {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        maxBytes: 512 * 1024,
      });
      transcript = parseYouTubeJson3Transcript(transcriptResponse.text);
    } catch (_error) {
      try {
        const transcriptResponse = await requestResearchUrl(track.baseUrl, {
          accept: "text/xml,text/plain;q=0.9,*/*;q=0.8",
          maxBytes: 512 * 1024,
        });
        transcript = parseYouTubeXmlTranscript(transcriptResponse.text);
      } catch (__error) {
        transcript = "";
      }
    }
    if (transcript) {
      return {
        transcript,
        language: track.languageCode || "",
        status: "youtube_transcript",
      };
    }
  }
  return {
    transcript: "",
    language: lastLanguage,
    status: "youtube_empty_transcript",
  };
}

async function fetchYouTubeResearch(url) {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await requestResearchUrl(oembedUrl, {
    accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
    maxBytes: 256 * 1024,
  });
  const payload = JSON.parse(response.text);
  const title = compactText(payload.title, 180);
  const author = compactText(payload.author_name, 120);
  let transcriptResult = { transcript: "", language: "", status: "youtube_oembed" };
  try {
    transcriptResult = await fetchYouTubeTranscript(url);
  } catch (_error) {
    transcriptResult = { transcript: "", language: "", status: "youtube_oembed_no_transcript" };
  }
  const sourceText = cleanMultilineText([
    title ? `YouTube 제목: ${title}` : "",
    author ? `채널: ${author}` : "",
    payload.provider_name ? `제공처: ${payload.provider_name}` : "제공처: YouTube",
    transcriptResult.language ? `자막 언어: ${transcriptResult.language}` : "",
    transcriptResult.transcript ? `자막/스크립트:\n${transcriptResult.transcript}` : "",
  ].filter(Boolean).join("\n"), 8000);
  return {
    ok: true,
    platform: "YouTube",
    title,
    source_text: sourceText,
    final_url: url,
    fetch_status: transcriptResult.status || "youtube_oembed",
  };
}

async function fetchGenericResearchUrl(url) {
  const response = await requestResearchUrl(url);
  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const platform = inferResearchPlatform(response.finalUrl || url, response.text);
  if (contentType.includes("application/json")) {
    return {
      ok: true,
      platform,
      title: compactText(url, 120),
      source_text: cleanMultilineText(response.text, 5000),
      final_url: response.finalUrl,
      fetch_status: "json",
    };
  }
  if (contentType.includes("text/html") || /<html|<title|<meta/i.test(response.text)) {
    const title = extractHtmlMeta(response.text, ["og:title", "twitter:title"]) || extractHtmlTitle(response.text);
    const description = extractHtmlMeta(response.text, ["description", "og:description", "twitter:description"]);
    const bodyText = htmlToResearchText(response.text);
    const sourceText = cleanMultilineText([
      title ? `제목: ${title}` : "",
      description ? `설명: ${description}` : "",
      bodyText ? `본문 발췌:\n${bodyText}` : "",
    ].filter(Boolean).join("\n\n"), 8000);
    return {
      ok: true,
      platform,
      title,
      source_text: sourceText,
      final_url: response.finalUrl,
      fetch_status: "html",
    };
  }
  return {
    ok: true,
    platform,
    title: compactText(url, 120),
    source_text: cleanMultilineText(response.text, 5000),
    final_url: response.finalUrl,
    fetch_status: "text",
  };
}

async function fetchResearchLink(url, options = {}) {
  const platform = inferResearchPlatform(url);
  if (platform === "YouTube") {
    try {
      return await fetchYouTubeResearch(url);
    } catch (_error) {
      const fallback = await fetchGenericResearchUrl(url);
      return { ...fallback, platform: "YouTube", fetch_status: `youtube_fallback_${fallback.fetch_status}` };
    }
  }
  if (platform === "Instagram" || platform === "TikTok") {
    const apifyState = options.apifyState && typeof options.apifyState === "object" ? options.apifyState : null;
    const hasApifyToken = apifyState ? Boolean(apifyState.server_configured) : hasStoredSecret("APIFY_API_TOKEN");
    const hasLocalApifyToken = Boolean(apifyState?.local_configured);
    return {
      ok: true,
      platform,
      title: `${platform} 링크`,
      source_text: cleanMultilineText([
        `${platform}는 기본 URL 읽기만으로 본문을 안정적으로 읽기 어려워 Apify 수집 대기 상태로 저장했습니다.`,
        hasApifyToken
          ? "Apify로 SNS 읽기 버튼을 누르면 실제 공개 메타데이터를 수집합니다."
          : hasLocalApifyToken
            ? "Apify 토큰은 이 PC에만 저장되어 있습니다. 설정 탭의 AI/API 연결에서 웹 보안 저장소로 저장하면 송이가 브라우저에서 바로 수집할 수 있습니다."
            : "Apify 토큰이 없어서 실제 SNS 메타데이터 수집을 아직 실행할 수 없습니다.",
        `원본 링크: ${url}`,
      ].join("\n"), 8000),
      final_url: url,
      fetch_status: hasApifyToken ? "apify_needs_approval" : hasLocalApifyToken ? "apify_local_pending" : "apify_key_missing",
    };
  }
  return fetchGenericResearchUrl(url);
}

function researchFetchErrorCode(error) {
  const code = String(error?.code || error?.message || "research_link_fetch_failed");
  const status = error?.status ? `:${error.status}` : "";
  return `${code}${status}`.slice(0, 80);
}

function researchGeminiErrorCode(error) {
  const status = Number(error?.status || 0);
  const detail = String(error?.detail || error?.message || "");
  if (/API_KEY_INVALID|api key not valid|invalid api key/i.test(detail)) return "research_gemini_invalid_api_key";
  if (status === 400) return "research_gemini_bad_request";
  if (status === 401 || status === 403) return "research_gemini_auth_or_permission";
  if (status === 404) return "research_gemini_model_unavailable";
  if (status === 429) return "research_gemini_quota_or_rate_limit";
  if (status === 503 && /high demand|overload|unavailable/i.test(detail)) return "research_gemini_high_demand";
  if (status >= 500) return "research_gemini_provider_error";
  if (error?.code === "external_timeout") return "research_gemini_timeout";
  return researchFetchErrorCode(error);
}

function secretFromEnv(name) {
  return String(process.env[name] || process.env[`AIMAX_${name}`] || "").trim();
}

function readKeychainSecret(account, service) {
  if (!account || !service) return "";
  try {
    return childProcess.execFileSync("security", [
      "find-generic-password",
      "-a",
      account,
      "-s",
      service,
      "-w",
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2500,
    }).trim();
  } catch (_error) {
    return "";
  }
}

function keychainSecretCandidates(name) {
  const candidates = [];
  if (KEYCHAIN_ACCOUNT) candidates.push({ account: KEYCHAIN_ACCOUNT, service: name });
  if (name === "GEMINI_API_KEY") {
    candidates.push(
      { account: "gemini_api_key", service: LOCAL_KEYRING_SERVICE },
      { account: "gemini_api_key", service: LEGACY_KEYRING_SERVICE },
    );
  }
  if (name === "APIFY_API_TOKEN") {
    candidates.push({ account: "apify_api_token", service: LOCAL_KEYRING_SERVICE });
  }
  return candidates;
}

function getStoredSecret(name) {
  const envValue = secretFromEnv(name);
  if (envValue) return envValue;
  for (const candidate of keychainSecretCandidates(name)) {
    const value = readKeychainSecret(candidate.account, candidate.service);
    if (value) return value;
  }
  return "";
}

function hasStoredSecret(name) {
  return Boolean(getStoredSecret(name));
}

let researchMediaToolStatusCache = { key: "", expiresAt: 0, value: null };

function executableStatus(command, args = ["--version"]) {
  const normalized = normalizeExecutableCommand(command, command);
  if (!normalized) {
    return {
      available: false,
      command: "",
      version: "",
      error: "research_tool_path_missing",
    };
  }
  try {
    const useWindowsShell = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(normalized);
    const result = childProcess.spawnSync(normalized, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: Number.isFinite(SONGI_MEDIA_TOOL_CHECK_TIMEOUT_MS) ? SONGI_MEDIA_TOOL_CHECK_TIMEOUT_MS : 10000,
      windowsHide: true,
      shell: useWindowsShell,
    });
    if (result.error) {
      return {
        available: false,
        command: normalized,
        version: "",
        error: result.error.code === "ENOENT" ? "research_tool_not_found" : "research_tool_check_failed",
      };
    }
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    return {
      available: result.status === 0,
      command: normalized,
      version: compactText(output.split(/\r?\n/)[0] || "", 120),
      error: result.status === 0 ? "" : "research_tool_check_failed",
    };
  } catch (error) {
    return {
      available: false,
      command: normalized,
      version: "",
      error: error.code === "ENOENT" ? "research_tool_not_found" : "research_tool_check_failed",
    };
  }
}

function researchMediaToolStatus() {
  const ytDlpPath = songiYtDlpPath();
  const ffmpegPath = songiFfmpegPath();
  const key = [
    process.platform,
    ytDlpPath,
    ffmpegPath,
    SONGI_VIDEO_MAX_SECONDS,
    SONGI_VIDEO_MAX_BYTES,
  ].join("|");
  const now = Date.now();
  if (researchMediaToolStatusCache.key === key && researchMediaToolStatusCache.expiresAt > now && researchMediaToolStatusCache.value) {
    return researchMediaToolStatusCache.value;
  }
  const videoDownload = executableStatus(ytDlpPath, ["--version"]);
  const frameExtract = executableStatus(ffmpegPath, ["-version"]);
  const value = {
    platform: process.platform,
    arch: process.arch,
    data_dir: RESEARCH_DATA_DIR,
    media_tools_dir: defaultMediaToolsDir(),
    video_download: videoDownload,
    frame_extract: frameExtract,
    video_file_analysis_ready: Boolean(videoDownload.available && frameExtract.available),
    video_limits: {
      max_seconds: Number.isFinite(SONGI_VIDEO_MAX_SECONDS) ? SONGI_VIDEO_MAX_SECONDS : 90,
      max_bytes: Number.isFinite(SONGI_VIDEO_MAX_BYTES) ? SONGI_VIDEO_MAX_BYTES : 18 * 1024 * 1024,
      max_width: Number.isFinite(SONGI_FRAME_MAX_WIDTH) ? SONGI_FRAME_MAX_WIDTH : 720,
    },
  };
  researchMediaToolStatusCache = { key, expiresAt: now + 60000, value };
  return value;
}

function researchMediaToolMissingCode() {
  const tools = researchMediaToolStatus();
  if (!tools.video_download.available) return "research_video_downloader_missing";
  if (!tools.frame_extract.available) return "research_frame_extractor_missing";
  return "";
}

function agentForUserId(userId) {
  if (!userId) return null;
  return findAgentForUser(loadAgents(), userId);
}

function researchApifyIntegrationState(agentValue, userValue) {
  const agent = agentValue ? publicAgent(agentValue) : null;
  const agentAiKeys = agent?.readiness?.ai_keys || {};
  const userId = typeof userValue === "string" ? userValue : userValue?.id || "";
  const userConfigured = hasUserSecret(userId, "APIFY_API_TOKEN");
  const globalConfigured = hasStoredSecret("APIFY_API_TOKEN");
  const serverConfigured = userConfigured || globalConfigured;
  const localConfigured = Boolean(agent?.connected && agentAiKeys.apify === "ready");
  return {
    configured: serverConfigured,
    server_configured: serverConfigured,
    user_configured: userConfigured,
    global_configured: globalConfigured,
    local_configured: localConfigured,
    agent_ready: localConfigured,
    local_execution_available: false,
    execution_mode: serverConfigured ? (userConfigured ? "web_user" : "server_global") : localConfigured ? "local_pending" : "missing",
  };
}

function researchIntegrationStatus(options = {}) {
  const userId = typeof options.user === "string" ? options.user : options.user?.id || "";
  const agent = options.agent ? publicAgent(options.agent) : null;
  const apifyState = researchApifyIntegrationState(options.agent, userId);
  const geminiUserConfigured = hasUserSecret(userId, "GEMINI_API_KEY");
  const geminiGlobalConfigured = hasStoredSecret("GEMINI_API_KEY");
  const youtubeUserConfigured = hasUserSecret(userId, "YOUTUBE_API_KEY");
  const youtubeGlobalConfigured = hasStoredSecret("YOUTUBE_API_KEY");
  const youtubeApiConfigured = youtubeUserConfigured || youtubeGlobalConfigured;
  const localYtDlpStatus = agent?.readiness?.media_tools?.yt_dlp || "unknown";
  const localYtDlpReady = Boolean(agent?.connected && localYtDlpStatus === "ready");
  const localAgentConnected = Boolean(agent?.connected);
  const serverYtDlpReady = Boolean(SONGI_SERVER_YTDLP_DISCOVERY_ENABLED && researchMediaToolStatus().video_download.available);
  return {
    storage: researchStoragePayload(),
    runtime: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    media_tools: researchMediaToolStatus(),
    gemini: {
      configured: geminiUserConfigured || geminiGlobalConfigured,
      user_configured: geminiUserConfigured,
      global_configured: geminiGlobalConfigured,
      execution_mode: geminiUserConfigured ? "web_user" : geminiGlobalConfigured ? "server_global" : "missing",
      model: SONGI_GEMINI_MODEL,
      action: "송이 AI 심화 분석",
      cost_notice: "Gemini API 토큰 사용량에 따라 비용이 발생할 수 있어 버튼 확인 후에만 실행합니다.",
    },
    youtube: {
      configured: serverYtDlpReady || localYtDlpReady || youtubeApiConfigured,
      server_configured: serverYtDlpReady,
      server_execution_available: serverYtDlpReady,
      local_configured: localYtDlpReady,
      local_agent_connected: localAgentConnected,
      local_yt_dlp_status: localYtDlpStatus,
      local_yt_dlp_version: agent?.readiness?.media_tools?.yt_dlp_version || "",
      api_configured: youtubeApiConfigured,
      user_configured: youtubeUserConfigured,
      global_configured: youtubeGlobalConfigured,
      execution_mode: serverYtDlpReady ? "server_ytdlp" : localYtDlpReady ? "local_ytdlp" : localAgentConnected ? "local_runner_pending" : youtubeApiConfigured ? "youtube_api_optional" : "local_runner_missing",
      action: "YouTube 쇼츠 키워드 후보 찾기",
      quota_notice: "기본 경로는 AIMAX 웹 서버 또는 로컬 실행기의 yt-dlp 메타데이터 검색이라 YouTube Data API quota를 사용하지 않습니다.",
      api_notice: "YouTube Data API 키는 선택 고급 커넥터로만 사용합니다.",
    },
    apify: {
      ...apifyState,
      action: "Instagram/TikTok SNS 링크 수집",
      cost_notice: "Apify Actor 실행은 결과 수와 부가 옵션에 따라 비용이 발생할 수 있어 버튼 확인 후에만 실행합니다.",
      actors: {
        instagram: SONGI_APIFY_INSTAGRAM_ACTOR,
        instagram_profile: SONGI_APIFY_INSTAGRAM_PROFILE_ACTOR,
        tiktok: SONGI_APIFY_TIKTOK_ACTOR,
      },
      discovery_actors: { ...SONGI_APIFY_DISCOVERY_ACTORS },
      discovery_pricing_usd: { ...SONGI_APIFY_DISCOVERY_PRICING_USD },
      discovery_min_results: { meta_ads: SONGI_META_ADS_MIN_RESULTS },
    },
  };
}

function requestExternalJson(rawUrl, options = {}) {
  const parsed = new URL(rawUrl);
  const bodyText = options.body == null
    ? ""
    : (typeof options.body === "string" ? options.body : JSON.stringify(options.body));
  return new Promise((resolve, reject) => {
    const req = https.request(parsed, {
      method: options.method || "GET",
      timeout: options.timeoutMs || 30000,
      headers: {
        accept: "application/json",
        ...(bodyText ? { "content-type": "application/json", "content-length": Buffer.byteLength(bodyText) } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      let total = 0;
      const maxBytes = options.maxBytes || 2 * 1024 * 1024;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy(blockedResearchFetchError("external_response_too_large", "외부 응답 크기가 너무 큽니다."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsedJson = null;
        try {
          parsedJson = text ? JSON.parse(text) : null;
        } catch (_error) {
          parsedJson = null;
        }
        if (Number(res.statusCode || 0) < 200 || Number(res.statusCode || 0) >= 300) {
          const error = blockedResearchFetchError("external_http_error", "외부 API 요청이 실패했습니다.");
          error.status = Number(res.statusCode || 0);
          const redactedDetail = redactValue("external_response", parsedJson || text);
          error.detail = (typeof redactedDetail === "string" ? redactedDetail : JSON.stringify(redactedDetail || {})).slice(0, 500);
          reject(error);
          return;
        }
        resolve({
          status: Number(res.statusCode || 0),
          headers: res.headers,
          text,
          json: parsedJson,
        });
      });
    });
    req.on("timeout", () => req.destroy(blockedResearchFetchError("external_timeout", "외부 API 요청 시간이 초과되었습니다.")));
    req.on("error", reject);
    if (bodyText) req.write(bodyText);
    req.end();
  });
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseYouTubeDurationSeconds(value) {
  const text = String(value || "");
  const match = text.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(String(videoId || ""))}`;
}

function youtubeShortsUrl(videoId) {
  return `https://www.youtube.com/shorts/${encodeURIComponent(String(videoId || ""))}`;
}

function youtubeShortsSearchQueries(keyword, searchLimit) {
  const cleanKeyword = compactText(keyword, 120).replace(/\s+/g, " ").trim();
  return [
    `ytsearch${searchLimit}:${cleanKeyword} shorts`,
    `ytsearch${searchLimit}:${cleanKeyword} #shorts`,
    `ytsearch${searchLimit}:${cleanKeyword} 쇼츠`,
    `ytsearch${searchLimit}:${cleanKeyword} 숏폼`,
  ];
}

function hasYouTubeShortHint(...values) {
  const text = values.map((value) => String(value || "")).join(" ").toLowerCase();
  return /\/shorts\/|#shorts|\bshorts\b|shortform|short form|쇼츠|숏폼/.test(text);
}

function youtubeCandidateVideoId(item = {}) {
  let videoId = compactText(item.id || item.video_id || "", 80);
  const url = compactText(item.webpage_url || item.url || "", 500);
  const match = url.match(/(?:\/shorts\/|[?&]v=)([^&/?#]+)/i);
  if (match?.[1]) videoId = compactText(match[1], 80);
  return videoId;
}

function youtubeCandidateUrl(videoId, url, isShortForm) {
  if (isShortForm && videoId) return youtubeShortsUrl(videoId);
  const cleanUrl = compactText(url, 500);
  if (videoId && !/^https?:\/\//i.test(cleanUrl)) return youtubeWatchUrl(videoId);
  return cleanUrl;
}

function youtubeDurationLabel(seconds) {
  const value = Math.round(Number(seconds || 0));
  if (!Number.isFinite(value) || value <= 0) return "";
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return minutes ? `${minutes}분 ${remainder}초` : `${remainder}초`;
}

function isShortFormYouTubeCandidate({ url = "", title = "", description = "", durationSeconds = 0 } = {}) {
  if (hasYouTubeShortHint(url, title, description)) return true;
  const duration = Math.round(Number(durationSeconds || 0));
  return duration > 0 && duration <= 180;
}

function youtubeThumbnail(snippet = {}) {
  const thumbnails = snippet.thumbnails || {};
  return thumbnails.maxres?.url
    || thumbnails.standard?.url
    || thumbnails.high?.url
    || thumbnails.medium?.url
    || thumbnails.default?.url
    || "";
}

function youtubeThumbnailFromVideoId(videoId) {
  const id = String(videoId || "").trim();
  return id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : "";
}

function youtubeDiscoverySourceText(candidate) {
  const metrics = candidate.metrics || {};
  return cleanMultilineText([
    "YouTube 키워드 벤치마킹 후보",
    `키워드: ${candidate.keyword || ""}`,
    `제목: ${candidate.title || ""}`,
    `채널: ${candidate.creator || ""}`,
    `게시일: ${candidate.published_at || ""}`,
    candidate.content_format === "youtube_shorts" || metrics.is_short_form ? "형식: YouTube Shorts/숏폼 후보" : "형식: YouTube 일반 동영상 후보",
    metrics.duration_seconds ? `길이: ${youtubeDurationLabel(metrics.duration_seconds)}` : "",
    `후보 지수: ${candidate.candidate_score || 0}/100`,
    `조회수: ${Number(metrics.view_count || 0).toLocaleString("ko-KR")}`,
    `좋아요: ${Number(metrics.like_count || 0).toLocaleString("ko-KR")}`,
    `댓글: ${Number(metrics.comment_count || 0).toLocaleString("ko-KR")}`,
    `시간당 조회수 추정: ${Math.round(Number(metrics.views_per_hour || 0)).toLocaleString("ko-KR")}`,
    `참여율 추정: ${(Number(metrics.engagement_rate || 0) * 100).toFixed(2)}%`,
    candidate.reason ? `선정 이유: ${candidate.reason}` : "",
    candidate.description ? `설명:\n${candidate.description}` : "",
    `원본 링크: ${candidate.url || ""}`,
  ].filter(Boolean).join("\n"), 8000);
}

function publicResearchDiscoveryRun(run) {
  return {
    id: run.id,
    project_id: run.project_id,
    keyword: run.keyword || "",
    platform: run.platform || "youtube",
    sort_mode: run.sort_mode || "",
    date_range_days: run.date_range_days || 30,
    region_code: run.region_code || "",
    relevance_language: run.relevance_language || "",
    max_results: run.max_results || 12,
    status: run.status || "",
    error: run.error || "",
    result_count: Number(run.result_count || 0),
    command_id: run.command_id || "",
    quota_units_estimate: run.quota_units_estimate || 0,
    source_mode: run.source_mode || "local_ytdlp",
    subscription_id: run.subscription_id || "",
    cost_usd: Number(run.cost_usd || 0),
    created_at: run.created_at || "",
    expires_at: run.expires_at || "",
  };
}

function publicResearchDiscoveryCandidate(candidate) {
  return {
    id: candidate.id,
    run_id: candidate.run_id,
    project_id: candidate.project_id,
    platform: candidate.platform || "YouTube",
    keyword: candidate.keyword || "",
    url: candidate.url || "",
    title: candidate.title || "",
    creator: candidate.creator || "",
    description: candidate.description || "",
    thumbnail_url: candidate.thumbnail_url || "",
    published_at: candidate.published_at || "",
    metrics: candidate.metrics || {},
    content_format: candidate.content_format || "",
    candidate_score: Number(candidate.candidate_score || 0),
    reason: candidate.reason || "",
    confidence_label: candidate.confidence_label || "공개 지표 기반",
    measurement_badge: candidate.measurement_badge || "로컬 공개 검색",
    imported_item_id: candidate.imported_item_id || "",
    created_at: candidate.created_at || "",
    expires_at: candidate.expires_at || "",
  };
}

function keepLastPerUser(items, limit, isProtected) {
  // 뒤(최신)에서부터 사용자별 limit개 유지, protected 항목은 캡과 무관하게 유지
  const counts = new Map();
  const kept = [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (typeof isProtected === "function" && isProtected(item)) {
      kept.push(item);
      continue;
    }
    const key = String(item.user_id || "");
    const count = counts.get(key) || 0;
    if (count < limit) {
      counts.set(key, count + 1);
      kept.push(item);
    }
  }
  return kept.reverse();
}

function pruneResearchDiscovery(research) {
  const now = Date.now();
  const activeRuns = new Set();
  research.discovery_runs = keepLastPerUser(
    (Array.isArray(research.discovery_runs) ? research.discovery_runs : [])
      .filter((run) => !run.expires_at || Date.parse(run.expires_at) > now),
    SONGI_DISCOVERY_RUNS_PER_USER,
    // 실행 중인 런이 캡으로 밀려나면 apify_run_id 재개 체인이 끊겨 이중 과금 위험
    (run) => String(run.status || "") === "running",
  );
  const staleRunningBefore = now - 10 * 60 * 1000;
  for (const run of research.discovery_runs) {
    if (String(run.status || "") !== "running" || !/^server_/.test(String(run.source_mode || ""))) continue;
    const updatedAt = Date.parse(run.updated_at || run.created_at || "");
    if (Number.isFinite(updatedAt) && updatedAt < staleRunningBefore) {
      run.status = "failed";
      run.error = run.error || "research_discovery_timeout";
      run.error_detail = run.error_detail || "서버가 이 수집 실행을 더 이상 추적하지 못해 실패로 정리했습니다. 다시 시도해주세요.";
      run.updated_at = nowIso();
    }
  }
  for (const run of research.discovery_runs) activeRuns.add(run.id);
  research.discovery_candidates = keepLastPerUser(
    (Array.isArray(research.discovery_candidates) ? research.discovery_candidates : [])
      .filter((candidate) => activeRuns.has(candidate.run_id) && (!candidate.expires_at || Date.parse(candidate.expires_at) > now)),
    SONGI_DISCOVERY_CANDIDATES_PER_USER,
  );
  const projectIds = new Set((Array.isArray(research.projects) ? research.projects : []).map((project) => project.id));
  research.discovery_subscriptions = (Array.isArray(research.discovery_subscriptions) ? research.discovery_subscriptions : [])
    .filter((subscription) => projectIds.has(subscription.project_id));
}

async function requestYouTubeData(pathname, params, apiKey) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${pathname}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  url.searchParams.set("key", apiKey);
  const response = await requestExternalJson(url.toString(), {
    timeoutMs: 12000,
    maxBytes: 1024 * 1024,
  });
  return response.json || {};
}

function scoreYouTubeCandidates(candidates) {
  const maxVelocity = Math.max(1, ...candidates.map((item) => Number(item.metrics?.views_per_hour || 0)));
  const maxEngagement = Math.max(0.0001, ...candidates.map((item) => Number(item.metrics?.engagement_rate || 0)));
  return candidates.map((candidate) => {
    const metrics = candidate.metrics || {};
    const velocityScore = Math.min(1, Number(metrics.views_per_hour || 0) / maxVelocity);
    const engagementScore = Math.min(1, Number(metrics.engagement_rate || 0) / maxEngagement);
    const recencyScore = Math.max(0, Math.min(1, 1 - (Number(metrics.age_hours || 0) / (24 * 30))));
    const durationSeconds = Math.round(Number(metrics.duration_seconds || 0));
    const shortFormScore = metrics.is_short_form || (durationSeconds > 0 && durationSeconds <= 180) ? 1 : 0;
    const candidateScore = Math.round((velocityScore * 0.52 + engagementScore * 0.25 + recencyScore * 0.18 + shortFormScore * 0.05) * 100);
    const reasonParts = [
      shortFormScore ? "쇼츠" : "일반 동영상",
      durationSeconds ? `길이 ${youtubeDurationLabel(durationSeconds)}` : "",
      Number(metrics.views_per_hour || 0) ? `시간당 조회수 약 ${Math.round(metrics.views_per_hour).toLocaleString("ko-KR")}` : "",
      Number(metrics.engagement_rate || 0) ? `참여율 약 ${(metrics.engagement_rate * 100).toFixed(2)}%` : "",
      metrics.age_hours <= 72 ? "최근 3일 내 게시" : metrics.age_hours <= 24 * 14 ? "최근 2주 내 게시" : "",
    ].filter(Boolean);
    return {
      ...candidate,
      candidate_score: candidateScore,
      reason: reasonParts.join(" · ") || "최근 공개 지표 기준으로 벤치마킹 후보에 포함되었습니다.",
    };
  }).sort((a, b) => Number(b.candidate_score || 0) - Number(a.candidate_score || 0));
}

async function discoverYouTubeCandidates({ apiKey, keyword, days, regionCode, relevanceLanguage, maxResults }) {
  const publishedAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const searchPayload = await requestYouTubeData("search", {
    part: "snippet",
    type: "video",
    q: `${keyword} shorts`,
    order: "viewCount",
    publishedAfter,
    regionCode,
    relevanceLanguage,
    safeSearch: "moderate",
    videoDuration: "short",
    maxResults,
  }, apiKey);
  const ids = (Array.isArray(searchPayload.items) ? searchPayload.items : [])
    .map((item) => item?.id?.videoId)
    .filter(Boolean)
    .slice(0, maxResults);
  if (!ids.length) return [];
  const detailsPayload = await requestYouTubeData("videos", {
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
    maxResults: ids.length,
  }, apiKey);
  const now = Date.now();
  const candidates = (Array.isArray(detailsPayload.items) ? detailsPayload.items : [])
    .map((item) => {
      const snippet = item.snippet || {};
      const stats = item.statistics || {};
      const publishedAt = snippet.publishedAt || "";
      const publishedTime = Date.parse(publishedAt || "");
      const ageHours = Number.isFinite(publishedTime) ? Math.max(1, (now - publishedTime) / 3600000) : 24 * days;
      const views = parseCount(stats.viewCount);
      const likes = parseCount(stats.likeCount);
      const comments = parseCount(stats.commentCount);
      const durationSeconds = parseYouTubeDurationSeconds(item.contentDetails?.duration || "");
      const isShortForm = isShortFormYouTubeCandidate({
        url: youtubeWatchUrl(item.id),
        title: snippet.title,
        description: snippet.description,
        durationSeconds,
      });
      if (!isShortForm) return null;
      return {
        platform: "YouTube",
        video_id: item.id || "",
        url: youtubeCandidateUrl(item.id, "", true),
        title: compactText(snippet.title, 180),
        creator: compactText(snippet.channelTitle, 120),
        description: compactText(snippet.description, 900),
        thumbnail_url: youtubeThumbnail(snippet),
        published_at: publishedAt,
        metrics: {
          view_count: views,
          like_count: likes,
          comment_count: comments,
          duration_seconds: durationSeconds,
          is_short_form: true,
          age_hours: Math.round(ageHours * 10) / 10,
          views_per_hour: Math.round((views / ageHours) * 10) / 10,
          engagement_rate: views ? Math.round(((likes + comments) / views) * 10000) / 10000 : 0,
        },
        content_format: "youtube_shorts",
        confidence_label: "공개 지표 기반",
        measurement_badge: "쇼츠 공개 API",
      };
    })
    .filter((candidate) => candidate && candidate.url && candidate.title);
  return scoreYouTubeCandidates(candidates);
}

function songiUploadDateIso(value) {
  const text = String(value || "").trim();
  if (/^\d{8}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6));
    const day = Number(text.slice(6, 8));
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day)).toISOString();
    }
  }
  return safeIsoOrNull(text) || "";
}

function parseYtDlpJsonLines(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

async function serverYtDlpVideoDetail(url) {
  const separator = "\x1f";
  const template = [
    "%(upload_date)s",
    "%(like_count)s",
    "%(comment_count)s",
    "%(channel_follower_count)s",
    "%(duration)s",
    "%(webpage_url)s",
  ].join(separator);
  try {
    const result = await runBoundedProcess(songiYtDlpPath(), [
      "--skip-download",
      "--no-warnings",
      "--print",
      template,
      url,
    ], {
      timeoutMs: Math.min(35000, SONGI_YTDLP_DISCOVERY_TIMEOUT_MS),
      maxOutput: 8000,
      errorCode: "server_ytdlp_detail_failed",
      timeoutCode: "server_ytdlp_detail_timeout",
      missingCode: "server_ytdlp_missing",
      missingMessage: "YouTube 공개 검색 도구를 찾지 못했습니다.",
    });
    const line = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
    const parts = line.split(separator);
    return {
      upload_date: parts[0] || "",
      like_count: parseCount(parts[1] || ""),
      comment_count: parseCount(parts[2] || ""),
      channel_follower_count: parseCount(parts[3] || ""),
      duration: parseCount(parts[4] || ""),
      webpage_url: compactText(parts[5] || "", 500),
    };
  } catch (_error) {
    return {};
  }
}

async function discoverYouTubeCandidatesWithServerYtDlp({ keyword, days, maxResults }) {
  const rows = [];
  const seenVideoIds = new Set();
  const searchLimit = Math.min(60, Math.max(maxResults * 4, maxResults + 12));
  for (const query of youtubeShortsSearchQueries(keyword, searchLimit)) {
    const search = await runBoundedProcess(songiYtDlpPath(), [
      "--skip-download",
      "--flat-playlist",
      "--no-warnings",
      "--dump-json",
      "--playlist-end",
      String(searchLimit),
      query,
    ], {
      timeoutMs: Math.max(45000, Math.min(SONGI_YTDLP_DISCOVERY_TIMEOUT_MS, searchLimit * 4000)),
      maxOutput: 240000,
      errorCode: "server_ytdlp_discovery_failed",
      timeoutCode: "server_ytdlp_discovery_timeout",
      missingCode: "server_ytdlp_missing",
      missingMessage: "YouTube 공개 검색 도구를 찾지 못했습니다.",
    });
    const items = parseYtDlpJsonLines(search.stdout);
    for (const item of items) {
      const videoId = youtubeCandidateVideoId(item);
      if (!videoId || seenVideoIds.has(videoId)) continue;
      seenVideoIds.add(videoId);
      const rawUrl = compactText(item.webpage_url || item.url || "", 500);
      const provisionalUrl = youtubeCandidateUrl(videoId, rawUrl, hasYouTubeShortHint(rawUrl));
      if (!/^https?:\/\//i.test(provisionalUrl)) continue;
      const detail = await serverYtDlpVideoDetail(provisionalUrl);
      const durationSeconds = Math.round(parseCount(item.duration) || parseCount(detail.duration));
      const detailUrl = compactText(detail.webpage_url || "", 500);
      const isShortForm = isShortFormYouTubeCandidate({
        url: `${rawUrl} ${detailUrl}`,
        title: item.title,
        description: item.description,
        durationSeconds,
      });
      const url = youtubeCandidateUrl(videoId, detailUrl || rawUrl, isShortForm);
      if (!url.includes("youtube.com/")) continue;
      const publishedAt = songiUploadDateIso(detail.upload_date || item.upload_date || item.timestamp || "");
      const publishedTime = Date.parse(publishedAt || "");
      const ageHours = Number.isFinite(publishedTime)
        ? Math.max(1, (Date.now() - publishedTime) / 3600000)
        : Math.max(1, boundedInteger(days, 30, 1, 90) * 24);
      const viewCount = parseCount(item.view_count);
      const likeCount = parseCount(detail.like_count || item.like_count);
      const commentCount = parseCount(detail.comment_count || item.comment_count);
      rows.push({
        video_id: videoId,
        url,
        title: compactText(item.title, 180),
        creator: compactText(item.channel || item.uploader, 120),
        description: compactText(item.description, 900),
        thumbnail_url: compactText(youtubeThumbnailFromVideoId(videoId), 700),
        published_at: publishedAt,
        metrics: {
          view_count: viewCount,
          like_count: likeCount,
          comment_count: commentCount,
          duration_seconds: durationSeconds,
          is_short_form: isShortForm,
          age_hours: Math.round(ageHours * 10) / 10,
          views_per_hour: Math.round((viewCount / ageHours) * 10) / 10,
          engagement_rate: viewCount ? Math.round(((likeCount + commentCount) / viewCount) * 10000) / 10000 : 0,
          channel_follower_count: Math.round(parseCount(detail.channel_follower_count)),
        },
        content_format: isShortForm ? "youtube_shorts" : "youtube_video",
        confidence_label: "비공식 공개 지표 기반",
        measurement_badge: "유튜브 공개 검색",
      });
      if (rows.length >= maxResults) break;
    }
    if (rows.length >= maxResults) break;
  }
  const toolStatus = researchMediaToolStatus().video_download || {};
  return {
    candidates: rows,
    source_version: toolStatus.version || "",
  };
}

function normalizeDiscoveryNumber(value, fallback = 0, max = 100000000000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(number, max));
}

function sanitizeLocalYouTubeCandidate(raw, context = {}) {
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const metrics = data.metrics && typeof data.metrics === "object" && !Array.isArray(data.metrics) ? data.metrics : {};
  const videoId = compactText(data.video_id || data.id || "", 80);
  const rawUrl = compactText(data.url || data.webpage_url || (videoId ? youtubeWatchUrl(videoId) : ""), 500);
  const publishedAt = safeIsoOrNull(data.published_at || data.publishedAt || "") || "";
  const viewCount = Math.round(normalizeDiscoveryNumber(metrics.view_count ?? data.view_count));
  const likeCount = Math.round(normalizeDiscoveryNumber(metrics.like_count ?? data.like_count));
  const commentCount = Math.round(normalizeDiscoveryNumber(metrics.comment_count ?? data.comment_count));
  const durationSeconds = Math.round(normalizeDiscoveryNumber(metrics.duration_seconds ?? data.duration));
  const isShortForm = Boolean(
    metrics.is_short_form
    || data.content_format === "youtube_shorts"
    || isShortFormYouTubeCandidate({
      url: rawUrl,
      title: data.title,
      description: data.description,
      durationSeconds,
    }),
  );
  const url = compactText(youtubeCandidateUrl(videoId, rawUrl, isShortForm), 500);
  const ageHours = Math.round(normalizeDiscoveryNumber(metrics.age_hours, 24 * boundedInteger(context.days, 30, 1, 90), 24 * 3650) * 10) / 10;
  const viewsPerHour = normalizeDiscoveryNumber(metrics.views_per_hour) || (ageHours ? viewCount / ageHours : 0);
  const engagementRate = normalizeDiscoveryNumber(metrics.engagement_rate, 0, 10) || (viewCount ? (likeCount + commentCount) / viewCount : 0);
  return {
    platform: "YouTube",
    video_id: videoId,
    url,
    title: compactText(data.title, 180),
    creator: compactText(data.creator || data.channel || data.uploader, 120),
    description: compactText(data.description, 900),
    thumbnail_url: compactText(data.thumbnail_url || data.thumbnail || youtubeThumbnailFromVideoId(videoId), 700),
    published_at: publishedAt,
    metrics: {
      view_count: viewCount,
      like_count: likeCount,
      comment_count: commentCount,
      duration_seconds: durationSeconds,
      is_short_form: isShortForm,
      age_hours: ageHours,
      views_per_hour: Math.round(viewsPerHour * 10) / 10,
      engagement_rate: Math.round(engagementRate * 10000) / 10000,
      channel_follower_count: Math.round(normalizeDiscoveryNumber(metrics.channel_follower_count ?? data.channel_follower_count)),
    },
    content_format: isShortForm ? "youtube_shorts" : compactText(data.content_format || "", 80),
    confidence_label: "비공식 공개 지표 기반",
    measurement_badge: compactText(data.measurement_badge || "", 80) || "로컬 공개 검색",
  };
}

function materializeSongiDiscoveryCandidates(research, run, userId, rawCandidates, options = {}) {
  const project = research.projects.find((item) => item.id === run.project_id && item.user_id === userId);
  const maxResults = boundedInteger(run.max_results, 12, 1, 25);
  const candidates = scoreYouTubeCandidates(
    (Array.isArray(rawCandidates) ? rawCandidates : [])
      .slice(0, maxResults)
      .map((candidate) => sanitizeLocalYouTubeCandidate(candidate, { days: run.date_range_days }))
      .filter((candidate) => candidate.url && candidate.title),
  ).map((candidate) => ({
    id: crypto.randomUUID(),
    run_id: run.id,
    user_id: userId,
    project_id: run.project_id,
    keyword: run.keyword,
    created_at: nowIso(),
    expires_at: run.expires_at || new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    ...candidate,
  }));
  for (const candidate of candidates) {
    candidate.source_text = youtubeDiscoverySourceText(candidate);
  }
  research.discovery_candidates = (research.discovery_candidates || []).filter((candidate) => candidate.run_id !== run.id);
  research.discovery_candidates.push(...candidates);
  run.status = "completed";
  run.result_count = candidates.length;
  run.error = "";
  run.error_detail = "";
  run.source_mode = compactText(options.sourceMode || run.source_mode || "local_ytdlp", 80);
  run.source_version = compactText(options.sourceVersion || "", 80);
  run.updated_at = nowIso();
  if (project) project.updated_at = run.updated_at;
  pruneResearchDiscovery(research);
  return candidates;
}

function createSongiDiscoveryCommand(auth, run, payload = {}) {
  const commands = loadCommands();
  const now = nowIso();
  const command = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    type: "songi_youtube_discovery",
    status: "queued",
    target_platform: normalizePlatform(payload.target_platform || payload.platform || ""),
    payload: {
      run_id: run.id,
      project_id: run.project_id,
      keyword: run.keyword,
      date_range_days: run.date_range_days,
      max_results: run.max_results,
    },
    logs: [
      {
        at: now,
        level: "info",
        message: "송이 YouTube 쇼츠 로컬 후보 찾기 명령이 생성되었습니다.",
      },
    ],
    created_at: now,
    updated_at: now,
  };
  commands.commands.push(command);
  saveCommands(commands);
  return command;
}

function completeSongiDiscoveryCommand(command, body) {
  if (!command || command.type !== "songi_youtube_discovery") return;
  const payload = command.payload && typeof command.payload === "object" ? command.payload : {};
  const result = body && body.result && typeof body.result === "object" ? body.result : {};
  const runId = String(result.run_id || payload.run_id || "").trim();
  if (!runId) return;

  const research = loadResearch();
  const run = research.discovery_runs.find((item) => item.id === runId && item.user_id === command.user_id);
  if (!run) return;
  const now = nowIso();
  run.command_id = command.id;
  run.updated_at = now;

  if (body.status === "failed" || result.ok === false) {
    run.status = "failed";
    run.error = compactText(result.error || "local_ytdlp_discovery_failed", 120);
    run.error_detail = compactText(result.message || body.log || "", 500);
    saveResearch(research);
    return;
  }

  materializeSongiDiscoveryCandidates(research, run, command.user_id, result.candidates, {
    sourceMode: result.source_mode || "local_ytdlp",
    sourceVersion: result.source_version || "",
  });
  pruneResearchDiscovery(research);
  saveResearch(research);
}

function canUseApifyForResearchUrl(url) {
  const platform = inferResearchPlatform(url);
  return platform === "Instagram" || platform === "TikTok";
}

function apifyRunConfigForUrl(url) {
  const platform = inferResearchPlatform(url);
  if (platform === "Instagram") {
    return {
      platform,
      actorId: SONGI_APIFY_INSTAGRAM_ACTOR,
      pricingLabel: "Instagram Reel Scraper: 기본 $1.00/1,000 reels 수준, transcript/download 부가 옵션은 끔",
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
      actorId: SONGI_APIFY_TIKTOK_ACTOR,
      pricingLabel: "TikTok Video Scraper: 기본 $5.00/1,000 videos 수준, 다운로드/전사 부가 옵션은 끔",
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

function apifyActorPath(actorId) {
  return encodeURIComponent(String(actorId || "").replace("/", "~"));
}

function apifyData(response) {
  return response?.json?.data || response?.json || {};
}

function apifyTerminalStatus(status) {
  return ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(String(status || "").toUpperCase());
}

async function startApifyActorRun(config, token) {
  const endpoint = `https://api.apify.com/v2/acts/${apifyActorPath(config.actorId)}/runs?waitForFinish=0`;
  const response = await requestExternalJson(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: config.input,
    timeoutMs: 30000,
    maxBytes: 1024 * 1024,
  });
  return apifyData(response);
}

async function getApifyRun(runId, token, waitForFinish = 10) {
  const endpoint = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?waitForFinish=${encodeURIComponent(waitForFinish)}`;
  const response = await requestExternalJson(endpoint, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    timeoutMs: (waitForFinish + 10) * 1000,
    maxBytes: 1024 * 1024,
  });
  return apifyData(response);
}

async function fetchApifyDatasetItems(datasetId, token) {
  return fetchApifyDatasetItemsLimited(datasetId, token, 3);
}

async function fetchApifyDatasetItemsLimited(datasetId, token, limit = 3) {
  const safeLimit = Math.max(1, Math.min(10, Number(limit || 3)));
  const endpoint = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=${encodeURIComponent(safeLimit)}`;
  const response = await requestExternalJson(endpoint, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    timeoutMs: 30000,
    maxBytes: 3 * 1024 * 1024,
  });
  return Array.isArray(response.json) ? response.json : [];
}

async function waitForApifyRun(runId, token) {
  let run = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    run = await getApifyRun(runId, token, 10);
    if (apifyTerminalStatus(run.status)) return run;
  }
  const error = blockedResearchFetchError("research_apify_run_still_running", "Apify 수집이 아직 실행 중입니다.");
  error.run = run || { id: runId, status: "RUNNING" };
  throw error;
}

async function runApifyCollection(config, token, existingRunId = "") {
  if (!config) {
    throw blockedResearchFetchError("research_apify_not_supported", "이 링크는 Apify 수집 대상이 아닙니다.");
  }
  const startedRun = existingRunId ? await getApifyRun(existingRunId, token, 0) : await startApifyActorRun(config, token);
  const runId = startedRun.id || existingRunId;
  const datasetId = startedRun.defaultDatasetId || "";
  if (!runId) {
    throw blockedResearchFetchError("research_apify_run_missing", "Apify 실행 ID를 받지 못했습니다.");
  }
  const finishedRun = apifyTerminalStatus(startedRun.status) ? startedRun : await waitForApifyRun(runId, token);
  if (String(finishedRun.status || "").toUpperCase() !== "SUCCEEDED") {
    const error = blockedResearchFetchError("research_apify_run_failed", "Apify 수집 실행이 실패했습니다.");
    error.run = finishedRun;
    throw error;
  }
  const finalDatasetId = finishedRun.defaultDatasetId || datasetId;
  const items = finalDatasetId ? await fetchApifyDatasetItemsLimited(finalDatasetId, token, config.datasetLimit || 3) : [];
  if (!items.length) {
    const error = blockedResearchFetchError("research_apify_no_items", "Apify 수집 결과가 비어 있습니다.");
    error.run = finishedRun;
    throw error;
  }
  return {
    ...config,
    items: items.slice(0, 3),
    run: finishedRun,
  };
}

async function runApifyResearchCollection(url, token, existingRunId = "") {
  return runApifyCollection(apifyRunConfigForUrl(url), token, existingRunId);
}

const SONGI_DISCOVERY_PLATFORM_LABELS = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  threads: "Threads",
  meta_ads: "Meta 광고",
};

function songiDiscoveryHashtag(keyword) {
  return String(keyword || "")
    .replace(/^#+/, "")
    .replace(/[!?.,:;\-+=*&%$#@/\\~^|<>()[\]{}"'`\s]+/g, "")
    .trim();
}

function songiApifyDiscoveryConfig(platform, keyword, maxResults) {
  const actorId = SONGI_APIFY_DISCOVERY_ACTORS[platform];
  if (!actorId) return null;
  const trimmedKeyword = compactText(keyword, 120);
  if (platform === "instagram") {
    const hashtag = songiDiscoveryHashtag(trimmedKeyword);
    if (!hashtag) return null;
    return { actorId, input: { hashtags: [hashtag], resultsLimit: maxResults }, query: `#${hashtag}` };
  }
  if (platform === "tiktok") {
    const hashtag = songiDiscoveryHashtag(trimmedKeyword);
    const singleToken = hashtag && !/\s/.test(trimmedKeyword);
    return singleToken
      ? { actorId, input: { hashtags: [hashtag], resultsPerPage: maxResults }, query: `#${hashtag}` }
      : { actorId, input: { searchQueries: [trimmedKeyword], resultsPerPage: maxResults }, query: trimmedKeyword };
  }
  if (platform === "threads") {
    return { actorId, input: { mode: "search", searchQueries: [trimmedKeyword], maxPosts: maxResults }, query: trimmedKeyword };
  }
  if (platform === "meta_ads") {
    const libraryUrl = new URL("https://www.facebook.com/ads/library/");
    libraryUrl.searchParams.set("active_status", "active");
    libraryUrl.searchParams.set("ad_type", "all");
    libraryUrl.searchParams.set("country", "KR");
    libraryUrl.searchParams.set("q", trimmedKeyword);
    libraryUrl.searchParams.set("search_type", "keyword_unordered");
    return {
      actorId,
      input: { urls: [{ url: libraryUrl.toString() }], count: Math.max(SONGI_META_ADS_MIN_RESULTS, maxResults) },
      query: trimmedKeyword,
    };
  }
  return null;
}

async function fetchApifyDiscoveryItems(datasetId, token, limit = 12) {
  const safeLimit = Math.max(1, Math.min(25, Number(limit || 12)));
  const endpoint = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=${encodeURIComponent(safeLimit)}`;
  const response = await requestExternalJson(endpoint, {
    headers: { authorization: `Bearer ${token}` },
    timeoutMs: 30000,
    maxBytes: 8 * 1024 * 1024,
  });
  return Array.isArray(response.json) ? response.json : [];
}

async function runSongiApifyDiscovery(config, token, limit, options = {}) {
  const existingRunId = compactText(options.existingRunId, 120);
  const startedRun = existingRunId ? await getApifyRun(existingRunId, token, 0) : await startApifyActorRun(config, token);
  const runId = startedRun.id || existingRunId;
  if (!runId) {
    throw blockedResearchFetchError("research_apify_run_missing", "Apify 실행 ID를 받지 못했습니다.");
  }
  if (typeof options.onRunStarted === "function") {
    try { options.onRunStarted(String(runId)); } catch (_error) {}
  }
  const finishedRun = apifyTerminalStatus(startedRun.status) ? startedRun : await waitForApifyRun(runId, token);
  if (String(finishedRun.status || "").toUpperCase() !== "SUCCEEDED") {
    const error = blockedResearchFetchError("research_apify_run_failed", "Apify 수집 실행이 실패했습니다.");
    error.run = finishedRun;
    throw error;
  }
  const datasetId = finishedRun.defaultDatasetId || startedRun.defaultDatasetId || "";
  const items = datasetId ? await fetchApifyDiscoveryItems(datasetId, token, limit) : [];
  return { run: finishedRun, items };
}

function safeExternalHttpUrl(value, maxLength = 1000) {
  const text = compactText(value, maxLength);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

function songiDiscoveryAgeHours(publishedAt) {
  const time = Date.parse(publishedAt || "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / (60 * 60 * 1000));
}

function songiApifyDiscoveryRows(platform, keyword, items) {
  const rows = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== "object" || item.error) continue;
    if (platform === "tiktok") {
      const url = compactText(item.webVideoUrl, 1000);
      if (!url) continue;
      const plays = parseCount(item.playCount);
      const likes = parseCount(item.diggCount);
      const comments = parseCount(item.commentCount);
      const shares = parseCount(item.shareCount);
      rows.push({
        platform: "TikTok",
        url,
        title: compactText(item.text, 120) || "TikTok 영상",
        creator: compactText(item.authorMeta?.name, 80),
        description: compactText(item.text, 500),
        thumbnail_url: compactText(item.videoMeta?.coverUrl, 1000),
        published_at: compactText(item.createTimeISO, 40),
        content_format: "tiktok_video",
        metrics: {
          view_count: plays,
          like_count: likes,
          comment_count: comments,
          share_count: shares,
          save_count: parseCount(item.collectCount),
          duration_seconds: Math.round(Number(item.videoMeta?.duration || 0)),
          is_short_form: true,
          engagement_rate: plays > 0 ? (likes + comments + shares) / plays : 0,
          language: compactText(item.textLanguage, 12),
        },
      });
      continue;
    }
    if (platform === "threads") {
      const url = compactText(item.url, 1000);
      if (!url) continue;
      rows.push({
        platform: "Threads",
        url,
        title: compactText(item.text, 120) || "Threads 게시물",
        creator: compactText(item.fullName || item.username, 80),
        description: compactText(item.text, 500),
        thumbnail_url: "",
        published_at: compactText(item.date, 40),
        content_format: "threads_post",
        metrics: {
          like_count: parseCount(item.likeCount),
          comment_count: parseCount(item.replyCount),
          share_count: parseCount(item.repostCount) + parseCount(item.quoteCount),
          media_type: compactText(item.mediaType, 20),
        },
      });
      continue;
    }
    if (platform === "instagram") {
      const url = compactText(item.url, 1000);
      if (!url) continue;
      const views = parseCount(item.videoViewCount || item.videoPlayCount);
      const likes = parseCount(item.likesCount);
      const comments = parseCount(item.commentsCount);
      rows.push({
        platform: "Instagram",
        url,
        title: compactText(item.caption, 120) || "Instagram 게시물",
        creator: compactText(item.ownerFullName || item.ownerUsername, 80),
        description: compactText(item.caption, 500),
        thumbnail_url: compactText(item.displayUrl || (Array.isArray(item.images) ? item.images[0] : ""), 1000),
        published_at: compactText(item.timestamp, 40),
        content_format: String(item.type || "").toLowerCase() === "video" ? "instagram_reel" : "instagram_post",
        metrics: {
          view_count: views,
          like_count: likes,
          comment_count: comments,
          is_short_form: String(item.type || "").toLowerCase() === "video",
          engagement_rate: views > 0 ? (likes + comments) / views : 0,
        },
      });
      continue;
    }
    if (platform === "meta_ads") {
      const snapshot = item.snapshot && typeof item.snapshot === "object" ? item.snapshot : {};
      const bodyText = compactText(snapshot.body?.text, 500);
      const url = compactText(item.ad_library_url || item.url, 1000)
        || (item.ad_archive_id ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(item.ad_archive_id)}` : "");
      if (!url) continue;
      const firstVideo = Array.isArray(snapshot.videos) ? snapshot.videos[0] : null;
      const firstImage = Array.isArray(snapshot.images) ? snapshot.images[0] : null;
      const publishedAt = compactText(item.start_date_formatted, 40)
        || (Number(item.start_date) ? new Date(Number(item.start_date) * 1000).toISOString() : "");
      rows.push({
        platform: "Meta 광고",
        url,
        title: compactText(snapshot.title, 120) || bodyText.slice(0, 120) || `${compactText(item.page_name, 60) || "광고주"} 광고`,
        creator: compactText(item.page_name || snapshot.page_name, 80),
        description: cleanMultilineText([
          bodyText,
          snapshot.cta_text ? `CTA: ${compactText(snapshot.cta_text, 60)}` : "",
          snapshot.link_url ? `랜딩: ${compactText(snapshot.link_url, 200)}` : "",
        ].filter(Boolean).join("\n"), 600),
        thumbnail_url: compactText(
          firstVideo?.video_preview_image_url || (typeof firstImage === "string" ? firstImage : firstImage?.original_image_url || firstImage?.resized_image_url) || snapshot.page_profile_picture_url,
          1000,
        ),
        published_at: publishedAt,
        content_format: String(snapshot.display_format || "").toLowerCase() === "video" ? "meta_video_ad" : "meta_ad",
        metrics: {
          like_count: parseCount(snapshot.page_like_count),
          ad_variant_count: parseCount(item.collation_count || item.ads_count),
          is_active_ad: Boolean(item.is_active),
        },
      });
      continue;
    }
  }
  const seen = new Set();
  return rows
    .map((row) => ({ ...row, keyword, url: safeExternalHttpUrl(row.url), thumbnail_url: safeExternalHttpUrl(row.thumbnail_url) }))
    .filter((row) => {
      if (!row.url || seen.has(row.url)) return false;
      seen.add(row.url);
      return true;
    });
}

function scoreSongiApifyCandidates(rows, sortMode = "top") {
  const maxViews = Math.max(1, ...rows.map((row) => Number(row.metrics?.view_count || 0)));
  const maxLikes = Math.max(1, ...rows.map((row) => Number(row.metrics?.like_count || 0)));
  const scored = rows.map((row) => {
    const metrics = row.metrics || {};
    const ageHours = songiDiscoveryAgeHours(row.published_at);
    const recencyScore = ageHours == null ? 0.4 : Math.max(0, Math.min(1, 1 - ageHours / (24 * 30)));
    const viewScore = Math.min(1, Number(metrics.view_count || 0) / maxViews);
    const likeScore = Math.min(1, Number(metrics.like_count || 0) / maxLikes);
    const popularity = metrics.view_count ? viewScore * 0.6 + likeScore * 0.4 : likeScore;
    const activeBoost = metrics.is_active_ad ? 0.15 : 0;
    const weighted = sortMode === "recent"
      ? recencyScore * 0.7 + popularity * 0.3
      : popularity * 0.75 + recencyScore * 0.25;
    const candidateScore = Math.round(Math.max(0, Math.min(1, weighted + activeBoost)) * 100);
    const reasonParts = [
      Number(metrics.view_count || 0) ? `조회수 ${Number(metrics.view_count).toLocaleString("ko-KR")}` : "",
      Number(metrics.like_count || 0) ? `좋아요 ${Number(metrics.like_count).toLocaleString("ko-KR")}` : "",
      Number(metrics.comment_count || 0) ? `댓글 ${Number(metrics.comment_count).toLocaleString("ko-KR")}` : "",
      Number(metrics.ad_variant_count || 0) ? `광고 변형 ${Number(metrics.ad_variant_count)}개` : "",
      metrics.is_active_ad ? "현재 집행 중 광고" : "",
      ageHours != null && ageHours <= 72 ? "최근 3일 내 게시" : "",
      metrics.language && metrics.language !== "ko" ? `언어 ${metrics.language}` : "",
    ].filter(Boolean);
    return {
      ...row,
      candidate_score: candidateScore,
      reason: reasonParts.join(" · ") || (sortMode === "recent" ? "최신 공개 게시물 기준 후보입니다." : "공개 반응 지표 기준 후보입니다."),
      measurement_badge: "Apify 공개 수집",
      confidence_label: "공개 지표 기반",
    };
  });
  return scored.sort((a, b) => Number(b.candidate_score || 0) - Number(a.candidate_score || 0));
}

function songiApifyDiscoverySourceText(candidate) {
  const metrics = candidate.metrics || {};
  return cleanMultilineText([
    `${candidate.platform || "SNS"} 키워드 벤치마킹 후보`,
    `키워드: ${candidate.keyword || ""}`,
    `제목/본문 요약: ${candidate.title || ""}`,
    `작성자/광고주: ${candidate.creator || ""}`,
    `게시일: ${candidate.published_at || ""}`,
    Number(metrics.view_count || 0) ? `조회수: ${Number(metrics.view_count).toLocaleString("ko-KR")}` : "",
    Number(metrics.like_count || 0) ? `좋아요: ${Number(metrics.like_count).toLocaleString("ko-KR")}` : "",
    Number(metrics.comment_count || 0) ? `댓글: ${Number(metrics.comment_count).toLocaleString("ko-KR")}` : "",
    Number(metrics.share_count || 0) ? `공유/리포스트: ${Number(metrics.share_count).toLocaleString("ko-KR")}` : "",
    Number(metrics.ad_variant_count || 0) ? `광고 변형 수: ${Number(metrics.ad_variant_count)}` : "",
    metrics.is_active_ad ? "상태: 현재 집행 중 광고" : "",
    candidate.reason ? `선정 이유: ${candidate.reason}` : "",
    candidate.description ? `본문:\n${candidate.description}` : "",
    `원본 링크: ${candidate.url || ""}`,
  ].filter(Boolean).join("\n"), 8000);
}

function materializeSongiApifyDiscoveryCandidates(research, run, userId, rows, options = {}) {
  const project = research.projects.find((item) => item.id === run.project_id && item.user_id === userId);
  const maxResults = boundedInteger(run.max_results, 12, 1, 25);
  const candidates = scoreSongiApifyCandidates(rows.slice(0, maxResults), options.sortMode || "top").map((candidate) => ({
    id: crypto.randomUUID(),
    run_id: run.id,
    user_id: userId,
    project_id: run.project_id,
    keyword: run.keyword,
    created_at: nowIso(),
    expires_at: run.expires_at || new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    ...candidate,
  }));
  for (const candidate of candidates) {
    candidate.source_text = songiApifyDiscoverySourceText(candidate);
  }
  research.discovery_candidates = (research.discovery_candidates || []).filter((candidate) => candidate.run_id !== run.id);
  research.discovery_candidates.push(...candidates);
  run.status = "completed";
  run.result_count = candidates.length;
  run.error = "";
  run.error_detail = "";
  run.source_mode = compactText(options.sourceMode || "server_apify", 80);
  run.updated_at = nowIso();
  if (project) project.updated_at = run.updated_at;
  pruneResearchDiscovery(research);
  return candidates;
}

function songiApifyDiscoveryErrorInfo(error, platform) {
  const status = Number(error?.status || 0);
  const detail = String(error?.detail || error?.message || "").toLowerCase();
  if (status === 401 || /token.*(invalid|not valid)|user was not found/i.test(detail)) {
    return {
      code: "research_apify_invalid_token",
      message: "Apify 키가 유효하지 않습니다. 설정 > AI/API 연결에서 키를 다시 저장해주세요.",
    };
  }
  if (status === 402 || /payment|credit|usage hard limit|exceeded/.test(detail)) {
    return {
      code: "research_apify_credit_exhausted",
      message: "Apify 크레딧이 부족합니다. Apify 콘솔에서 잔액을 확인하거나 플랜을 올린 뒤 다시 시도해주세요.",
    };
  }
  if (String(error?.code || "") === "research_apify_run_still_running") {
    return {
      code: "research_apify_run_still_running",
      message: "Apify 수집이 평소보다 오래 걸리고 있습니다. 1~2분 뒤 다시 시도해주세요.",
    };
  }
  if (String(error?.code || "") === "research_apify_no_items" || /no_items/.test(detail)) {
    return songiApifyEmptyResultInfo(platform);
  }
  return {
    code: String(error?.code || "research_apify_discovery_failed"),
    message: "Apify 수집 실행이 실패했습니다. 잠시 뒤 다시 시도해주세요.",
  };
}

function parseJson3TranscriptText(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const parts = [];
  for (const event of events) {
    const segs = Array.isArray(event?.segs) ? event.segs : [];
    const text = segs.map((seg) => String(seg?.utf8 || "")).join("");
    if (text.trim()) parts.push(text.replace(/\s+/g, " ").trim());
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function parseVttTranscriptText(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .filter((line) => line && !/^WEBVTT/i.test(line) && !/^\d+$/.test(line.trim()) && !/-->/.test(line) && !/^(Kind|Language):/i.test(line))
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .filter((line, index, lines) => line !== lines[index - 1])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickYouTubeSubtitleTrack(info) {
  const sources = [info?.subtitles, info?.automatic_captions];
  const langPriority = ["ko", "ko-orig", "en", "en-orig"];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const available = Object.keys(source);
    const lang = langPriority.find((code) => available.includes(code))
      || available.find((code) => code.startsWith("ko"))
      || available.find((code) => code.startsWith("en"));
    if (!lang) continue;
    const entries = Array.isArray(source[lang]) ? source[lang] : [];
    const entry = entries.find((row) => row?.ext === "json3") || entries.find((row) => row?.ext === "vtt") || entries[0];
    if (entry?.url) return { lang, ext: entry.ext || "", url: entry.url };
  }
  return null;
}

async function fetchYouTubeAutoTranscript(url) {
  const result = await runBoundedProcess(songiYtDlpPath(), [
    "--skip-download",
    "--no-warnings",
    "--no-playlist",
    "--dump-single-json",
    url,
  ], {
    timeoutMs: 45000,
    maxOutput: 6 * 1024 * 1024,
    errorCode: "server_ytdlp_subtitle_failed",
    timeoutCode: "server_ytdlp_subtitle_timeout",
    missingCode: "server_ytdlp_missing",
    missingMessage: "YouTube 자막 도구를 찾지 못했습니다.",
  });
  let info = null;
  try {
    info = JSON.parse(String(result.stdout || "").trim());
  } catch (_error) {
    return "";
  }
  const track = pickYouTubeSubtitleTrack(info);
  if (!track) return "";
  const response = await requestExternalJson(track.url, { timeoutMs: 20000, maxBytes: 4 * 1024 * 1024 });
  const text = track.ext === "json3" || response.json
    ? parseJson3TranscriptText(response.json)
    : parseVttTranscriptText(response.text);
  return compactText(text, 6000);
}

function songiApifyEmptyResultInfo(platform) {
  if (platform === "instagram") {
    return {
      code: "research_apify_no_items",
      message: "수집 결과가 비어 있습니다. 인스타그램이 제한한 해시태그(의료·시술 등)일 수 있으니 비슷한 다른 키워드로 시도해주세요.",
    };
  }
  return {
    code: "research_apify_no_items",
    message: "이 키워드로 수집된 공개 게시물이 없습니다. 키워드를 바꿔 다시 시도해주세요.",
  };
}

function readObjectPath(value, pathExpression) {
  return String(pathExpression || "").split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return current[key];
  }, value);
}

function firstResearchString(value, paths, maxLength = 500) {
  for (const pathExpression of paths) {
    const raw = readObjectPath(value, pathExpression);
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      const joined = raw.map((item) => typeof item === "string" ? item : item?.name || item?.tag || item?.text || "").filter(Boolean).join(", ");
      if (joined) return compactText(joined, maxLength);
      continue;
    }
    if (typeof raw === "object") continue;
    const text = compactText(raw, maxLength);
    if (text) return text;
  }
  return "";
}

function firstResearchNumber(value, paths) {
  for (const pathExpression of paths) {
    const raw = readObjectPath(value, pathExpression);
    const number = Number(raw);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function numberLabel(value) {
  return Number.isFinite(value) ? value.toLocaleString("ko-KR") : "";
}

function instagramUsernameFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!/instagram\.com$/i.test(parsed.hostname.replace(/^www\./i, ""))) return "";
    const first = parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (!first || ["p", "reel", "reels", "tv", "stories", "explore"].includes(first.toLowerCase())) return "";
    return first.replace(/^@/, "").trim();
  } catch (_error) {
    return raw.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "").trim();
  }
}

function apifyProfileRunConfigForInstagram(profileUrl) {
  const username = instagramUsernameFromUrl(profileUrl);
  if (!username) return null;
  return {
    actorId: SONGI_APIFY_INSTAGRAM_PROFILE_ACTOR,
    platform: "Instagram Profile",
    datasetLimit: 1,
    input: {
      usernames: [username],
      includeAboutSection: false,
    },
    username,
  };
}

async function runApifyInstagramProfileCollection(profileUrl, token, existingRunId = "") {
  const config = apifyProfileRunConfigForInstagram(profileUrl);
  if (!config) {
    throw blockedResearchFetchError("research_apify_profile_not_supported", "Instagram 프로필 URL 또는 사용자명을 확인해주세요.");
  }
  return runApifyCollection(config, token, existingRunId);
}

function apifyProfileItemsToProjectProfile(result, profileUrl) {
  const item = result.items[0] || {};
  const username = firstResearchString(item, ["username", "userName", "ownerUsername"], 120) || instagramUsernameFromUrl(profileUrl);
  const fullName = firstResearchString(item, ["fullName", "full_name", "name"], 160);
  const biography = firstResearchString(item, ["biography", "bio", "description"], 1200);
  const category = firstResearchString(item, ["businessCategoryName", "categoryName", "business_category_name", "externalUrl"], 200);
  const followers = firstResearchNumber(item, ["followersCount", "followers", "followerCount"]);
  const following = firstResearchNumber(item, ["followsCount", "followingCount", "following"]);
  const posts = firstResearchNumber(item, ["postsCount", "mediaCount", "posts"]);
  const latest = Array.isArray(item.latestPosts)
    ? item.latestPosts
    : Array.isArray(item.latestIgtvVideos)
      ? item.latestIgtvVideos
      : [];
  const latestLines = latest.slice(0, 5).map((post, index) => {
    const caption = firstResearchString(post, ["caption", "text", "description"], 180);
    const url = firstResearchString(post, ["url", "shortCode"], 220);
    const likes = firstResearchNumber(post, ["likesCount", "likeCount", "likes"]);
    return [`최근 콘텐츠 ${index + 1}: ${caption || url || "내용 없음"}`, likes != null ? `좋아요 ${numberLabel(likes)}` : ""].filter(Boolean).join(" · ");
  });
  const lines = [
    `Apify Actor: ${result.actorId}`,
    `프로필 URL: ${profileUrl}`,
    username ? `사용자명: ${username}` : "",
    fullName ? `이름: ${fullName}` : "",
    category ? `카테고리/외부 링크: ${category}` : "",
    biography ? `소개글:\n${biography}` : "",
    [followers != null ? `팔로워 ${numberLabel(followers)}` : "", following != null ? `팔로잉 ${numberLabel(following)}` : "", posts != null ? `게시물 ${numberLabel(posts)}` : ""].filter(Boolean).join(" · "),
    latestLines.length ? `최근 콘텐츠:\n${latestLines.join("\n")}` : "",
  ].filter(Boolean);
  return {
    profile_source_text: cleanMultilineText(lines.join("\n\n"), 6000),
    profile_snapshot: {
      username,
      full_name: fullName,
      biography,
      category,
      followers,
      following,
      posts,
      latest: latestLines,
    },
  };
}

function apifyItemsToResearchSource(result, url) {
  const item = result.items[0] || {};
  const caption = firstResearchString(item, ["caption", "text", "description", "title", "alt", "shortCode"], 1200);
  const author = firstResearchString(item, [
    "ownerUsername",
    "ownerFullName",
    "username",
    "authorMeta.name",
    "authorMeta.nickName",
    "author.username",
    "author.name",
  ], 180);
  const hashtags = firstResearchString(item, ["hashtags", "hashtags.name", "tags"], 500);
  const transcript = firstResearchString(item, ["transcript", "videoTranscript", "subtitle", "subtitles", "audioTranscript"], 3000);
  const views = firstResearchNumber(item, ["videoViewCount", "videoPlayCount", "playCount", "viewCount", "views"]);
  const likes = firstResearchNumber(item, ["likesCount", "likeCount", "diggCount", "likes"]);
  const comments = firstResearchNumber(item, ["commentsCount", "commentCount", "comments"]);
  const shares = firstResearchNumber(item, ["sharesCount", "shareCount", "shares"]);
  const collectedUrl = firstResearchString(item, ["url", "inputUrl", "webVideoUrl", "submittedVideoUrl", "shortCode"], 500);
  const lines = [
    `Apify Actor: ${result.actorId}`,
    `플랫폼: ${result.platform}`,
    `원본 URL: ${url}`,
    collectedUrl && collectedUrl !== url ? `수집 URL: ${collectedUrl}` : "",
    author ? `작성자: ${author}` : "",
    caption ? `캡션/본문:\n${caption}` : "",
    hashtags ? `해시태그: ${hashtags}` : "",
    [views != null ? `조회 ${numberLabel(views)}` : "", likes != null ? `좋아요 ${numberLabel(likes)}` : "", comments != null ? `댓글 ${numberLabel(comments)}` : "", shares != null ? `공유 ${numberLabel(shares)}` : ""].filter(Boolean).join(" · "),
    transcript ? `스크립트:\n${transcript}` : "",
  ].filter(Boolean);
  return {
    title: compactText(caption || collectedUrl || url, 180),
    source_text: cleanMultilineText(lines.join("\n\n"), 8000),
    tags: normalizeResearchTags([result.platform, ...String(hashtags || "").split(/[,#\s]+/)]),
  };
}

function extractGeminiText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim();
}

function parseJsonObjectFromText(text) {
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

function stringList(value, limit = 5, itemLimit = 180) {
  const rows = Array.isArray(value) ? value : String(value || "").split(/\n+/);
  return rows
    .map((item) => compactText(item, itemLimit))
    .filter(Boolean)
    .slice(0, limit);
}

function flowList(value, fallback = [], limit = 6) {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          timestamp: index === 0 ? "0:00" : `구간 ${index + 1}`,
          description: compactText(item, 260),
        };
      }
      return {
        timestamp: compactText(item?.timestamp || item?.time || `구간 ${index + 1}`, 40),
        description: compactText(item?.description || item?.text || item?.note, 260),
      };
    })
    .filter((item) => item.description)
    .slice(0, limit);
  if (normalized.length) return normalized;
  return (Array.isArray(fallback) ? fallback : []).slice(0, limit);
}

function performanceReasonsObject(value, fallback = {}) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const base = fallback && typeof fallback === "object" && !Array.isArray(fallback) ? fallback : {};
  return {
    views: compactText(data.views || data.view || base.views, 240),
    likes: compactText(data.likes || data.like || base.likes, 240),
    comments: compactText(data.comments || data.comment || base.comments, 240),
    saves: compactText(data.saves || data.save || data.storage || base.saves, 240),
  };
}

function sanitizeGeminiResearchAnalysis(value, fallback) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    summary: compactText(data.summary, 220) || fallback.summary,
    transcript: cleanMultilineText(data.transcript || fallback.transcript, 8000),
    tags: normalizeResearchTags(data.tags?.length ? data.tags : fallback.tags),
    insights: stringList(data.insights?.length ? data.insights : fallback.insights, 5, 220),
    hooks: stringList(data.hooks?.length ? data.hooks : fallback.hooks, 5, 220),
    flow: flowList(data.flow, fallback.flow, 6),
    benchmarking: stringList(data.benchmarking?.length ? data.benchmarking : fallback.benchmarking, 6, 240),
    copywriting_points: stringList(data.copywriting_points?.length ? data.copywriting_points : fallback.copywriting_points, 5, 220),
    visual_cues: stringList(data.visual_cues?.length ? data.visual_cues : fallback.visual_cues, 6, 220),
    performance_reasons: performanceReasonsObject(data.performance_reasons, fallback.performance_reasons),
    hook_note: compactText(data.hook_note, 260) || fallback.hook_note,
    copy_note: compactText(data.copy_note, 260) || fallback.copy_note,
    structure_note: compactText(data.structure_note, 320) || fallback.structure_note,
    performance_note: compactText(data.performance_note, 320) || fallback.performance_note,
    personalized_plan: cleanMultilineText(data.personalized_plan || fallback.personalized_plan, 1600),
    script_brief: cleanMultilineText(data.script_brief || fallback.script_brief, 1600),
  };
}

function buildGeminiResearchPrompt(item) {
  const source = cleanMultilineText(item.source_text || "", 6500);
  const media = item.gemini_media_context || {};
  const mediaLine = media.status === "attached"
    ? `첨부 영상: ${media.source || "video"} · ${media.mime_type || "video"} · ${Math.round(Number(media.bytes || 0) / 1024 / 1024 * 10) / 10}MB · 처음 ${media.duration_cap_seconds || SONGI_VIDEO_MAX_SECONDS}초 중심`
    : media.note || "첨부 영상: 없음. 수집된 제목/자막/본문만 근거로 분석";
  return [
    "너는 AIMAX 자료조사원 송이다. 아래 벤치마킹 자료를 숏폼 제작자가 바로 활용할 수 있는 콘텐츠 기획 브리프로 정리해라.",
    "규칙: 확인되지 않은 성과 수치를 만들지 말고, 조회수/좋아요 같은 숫자는 원문에 있을 때만 언급한다. 한국어로 답한다. Markdown 없이 JSON 객체만 출력한다.",
    "영상이 첨부되어 있으면 화면 전환, 자막/오버레이, 장면 밀도, 초반 3초 후킹을 우선 분석한다. 영상이 없으면 수집된 원문과 자막만 근거로 한다.",
    "반드시 viral shorts 분석 3관점인 hooks, flow, benchmarking을 작성한다. flow는 timestamp와 description 객체 배열이다.",
    "PRD 기준으로 copywriting_points, visual_cues, performance_reasons.views/likes/comments/saves도 작성한다. 저장수 실제값이 없으면 saves는 저장 유도 가능성으로 표현한다.",
    "JSON 스키마: {\"summary\":\"...\",\"transcript\":\"...\",\"tags\":[\"...\"],\"insights\":[\"...\"],\"hooks\":[\"...\"],\"flow\":[{\"timestamp\":\"0:00-0:03\",\"description\":\"...\"}],\"benchmarking\":[\"...\"],\"copywriting_points\":[\"...\"],\"visual_cues\":[\"...\"],\"performance_reasons\":{\"views\":\"...\",\"likes\":\"...\",\"comments\":\"...\",\"saves\":\"...\"},\"hook_note\":\"...\",\"copy_note\":\"...\",\"structure_note\":\"...\",\"performance_note\":\"...\",\"personalized_plan\":\"...\",\"script_brief\":\"...\"}",
    "",
    `제목: ${item.title || ""}`,
    `URL: ${item.url || ""}`,
    `플랫폼: ${item.platform || ""}`,
    mediaLine,
    `카테고리: ${item.category || ""}`,
    `사용자 인스타그램 프로필: ${item.instagram_profile_url || ""}`,
    `사용자 영상 카테고리: ${item.content_category || ""}`,
    `사용자 영상 주제: ${item.content_topic || ""}`,
    `기존 메모: ${item.memo || ""}`,
    "",
    "자료 원문:",
    source || "(원문 없음)",
  ].join("\n");
}

function researchMediaCacheDir() {
  return path.join(RESEARCH_DATA_DIR, "media-cache");
}

function researchHtmlAssetDir() {
  return path.join(researchHtmlDir(), "assets");
}

function isYouTubeResearchUrl(url) {
  return /youtu\.be|youtube\.com/i.test(String(url || ""));
}

function safeMediaCacheBase(item) {
  const hash = crypto.createHash("sha256")
    .update(`${item.id || ""}:${item.url || ""}`)
    .digest("hex")
    .slice(0, 20);
  return `songi-${hash}`;
}

function videoMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mkv") return "video/x-matroska";
  return "video/mp4";
}

function parseResearchTimestampSeconds(value) {
  const raw = String(value || "").trim();
  if (!raw || /마무리|끝|end/i.test(raw)) return null;
  const first = raw.split(/[-~–—]/)[0].trim();
  const match = first.match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?|(\d+(?:\.\d+)?)\s*s/i);
  if (!match) return null;
  if (match[4] != null) return Number(match[4]);
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? total : null;
}

function uniqueFrameMoments(flow, limit = 6) {
  const seen = new Set();
  return flowList(flow, [], limit * 2)
    .map((entry) => ({ ...entry, seconds: parseResearchTimestampSeconds(entry.timestamp) }))
    .filter((entry) => Number.isFinite(entry.seconds) && entry.seconds >= 0)
    .filter((entry) => {
      const key = Math.round(entry.seconds * 10);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function findResearchMediaFile(basePath) {
  const dir = path.dirname(basePath);
  const base = path.basename(basePath);
  const exts = new Set([".mp4", ".webm", ".mov", ".mkv"]);
  if (!fs.existsSync(dir)) return "";
  const files = fs.readdirSync(dir)
    .filter((file) => file.startsWith(base) && exts.has(path.extname(file).toLowerCase()))
    .map((file) => path.join(dir, file))
    .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || "";
}

function runBoundedProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const normalizedCommand = normalizeExecutableCommand(command, command);
    const useWindowsShell = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(normalizedCommand);
    const child = childProcess.spawn(normalizedCommand, args, {
      cwd: options.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: useWindowsShell,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const maxOutput = options.maxOutput || 12000;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      const error = blockedResearchFetchError(options.timeoutCode || "research_video_download_timeout", "영상 다운로드 시간이 초과되었습니다.");
      error.stderr = stderr.slice(-maxOutput);
      reject(error);
    }, options.timeoutMs || 120000);
    const append = (current, chunk) => (current + chunk.toString("utf8")).slice(-maxOutput);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        const missing = blockedResearchFetchError(
          options.missingCode || options.errorCode || "research_tool_not_found",
          options.missingMessage || `${normalizedCommand} 실행 파일을 찾지 못했습니다.`,
        );
        missing.stderr = String(error.message || "");
        reject(missing);
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const error = blockedResearchFetchError(options.errorCode || "research_video_download_failed", "영상 다운로드가 실패했습니다.");
        error.stderr = stderr.slice(-maxOutput);
        error.stdout = stdout.slice(-maxOutput);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function downloadYouTubeVideoForGemini(item) {
  const missingTool = researchMediaToolMissingCode();
  if (missingTool) {
    const message = missingTool === "research_video_downloader_missing"
      ? "yt-dlp 실행 파일을 찾지 못했습니다."
      : "ffmpeg 실행 파일을 찾지 못했습니다.";
    throw blockedResearchFetchError(missingTool, message);
  }
  const maxBytes = Number.isFinite(SONGI_VIDEO_MAX_BYTES) ? SONGI_VIDEO_MAX_BYTES : 18 * 1024 * 1024;
  const maxMb = Math.max(4, Math.ceil(maxBytes / 1024 / 1024));
  const maxSeconds = Number.isFinite(SONGI_VIDEO_MAX_SECONDS) ? SONGI_VIDEO_MAX_SECONDS : 90;
  const cacheDir = researchMediaCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const basePath = path.join(cacheDir, safeMediaCacheBase(item));
  const cachedFile = findResearchMediaFile(basePath);
  if (cachedFile && fs.statSync(cachedFile).size <= maxBytes) {
    return { filePath: cachedFile, cached: true };
  }
  const outputTemplate = `${basePath}.%(ext)s`;
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--force-overwrites",
    "--max-filesize", `${maxMb}m`,
    "--download-sections", `*0-${Math.max(15, maxSeconds)}`,
    "-f", SONGI_VIDEO_FORMAT,
    "--merge-output-format", "mp4",
    "-o", outputTemplate,
    item.url,
  ];
  await runBoundedProcess(songiYtDlpPath(), args, {
    timeoutMs: Math.max(60000, Math.min(240000, maxSeconds * 2500)),
    errorCode: "research_video_download_failed",
    missingCode: "research_video_downloader_missing",
    missingMessage: "yt-dlp 실행 파일을 찾지 못했습니다.",
  });
  const filePath = findResearchMediaFile(basePath);
  if (!filePath) throw blockedResearchFetchError("research_video_download_missing_file", "다운로드된 영상 파일을 찾지 못했습니다.");
  const size = fs.statSync(filePath).size;
  if (size > maxBytes) {
    throw blockedResearchFetchError("research_video_too_large", "Gemini에 전달할 영상 파일이 너무 큽니다.");
  }
  return { filePath, cached: false };
}

async function prepareGeminiVideoContext(item, options = {}) {
  if (options.includeVideo === false) {
    return { parts: [], context: { status: "skipped", note: "영상 첨부: 사용자가 영상 분석을 끔" }, filePath: "" };
  }
  if (!item.url || !isYouTubeResearchUrl(item.url)) {
    return { parts: [], context: { status: "unsupported", note: "영상 첨부: 현재 백엔드 직접 영상 분석은 YouTube 링크부터 지원" }, filePath: "" };
  }
  try {
    const downloaded = await downloadYouTubeVideoForGemini(item);
    const bytes = fs.readFileSync(downloaded.filePath);
    const mimeType = videoMimeType(downloaded.filePath);
    return {
      parts: [{ inlineData: { data: bytes.toString("base64"), mimeType } }],
      context: {
        status: "attached",
        source: "youtube_yt_dlp",
        mime_type: mimeType,
        bytes: bytes.length,
        cached: downloaded.cached,
        duration_cap_seconds: Number.isFinite(SONGI_VIDEO_MAX_SECONDS) ? SONGI_VIDEO_MAX_SECONDS : 90,
      },
      filePath: downloaded.filePath,
    };
  } catch (error) {
    const code = researchFetchErrorCode(error);
    return {
      parts: [],
      context: {
        status: "failed",
        error: code,
        note: `영상 첨부 실패: ${code}. 수집된 제목/자막/본문 기준으로 분석`,
      },
      filePath: "",
    };
  }
}

async function extractSongiFlowFrames(item, mediaFilePath, flow) {
  if (!mediaFilePath || !fs.existsSync(mediaFilePath)) {
    return { status: "skipped", error: "", captures: [] };
  }
  if (!researchMediaToolStatus().frame_extract.available) {
    return { status: "failed", error: "research_frame_extractor_missing", captures: [] };
  }
  const moments = uniqueFrameMoments(flow, 6);
  if (!moments.length) return { status: "skipped", error: "no_timestamps", captures: [] };
  const assetDir = researchHtmlAssetDir();
  fs.mkdirSync(assetDir, { recursive: true });
  const maxWidth = Number.isFinite(SONGI_FRAME_MAX_WIDTH) ? SONGI_FRAME_MAX_WIDTH : 720;
  const captures = [];
  let lastError = "";
  for (const [index, moment] of moments.entries()) {
    const secondsKey = String(Math.round(moment.seconds * 10)).padStart(4, "0");
    const filename = `${safeMediaCacheBase(item)}-frame-${String(index + 1).padStart(2, "0")}-${secondsKey}.jpg`;
    const outputPath = path.join(assetDir, filename);
    const args = [
      "-y",
      "-ss", String(Math.max(0, moment.seconds)),
      "-i", mediaFilePath,
      "-frames:v", "1",
      "-vf", `scale='min(${Math.max(320, maxWidth)},iw)':-2`,
      "-q:v", "3",
      outputPath,
    ];
    try {
      await runBoundedProcess(songiFfmpegPath(), args, {
        timeoutMs: 30000,
        errorCode: "research_frame_extract_failed",
        missingCode: "research_frame_extractor_missing",
        missingMessage: "ffmpeg 실행 파일을 찾지 못했습니다.",
      });
      if (fs.existsSync(outputPath)) {
        captures.push({
          timestamp: moment.timestamp,
          description: compactText(moment.description, 180),
          file: `assets/${filename}`,
          image_url: `/research-html/assets/${filename}`,
        });
      }
    } catch (error) {
      lastError = researchFetchErrorCode(error);
    }
  }
  return {
    status: captures.length ? "completed" : "failed",
    error: captures.length ? "" : (lastError || "research_frame_extract_failed"),
    captures,
  };
}

async function runGeminiResearchAnalysis(item, apiKey, model, options = {}) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const media = await prepareGeminiVideoContext(item, options);
  const promptItem = { ...item, gemini_media_context: media.context };
  const response = await requestExternalJson(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
    },
    body: {
      contents: [
        {
          role: "user",
          parts: [...media.parts, { text: buildGeminiResearchPrompt(promptItem) }],
        },
      ],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            transcript: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            insights: { type: "array", items: { type: "string" } },
            hooks: { type: "array", items: { type: "string" } },
            flow: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  timestamp: { type: "string" },
                  description: { type: "string" },
                },
                required: ["timestamp", "description"],
              },
            },
            benchmarking: { type: "array", items: { type: "string" } },
            copywriting_points: { type: "array", items: { type: "string" } },
            visual_cues: { type: "array", items: { type: "string" } },
            performance_reasons: {
              type: "object",
              properties: {
                views: { type: "string" },
                likes: { type: "string" },
                comments: { type: "string" },
                saves: { type: "string" },
              },
              required: ["views", "likes", "comments", "saves"],
            },
            hook_note: { type: "string" },
            copy_note: { type: "string" },
            structure_note: { type: "string" },
            performance_note: { type: "string" },
            personalized_plan: { type: "string" },
            script_brief: { type: "string" },
          },
          required: ["summary", "transcript", "tags", "insights", "hooks", "flow", "benchmarking", "copywriting_points", "visual_cues", "performance_reasons", "hook_note", "copy_note", "structure_note", "performance_note", "personalized_plan", "script_brief"],
        },
      },
    },
    timeoutMs: 60000,
    maxBytes: 1024 * 1024,
  });
  const text = extractGeminiText(response.json);
  const parsed = parseJsonObjectFromText(text);
  if (!parsed) {
    throw blockedResearchFetchError("research_gemini_invalid_json", "Gemini 분석 응답을 해석하지 못했습니다.");
  }
  return {
    analysis: sanitizeGeminiResearchAnalysis(parsed, analyzeResearchInput(item)),
    usage: response.json?.usageMetadata || {},
    media: media.context,
    media_file_path: media.filePath || "",
  };
}

function canUseResearch(user) {
  if (!canExecute(user)) return false;
  return productAllowed(user, "songi");
}

function publicResearchProject(project) {
  return {
    id: project.id,
    name: project.name,
    goal: project.goal || "",
    industry: project.industry || "",
    instagram_profile_url: project.instagram_profile_url || "",
    content_category: project.content_category || "",
    content_topic: project.content_topic || "",
    profile_fetch_status: project.profile_fetch_status || "",
    profile_fetch_error: project.profile_fetch_error || "",
    profile_fetched_at: project.profile_fetched_at || "",
    profile_source_text: project.profile_source_text || "",
    profile_snapshot: project.profile_snapshot || null,
    profile_apify_status_url: project.profile_apify_collection?.status_url || "",
    profile_apify_actor_id: project.profile_apify_collection?.actor_id || "",
    handoff_md_file: path.join(researchMarkdownDir(), researchProjectMarkdownFilename(project)),
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

function publicResearchItem(item) {
  return {
    id: item.id,
    project_id: item.project_id,
    type: item.type || "reference",
    url: item.url || "",
    title: item.title || "",
    platform: item.platform || "직접 입력",
    category: item.category || "일반 자료",
    instagram_profile_url: item.instagram_profile_url || "",
    content_category: item.content_category || "",
    content_topic: item.content_topic || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    source_text: item.source_text || "",
    summary: item.summary || "",
    transcript: item.transcript || "",
    insights: Array.isArray(item.insights) ? item.insights : [],
    hooks: Array.isArray(item.hooks) ? item.hooks : [],
    flow: Array.isArray(item.flow) ? item.flow : [],
    benchmarking: Array.isArray(item.benchmarking) ? item.benchmarking : [],
    copywriting_points: Array.isArray(item.copywriting_points) ? item.copywriting_points : [],
    visual_cues: Array.isArray(item.visual_cues) ? item.visual_cues : [],
    performance_reasons: performanceReasonsObject(item.performance_reasons),
    hook_note: item.hook_note || "",
    copy_note: item.copy_note || "",
    structure_note: item.structure_note || "",
    performance_note: item.performance_note || "",
    personalized_plan: item.personalized_plan || "",
    script_brief: item.script_brief || "",
    link_fetch_status: item.link_fetch_status || "",
    link_fetch_error: item.link_fetch_error || "",
    link_final_url: item.link_final_url || "",
    link_fetched_at: item.link_fetched_at || "",
    apify_collection_status: item.apify_collection?.status || "",
    apify_actor_id: item.apify_collection?.actor_id || "",
    apify_run_id: item.apify_collection?.run_id || "",
    apify_status_url: item.apify_collection?.status_url || "",
    apify_error: item.apify_collection?.error || "",
    ai_analysis_status: item.ai_analysis?.status || "",
    ai_analysis_model: item.ai_analysis?.model || "",
    ai_analysis_error: item.ai_analysis?.error || "",
    ai_analysis_error_detail: item.ai_analysis?.error_detail || "",
    media_analysis_status: item.ai_analysis?.media?.status || "",
    media_analysis_error: item.ai_analysis?.media?.error || "",
    media_analysis_source: item.ai_analysis?.media?.source || "",
    frame_capture_status: item.frame_capture?.status || "",
    frame_capture_error: item.frame_capture?.error || "",
    frame_captures: Array.isArray(item.frame_captures) ? item.frame_captures : [],
    memo: item.memo || "",
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function researchPersonalizationFromBody(body) {
  return {
    instagram_profile_url: compactText(body.instagram_profile_url, 500),
    content_category: compactText(body.content_category, 80),
    content_topic: compactText(body.content_topic, 160),
  };
}

function researchPersonalizationText(personalization) {
  const rows = [];
  if (personalization.instagram_profile_url) rows.push(`사용자 인스타그램 프로필: ${personalization.instagram_profile_url}`);
  if (personalization.content_category) rows.push(`사용자 영상 카테고리: ${personalization.content_category}`);
  if (personalization.content_topic) rows.push(`사용자 영상 주제: ${personalization.content_topic}`);
  return rows.length ? `사용자 맞춤 기준:\n${rows.join("\n")}` : "";
}

function normalizeResearchTags(value, limit = 8) {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[,#\n]/);
  const result = [];
  for (const tag of raw) {
    const cleaned = compactText(tag, 24).replace(/^#+/, "").trim();
    if (!cleaned) continue;
    if (result.some((item) => item.toLowerCase() === cleaned.toLowerCase())) continue;
    result.push(cleaned);
    if (result.length >= limit) break;
  }
  return result;
}

function inferResearchPlatform(url, sourceText = "") {
  const value = String(url || "").toLowerCase();
  if (/youtu\.be|youtube\.com/.test(value)) return "YouTube";
  if (/instagram\.com/.test(value)) return "Instagram";
  if (/tiktok\.com/.test(value)) return "TikTok";
  if (/threads\.net/.test(value)) return "Threads";
  if (/(^|\/\/)(x\.com|twitter\.com)/.test(value)) return "X";
  if (/naver\.com/.test(value)) return "Naver";
  if (/notion\.site|notion\.so/.test(value)) return "Notion";
  if (/arxiv\.org|doi\.org|scholar\.google/.test(value)) return "논문/리포트";
  if (/medium\.com|substack\.com|brunch\.co\.kr/.test(value)) return "아티클";
  if (value) return "웹 링크";
  return sourceText ? "직접 입력" : "미분류";
}

function inferResearchCategory(text, platform) {
  const source = `${text || ""} ${platform || ""}`.toLowerCase();
  const pairs = [
    ["숏폼 구조", /shorts|shortform|reels|릴스|쇼츠|틱톡|tiktok|youtube|instagram|3초|후킹|hook/],
    ["광고/전환", /광고|전환|구매|상담|문의|cta|랜딩|매출|세일즈|sales|conversion/],
    ["카피라이팅", /카피|제목|문구|문장|헤드라인|subtitle|caption|copy/],
    ["교육/강의", /강의|수업|교육|커리큘럼|워크샵|class|lecture|course/],
    ["트렌드", /트렌드|뉴스|업데이트|신규|사례|벤치마크|trend|news|update/],
    ["리서치 근거", /논문|리포트|조사|통계|데이터|paper|report|research|survey/],
  ];
  return pairs.find(([, pattern]) => pattern.test(source))?.[0] || "일반 자료";
}

function extractResearchKeywords(text, limit = 8) {
  const stopwords = new Set([
    "그리고", "하지만", "그래서", "이것", "저것", "있는", "없는", "하면", "합니다", "대한", "위해",
    "그대로", "보여준다", "마지막", "초반", "중간", "이렇게", "여러분", "오늘", "제가", "지금",
    "여기서", "그럼", "그리고요", "겁니다", "있습니다", "있는데요", "하는", "하게", "보시면",
    "with", "from", "this", "that", "have", "your", "about", "into", "what", "when", "where", "how",
    "https", "http", "www", "com", "the", "and", "for", "you", "are",
  ]);
  const counts = new Map();
  const tokens = String(text || "").toLowerCase().match(/[a-z0-9가-힣]{2,}/g) || [];
  for (const rawToken of tokens) {
    if (stopwords.has(rawToken)) continue;
    let token = rawToken.replace(/(으로|에서|에게|부터|까지|처럼|하고|하며|하면|한다|했다|은|는|이|가|을|를|의|와|과|로|에|도|만)$/u, "");
    if (token.length < 2) token = rawToken;
    if (stopwords.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([token]) => token);
}

function splitResearchSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+|[\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
    .slice(0, 30);
}

function extractResearchTranscript(text) {
  const source = String(text || "");
  const markers = ["자막/스크립트:", "스크립트:", "Transcript:", "transcript:"];
  for (const marker of markers) {
    const index = source.indexOf(marker);
    if (index < 0) continue;
    return cleanMultilineText(source.slice(index + marker.length), 8000);
  }
  return "";
}

function pickResearchSummary(title, text, keywords) {
  const sentences = splitResearchSentences(text);
  const scored = sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const score = keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 2 : 0), 0) + Math.max(0, 6 - index);
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score);
  const picked = scored[0]?.sentence || compactText(text, 140) || compactText(title, 120);
  if (!picked) return "아직 분석할 원문이 부족합니다. 링크와 함께 핵심 문장이나 메모를 붙여넣으면 더 쓸 수 있는 요약이 만들어집니다.";
  return compactText(picked, 180);
}

function analyzeResearchInput(input) {
  const url = compactText(input.url, 1000);
  const title = compactText(input.title, 180);
  const sourceText = cleanMultilineText(input.source_text, 8000);
  const memo = cleanMultilineText(input.memo, 2000);
  const platform = inferResearchPlatform(url, sourceText);
  const combined = [title, url, sourceText, memo].filter(Boolean).join("\n");
  const keywords = extractResearchKeywords(combined);
  const inferredCategory = inferResearchCategory(combined, platform);
  const category = compactText(input.category, 40) || inferredCategory;
  const explicitTags = normalizeResearchTags(input.tags);
  const generatedTags = normalizeResearchTags([...keywords.slice(0, 5), platform, category]);
  const tags = explicitTags.length ? explicitTags : generatedTags;
  const summary = pickResearchSummary(title || url, combined, keywords);
  const transcript = extractResearchTranscript(sourceText);
  const primaryKeyword = keywords[0] || category;
  const secondaryKeyword = keywords[1] || platform;
  const targetProfile = compactText(input.instagram_profile_url, 500);
  const targetCategory = compactText(input.content_category, 80) || category;
  const targetTopic = compactText(input.content_topic, 160) || primaryKeyword;
  const hooks = [
    `첫 3초에 "${targetTopic}" 상황을 바로 보여주고, ${primaryKeyword} 문제를 한 문장으로 압축합니다.`,
    `${secondaryKeyword} 단서를 숫자, 비교, 전후 변화 중 하나로 바꾸면 스크롤 정지 확률이 높아집니다.`,
    targetProfile ? "내 프로필의 기존 톤과 충돌하지 않게 같은 문제를 더 구체적인 사례로 시작합니다." : `${targetCategory} 시청자가 바로 알아듣는 상황어를 첫 문장에 둡니다.`,
  ];
  const flow = [
    { timestamp: "0:00-0:03", description: `문제 상황 또는 궁금증을 "${targetTopic}" 기준으로 바로 제시합니다.` },
    { timestamp: "0:03-0:08", description: `벤치마킹 자료에서 관찰한 ${primaryKeyword} 패턴을 근거로 보여줍니다.` },
    { timestamp: "0:08-0:15", description: `${targetCategory} 시청자가 따라 할 수 있는 적용 방법을 2-3단계로 압축합니다.` },
    { timestamp: "마무리", description: "저장/댓글/다음 행동을 유도하는 CTA로 닫습니다." },
  ];
  const benchmarking = [
    `그대로 베끼기보다 ${primaryKeyword} 구조를 ${targetTopic} 사례로 치환합니다.`,
    `영상 흐름은 문제 제기 -> 근거 -> 적용 -> 행동 유도로 재사용합니다.`,
    targetProfile ? "사용자 프로필의 기존 콘텐츠 톤과 맞는 단어를 우선 사용합니다." : "프로필 정보가 없으므로 카테고리와 주제를 기준으로 타깃을 좁혀야 합니다.",
  ];
  const basis = url
    ? "링크에서 읽은 제목/설명/본문 일부와 사용자가 입력한 메모를 근거로 정리합니다."
    : "사용자가 업로드하거나 붙여넣은 원문과 메모를 근거로 정리합니다.";
  return {
    platform,
    category,
    tags,
    summary,
    insights: [
      `${platform} 자료로 분류했습니다. ${basis}`,
      `반복 단서: ${primaryKeyword}, ${secondaryKeyword}. 다음 제작 직원에게는 이 키워드를 중심 축으로 넘기면 됩니다.`,
      `${category} 관점에서 바로 재활용할 수 있도록 제목, 핵심 문장, 메모를 함께 보관했습니다.`,
    ],
    transcript,
    hooks,
    flow,
    benchmarking,
    copywriting_points: [
      `"${secondaryKeyword}"를 타깃이 바로 알아듣는 상황어와 함께 배치합니다.`,
      "제목/첫 자막은 문제, 숫자, 전후 비교 중 하나로 압축합니다.",
      "마지막 문장은 저장/댓글/상담처럼 한 가지 행동만 요청합니다.",
    ],
    visual_cues: [
      "초반 장면은 상황을 설명하기보다 바로 보여주는 컷으로 시작합니다.",
      "자막은 한 화면에 한 메시지만 두고, 핵심 단어를 반복 노출합니다.",
      "흐름 전환 구간마다 손동작, 화면 확대, 텍스트 강조 같은 리듬 장치를 둡니다.",
    ],
    performance_reasons: {
      views: `초반에 ${primaryKeyword} 문제를 바로 제시하면 스크롤 정지 가능성이 높아집니다.`,
      likes: `${targetCategory} 시청자가 공감할 만한 구체 사례로 바꾸면 긍정 반응을 받기 쉽습니다.`,
      comments: "찬반, 경험 공유, 질문을 유도하는 한 문장 CTA가 있으면 댓글 가능성이 올라갑니다.",
      saves: "실행 순서나 체크리스트 형태로 정리하면 저장 유도 가능성이 생깁니다.",
    },
    hook_note: `첫 3초 또는 첫 문장에 "${primaryKeyword}" 단서를 배치하면 자료의 관심 포인트가 빨리 드러납니다.`,
    copy_note: `"${secondaryKeyword}" 단서를 구체적인 대상/상황과 함께 쓰면 카피가 덜 추상적으로 보입니다.`,
    structure_note: `추천 구조: 문제 상황 -> 참고 자료 근거 -> 관찰한 패턴 -> 우리 콘텐츠에 적용할 방식.`,
    performance_note: `실제 성과 수치가 없으면 조회수/좋아요를 단정하지 말고, 댓글 유도/저장 유도 가능성처럼 추정 표현으로 넘깁니다.`,
    personalized_plan: [
      `목표: ${targetCategory} 계정에서 "${targetTopic}" 주제로 재해석한 숏폼을 만든다.`,
      targetProfile ? `프로필 기준: ${targetProfile}` : "프로필 링크가 없으므로 카테고리/주제 입력값을 기준으로 톤을 잡는다.",
      `적용 방향: 벤치마킹 영상의 ${primaryKeyword} 단서를 내 사례/고객 상황으로 바꾼다.`,
    ].join("\n"),
    script_brief: [
      `스크립트 직원 전달용 브리프`,
      `주제: ${targetTopic}`,
      `카테고리: ${targetCategory}`,
      `후킹: ${hooks[0]}`,
      `구성: ${flow.map((item) => `${item.timestamp} ${item.description}`).join(" / ")}`,
      `CTA: 저장, 댓글, 상담, 다음 영상 중 목적에 맞는 하나로 마무리`,
    ].join("\n"),
  };
}

function buildResearchBrief(project, items) {
  const lines = [];
  lines.push(`# 송이 리서치 브리프`);
  lines.push("");
  lines.push(`프로젝트: ${project.name}`);
  if (project.industry) lines.push(`산업/주제: ${project.industry}`);
  if (project.goal) lines.push(`조사 목적: ${project.goal}`);
  if (project.instagram_profile_url) lines.push(`인스타 프로필: ${project.instagram_profile_url}`);
  if (project.content_category) lines.push(`영상 카테고리: ${project.content_category}`);
  if (project.content_topic) lines.push(`만들고 싶은 주제: ${project.content_topic}`);
  lines.push(`자료 수: ${items.length}개`);
  lines.push("");
  lines.push("## 핵심 태그");
  const tags = [...new Set(items.flatMap((item) => item.tags || []))].slice(0, 12);
  lines.push(tags.length ? tags.map((tag) => `#${tag}`).join(" ") : "- 아직 태그가 없습니다.");
  lines.push("");
  lines.push("## 참고자료");
  for (const [index, item] of items.entries()) {
    lines.push(`${index + 1}. ${item.title || item.url || "제목 없음"} (${item.platform || "자료"})`);
    if (item.url) lines.push(`   - 링크: ${item.url}`);
    lines.push(`   - 요약: ${item.summary || "요약 없음"}`);
    if (item.memo) lines.push(`   - 메모: ${compactText(item.memo, 220)}`);
    const firstInsight = Array.isArray(item.insights) ? item.insights[0] : "";
    if (firstInsight) lines.push(`   - 관찰: ${firstInsight}`);
    const hooks = Array.isArray(item.hooks) ? item.hooks : [];
    if (hooks.length) lines.push(`   - 핵심 소구점: ${hooks.slice(0, 2).join(" / ")}`);
    const flow = Array.isArray(item.flow) ? item.flow : [];
    if (flow.length) lines.push(`   - 영상 흐름: ${flow.slice(0, 3).map((entry) => `${entry.timestamp} ${entry.description}`).join(" -> ")}`);
    const benchmarking = Array.isArray(item.benchmarking) ? item.benchmarking : [];
    if (benchmarking.length) lines.push(`   - 벤치마킹 포인트: ${benchmarking.slice(0, 2).join(" / ")}`);
    const copyPoints = Array.isArray(item.copywriting_points) ? item.copywriting_points : [];
    if (copyPoints.length) lines.push(`   - 카피 포인트: ${copyPoints.slice(0, 2).join(" / ")}`);
    const reasons = performanceReasonsObject(item.performance_reasons);
    const reasonRows = [
      reasons.views ? `조회: ${reasons.views}` : "",
      reasons.comments ? `댓글: ${reasons.comments}` : "",
      reasons.saves ? `저장: ${reasons.saves}` : "",
    ].filter(Boolean);
    if (reasonRows.length) lines.push(`   - 성과 원인: ${reasonRows.join(" / ")}`);
    if (item.script_brief) lines.push(`   - 스크립트 브리프: ${compactText(item.script_brief, 420)}`);
  }
  lines.push("");
  lines.push("## 다음 제작 직원에게 요청할 일");
  lines.push("- 위 자료의 핵심 소구점, 영상 흐름, 벤치마킹 포인트를 바탕으로 콘텐츠 초안 또는 제작 기획안을 작성해주세요.");
  lines.push("- 사용자의 인스타 프로필/카테고리/주제 기준을 우선 반영해주세요.");
  lines.push("- 실제 수치가 없는 부분은 단정하지 말고 추정/가능성 표현으로 분리해주세요.");
  lines.push("- 자료별 메모는 사용자 의도가 담긴 부분이므로 결과물의 방향 설정에 우선 반영해주세요.");
  return lines.join("\n");
}

function researchScriptBriefTopic(item) {
  const text = cleanMultilineText([item?.script_brief, item?.personalized_plan].filter(Boolean).join("\n"), 2000);
  const bracketMatch = text.match(/스크립트\s*브리프\s*[:：]\s*([^】\]\n]+)/i);
  if (bracketMatch?.[1]) return compactText(bracketMatch[1], 120);
  const topicMatch = text.match(/(?:^|\n)\s*(?:주제|topic)\s*[:：]\s*([^\n]+)/i);
  if (topicMatch?.[1]) return compactText(topicMatch[1], 120);
  return "";
}

function buildYunmiPayloadFromResearchItem(project, item, options = {}) {
  const topic = compactText(
    options.topic || researchScriptBriefTopic(item) || item.content_topic || project.content_topic || item.title || project.name || "송이 리서치 기반 스크립트",
    120,
  );
  const flow = Array.isArray(item.flow) ? item.flow : [];
  const reasons = performanceReasonsObject(item.performance_reasons);
  const referenceText = [
    "송이가 조사한 자료를 윤미에게 넘깁니다.",
    "",
    `프로젝트: ${project.name || "-"}`,
    project.goal ? `조사 목적: ${project.goal}` : "",
    project.industry || item.content_category ? `카테고리: ${item.content_category || project.industry}` : "",
    `주제: ${topic}`,
    "",
    `레퍼런스 제목: ${item.title || "-"}`,
    item.url ? `레퍼런스 URL: ${item.url}` : "",
    item.platform ? `플랫폼: ${item.platform}` : "",
    item.summary ? `송이 요약: ${item.summary}` : "",
    "",
    item.hook_note ? `후킹 관찰: ${item.hook_note}` : "",
    item.copy_note ? `카피 관찰: ${item.copy_note}` : "",
    item.structure_note ? `구성 관찰: ${item.structure_note}` : "",
    item.performance_note ? `성과 해석: ${item.performance_note}` : "",
    "",
    Array.isArray(item.hooks) && item.hooks.length ? `핵심 소구점:\n- ${item.hooks.slice(0, 5).join("\n- ")}` : "",
    flow.length ? `추천 흐름:\n- ${flow.slice(0, 6).map((entry) => `${entry.timestamp || "구간"}: ${entry.description || ""}`).join("\n- ")}` : "",
    Array.isArray(item.benchmarking) && item.benchmarking.length ? `벤치마킹 포인트:\n- ${item.benchmarking.slice(0, 5).join("\n- ")}` : "",
    Array.isArray(item.copywriting_points) && item.copywriting_points.length ? `카피 포인트:\n- ${item.copywriting_points.slice(0, 5).join("\n- ")}` : "",
    [reasons.views, reasons.likes, reasons.comments, reasons.saves].some(Boolean)
      ? [
        "성과 원인:",
        reasons.views ? `- 조회: ${reasons.views}` : "",
        reasons.likes ? `- 좋아요: ${reasons.likes}` : "",
        reasons.comments ? `- 댓글: ${reasons.comments}` : "",
        reasons.saves ? `- 저장: ${reasons.saves}` : "",
      ].filter(Boolean).join("\n")
      : "",
    "",
    item.personalized_plan ? `사용자 맞춤 적용:\n${item.personalized_plan}` : "",
    item.script_brief ? `송이의 스크립트 브리프:\n${item.script_brief}` : "",
    item.source_text ? `원문/수집 메모 발췌:\n${compactText(item.source_text, 1200)}` : "",
  ].filter(Boolean).join("\n");

  return {
    topic,
    format: compactText(options.format || "shortform", 40),
    duration: compactText(options.duration || "60초", 40),
    target_audience: compactText(options.target_audience || "첫 구매를 고민하는 고객", 140),
    tone: compactText(options.tone || "friendly_expert", 60),
    objective: compactText(options.objective || `송이 벤치마킹 자료를 바탕으로 ${topic} 숏폼 스크립트를 만든다.`, 220),
    reference_url: compactText(item.url || options.reference_url || "", 1000),
    reference_text: cleanMultilineText(referenceText, 6000),
    cta: compactText(options.cta || "댓글, 저장, 상담 중 목적에 맞는 한 가지 행동으로 마무리", 160),
    mode: "no_paid_alpha",
  };
}

async function handleCreateYunmiFromResearchItem(req, res, itemId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  if (!isJobAllowed(auth.user, "yunmi_script")) {
    json(req, res, 403, { ok: false, error: "job_not_allowed" });
    return;
  }
  const body = await readJsonBody(req, res);
  if (!body) return;
  const research = loadResearch();
  const item = research.items.find((entry) => entry.id === itemId && entry.user_id === auth.user.id);
  if (!item) {
    json(req, res, 404, { ok: false, error: "research_item_not_found" });
    return;
  }
  const project = research.projects.find((entry) => entry.id === item.project_id && entry.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const jobs = loadJobs();
  const created = await createYunmiScriptJob(auth, buildYunmiPayloadFromResearchItem(project, item, body || {}), jobs);
  if (created.error) {
    json(req, res, created.statusCode || 400, { ok: false, error: created.error, detail: created.detail || "" });
    return;
  }
  if (!created.existing) {
    created.job.source = {
      employee: "songi",
      workflow: "songi_research",
      research_project_id: project.id,
      research_item_id: item.id,
    };
    created.job.logs = created.job.logs || [];
    created.job.logs.push({
      at: nowIso(),
      level: "info",
      message: "송이 리서치 브리프를 윤미 스크립트 입력으로 연결했습니다.",
    });
    jobs.jobs.push(created.job);
    saveJobs(jobs);
  }
  json(req, res, created.existing ? 200 : 201, {
    ok: true,
    existing: Boolean(created.existing),
    job: publicJob(created.job),
    research_item: publicResearchItem(item),
    research_project: publicResearchProject(project),
  });
}

function researchMarkdownDir() {
  return path.join(RESEARCH_DATA_DIR, "handoff-md");
}

function researchProjectMarkdownFilename(project) {
  return `${safeHtmlFilename(project?.name || project?.id, "project")}-${safeHtmlFilename(project?.id, "id").slice(0, 8)}.md`;
}

function researchIndexMarkdownFilename() {
  return "index.md";
}

function mdClean(value, limit = 0) {
  const text = String(value || "")
    .replace(/\*\*/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\r/g, "")
    .trim();
  return limit ? compactText(text, limit) : text;
}

function mdList(title, items) {
  const rows = (Array.isArray(items) ? items : [])
    .map((item) => mdClean(item, 500))
    .filter(Boolean);
  if (!rows.length) return [`## ${title}`, "", "- 아직 정리된 항목이 없습니다.", ""].join("\n");
  return [`## ${title}`, "", ...rows.map((item) => `- ${item}`), ""].join("\n");
}

function mdFlow(items) {
  const rows = flowList(items, [], 8);
  if (!rows.length) return ["## 영상 흐름", "", "- 아직 영상 흐름 분석이 없습니다.", ""].join("\n");
  return ["## 영상 흐름", "", ...rows.map((item) => `- ${mdClean(item.timestamp, 60)}: ${mdClean(item.description, 500)}`), ""].join("\n");
}

function mdPerformance(value) {
  const reasons = performanceReasonsObject(value);
  const rows = [
    ["조회수 높은 이유", reasons.views],
    ["좋아요 높은 이유", reasons.likes],
    ["댓글 많은 이유", reasons.comments],
    ["저장 유도 이유", reasons.saves],
  ].filter(([, text]) => text);
  if (!rows.length) return ["## 성과 원인", "", "- 아직 성과 원인 분석이 없습니다.", ""].join("\n");
  return ["## 성과 원인", "", ...rows.map(([label, text]) => `- ${label}: ${mdClean(text, 500)}`), ""].join("\n");
}

function researchItemMarkdown(item, index) {
  const lines = [];
  lines.push(`### ${index + 1}. ${mdClean(item.title || item.url || "제목 없음", 180)}`);
  if (item.url) lines.push(`- 원본 링크: ${item.url}`);
  lines.push(`- 플랫폼: ${item.platform || "자료"}`);
  lines.push(`- 카테고리: ${item.category || "일반 자료"}`);
  if (item.summary) lines.push(`- 한 줄 요약: ${mdClean(item.summary, 400)}`);
  lines.push("");
  lines.push(mdList("핵심 소구점", item.hooks));
  lines.push(mdFlow(item.flow));
  lines.push(mdList("벤치마킹 포인트", item.benchmarking));
  lines.push(mdList("카피라이팅 포인트", item.copywriting_points));
  lines.push(mdList("시각 단서", item.visual_cues));
  lines.push(mdPerformance(item.performance_reasons));
  if (item.personalized_plan) {
    lines.push("## 사용자 맞춤 적용");
    lines.push("");
    lines.push(mdClean(item.personalized_plan));
    lines.push("");
  }
  if (item.script_brief) {
    lines.push("## 다음 직원 전달 브리프");
    lines.push("");
    lines.push(mdClean(item.script_brief));
    lines.push("");
  }
  return lines.join("\n");
}

function researchProjectMarkdown(project, items) {
  const lines = [];
  lines.push(`# ${mdClean(project.name || "송이 프로젝트", 120)} 다음 직원 전달 문서`);
  lines.push("");
  if (project.goal) lines.push(`- 조사 목적: ${mdClean(project.goal, 300)}`);
  if (project.instagram_profile_url) lines.push(`- 인스타 프로필: ${project.instagram_profile_url}`);
  if (project.content_category) lines.push(`- 영상 카테고리: ${mdClean(project.content_category, 120)}`);
  if (project.content_topic) lines.push(`- 만들고 싶은 주제: ${mdClean(project.content_topic, 180)}`);
  lines.push(`- 자료 수: ${items.length}개`);
  lines.push("");
  lines.push("## 다음 직원에게 넘길 핵심");
  lines.push("");
  lines.push(mdClean(buildResearchBrief(project, items)));
  lines.push("");
  lines.push("## 자료별 정리");
  lines.push("");
  for (const [index, item] of items.entries()) {
    lines.push(researchItemMarkdown(item, index));
    lines.push("");
  }
  lines.push(`_생성: ${nowIso()}_`);
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

function researchIndexMarkdown(data) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const items = Array.isArray(data.items) ? data.items : [];
  const lines = ["# 송이 다음 직원 전달 문서 목록", ""];
  if (!projects.length) {
    lines.push("- 아직 프로젝트가 없습니다.");
  } else {
    for (const project of projects) {
      const count = items.filter((item) => item.project_id === project.id).length;
      lines.push(`- [${mdClean(project.name || "프로젝트", 120)}](${researchProjectMarkdownFilename(project)}) · ${count}개 자료`);
    }
  }
  lines.push("");
  lines.push(`_생성: ${nowIso()}_`);
  return lines.join("\n");
}

function writeResearchMarkdownExports(data) {
  const mdDir = researchMarkdownDir();
  fs.mkdirSync(mdDir, { recursive: true });
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const items = Array.isArray(data.items) ? data.items : [];
  fs.writeFileSync(path.join(mdDir, researchIndexMarkdownFilename()), researchIndexMarkdown({ projects, items }), "utf8");
  for (const project of projects) {
    const projectItems = items.filter((item) => item.project_id === project.id);
    fs.writeFileSync(path.join(mdDir, researchProjectMarkdownFilename(project)), researchProjectMarkdown(project, projectItems), "utf8");
  }
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlAttr(value) {
  return htmlEscape(value);
}

function safeHtmlFilename(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9가-힣_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function researchHtmlDir() {
  return path.join(RESEARCH_DATA_DIR, "html");
}

function researchProjectHtmlFilename(project) {
  return `project-${safeHtmlFilename(project?.name || project?.id, "project")}-${safeHtmlFilename(project?.id, "id").slice(0, 8)}.html`;
}

function researchItemHtmlFilename(item) {
  return `item-${safeHtmlFilename(item?.title || item?.id, "item")}-${safeHtmlFilename(item?.id, "id").slice(0, 8)}.html`;
}

function htmlPill(value, className = "") {
  if (!value) return "";
  return `<span class="pill ${htmlAttr(className)}">${htmlEscape(value)}</span>`;
}

function htmlList(items) {
  const rows = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!rows.length) return `<p class="muted">아직 정리된 항목이 없습니다.</p>`;
  return `<ul>${rows.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
}

function htmlFlowList(items) {
  const rows = flowList(items);
  if (!rows.length) return `<p class="muted">아직 영상 흐름 분석이 없습니다.</p>`;
  return `<ul>${rows.map((item) => `<li><strong>${htmlEscape(item.timestamp)}</strong> ${htmlEscape(item.description)}</li>`).join("")}</ul>`;
}

function htmlPerformanceReasons(value) {
  const reasons = performanceReasonsObject(value);
  const rows = [
    ["조회수 높은 이유", reasons.views],
    ["좋아요 높은 이유", reasons.likes],
    ["댓글 많은 이유", reasons.comments],
    ["저장 유도 이유", reasons.saves],
  ].filter(([, text]) => text);
  if (!rows.length) return `<p class="muted">아직 성과 원인 분석이 없습니다.</p>`;
  return `<ul>${rows.map(([label, text]) => `<li><strong>${htmlEscape(label)}</strong><br>${htmlEscape(text)}</li>`).join("")}</ul>`;
}

const RESEARCH_NOTE_LABELS = {
  hook_note: ["후킹", "처음 멈추게 만드는 단서"],
  copy_note: ["카피", "제목, 자막, 문장의 설득 포인트"],
  structure_note: ["구성", "콘텐츠 흐름을 다시 쓸 순서"],
  performance_note: ["성과 해석", "반응 이유와 확인해야 할 근거"],
};

function researchNoteHtml(type, value) {
  const [label, helper] = RESEARCH_NOTE_LABELS[type] || ["분석", "참고할 관찰 포인트"];
  const text = String(value || "-").trim() || "-";
  const parts = text.split(/\s*->\s*/).map((item) => item.trim()).filter(Boolean);
  const stepHtml = parts.length >= 2
    ? `<div class="note-steps">${parts.map((part, index) => `<span>${index + 1}. ${htmlEscape(part)}</span>`).join("")}</div>`
    : "";
  const lineHtml = htmlEscape(text)
    .replace(/&quot;([^&]+)&quot;/g, "<b>&quot;$1&quot;</b>")
    .replace(/^([^:：]{2,18})[:：]\s*/, "<b>$1:</b><br>")
    .replace(/\. /g, ".<br>");
  return `<div class="box">
    <div class="box-title">
      <strong>${htmlEscape(label)}</strong>
      <span>${htmlEscape(helper)}</span>
    </div>
    <p class="note-text">${lineHtml}</p>
    ${stepHtml}
  </div>`;
}

function researchHtmlDocument(title, body) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title || "송이 리서치 노트")}</title>
  <style>
    :root { --bg:#f4f6f3; --panel:#fff; --ink:#191d1b; --muted:#66736d; --line:#d9ddd6; --brand:#0f766e; --soft:#fbfaf7; --ok:#147a55; --warn:#9a6500; --bad:#b3261e; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--ink); line-height:1.55; }
    .page { max-width:1120px; margin:0 auto; padding:32px 22px 56px; }
    header { display:grid; gap:10px; padding:28px 0 22px; border-bottom:1px solid var(--line); margin-bottom:22px; }
    h1 { margin:0; font-size:30px; line-height:1.2; letter-spacing:0; }
    h2 { margin:0 0 12px; font-size:19px; }
    h3 { margin:0; font-size:17px; }
    a { color:var(--brand); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .muted { color:var(--muted); }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .cards { display:grid; gap:12px; }
    .card, .box { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; box-shadow:0 1px 0 rgba(22,29,25,.04); }
    .card h3 { overflow-wrap:anywhere; }
    .meta { display:flex; flex-wrap:wrap; gap:7px; margin:9px 0; }
    .pill { display:inline-flex; align-items:center; min-height:26px; border-radius:999px; padding:3px 9px; background:#eef1ec; color:#3d4842; font-size:13px; border:1px solid transparent; }
    .pill.ok { background:#e9f6ef; color:var(--ok); border-color:#c5ead7; }
    .pill.warn { background:#fff4d8; color:var(--warn); border-color:#f2dfab; }
    .pill.bad { background:#fff0ec; color:var(--bad); border-color:#f3c9c0; }
    .detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
    .box-title { display:grid; gap:3px; margin-bottom:9px; }
    .box-title strong { display:block; color:#0b5f58; }
    .box-title span { color:var(--muted); font-size:13px; }
    .note-text { margin:0; color:#3d4842; }
    .note-text b { color:var(--ink); font-weight:700; }
    .note-steps { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
    .note-steps span { border:1px solid #d7e7df; border-radius:999px; background:#f2fbf8; color:#0b5f58; padding:4px 9px; font-size:13px; }
    .planning { white-space:pre-wrap; background:var(--soft); color:#2f3834; }
    ul { margin:0; padding-left:20px; }
    li + li { margin-top:6px; }
    pre { margin:0; white-space:pre-wrap; overflow:auto; max-height:420px; background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:14px; color:#3d4842; }
    .brief { white-space:pre-wrap; background:var(--soft); }
    footer { margin-top:28px; color:var(--muted); font-size:13px; }
    @media (max-width:760px) { .grid,.detail-grid { grid-template-columns:1fr; } .page { padding:22px 14px 40px; } h1 { font-size:24px; } }
  </style>
</head>
<body>
  <main class="page">
    ${body}
  </main>
</body>
</html>
`;
}

function itemStatusPills(item) {
  const pills = [
    htmlPill(item.platform || "자료", "ok"),
    htmlPill(item.category || "일반 자료"),
  ];
  if (item.link_fetch_status) pills.push(htmlPill(item.link_fetch_status, item.link_fetch_error ? "bad" : "ok"));
  if (item.ai_analysis?.status) pills.push(htmlPill(`AI ${item.ai_analysis.status}`, item.ai_analysis.status === "failed" ? "bad" : "ok"));
  if (item.ai_analysis?.media?.status === "attached") pills.push(htmlPill("영상 첨부 분석", "ok"));
  if (item.ai_analysis?.media?.status === "failed") pills.push(htmlPill("영상 첨부 실패", "warn"));
  if (item.frame_capture?.status === "completed") pills.push(htmlPill("이미지 캡처", "ok"));
  return pills.join("");
}

function htmlFrameCaptures(items) {
  const rows = Array.isArray(items) ? items.filter((item) => item?.file) : [];
  if (!rows.length) return `<p class="muted">아직 추출된 이미지가 없습니다.</p>`;
  return `<div class="grid">${rows.map((item) => `<figure class="card" style="margin:0;">
    <img src="./${htmlAttr(item.file)}" alt="${htmlAttr(item.timestamp || "영상 캡처")}" style="width:100%;border-radius:8px;border:1px solid var(--line);">
    <figcaption class="muted" style="margin-top:8px;"><strong>${htmlEscape(item.timestamp || "구간")}</strong><br>${htmlEscape(item.description || "")}</figcaption>
  </figure>`).join("")}</div>`;
}

function researchItemCardHtml(item) {
  const filename = researchItemHtmlFilename(item);
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return `<article class="card">
    <h3><a href="./${htmlAttr(filename)}">${htmlEscape(item.title || item.url || "제목 없음")}</a></h3>
    <div class="meta">${itemStatusPills(item)}${tags.slice(0, 5).map((tag) => htmlPill(tag)).join("")}</div>
    <p>${htmlEscape(item.summary || "요약 없음")}</p>
    ${item.url ? `<p class="muted">원본: <a href="${htmlAttr(item.url)}">${htmlEscape(item.url)}</a></p>` : ""}
  </article>`;
}

function researchItemHtml(project, item) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const body = `<header>
    <div class="muted">송이 리서치 노트 · ${htmlEscape(project?.name || "프로젝트 없음")}</div>
    <h1>${htmlEscape(item.title || item.url || "제목 없음")}</h1>
    <div class="meta">${itemStatusPills(item)}${tags.map((tag) => htmlPill(tag)).join("")}</div>
    ${item.url ? `<a href="${htmlAttr(item.url)}">원본 링크 열기</a>` : ""}
  </header>
  <section class="card">
    <h2>한 줄 요약</h2>
    <p>${htmlEscape(item.summary || "요약 없음")}</p>
  </section>
  <section class="detail-grid">
    ${researchNoteHtml("hook_note", item.hook_note)}
    ${researchNoteHtml("copy_note", item.copy_note)}
    ${researchNoteHtml("structure_note", item.structure_note)}
    ${researchNoteHtml("performance_note", item.performance_note)}
  </section>
  <section class="grid" style="margin-top:14px;">
    <div class="card">
      <h2>핵심 소구점 (Hooks)</h2>
      ${htmlList(item.hooks)}
    </div>
    <div class="card">
      <h2>영상 흐름 분석</h2>
      ${htmlFlowList(item.flow)}
    </div>
    <div class="card">
      <h2>벤치마킹 포인트</h2>
      ${htmlList(item.benchmarking)}
    </div>
    <div class="card">
      <h2>카피라이팅 포인트</h2>
      ${htmlList(item.copywriting_points)}
    </div>
    <div class="card">
      <h2>시각 단서</h2>
      ${htmlList(item.visual_cues)}
    </div>
    <div class="card">
      <h2>성과 원인 분석</h2>
      ${htmlPerformanceReasons(item.performance_reasons)}
    </div>
    <div class="card planning">
      <h2>맞춤 기획/스크립트 브리프</h2>
      ${htmlEscape([item.personalized_plan, item.script_brief].filter(Boolean).join("\n\n") || "아직 맞춤 기획 문서가 없습니다.")}
    </div>
  </section>
  <section class="card" style="margin-top:14px;">
    <h2>핵심 관찰</h2>
    ${htmlList(item.insights)}
  </section>
  <section class="card" style="margin-top:14px;">
    <h2>영상 흐름 이미지 캡처</h2>
    ${htmlFrameCaptures(item.frame_captures)}
  </section>
  ${item.memo ? `<section class="card" style="margin-top:14px;"><h2>내 메모</h2><p>${htmlEscape(item.memo)}</p></section>` : ""}
  <section class="card" style="margin-top:14px;">
    <h2>원문/수집 내용</h2>
    <pre>${htmlEscape(item.source_text || "원문 없음")}</pre>
  </section>
  ${item.transcript ? `<section class="card" style="margin-top:14px;"><h2>전사 원문</h2><pre>${htmlEscape(item.transcript)}</pre></section>` : ""}
  <footer>저장 위치: ${htmlEscape(RESEARCH_PATH)} · 생성: ${htmlEscape(nowIso())}</footer>`;
  return researchHtmlDocument(item.title || "송이 리서치 노트", body);
}

function researchProjectHtml(project, items) {
  const tags = [...new Set(items.flatMap((item) => item.tags || []))].slice(0, 16);
  const projectCriteria = [
    project.instagram_profile_url ? ["인스타 프로필", project.instagram_profile_url] : null,
    project.content_category ? ["영상 카테고리", project.content_category] : null,
    project.content_topic ? ["만들고 싶은 주제", project.content_topic] : null,
    project.profile_source_text ? ["프로필 분석", compactText(project.profile_source_text, 900)] : null,
  ].filter(Boolean);
  const body = `<header>
    <div class="muted">송이 프로젝트 리서치 노트</div>
    <h1>${htmlEscape(project.name || "프로젝트")} 콘텐츠 아이디어 기획 문서</h1>
    <div class="meta">${htmlPill(`${items.length}개 자료`, "ok")}${tags.map((tag) => htmlPill(tag)).join("")}</div>
    ${project.goal ? `<p>${htmlEscape(project.goal)}</p>` : ""}
  </header>
  <section class="card">
    <h2>프로젝트 기준</h2>
    ${projectCriteria.length
      ? `<ul>${projectCriteria.map(([label, value]) => `<li><strong>${htmlEscape(label)}</strong><br>${htmlEscape(value)}</li>`).join("")}</ul>`
      : `<p class="muted">프로필, 카테고리, 주제를 입력하면 사용자 맞춤 기획 기준이 여기에 정리됩니다.</p>`}
  </section>
  <section class="cards" style="margin-top:14px;">
    ${items.length ? items.map(researchItemCardHtml).join("") : `<div class="card muted">아직 저장된 자료가 없습니다.</div>`}
  </section>
  <section class="card brief" style="margin-top:14px;">
    <h2>콘텐츠 아이디어 기획 브리프</h2>
    ${htmlEscape(buildResearchBrief(project, items))}
  </section>
  <footer>저장 위치: ${htmlEscape(RESEARCH_PATH)} · 생성: ${htmlEscape(nowIso())}</footer>`;
  return researchHtmlDocument(`${project.name || "프로젝트"} · 송이 리서치`, body);
}

function researchIndexHtml(data) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const items = Array.isArray(data.items) ? data.items : [];
  const body = `<header>
    <div class="muted">AIMAX 송이 자료 저장소</div>
    <h1>송이 리서치 HTML 노트</h1>
    <div class="meta">${htmlPill(`${projects.length}개 프로젝트`, "ok")}${htmlPill(`${items.length}개 자료`, "ok")}</div>
    <p>송이가 분석한 자료를 프로젝트별 HTML 노트로 정리했습니다.</p>
  </header>
  <section class="cards">
    ${projects.length ? projects.map((project) => {
      const projectItems = items.filter((item) => item.project_id === project.id);
      return `<article class="card">
        <h3><a href="./${htmlAttr(researchProjectHtmlFilename(project))}">${htmlEscape(project.name || "프로젝트")}</a></h3>
        <div class="meta">${htmlPill(`${projectItems.length}개 자료`, "ok")}${project.industry ? htmlPill(project.industry) : ""}</div>
        <p>${htmlEscape(project.goal || "저장된 리서치 자료를 확인하세요.")}</p>
      </article>`;
    }).join("") : `<div class="card muted">아직 프로젝트가 없습니다.</div>`}
  </section>
  <footer>HTML 폴더: ${htmlEscape(researchHtmlDir())} · 생성: ${htmlEscape(nowIso())}</footer>`;
  return researchHtmlDocument("송이 리서치 HTML 노트", body);
}

function writeResearchHtmlExports(data) {
  const htmlDir = researchHtmlDir();
  fs.mkdirSync(htmlDir, { recursive: true });
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const items = Array.isArray(data.items) ? data.items : [];
  writeJsonAtomic(path.join(htmlDir, "manifest.json"), {
    version: 1,
    generated_at: nowIso(),
    index_file: path.join(htmlDir, "index.html"),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      file: researchProjectHtmlFilename(project),
      item_count: items.filter((item) => item.project_id === project.id).length,
    })),
  });
  fs.writeFileSync(path.join(htmlDir, "index.html"), researchIndexHtml({ projects, items }), "utf8");
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  for (const project of projects) {
    const projectItems = items.filter((item) => item.project_id === project.id);
    fs.writeFileSync(path.join(htmlDir, researchProjectHtmlFilename(project)), researchProjectHtml(project, projectItems), "utf8");
  }
  for (const item of items) {
    const project = projectsById.get(item.project_id) || { name: "프로젝트 없음" };
    fs.writeFileSync(path.join(htmlDir, researchItemHtmlFilename(item)), researchItemHtml(project, item), "utf8");
  }
}

function parseCafe24Amount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const digits = String(value || "").replace(/[^\d]/g, "");
  const amount = Number(digits || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return `***-${digits.slice(-4)}`;
}

function normalizeCafe24ProductText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

const CAFE24_STAFF_PRODUCT_RULES = [
  { product: "blog_team", priceWon: 66000, patterns: [/블로그마케팅팀|블로그마케팅.*예리.*현주|예리.*현주|현주.*예리|blogteam|blog_team/] },
  { product: "yeri", priceWon: 33000, patterns: [/예리|yeri|블로그마케터/] },
  { product: "hyunju", priceWon: 33000, patterns: [/현주|hyunju|영업사원/] },
  { product: "songi", priceWon: 3300, patterns: [/송이|songi|자료조사|자료조사원|리서치|research/] },
  { product: "yunmi", priceWon: 9900, patterns: [/윤미|yunmi|스크립트작가|스크립트/] },
  { product: "jieun", priceWon: 5500, patterns: [/지은|jieun|오피스매니저|오피스지원|office/] },
  { product: "nakyung", priceWon: 9900, patterns: [/나경|nakyung|판서쌤|판서|pencil/] },
  { product: "hyojin", priceWon: 33000, reviewIssue: "product_not_ready", patterns: [/효진|hyojin|영상제작|아나운서/] },
  { product: "sangsu", priceWon: 0, patterns: [/상수|sangsu|견적|견적서|quote|quotation|estimate/] },
  { product: "bundle", priceWon: 0, patterns: [/전체통합|통합권한|통합설치|bundle|올인원|allinone/] },
];

const CAFE24_NON_STAFF_PRODUCT_PATTERNS = [
  /회원가입을하셨습니다|회원가입|입금처리가확인/,
  /ai로직원만드는법|ai로직원만드는/,
  /일본구매대행/,
  /창업프로그램2기/,
  /제2의뇌|제의뇌|나같이생각하는ai비서/,
  /공동구매수익화/,
  /사업자pt/,
  /평생회원제/,
];

function inferCafe24Product(productName, amountValue) {
  const amount = parseCafe24Amount(amountValue);
  const normalized = normalizeCafe24ProductText(productName);
  if (CAFE24_NON_STAFF_PRODUCT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { product: "", confidence: "ignored", issue: "non_staff_product", status: "ignored" };
  }
  const rule = CAFE24_STAFF_PRODUCT_RULES.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
  if (rule) {
    if (rule.priceWon && amount && amount !== rule.priceWon) {
      return { product: rule.product, confidence: "needs_review", issue: "amount_mismatch" };
    }
    if (rule.reviewIssue) {
      return { product: rule.product, confidence: "needs_review", issue: rule.reviewIssue };
    }
    return { product: rule.product, confidence: "auto", issue: "" };
  }
  return { product: "", confidence: "needs_review", issue: "unknown_product" };
}

function cafe24OrderSource(body) {
  return body?.order || body?.data || body?.payload || body || {};
}

function cafe24ExternalId(row) {
  const direct = row.external_id || row.externalId || row.order_id || row.orderId || row.order_no || row.orderNo || row.message_id || row.messageId || row.email_message_id;
  if (direct) return compactText(direct, 220);
  const fingerprint = [
    normalizeEmail(row.email),
    compactText(row.name || row.buyer_name || row.buyerName, 120),
    compactText(row.product || row.product_name || row.productName || row.item_name || row.itemName, 180),
    parseCafe24Amount(row.amount || row.price || row.total_amount),
    compactText(row.order_date || row.orderDate || row.ordered_at || row.received_at, 80),
  ].join("|");
  return `derived:${crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`;
}

function buildCafe24Order(body, now) {
  const row = cafe24OrderSource(body);
  const email = normalizeEmail(row.email || row.buyer_email || row.buyerEmail);
  const name = compactText(row.name || row.buyer_name || row.buyerName || row.customer_name || row.customerName, 120);
  const productName = compactText(row.product || row.product_name || row.productName || row.item_name || row.itemName || row.order_name || row.orderName, 220);
  const amount = parseCafe24Amount(row.amount || row.price || row.total_amount || row.totalAmount || row.payment_amount || row.paymentAmount);
  const inferred = inferCafe24Product(productName, amount);
  const explicitProduct = String(row.aimax_product || row.aimaxProduct || row.product_code || row.productCode || "").trim();
  const product = PRODUCTS.has(explicitProduct) ? explicitProduct : inferred.product;
  const issue = inferred.status === "ignored"
    ? inferred.issue
    : !isValidEmail(email)
      ? "invalid_email"
      : inferred.issue || (product ? "" : "invalid_product");
  const status = inferred.status === "ignored" ? "ignored" : issue ? "needs_review" : "pending";

  return {
    id: crypto.randomUUID(),
    external_id: cafe24ExternalId(row),
    source: compactText(row.source || body.source || "cafe24", 80),
    name,
    email,
    masked_phone: maskPhone(row.phone || row.mobile || row.cellphone || row.buyer_phone || row.buyerPhone),
    product_name: productName,
    amount,
    product,
    product_confidence: product ? (PRODUCTS.has(explicitProduct) ? "explicit" : inferred.confidence) : inferred.confidence || "needs_review",
    issue,
    status,
    order_date: compactText(row.order_date || row.orderDate || row.ordered_at || row.orderedAt || row.payment_date || row.paymentDate, 80),
    received_at: compactText(row.received_at || row.receivedAt || now, 80),
    created_at: now,
    updated_at: now,
    processed_at: null,
    sent_at: null,
    review_alert_sent_at: null,
    review_alert_error: "",
    review_alert_error_at: null,
    auto_process_started_at: null,
    auto_process_stage: "",
    auto_process_attempts: 0,
    auto_process_error: "",
    auto_process_error_at: null,
    auto_process_error_stage: "",
    auto_process_alert_sent_at: null,
    auto_process_alert_error: "",
    auto_process_alert_error_at: null,
    admin_note: "",
  };
}

function mergeCafe24Order(existing, incoming, now) {
  const terminal = ["sent", "ignored"].includes(existing.status);
  existing.source = incoming.source || existing.source || "cafe24";
  existing.name = incoming.name || existing.name || "";
  existing.email = incoming.email || existing.email || "";
  existing.masked_phone = incoming.masked_phone || existing.masked_phone || "";
  existing.product_name = incoming.product_name || existing.product_name || "";
  existing.amount = incoming.amount || existing.amount || 0;
  existing.order_date = incoming.order_date || existing.order_date || "";
  existing.received_at = incoming.received_at || existing.received_at || now;
  existing.product = incoming.product || existing.product || "";
  existing.product_confidence = incoming.product ? incoming.product_confidence : existing.product_confidence || incoming.product_confidence;
  existing.issue = incoming.issue || "";
  if (!terminal && existing.status !== "provisioned") existing.status = incoming.status;
  existing.review_alert_sent_at = existing.review_alert_sent_at || incoming.review_alert_sent_at || null;
  existing.review_alert_error = existing.review_alert_error || "";
  existing.review_alert_error_at = existing.review_alert_error_at || null;
  existing.auto_process_started_at = existing.auto_process_started_at || null;
  existing.auto_process_stage = existing.auto_process_stage || "";
  existing.auto_process_attempts = Number(existing.auto_process_attempts || 0);
  existing.auto_process_error = existing.auto_process_error || "";
  existing.auto_process_error_at = existing.auto_process_error_at || null;
  existing.auto_process_error_stage = existing.auto_process_error_stage || "";
  existing.auto_process_alert_sent_at = existing.auto_process_alert_sent_at || null;
  existing.auto_process_alert_error = existing.auto_process_alert_error || "";
  existing.auto_process_alert_error_at = existing.auto_process_alert_error_at || null;
  existing.updated_at = now;
  return existing;
}

function cafe24OrderStatusLabel(status) {
  const value = String(status || "");
  if (value === "pending") return "대기";
  if (value === "needs_review") return "확인 필요";
  if (value === "provisioned") return "계정 생성";
  if (value === "sent") return "발송 완료";
  if (value === "ignored") return "제외";
  if (value === "failed") return "실패";
  return value || "-";
}

function adminCafe24OrderRow(order) {
  return {
    id: order.id,
    external_id: order.external_id || "",
    source: order.source || "",
    name: order.name || "",
    email: order.email || "",
    masked_phone: order.masked_phone || "",
    product_name: order.product_name || "",
    amount: Number(order.amount || 0),
    product: order.product || "",
    product_label: productLabel(order.product || ""),
    product_confidence: order.product_confidence || "",
    issue: order.issue || "",
    status: order.status || "pending",
    status_label: cafe24OrderStatusLabel(order.status),
    order_date: order.order_date || "",
    received_at: order.received_at || "",
    created_at: order.created_at || "",
    updated_at: order.updated_at || "",
    processed_at: order.processed_at || null,
    sent_at: order.sent_at || null,
    review_alert_sent_at: order.review_alert_sent_at || null,
    review_alert_error: order.review_alert_error || "",
    review_alert_error_at: order.review_alert_error_at || null,
    auto_process_started_at: order.auto_process_started_at || null,
    auto_process_stage: order.auto_process_stage || "",
    auto_process_attempts: Number(order.auto_process_attempts || 0),
    auto_process_error: order.auto_process_error || "",
    auto_process_error_at: order.auto_process_error_at || null,
    auto_process_error_stage: order.auto_process_error_stage || "",
    auto_process_alert_sent_at: order.auto_process_alert_sent_at || null,
    auto_process_alert_error: order.auto_process_alert_error || "",
    auto_process_alert_error_at: order.auto_process_alert_error_at || null,
    admin_note: order.admin_note || "",
  };
}

function cafe24OrderStats(orders) {
  const stats = { total: orders.length, open: 0, pending: 0, needs_review: 0, provisioned: 0, sent: 0, ignored: 0, failed: 0 };
  orders.forEach((order) => {
    const status = String(order.status || "pending");
    if (Object.prototype.hasOwnProperty.call(stats, status)) stats[status] += 1;
    if (!["sent", "ignored"].includes(status)) stats.open += 1;
  });
  return stats;
}

function onboardingGuideSubject(user) {
  const name = String(user?.name || "").trim();
  return name ? `[AIMAX] ${name}님, 계정 이용 안내입니다.` : "[AIMAX] 계정 이용 안내입니다.";
}

function onboardingGuideText(email, password, product) {
  const lines = [
    "AIMAX 이용 안내입니다.",
    "",
    "1. 웹앱에 접속해주세요.",
    `${PUBLIC_BASE_URL}/app`,
    "",
    `2. 이메일: ${email}`,
  ];
  if (password) {
    lines.push(`3. 임시 비밀번호: ${password}`, "", "4. 첫 로그인 후 새 비밀번호로 변경해주세요.");
  } else {
    lines.push("3. 기존 비밀번호로 로그인해주세요.", "", "4. 비밀번호를 잊으셨다면 운영자에게 재발급을 요청해주세요.");
  }
  lines.push(
    `5. 구매 상품: ${productLabel(product)}`,
    "6. 설치 파일을 한 번 설치한 뒤, 웹앱에서 실행기 연결을 눌러주세요.",
    "",
    "설치가 막히면 웹앱의 권한 허용 가이드를 순서대로 확인해주세요.",
  );
  return lines.join("\n");
}

function onboardingSetupLinkText(user, setupLink, product, expiresAt) {
  const email = normalizeEmail(user?.email);
  const lines = [
    "AIMAX 이용 안내입니다.",
    "",
    "1. 아래 링크에서 비밀번호를 설정해주세요.",
    setupLink,
    "",
    `2. 이메일: ${email}`,
    `3. 구매 상품: ${productLabel(product)}`,
  ];
  if (expiresAt) lines.push(`4. 설정 링크 만료: ${expiresAt}`);
  lines.push(
    "",
    "비밀번호 설정 후 웹앱에 접속해주세요.",
    `${PUBLIC_BASE_URL}/app`,
    "",
    "설치 파일을 한 번 설치한 뒤, 웹앱에서 실행기 연결을 눌러주세요.",
    "설치가 막히면 웹앱의 권한 허용 가이드를 순서대로 확인해주세요.",
  );
  return lines.join("\n");
}

function createSetupLinkForUser(setupTokens, user, now, source) {
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  setupTokens.tokens.forEach((tokenRow) => {
    if (tokenRow.user_id === user.id && !tokenRow.used_at) {
      tokenRow.revoked_at = now;
      tokenRow.used_at = now;
    }
  });
  const token = crypto.randomBytes(32).toString("base64url");
  setupTokens.tokens.push({
    id: crypto.randomUUID(),
    user_id: user.id,
    email: user.email,
    token_hash: hashToken(token),
    created_at: now,
    expires_at: expiresAt,
    used_at: null,
    source: String(source || "setup_link").trim() || "setup_link",
  });
  user.password_hash = hashPassword(generateTemporaryPassword());
  user.must_change_password = true;
  user.updated_at = now;
  return {
    setup_url: setupUrl(token),
    expires_at: expiresAt,
  };
}

function adminStats(users, agents) {
  const agentByUserId = new Map(agents.map((agent) => [agent.user_id, agent]));
  return {
    total: users.length,
    active: users.filter((user) => user.status === "active").length,
    expired: users.filter((user) => isExpiredUser(user)).length,
    must_change_password: users.filter((user) => user.must_change_password).length,
    executable: users.filter((user) => canExecute(user)).length,
    connected_agents: users.filter((user) => publicAgent(agentByUserId.get(user.id)).connected).length,
    products: Object.fromEntries(
      [...PRODUCTS].map((product) => [
        product,
        users.filter((user) => entitlementProductsForMerge(user.entitlements || {}).has(product)).length,
      ]),
    ),
    account_segments: Object.fromEntries(
      [...ACCOUNT_SEGMENTS].map((segment) => [
        segment,
        users.filter((user) => normalizeAccountSegment(user.account_segment || user.accountSegment || "", "paid_buyer") === segment).length,
      ]),
    ),
  };
}

function parseVersion(version) {
  return String(version || "")
    .replace(/^[^\d]*/, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(a, b) {
  const aa = parseVersion(a);
  const bb = parseVersion(b);
  const length = Math.max(aa.length, bb.length, 3);
  for (let index = 0; index < length; index += 1) {
    const diff = (aa[index] || 0) - (bb[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function platformVersionConfig(platformValue = "") {
  const platform = normalizePlatform(platformValue);
  if (!platform) {
    const platformConfigs = Object.values(PLATFORM_AGENT_VERSIONS);
    return {
      platform,
      latest: platformConfigs
        .map((config) => config.latest)
        .filter(Boolean)
        .reduce((best, version) => (compareVersions(version, best) > 0 ? version : best), LATEST_AGENT_VERSION),
      min: platformConfigs
        .map((config) => config.min)
        .filter(Boolean)
        .reduce((best, version) => (compareVersions(version, best) > 0 ? version : best), MIN_AGENT_VERSION),
      releaseNotes: AGENT_RELEASE_NOTES,
    };
  }
  const config = PLATFORM_AGENT_VERSIONS[platform] || {};
  return {
    platform,
    latest: config.latest || LATEST_AGENT_VERSION,
    min: config.min || MIN_AGENT_VERSION,
    releaseNotes: PLATFORM_AGENT_RELEASE_NOTES[platform] || AGENT_RELEASE_NOTES,
  };
}

function versionPayload(currentVersion = "", platformValue = "") {
  const config = platformVersionConfig(platformValue);
  const hasCurrent = Boolean(String(currentVersion || "").trim());
  const updateAvailable = hasCurrent && compareVersions(currentVersion, config.latest) < 0;
  const updateRequired = hasCurrent && compareVersions(currentVersion, config.min) < 0;
  return {
    latest_version: config.latest,
    min_version: config.min,
    current_version: currentVersion || "",
    platform: config.platform,
    update_available: updateAvailable,
    update_required: updateRequired,
    download_url: AGENT_DOWNLOAD_URL,
    release_notes: config.releaseNotes,
  };
}

function normalizePlatform(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["mac", "macos", "darwin", "osx"].includes(raw) || raw.includes("mac") || raw.includes("darwin")) return "macos";
  if (["win", "windows", "win32", "win64"].includes(raw) || raw.includes("win")) return "windows";
  return "";
}

function productAllowed(user, product) {
  if (MEMBER_ONLY_PRODUCTS.has(product)) return canAccessEunseo(user);
  const products = userProducts(user);
  return products.has("bundle") || products.has(product);
}

function downloadProductAllowed(user, platform, product) {
  if (platform === "windows") {
    return product === "bundle" && userProducts(user).size > 0;
  }
  return productAllowed(user, product);
}

function defaultDownloadProduct(user, platformValue = "") {
  if (normalizePlatform(platformValue) === "windows") return "bundle";
  const products = userProducts(user);
  if (products.has("bundle")) return "bundle";
  if (products.has("yeri")) return "yeri";
  if (products.has("hyunju")) return "hyunju";
  if (canAccessEunseo(user)) return "eunseo";
  return "";
}

function downloadInfo(user, platformValue, productValue) {
  const platform = normalizePlatform(platformValue);
  const product = String(productValue || defaultDownloadProduct(user, platform)).trim();
  if (!platform || !DOWNLOAD_CATALOG[platform]) {
    return { error: "unsupported_platform" };
  }
  if (!PRODUCTS.has(product)) {
    return { error: "invalid_product" };
  }
  if (!downloadProductAllowed(user, platform, product)) {
    return { error: "download_not_allowed" };
  }
  const item = DOWNLOAD_CATALOG[platform][product];
  if (!item) return { error: "download_not_found" };
  const filePath = path.join(DOWNLOAD_DIR, item.filename);
  const exists = fs.existsSync(filePath);
  return {
    platform,
    product,
    label: item.label,
    filename: item.filename,
    url: `/api/downloads/agent?platform=${encodeURIComponent(platform)}&product=${encodeURIComponent(product)}`,
    exists,
    size: exists ? fs.statSync(filePath).size : 0,
    filePath,
  };
}

function cleanupDownloadTickets() {
  const now = Date.now();
  for (const [ticket, entry] of downloadTickets.entries()) {
    if (!entry || Number(entry.expires_at_ms || 0) <= now) {
      downloadTickets.delete(ticket);
    }
  }
}

function createDownloadTicket(user, platformValue, productValue) {
  cleanupDownloadTickets();
  const info = downloadInfo(user, platformValue, productValue);
  if (info.error) return { error: info.error };
  if (!info.exists) return { error: "download_file_not_uploaded" };
  const ticket = crypto.randomBytes(24).toString("base64url");
  const expiresAtMs = Date.now() + Math.max(60 * 1000, DOWNLOAD_TICKET_TTL_MS);
  downloadTickets.set(ticket, {
    ticket,
    user_id: user.id,
    platform: info.platform,
    product: info.product,
    label: info.label,
    filename: info.filename,
    filePath: info.filePath,
    expires_at_ms: expiresAtMs,
    created_at: nowIso(),
  });
  return {
    ticket,
    info,
    expires_at: new Date(expiresAtMs).toISOString(),
    url: `/api/downloads/agent?ticket=${encodeURIComponent(ticket)}`,
  };
}

function downloadInfoFromTicket(ticketValue) {
  cleanupDownloadTickets();
  const ticket = String(ticketValue || "").trim();
  if (!ticket) return { error: "download_ticket_required" };
  const entry = downloadTickets.get(ticket);
  if (!entry) return { error: "download_ticket_invalid" };
  if (Number(entry.expires_at_ms || 0) <= Date.now()) {
    downloadTickets.delete(ticket);
    return { error: "download_ticket_expired" };
  }
  const exists = fs.existsSync(entry.filePath);
  return {
    platform: entry.platform,
    product: entry.product,
    label: entry.label,
    filename: entry.filename,
    url: `/api/downloads/agent?ticket=${encodeURIComponent(ticket)}`,
    exists,
    size: exists ? fs.statSync(entry.filePath).size : 0,
    filePath: entry.filePath,
  };
}

function eunseoAccessCookie(req, value, maxAgeSeconds) {
  const parts = [
    `${EUNSEO_ACCESS_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/eunseo",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, maxAgeSeconds)}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function cleanupEunseoLaunchTickets() {
  const now = Date.now();
  for (const [ticket, entry] of eunseoLaunchTickets.entries()) {
    if (!entry || Number(entry.expires_at_ms || 0) <= now) {
      eunseoLaunchTickets.delete(ticket);
    }
  }
}

function createEunseoLaunchTicket(user) {
  cleanupEunseoLaunchTickets();
  if (!canAccessEunseo(user)) return { error: "eunseo_not_allowed" };
  const ticket = crypto.randomBytes(24).toString("base64url");
  const expiresAtMs = Date.now() + Math.max(60 * 1000, EUNSEO_ACCESS_TTL_MS);
  eunseoLaunchTickets.set(ticket, {
    ticket,
    user_id: user.id,
    expires_at_ms: expiresAtMs,
    created_at: nowIso(),
  });
  return {
    ticket,
    expires_at: new Date(expiresAtMs).toISOString(),
    url: `/eunseo?ticket=${encodeURIComponent(ticket)}`,
  };
}

function eunseoAccessFromTicket(ticketValue) {
  cleanupEunseoLaunchTickets();
  const ticket = String(ticketValue || "").trim();
  if (!ticket) return null;
  const entry = eunseoLaunchTickets.get(ticket);
  if (!entry) return null;
  if (Number(entry.expires_at_ms || 0) <= Date.now()) {
    eunseoLaunchTickets.delete(ticket);
    return null;
  }
  return entry;
}

function downloadContentType(filename) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  if (lower.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".dmg")) return "application/x-apple-diskimage";
  if (lower.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  if (lower.endsWith(".msi")) return "application/x-msi";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

function sessionTokenFromReq(req) {
  const direct = req.headers["x-aimax-session-token"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function requireSession(req, res) {
  const auth = lookupSession(req);
  if (!auth) {
    json(req, res, 401, { ok: false, error: "invalid_session" });
    return null;
  }
  if (auth.user.status !== "active") {
    json(req, res, 401, { ok: false, error: "inactive_user" });
    return null;
  }
  auth.session.last_seen_at = nowIso();
  saveSessions(auth.sessions);
  return auth;
}

function lookupSession(req) {
  const token = sessionTokenFromReq(req);
  if (!token) return null;
  const sessions = loadSessions();
  const users = loadUsers();
  const tokenHash = hashToken(token);
  const session = sessions.sessions.find((item) => item.token_hash === tokenHash);
  if (!session) return null;
  const user = users.users.find((item) => item.id === session.user_id);
  if (!user) return null;
  return { session, sessions, user, users };
}

function userProducts(user) {
  const products = new Set(user.entitlements?.products || []);
  if (user.entitlements?.product) products.add(user.entitlements.product);
  if (products.has("blog_team")) {
    products.add("yeri");
    products.add("hyunju");
  }
  if (products.has("bundle")) {
    productList("bundle").forEach((product) => products.add(product));
  }
  return products;
}

function envFlag(name) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function normalizeAccessIdentifier(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function accessIdentifierVariants(value) {
  const normalized = normalizeAccessIdentifier(value);
  if (!normalized) return [];
  const compact = normalized.replace(/\s+/g, "");
  return compact && compact !== normalized ? [normalized, compact] : [normalized];
}

function userAccessIdentifierVariants(user) {
  return [user?.id, user?.email, user?.name]
    .flatMap(accessIdentifierVariants);
}

function canAccessYunmi(user) {
  if (YUNMI_PUBLIC_ENABLED) return true;
  if (user && productAllowed(user, "yunmi")) return true;
  return userAccessIdentifierVariants(user).some((identifier) => YUNMI_ALLOWED_USER_IDENTIFIERS.has(identifier));
}

function isMakefamilyMemberSegment(segment) {
  return ["makefamily_member", "member_and_buyer", "operator", "test"].includes(segment);
}

function isMakefamilyMemberAccount(user) {
  const segment = normalizeAccountSegment(user?.account_segment || user?.accountSegment || "", "paid_buyer");
  return isMakefamilyMemberSegment(segment);
}

function canAccessEunseo(user) {
  return Boolean(user && canExecute(user) && isMakefamilyMemberAccount(user));
}

function canAccessWorker(worker, user) {
  if (!worker) return false;
  if (worker.accessPolicy === "public") return Boolean(user && user.status === "active");
  if (worker.accessPolicy === "makefamily_member" || worker.accessPolicy === "member_only") {
    if (worker.staffCode === "eunseo" || worker.product === "eunseo") return canAccessEunseo(user);
    return Boolean(user && canExecute(user) && isMakefamilyMemberAccount(user));
  }
  return Boolean(user && canExecute(user) && (!worker.product || productAllowed(user, worker.product)));
}

function isYunmiWorker(worker) {
  return worker?.staffCode === "yunmi" || worker?.jobKind === "yunmi_script";
}

function isYunmiJobKind(kind) {
  return kind === "yunmi_script";
}

function workerVisibleToUser(worker, user) {
  if (worker?.accessPolicy === "public") return true;
  return true;
}

function jobKindVisibleToUser(kind, user) {
  return true;
}

function jobVisibleToUser(job, user) {
  return true;
}

function isJobAllowed(user, kind) {
  const jobKind = JOB_KINDS[kind];
  if (!jobKind) return false;
  if (!jobKindVisibleToUser(kind, user)) return false;
  const products = userProducts(user);
  return products.has(jobKind.requiredProduct);
}

function publicJob(job) {
  const worker = WORKERS[job.worker_code] || null;
  return {
    id: job.id,
    kind: job.kind,
    label: JOB_KINDS[job.kind]?.label || job.kind,
    worker_code: job.worker_code || JOB_KINDS[job.kind]?.workerCode || "",
    staff_code: worker?.staffCode || "",
    worker_label: worker?.label || "",
    worker_name: worker?.name || worker?.label || "",
    worker_role: worker?.role || "",
    worker_type: worker?.type || "",
    status: job.status,
    server_generation: job.server_generation || "",
    created_at: job.created_at,
    updated_at: job.updated_at,
    assigned_at: job.assigned_at || null,
    finished_at: job.finished_at || null,
    target_platform: job.target_platform || "",
    target_device_label: job.target_device_label || "",
    failed_stage: job.failed_stage || "",
    failed_reason: job.failed_reason || "",
    diagnostic: jobFailureDiagnostic(job),
    retry_count: safeInt(job.retry_count, 0, 100),
    artifact: publicYeriArtifactMeta(job),
    logs: (job.logs || []).slice(-20),
    result: job.result || null,
  };
}

function agentJob(job) {
  return {
    ...publicJob(job),
    payload: job.payload || {},
    artifact: agentYeriArtifactPayload(job),
  };
}

function safeInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function safeNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeUsage(raw) {
  const usage = raw && typeof raw === "object" ? raw : {};
  return {
    input_tokens: safeInt(usage.input_tokens),
    output_tokens: safeInt(usage.output_tokens),
    thinking_tokens: safeInt(usage.thinking_tokens),
    billable_output_tokens: safeInt(usage.billable_output_tokens),
    total_tokens: safeInt(usage.total_tokens),
  };
}

function sanitizeImageDiagnostics(raw) {
  const diagnostics = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const attempts = Array.isArray(diagnostics.attempts)
    ? diagnostics.attempts.slice(-8).map((item) => {
      const attempt = item && typeof item === "object" ? item : {};
      return {
        method: String(attempt.method || "").slice(0, 80),
        uploaded: Boolean(attempt.uploaded),
      };
    })
    : [];
  const selectorCounts = diagnostics.selector_counts && typeof diagnostics.selector_counts === "object"
    ? Object.fromEntries(Object.entries(diagnostics.selector_counts).slice(0, 20).map(([key, value]) => [
      String(key).slice(0, 120),
      safeInt(value, -1, 100000),
    ]))
    : {};
  const result = {
    before_image_count: safeInt(diagnostics.before_image_count, 0, 1000),
    after_image_count: safeInt(diagnostics.after_image_count, 0, 1000),
    upload_method: String(diagnostics.upload_method || "").slice(0, 80),
    debug_html_path: String(diagnostics.debug_html_path || "").slice(0, 260),
    screenshot_path: String(diagnostics.screenshot_path || "").slice(0, 260),
    browser_name: String(diagnostics.browser_name || "").slice(0, 60),
    browser_version: String(diagnostics.browser_version || "").slice(0, 80),
    chromedriver_version: String(diagnostics.chromedriver_version || "").slice(0, 120),
    current_url: String(diagnostics.current_url || "").slice(0, 260),
    selector_error: redactText(String(diagnostics.selector_error || "")).slice(0, 180),
    attempts,
    selector_counts: selectorCounts,
  };
  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => {
      if (Array.isArray(value)) return value.length;
      if (value && typeof value === "object") return Object.keys(value).length;
      return value !== "" && value !== 0;
    })
  );
}

function sanitizeImages(raw) {
  const images = raw && typeof raw === "object" ? raw : {};
  const providers = images.provider_counts && typeof images.provider_counts === "object" ? images.provider_counts : {};
  const failures = Array.isArray(images.failures) ? images.failures.slice(-20).map((item) => {
    const failure = item && typeof item === "object" ? item : {};
    return {
      index: safeInt(failure.index, 0, 100),
      stage: String(failure.stage || "").slice(0, 80),
      error_code: String(failure.error_code || failure.error || "").slice(0, 80),
      provider: String(failure.provider || "").slice(0, 40),
      method: String(failure.method || "").slice(0, 40),
      message: redactText(String(failure.message || "")).slice(0, 180),
      local_image_path: String(failure.local_image_path || "").slice(0, 260),
      user_actionable: Boolean(failure.user_actionable),
      admin_action_required: Boolean(failure.admin_action_required),
      diagnostics: sanitizeImageDiagnostics(failure.diagnostics),
    };
  }) : [];
  const localPaths = Array.isArray(images.local_paths)
    ? images.local_paths.slice(-20).map((item) => String(item || "").slice(0, 260)).filter(Boolean)
    : [];
  const items = Array.isArray(images.items)
    ? images.items.slice(-20).map((item) => {
      const image = item && typeof item === "object" ? item : {};
      return {
        index: safeInt(image.index, 0, 100),
        prompt: redactText(String(image.prompt || "")).slice(0, 500),
        provider: String(image.provider || "").slice(0, 40),
        model: String(image.model || "").slice(0, 80),
        generated: Boolean(image.generated),
        inserted: Boolean(image.inserted),
        local_image_path: String(image.local_image_path || "").slice(0, 260),
        stage: String(image.stage || "").slice(0, 80),
        error_code: String(image.error_code || "").slice(0, 80),
        method: String(image.method || "").slice(0, 80),
        diagnostics: sanitizeImageDiagnostics(image.diagnostics),
      };
    })
    : [];
  return {
    attempted: safeInt(images.attempted, 0, 100),
    generated: safeInt(images.generated, 0, 100),
    inserted: safeInt(images.inserted, 0, 100),
    failure_count: safeInt(images.failure_count || failures.length, 0, 100),
    failures,
    local_paths: localPaths,
    items,
    local_folder: String(images.local_folder || "").slice(0, 260),
    shortfall_accepted: Boolean(images.shortfall_accepted),
    soft_failure_accepted: Boolean(images.soft_failure_accepted),
    image_skipped_no_key: Boolean(images.image_skipped_no_key),
    mode_overridden_to_save: Boolean(images.mode_overridden_to_save),
    provider_counts: {
      gemini: safeInt(providers.gemini, 0, 100),
      openai: safeInt(providers.openai, 0, 100),
    },
  };
}

function sanitizeCost(raw) {
  const cost = raw && typeof raw === "object" ? raw : {};
  const providers = cost.image_provider_counts && typeof cost.image_provider_counts === "object" ? cost.image_provider_counts : {};
  return {
    currency: String(cost.currency || "KRW").slice(0, 10),
    exchange_rate: safeNumber(cost.exchange_rate, 0, 100000),
    exchange_rate_label: redactText(String(cost.exchange_rate_label || "")).slice(0, 80),
    price_available: Boolean(cost.price_available),
    model: String(cost.model || "").slice(0, 80),
    model_label: String(cost.model_label || "").slice(0, 80),
    input_tokens: safeInt(cost.input_tokens),
    output_tokens: safeInt(cost.output_tokens),
    thinking_tokens: safeInt(cost.thinking_tokens),
    billable_output_tokens: safeInt(cost.billable_output_tokens),
    image_generated: safeInt(cost.image_generated, 0, 100),
    image_provider_counts: {
      gemini: safeInt(providers.gemini, 0, 100),
      openai: safeInt(providers.openai, 0, 100),
    },
    text_won: safeInt(cost.text_won, 0, 100000000),
    image_won: safeInt(cost.image_won, 0, 100000000),
    total_won: safeInt(cost.total_won, 0, 100000000),
  };
}

function sanitizePostResult(raw) {
  const post = raw && typeof raw === "object" ? raw : {};
  const keyword = post.keyword || post.source || post.query || "";
  return {
    type: String(post.type || "").slice(0, 40),
    keyword: redactText(String(keyword)).slice(0, 160),
    source: redactText(String(post.source || "")).slice(0, 160),
    title: redactText(String(post.title || "")).slice(0, 180),
    status: String(post.status || "").slice(0, 40),
    stage: String(post.stage || post.step || "").slice(0, 80),
    mode: String(post.mode || "").slice(0, 40),
    requested_mode: String(post.requested_mode || "").slice(0, 40),
    error: redactText(String(post.error || post.message || "")).slice(0, 500),
    usage: sanitizeUsage(post.usage),
    images: sanitizeImages(post.images),
    char_count: safeInt(post.char_count, 0, 100000),
    target_char_count: safeInt(post.target_char_count, 0, 100000),
    recovery_markdown_path: String(post.recovery_markdown_path || "").slice(0, 260),
    recovery_manifest_path: String(post.recovery_manifest_path || "").slice(0, 260),
  };
}

function sanitizeJobResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const failedPosts = Array.isArray(raw.failed_posts)
    ? raw.failed_posts
    : Array.isArray(raw.failures)
      ? raw.failures
      : [];
  const result = {
    ok: Boolean(raw.ok),
    success: safeInt(raw.success, 0, 100),
    total: safeInt(raw.total, 0, 100),
    mode: String(raw.mode || "").slice(0, 40),
    stage: String(raw.stage || "").slice(0, 80),
    failed_keyword: redactText(String(raw.failed_keyword || raw.keyword || "")).slice(0, 160),
    usage: sanitizeUsage(raw.usage),
    images: sanitizeImages(raw.images),
    cost: sanitizeCost(raw.cost),
    posts: Array.isArray(raw.posts) ? raw.posts.slice(-20).map(sanitizePostResult) : [],
  };
  if (raw.diagnostic && typeof raw.diagnostic === "object" && !Array.isArray(raw.diagnostic)) {
    result.diagnostic = buildFailureDiagnostic(raw.diagnostic);
  }
  if (failedPosts.length) result.failed_posts = failedPosts.slice(-20).map(sanitizePostResult);
  if (raw.error) result.error = redactText(String(raw.error)).slice(0, 500);
  return result;
}

function normalizeYunmiScriptPayload(raw) {
  const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    topic: compactText(payload.topic || payload.title || payload.subject, 120),
    objective: compactText(payload.objective || payload.goal || payload.message, 220),
    target_audience: compactText(payload.target_audience || payload.audience || payload.target, 140),
    content_purpose: compactText(payload.content_purpose || payload.purpose || "", 90),
    platform: compactText(payload.platform || "인스타 릴스 / 유튜브 쇼츠 / 틱톡", 90),
    format: compactText(payload.format || "shortform", 40),
    tone: compactText(payload.tone || "friendly_expert", 60),
    duration: compactText(payload.duration || "60초", 40),
    cta: compactText(payload.cta || payload.call_to_action, 160),
    reference_url: compactText(payload.reference_url || payload.url, 1000),
    reference_text: cleanMultilineText(payload.reference_text || payload.source_text || payload.memo, 6000),
    notes: cleanMultilineText(payload.notes || payload.style_notes, 1600),
  };
}

function normalizeYunmiGenerationMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (["ai_beta", "paid_ready", "paid_ready_mock"].includes(mode)) return "ai_beta";
  return "no_paid_alpha";
}

function normalizeYunmiAiModel(value) {
  const model = String(value || "").trim();
  return YUNMI_AI_MODEL_PRICES[model] ? model : YUNMI_DEFAULT_AI_MODEL;
}

function yunmiRequestId(value) {
  const raw = String(value || "").trim();
  if (raw && /^[A-Za-z0-9_.:-]{8,120}$/.test(raw)) return raw;
  return crypto.randomUUID();
}

function estimateYunmiAiTokens(input) {
  const inputChars = [
    input.topic,
    input.objective,
    input.target_audience,
    input.content_purpose,
    input.platform,
    input.reference_url,
    input.reference_text,
    input.notes,
    input.cta,
  ].join("\n").length;
  const outputChars = Math.max(1800, Math.min(7000, Math.ceil(inputChars * 0.55) + 2200));
  return {
    input_tokens: Math.max(800, Math.ceil((inputChars + 1800) / 2.8)),
    output_tokens: Math.ceil(outputChars / 2.3),
  };
}

function estimateYunmiAiCost(input, model) {
  const normalizedModel = normalizeYunmiAiModel(model);
  const price = YUNMI_AI_MODEL_PRICES[normalizedModel] || YUNMI_AI_MODEL_PRICES[YUNMI_DEFAULT_AI_MODEL];
  const tokens = estimateYunmiAiTokens(input);
  const usd = (tokens.input_tokens / 1_000_000) * price.inputUsdPer1m
    + (tokens.output_tokens / 1_000_000) * price.outputUsdPer1m;
  const estimatedWon = Math.ceil(usd * USD_KRW_RATE);
  return {
    currency: "KRW",
    exchange_rate: USD_KRW_RATE,
    exchange_rate_label: USD_KRW_RATE_LABEL,
    price_available: true,
    model: normalizedModel,
    model_label: price.label,
    provider: price.provider,
    input_tokens: tokens.input_tokens,
    output_tokens: tokens.output_tokens,
    thinking_tokens: 0,
    billable_output_tokens: tokens.output_tokens,
    image_generated: 0,
    image_provider_counts: { gemini: 0, openai: 0 },
    estimated_usd: Number(usd.toFixed(6)),
    estimated_text_won: estimatedWon,
    estimated_total_won: estimatedWon,
    text_won: 0,
    image_won: 0,
    total_won: 0,
  };
}

function yunmiWords(text, limit = 8) {
  const stopwords = new Set(["그리고", "하지만", "그래서", "합니다", "있는", "없는", "으로", "에서", "에게", "the", "and", "for", "with", "this", "that"]);
  const counts = new Map();
  for (const word of String(text || "").toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || []) {
    if (stopwords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function yunmiToneLabel(tone) {
  const labels = {
    friendly_expert: "친절한 전문가",
    persuasive: "설득형",
    warm: "따뜻한 공감형",
    witty: "위트 있는 진행형",
    premium: "프리미엄 상담형",
    energetic: "빠른 텐션",
  };
  return labels[tone] || tone || "친절한 전문가";
}

function yunmiFormatLabel(format) {
  const labels = {
    shortform: "숏폼",
    reels: "릴스/쇼츠",
    presentation: "발표",
    event: "행사",
    sales: "세일즈",
    blog_video: "블로그/영상",
  };
  return labels[format] || format || "스크립트";
}

const YUNMI_HOOK_METHODS = {
  A: {
    label: "불편한 질문형",
    reason: "타깃이 자기 문제처럼 받아들이기 쉬워 첫 3초 정지력이 높습니다.",
  },
  B: {
    label: "숫자 충격형",
    reason: "근거나 단계가 있을 때 저장 욕구와 완주 이유를 만들기 좋습니다.",
  },
  C: {
    label: "반전형",
    reason: "흔한 믿음을 뒤집어 다음 장면을 보게 만드는 힘이 있습니다.",
  },
  D: {
    label: "손해 회피형",
    reason: "시간, 비용, 기회 손실을 먼저 보여줘 행동 전환으로 이어지기 쉽습니다.",
  },
  E: {
    label: "내부자 폭로형",
    reason: "겉으로 드러나지 않는 구조를 보여줄 때 신뢰와 궁금증이 동시에 생깁니다.",
  },
  F: {
    label: "장면 선공개형",
    reason: "눈으로 볼 장면을 먼저 던져 스크롤을 멈추게 만들기 좋습니다.",
  },
};

function yunmiPlain(value, fallback = "") {
  return compactText(String(value || fallback || "").replace(/\s+/g, " "), 160);
}

function yunmiInputSentences(input, limit = 4) {
  const source = [input.reference_text, input.notes, input.objective, input.topic]
    .filter(Boolean)
    .join("\n");
  return String(source || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((line) => yunmiPlain(line, ""))
    .filter((line) => line && !/^https?:\/\//i.test(line))
    .slice(0, limit);
}

function yunmiSubject(input, keywords) {
  return yunmiPlain(input.topic || keywords[0] || "이 주제", "이 주제");
}

function yunmiTargetOptions(input, keywords) {
  const topic = yunmiSubject(input, keywords);
  return [
    {
      code: "A",
      label: "A 타깃",
      name: "이미 관심 있는 사람",
      audience: `${topic}에 이미 관심 있고 바로 써먹을 기준을 찾는 사람`,
      strategy: "문제 공감보다 체크포인트와 실행 기준을 먼저 보여줘 저장 욕구를 만듭니다.",
      reason: "이미 관심이 있는 시청자는 긴 설득보다 바로 적용할 기준에 반응합니다.",
    },
    {
      code: "B",
      label: "B 타깃",
      name: "아직 관심 없지만 불편을 겪는 사람",
      audience: `${topic}을 아직 우선순위로 두지 않았지만 같은 불편을 겪는 사람`,
      strategy: "일상적인 불편과 손해를 먼저 보여줘 내 문제라고 느끼게 만듭니다.",
      reason: "관심이 낮은 시청자는 정보보다 자기 상황을 찌르는 장면에서 멈춥니다.",
    },
    {
      code: "C",
      label: "C 타깃",
      name: "구매/상담 직전 사람",
      audience: `${topic} 관련 선택을 앞두고 마지막 기준을 확인하려는 사람`,
      strategy: "비교 기준과 결정 포인트를 짧게 제시해 상담, 저장, 댓글 행동으로 연결합니다.",
      reason: "결정 직전 시청자는 확신을 주는 기준과 다음 행동이 있을 때 움직입니다.",
    },
  ];
}

function yunmiAudience(input, targetOption = null) {
  if (targetOption?.audience) return yunmiPlain(targetOption.audience, "");
  return yunmiPlain(input.target_audience || "이걸 고민하는 분들", "이걸 고민하는 분들");
}

function yunmiHookSample(code, input, keywords, audienceOverride = "") {
  const topic = yunmiSubject(input, keywords);
  const audience = audienceOverride || yunmiAudience(input);
  const samples = {
    A: `${audience}, 혹시 ${topic} 설명부터 시작하고 계세요?`,
    B: `${topic}, 대부분 첫 3초에서 놓칩니다.`,
    C: `잘되는 ${topic} 콘텐츠는 설명을 늦게 시작합니다.`,
    D: `${topic}, 이 순서로 만들면 시간만 날립니다.`,
    E: `실제로 만들어보면 ${topic}의 답은 겉보기와 다릅니다.`,
    F: `${topic}, 이 장면 하나가 끝까지 보게 만듭니다.`,
  };
  return samples[code] || samples.A;
}

function yunmiHookOptions(input, keywords) {
  const source = [input.reference_text, input.notes, input.objective, input.cta].filter(Boolean).join("\n").toLowerCase();
  const scores = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 };
  if (/[?？]|왜|어떻게|무엇|진짜|혹시/.test(source)) scores.A += 3;
  if (/\d|첫째|둘째|세 가지|3가지|5가지|조회|댓글|좋아요|저장|명|%/.test(source)) scores.B += 4;
  if (/반전|오히려|사실|아니라|반대로|달라|바뀌|before|after|전후/.test(source)) scores.C += 4;
  if (/손해|위험|시간만|실패|망하|틀린|실수|문제|안 팔|막히/.test(source)) scores.D += 4;
  if (/실제로|내부|현장|상담|테스트|분석|겉으로|진짜 이유/.test(source)) scores.E += 3;
  if (/장면|화면|순간|고객|클릭|결제|알림|캡처|전환/.test(source)) scores.F += 3;
  const fallbackReason = "입력 자료가 넓게 들어와도 숏폼에서 바로 적용하기 쉬운 기본 후킹입니다.";
  return Object.entries(YUNMI_HOOK_METHODS)
    .map(([code, meta]) => ({
      code,
      label: meta.label,
      sample: yunmiHookSample(code, input, keywords),
      reason: meta.reason || fallbackReason,
      score: scores[code] || 1,
    }))
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, 3);
}

function yunmiCoreMessage(input, keywords) {
  if (input.objective) return yunmiPlain(input.objective, "");
  if (input.content_purpose) return `${input.content_purpose}로 이어지는 기준을 하나만 전달하기`;
  const topic = input.topic || keywords[0] || "핵심 주제";
  return `${topic}에서 먼저 봐야 할 기준을 하나만 전달하기`;
}

function yunmiEvidenceLine(input) {
  const source = input.reference_text || input.notes || input.objective || input.topic;
  if (!source) return "입력 자료에서 반복되는 문제와 적용 포인트를 한 장면으로 압축합니다.";
  const firstLine = String(source).split(/\n+/).map((line) => line.trim()).find(Boolean) || source;
  return yunmiPlain(firstLine, "입력 자료의 핵심 근거를 짧게 보여줍니다.").slice(0, 150);
}

function yunmiCtaText(input) {
  return input.cta || "자료가 필요하면 댓글에 '자료'라고 남겨주세요.";
}

function yunmiTimeRows(input, hookOption, optionNumber, keywords, targetOption = null) {
  const topic = yunmiSubject(input, keywords);
  const audience = yunmiAudience(input, targetOption);
  const core = yunmiCoreMessage(input, keywords);
  const evidence = yunmiEvidenceLine(input);
  const cta = yunmiCtaText(input);
  const hook = hookOption.sample;
  const sourceLines = yunmiInputSentences(input, 3);
  const firstContext = sourceLines[0] || evidence;
  const secondContext = sourceLines[1] || core;
  const tension = optionNumber === 1
    ? "그런데 여기서 대부분 놓칩니다."
    : optionNumber === 2
      ? "문제는 이 다음입니다."
      : "여기서 방향을 조금만 바꾸면 달라집니다.";
  const solutionA = optionNumber === 1
    ? "먼저 문제를 한 문장으로 좁히세요."
    : optionNumber === 2
      ? "처음부터 설명하지 말고 장면을 먼저 보여주세요."
      : "핵심 장면을 먼저 보여주고, 이유는 나중에 붙이세요.";
  const solutionB = optionNumber === 1
    ? "그다음 기준은 세 개 이하로 줄이세요."
    : optionNumber === 2
      ? "그리고 바로 따라 할 기준을 하나만 주세요."
      : "마지막에는 시청자가 바로 할 행동 하나만 남기세요.";
  return [
    {
      time: "0~3초",
      screen: optionNumber === 1
        ? "정면 클로즈업, 첫 문장 자막 크게"
        : optionNumber === 2
          ? "문제 상황을 보여주는 화면이나 빈 결과 화면"
          : "실제 장면이나 캡처를 먼저 보여주는 빠른 컷",
      dialogue: hook,
      subtitles: hook,
      anchor: optionNumber === 1
        ? "얼굴 클로즈업 + 굵은 한 줄 자막"
        : optionNumber === 2
          ? "문제 장면 또는 결과가 없는 화면"
          : "실제 장면 선공개",
      bridge: hook,
    },
    {
      time: "3~10초",
      screen: "원본 자료의 핵심 장면, 숫자, 댓글, 캡처 중 하나",
      dialogue: `그냥 넘기는 순간은 거의 비슷합니다. ${firstContext}`,
      subtitles: "그냥 넘기는 순간은 비슷합니다",
      anchor: "근거가 되는 자료 캡처",
      bridge: `이 장면이 훅이 과장이 아니라는 근거가 됩니다.`,
    },
    {
      time: "10~25초",
      screen: "손가락으로 1개 포인트를 짚거나 화면에 키워드 1개만 표시",
      dialogue: `${audience}에게 필요한 건 많은 설명이 아닙니다. ${targetOption?.strategy || core} 이 메시지 하나만 남기면 됩니다.`,
      subtitles: "핵심 메시지는 하나만",
      anchor: "핵심 키워드 1개",
      bridge: targetOption?.strategy || `${core}.`,
    },
    {
      time: "25~40초",
      screen: "잘못된 흐름과 바꾼 흐름을 좌우로 비교",
      dialogue: `${tension} ${secondContext} 그런데 설명부터 시작하면 시청자는 내 얘기인지 모릅니다.`,
      subtitles: "설명보다 먼저 문제를 보여주세요",
      anchor: "잘못된 순서 vs 바꾼 순서",
      bridge: tension,
    },
    {
      time: "40~55초",
      screen: "체크포인트 2개를 빠르게 띄우기",
      dialogue: `순서는 이렇게 가면 됩니다. ${solutionA} ${solutionB} 마지막에는 행동 하나만 남기세요.`,
      subtitles: "문제 1개 / 기준 1~3개 / 행동 1개",
      anchor: "체크포인트 2개",
      bridge: `${solutionA} ${solutionB}`,
    },
    {
      time: "마무리",
      screen: "카메라를 보며 한 박자 쉬고 CTA 자막 표시",
      dialogue: `지금 막막한 게 정상입니다. 구조를 몰랐던 거니까요. ${cta}`,
      subtitles: cta,
      anchor: "CTA 한 문장",
      bridge: "지금 막막한 게 정상입니다. 구조를 몰랐던 거니까요.",
    },
  ];
}

function yunmiTitleCandidates(input, hookOption, keywords, targetOption = null) {
  const topic = input.topic || keywords[0] || "숏폼";
  const audience = targetOption?.name || input.target_audience || "처음 시작하는 사람";
  return [
    `${audience}이 멈추는 ${topic}`,
    `${topic} 전에 꼭 봐야 할 기준`,
    `${hookOption.label.replace("형", "")}으로 여는 ${topic}`,
  ].map((title) => compactText(title, 36));
}

function yunmiShootingGuide(input, optionNumber) {
  const energetic = input.tone === "energetic" || optionNumber === 2;
  return {
    visual: optionNumber === 1
      ? "정면 클로즈업과 자료 캡처를 번갈아 쓰고, 핵심 키워드는 한 번에 하나만 띄웁니다."
      : optionNumber === 2
        ? "문제 장면을 먼저 보여준 뒤 체크포인트 자막을 빠르게 전환합니다."
        : "실제 장면이나 결과 화면을 먼저 보여주고, 뒤에서 이유와 기준을 짧게 붙입니다.",
    audio_tone: energetic ? "속도감 있는 구어체, 문장 끝을 짧게 끊기" : "친근하지만 단정한 전문가 톤",
    energy: "평소보다 20~30% 높은 에너지로 첫 문장과 반전 문장을 강하게 말합니다.",
    expression_gesture: "첫 훅은 눈을 크게 뜨고, 체크포인트에서는 손가락으로 1, 2를 짚습니다.",
    cut_points: "0~3초 훅 직후, 25~40초 반전 문장 직후, CTA 직전에 컷을 바꿉니다.",
  };
}

function yunmiCtaCandidates(input) {
  const base = input.cta || "";
  return {
    comment: base || "자료가 필요하면 댓글에 '자료'라고 남겨주세요.",
    follow: "이런 실전 구조 계속 보고 싶으면 팔로우해두세요.",
    save: "나중에 촬영 전에 보려고 저장해두세요.",
  };
}

function yunmiScriptOption(input, hookOption, optionNumber, keywords, targetOption = null) {
  const target = targetOption || yunmiTargetOptions(input, keywords)[optionNumber - 1] || {};
  const sourceHook = hookOption || yunmiHookOptions(input, keywords)[0] || {
    code: "A",
    label: YUNMI_HOOK_METHODS.A.label,
    reason: YUNMI_HOOK_METHODS.A.reason,
  };
  const targetedHook = {
    ...sourceHook,
    sample: yunmiHookSample(sourceHook.code, input, keywords, target.audience),
  };
  const rows = yunmiTimeRows(input, targetedHook, optionNumber, keywords, target);
  const title = `숏폼 스크립트 ${optionNumber}안`;
  const angle = target.strategy || (optionNumber === 1
    ? "타깃 공감과 손실 회피를 먼저 잡는 안정형 구성입니다."
    : optionNumber === 2
      ? "장면과 반전으로 초반 정지력을 높이는 변주형 구성입니다."
      : "실제 장면 선공개와 행동 유도로 저장/댓글 전환을 노리는 실행형 구성입니다.");
  const script = rows.map((row) => `[${row.time}] ${row.dialogue}`).join("\n");
  return {
    code: String(optionNumber),
    title,
    target_label: target.label || `${optionNumber}번 타깃`,
    target_audience: target.audience || yunmiAudience(input),
    target_strategy: target.strategy || "",
    target_reason: target.reason || "",
    title_candidates: yunmiTitleCandidates(input, targetedHook, keywords, target),
    hook_method: {
      code: targetedHook.code,
      label: targetedHook.label,
      sample: targetedHook.sample,
      reason: targetedHook.reason,
    },
    angle,
    hook: targetedHook.sample,
    tone: yunmiToneLabel(input.tone),
    duration: input.duration || "60초",
    platform: input.platform,
    rows,
    anchor_bridges: rows.map((row) => ({ time: row.time, anchor: row.anchor, bridge: row.bridge })),
    shooting_guide: yunmiShootingGuide(input, optionNumber),
    cta_candidates: yunmiCtaCandidates(input),
    script,
  };
}

function yunmiMarkdownCell(value) {
  return String(value || "-").replace(/\|/g, "/").replace(/\n+/g, "<br>");
}

function yunmiCopyText(input, result) {
  const lines = [];
  lines.push(`# 윤미 숏폼 스크립트 - ${input.topic || "무제"}`);
  lines.push("");
  lines.push(`요약: ${result.summary || "-"}`);
  lines.push("");
  lines.push("## 후킹 방식 후보");
  for (const hook of result.hook_options || []) {
    lines.push(`- ${hook.label}: ${hook.sample}`);
    lines.push(`  선택 이유: ${hook.reason}`);
  }
  lines.push("");
  for (const option of result.script_options || result.variants || []) {
    lines.push(`## 숏폼 스크립트 ${option.code}안`);
    lines.push("");
    if (option.target_label || option.target_audience || option.target_strategy) {
      lines.push("### 타깃");
      lines.push(`- ${option.target_label || `${option.code}안`}: ${option.target_audience || "-"}`);
      if (option.target_strategy) lines.push(`- 전략: ${option.target_strategy}`);
      lines.push("");
    }
    lines.push("### 제목");
    for (const title of option.title_candidates || []) lines.push(`- ${title}`);
    lines.push("");
    lines.push("### 선택한 후킹 방식");
    lines.push(`- 후킹 방식: ${option.hook_method?.label || "-"}`);
    lines.push(`- 선택 이유: ${option.hook_method?.reason || "-"}`);
    lines.push("");
    lines.push("### 전체 대본");
    lines.push("| 시간 | 화면/행동 | 대사 | 자막 |");
    lines.push("|---|---|---|---|");
    for (const row of option.rows || []) {
      lines.push(`| ${yunmiMarkdownCell(row.time)} | ${yunmiMarkdownCell(row.screen)} | ${yunmiMarkdownCell(row.dialogue)} | ${yunmiMarkdownCell(row.subtitles)} |`);
    }
    lines.push("");
    lines.push("### 앵커 & 브릿지");
    for (const item of option.anchor_bridges || []) {
      lines.push(`- 앵커: ${item.anchor}`);
      lines.push(`- 브릿지: ${item.bridge}`);
    }
    lines.push("");
    lines.push("### 촬영 가이드");
    const guide = option.shooting_guide || {};
    lines.push(`- 비주얼: ${guide.visual || "-"}`);
    lines.push(`- 오디오/톤: ${guide.audio_tone || "-"}`);
    lines.push(`- 에너지: ${guide.energy || "-"}`);
    lines.push(`- 표정/제스처: ${guide.expression_gesture || "-"}`);
    lines.push(`- 컷 전환 포인트: ${guide.cut_points || "-"}`);
    lines.push("");
    lines.push("### CTA 후보");
    const ctas = option.cta_candidates || {};
    lines.push(`- 댓글 유도형: ${ctas.comment || "-"}`);
    lines.push(`- 팔로우 유도형: ${ctas.follow || "-"}`);
    lines.push(`- 저장 유도형: ${ctas.save || "-"}`);
    lines.push("");
  }
  lines.push("## 최종 추천");
  lines.push(result.final_recommendation?.text || "1안을 우선 추천합니다.");
  lines.push("");
  lines.push("추천 기준:");
  for (const item of result.final_recommendation?.criteria || []) lines.push(`- ${item}`);
  if (result.paid_call?.request_id) {
    lines.push("");
    lines.push(`요청 ID: ${result.paid_call.request_id}`);
  }
  lines.push("");
  lines.push(`입력 요약: ${result.summary || input.topic || "윤미 스크립트"}`);
  return lines.join("\n");
}

function buildYunmiScriptResult(payload) {
  const input = normalizeYunmiScriptPayload(payload);
  const keywords = yunmiWords([input.topic, input.objective, input.target_audience, input.reference_text, input.notes].join(" "));
  const hookOptions = yunmiHookOptions(input, keywords);
  const targetOptions = yunmiTargetOptions(input, keywords);
  const variants = targetOptions.map((target, index) => yunmiScriptOption(input, hookOptions[index] || hookOptions[0], index + 1, keywords, target));
  const patterns = hookOptions.map((item) => ({
    label: item.label,
    insight: item.reason,
    evidence: item.sample,
  }));
  const finalRecommendation = {
    recommended_code: "1",
    text: "1안을 우선 추천합니다. 이미 관심 있는 사람에게 바로 적용 기준을 보여줘 저장과 재시청으로 이어지기 가장 쉽습니다.",
    criteria: [
      "A 타깃: 관심이 있는 사람에게 기준을 바로 제시해 저장 욕구를 만듭니다.",
      "B 타깃: 관심이 낮은 사람에게는 불편과 손해 장면을 먼저 보여줍니다.",
      "C 타깃: 결정 직전 사람에게는 비교 기준과 다음 행동을 짧게 남깁니다.",
      "촬영 난이도: 정면 촬영과 자료 캡처만으로 만들 수 있습니다.",
    ],
  };
  const summary = [
    `A/B/C 타깃별 ${yunmiFormatLabel(input.format)} ${input.duration || "60초"} 초안입니다.`,
    input.objective || input.content_purpose ? `목표는 ${input.objective || input.content_purpose}입니다.` : "",
    "이번 알파는 유료 AI 호출 없이 숏폼 메타프롬프트 기준의 구조형 초안을 생성합니다.",
  ].filter(Boolean).join(" ");
  const result = {
    ok: true,
    mode: "no_paid_alpha",
    stage: "yunmi_script_alpha",
    input: {
      topic: input.topic,
      objective: input.objective,
      target_audience: input.target_audience,
      content_purpose: input.content_purpose,
      platform: input.platform,
      format: input.format,
      tone: input.tone,
      duration: input.duration,
      cta: input.cta,
      reference_url: input.reference_url,
    },
    summary,
    keywords,
    target_options: targetOptions,
    hook_options: hookOptions,
    patterns,
    script_options: variants,
    variants,
    final_recommendation: finalRecommendation,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      billable_output_tokens: 0,
      total_tokens: 0,
    },
    cost: {
      currency: "KRW",
      exchange_rate: 0,
      exchange_rate_label: "no-paid alpha",
      price_available: true,
      model: "yunmi-no-paid-alpha",
      model_label: "윤미 no-paid alpha",
      input_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      billable_output_tokens: 0,
      image_generated: 0,
      image_provider_counts: { gemini: 0, openai: 0 },
      text_won: 0,
      image_won: 0,
      total_won: 0,
    },
    posts: [{
      type: "script",
      keyword: input.topic,
      title: input.topic || "윤미 스크립트 초안",
      status: "done",
      stage: "yunmi_script_alpha",
      char_count: 0,
      target_char_count: 0,
    }],
  };
  result.copy_text = yunmiCopyText(input, result);
  result.posts[0].char_count = result.copy_text.length;
  return result;
}

function buildYunmiAiBetaMockResult(payload, options = {}) {
  const input = normalizeYunmiScriptPayload(payload);
  const model = normalizeYunmiAiModel(options.model || payload.ai_model || payload.model);
  const price = YUNMI_AI_MODEL_PRICES[model] || YUNMI_AI_MODEL_PRICES[YUNMI_DEFAULT_AI_MODEL];
  const requestId = options.requestId || yunmiRequestId(payload.request_id || payload.idempotency_key);
  const base = buildYunmiScriptResult(input);
  const cost = estimateYunmiAiCost(input, model);
  const variants = (base.variants || []).map((variant) => ({
    ...variant,
    title: `${variant.title} · AI mock`,
    angle: `${variant.angle} 레퍼런스 해석과 전환 목표를 더 선명하게 다듬는 AI 생성용 구조입니다.`,
  }));
  const summary = [
    `A/B/C 타깃별 ${yunmiFormatLabel(input.format)} ${input.duration || "60초"}용 AI mock 초안입니다.`,
    input.objective ? `목표는 ${input.objective}입니다.` : "",
    "현재 검증 모드에서는 유료 AI 호출을 실행하지 않고, 확인/비용/idempotency 흐름만 안전하게 점검합니다.",
  ].filter(Boolean).join(" ");
  const result = {
    ...base,
    mode: "paid_ready_mock",
    stage: "yunmi_ai_beta_mock",
    summary,
    variants,
    script_options: variants,
    usage: {
      input_tokens: cost.input_tokens,
      output_tokens: cost.output_tokens,
      thinking_tokens: 0,
      billable_output_tokens: cost.output_tokens,
      total_tokens: cost.input_tokens + cost.output_tokens,
    },
    cost,
    paid_call: {
      confirmed: true,
      executed: false,
      status: "mocked_no_paid_call",
      provider: price.provider,
      model,
      model_label: price.label,
      request_id: requestId,
      idempotency_key: requestId,
      auto_retry: false,
      resume_supported: true,
      diagnostic: "실제 유료 API 호출은 실행하지 않았습니다.",
    },
    request_id: requestId,
    idempotency_key: requestId,
    posts: [{
      type: "script",
      keyword: input.topic,
      title: input.topic || "윤미 AI mock 초안",
      status: "done",
      stage: "yunmi_ai_beta_mock",
      char_count: 0,
      target_char_count: 0,
    }],
  };
  result.copy_text = yunmiCopyText(input, result);
  result.posts[0].char_count = result.copy_text.length;
  return result;
}

function yunmiGeminiUsage(usageMetadata) {
  const usage = usageMetadata && typeof usageMetadata === "object" ? usageMetadata : {};
  const outputTokens = safeInt(usage.candidatesTokenCount);
  const thinkingTokens = safeInt(usage.thoughtsTokenCount);
  const inputTokens = safeInt(usage.promptTokenCount);
  const totalTokens = safeInt(usage.totalTokenCount, inputTokens + outputTokens + thinkingTokens);
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    thinking_tokens: thinkingTokens,
    billable_output_tokens: outputTokens + thinkingTokens,
    total_tokens: totalTokens,
  };
}

function yunmiCostFromUsage(input, model, usage = {}) {
  const estimate = estimateYunmiAiCost(input, model);
  const price = YUNMI_AI_MODEL_PRICES[estimate.model] || YUNMI_AI_MODEL_PRICES[YUNMI_DEFAULT_AI_MODEL];
  const cleanUsage = sanitizeUsage(usage);
  const inputTokens = cleanUsage.input_tokens || estimate.input_tokens;
  const outputTokens = cleanUsage.output_tokens || estimate.output_tokens;
  const thinkingTokens = cleanUsage.thinking_tokens || 0;
  const billableOutputTokens = cleanUsage.billable_output_tokens || outputTokens + thinkingTokens;
  const usd = (inputTokens / 1_000_000) * price.inputUsdPer1m
    + (billableOutputTokens / 1_000_000) * price.outputUsdPer1m;
  const textWon = Math.max(1, Math.ceil(usd * USD_KRW_RATE));
  return {
    ...estimate,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    thinking_tokens: thinkingTokens,
    billable_output_tokens: billableOutputTokens,
    estimated_usd: estimate.estimated_usd,
    estimated_text_won: estimate.estimated_text_won,
    estimated_total_won: estimate.estimated_total_won,
    actual_usd: Number(usd.toFixed(6)),
    text_won: textWon,
    image_won: 0,
    total_won: textWon,
    actual_from_usage: Boolean(cleanUsage.input_tokens || cleanUsage.output_tokens || cleanUsage.total_tokens),
  };
}

function buildYunmiGenerationPrompt(input, model) {
  const promptInput = redactPayload({
    topic: input.topic,
    objective: input.objective,
    target_audience: input.target_audience,
    content_purpose: input.content_purpose,
    platform: input.platform,
    format: input.format,
    tone: yunmiToneLabel(input.tone),
    duration: input.duration,
    cta: input.cta,
    reference_url: input.reference_url,
    reference_text: input.reference_text,
    notes: input.notes,
    target_profiles: yunmiTargetOptions(input, yunmiWords([input.topic, input.objective, input.reference_text, input.notes].join(" "))).map((item) => ({
      code: item.code,
      label: item.label,
      name: item.name,
      audience: item.audience,
      strategy: item.strategy,
    })),
  });
  return [
    "너는 AIMAX의 숏폼/영상 스크립트 직원 윤미다. 사용자가 준 지침과 레퍼런스 메모를 바탕으로 한국어 대본을 만든다.",
    "반드시 JSON 객체 하나만 출력한다. 마크다운 코드블록, 설명 문장, 주석을 출력하지 않는다.",
    "목표는 단순 요약이 아니라, 시청자가 첫 3초 안에 멈추고 끝까지 보게 만드는 바로 촬영 가능한 30~60초 숏폼 스크립트 3안을 만드는 것이다.",
    "",
    "반드시 따를 숏폼 스토리텔링 원칙:",
    "- 첫 2~3초 안에 시청자가 멈출 만한 훅을 먼저 제시한다.",
    "- 설명식 도입을 금지한다. 특히 '오늘은 ~에 대해 알아보겠습니다' 같은 문장으로 시작하지 않는다.",
    "- 정보 요약이 아니라 장면, 문제, 반전, 숫자, 손해, 궁금증 중 하나로 시작한다.",
    "- 문장은 짧게 쓴다. 한 문장에 하나의 메시지만 담는다.",
    "- 실제 사람이 말하는 구어체로 쓴다. 번역투, 보고서체, 과한 AI 문체를 금지한다.",
    "- 핵심 메시지는 하나만 잡는다.",
    "- CTA 전에 반드시 공감 또는 연결 문장을 넣어 흐름이 끊기지 않게 한다.",
    "- 시각 요소와 대사 요소를 함께 설계한다.",
    "- 촬영자가 실제보다 20~30% 더 높은 에너지로 말할 수 있게 리듬감 있게 쓴다.",
    "- 각 구간의 대사는 앞 구간의 감정과 논리를 받아 자연스럽게 이어져야 한다. 구간마다 새로 시작하는 보고서 문장처럼 쓰지 않는다.",
    "- 브릿지는 대사를 그대로 반복하지 말고 다음 장면으로 넘어가는 연결 문장으로 쓴다.",
    "",
    "3개 스크립트는 반드시 아래 타깃 관점으로 나눈다:",
    "- 1안/A 타깃: 이미 관심 있고 바로 적용할 기준을 찾는 사람",
    "- 2안/B 타깃: 아직 관심은 낮지만 같은 불편을 겪는 사람",
    "- 3안/C 타깃: 구매/상담/신청 직전 마지막 기준을 확인하려는 사람",
    "",
    "후킹 방식은 아래 중 원본 자료와 각 타깃에 맞는 것을 3개 이상 제안하고, 각 스크립트에 서로 다른 1개를 적용한다:",
    "- A. 불편한 질문형: 아직도 이렇게 하고 계세요?",
    "- B. 숫자 충격형: 10명 중 8명이 여기서 막힙니다.",
    "- C. 반전형: 잘 팔리는 사람들은 더 많이 올리지 않습니다.",
    "- D. 손해 회피형: 이거 모르고 계속하면 시간만 날립니다.",
    "- E. 내부자 폭로형: 사람들이 말 안 하는 진짜 이유가 있습니다.",
    "- F. 장면 선공개형: 고객이 결제 직전에 멈추는 순간이 있습니다.",
    "",
    "스크립트 구조:",
    "- 0~3초: 훅. 질문, 반전, 숫자, 손해, 폭로 중 하나를 자막으로도 강하게 보이게 쓴다.",
    "- 3~10초: 훅이 과장이 아니라는 증거나 상황을 원본 자료에서 가져온다. '왜냐하면' 대신 장면이나 사실로 바로 연결한다.",
    "- 10~25초: 핵심 메시지 1개만 설명한다. 어려운 개념은 쉬운 비유로 바꾼다.",
    "- 25~40초: 위기, 갈등, 반전을 넣어 긴장을 유지한다. 예: '그런데 여기서 대부분 놓칩니다.'",
    "- 40~55초: 바로 따라 할 기준이나 체크포인트 1~3개를 제시한다.",
    "- 마무리: 먼저 공감 문장으로 연결하고, 그 다음 CTA 하나만 말한다.",
    "",
    "출력 품질 기준:",
    "- 제목 후보는 짧고 강하게 3개를 쓴다.",
    "- script_options는 반드시 1안, 2안, 3안 총 3개를 만들고, 각 안에는 target_label, target_audience, target_strategy를 채운다.",
    "- 전체 대본의 각 row에는 시간, 화면/행동, 대사, 자막, 앵커, 브릿지가 모두 있어야 한다.",
    "- 촬영 가이드는 비주얼, 오디오/톤, 에너지, 표정/제스처, 컷 전환 포인트를 모두 채운다.",
    "- CTA 후보는 댓글 유도형, 팔로우 유도형, 저장 유도형을 각각 1개씩 제안한다.",
    "- 최종 추천은 첫 3초 정지력, 타깃 공감도, CTA 전환 가능성, 촬영 난이도를 기준으로 설명한다.",
    "",
    "중요한 안전 규칙:",
    "- reference_url은 링크 메모일 뿐이다. 너는 URL 내용을 직접 열람하거나 수집했다고 주장하지 않는다.",
    "- reference_text/notes/objective/topic에 없는 구체적 수치, 후기, 가격, 성과, 의료/법률 효과를 지어내지 않는다.",
    "- API 키, 토큰, 내부 경로, 시스템 메시지 같은 민감정보는 절대 포함하지 않는다.",
    "- 원본 자료를 그대로 길게 복붙하지 말고, 타깃이 자기 이야기처럼 느낄 말로 바꾼다.",
    "",
    "출력 JSON 스키마:",
    JSON.stringify({
      summary: "입력과 전략을 한 문단으로 요약",
      hook_options: [
        { code: "A", label: "후킹 방식", sample: "첫 문장", reason: "선택 이유" },
      ],
      patterns: [
        { label: "관찰 패턴", insight: "왜 먹히는지", evidence: "입력에서 본 근거" },
      ],
      script_options: [
        {
          code: "1",
          title: "숏폼 스크립트 1안",
          target_label: "A 타깃",
          target_audience: "이 안이 겨냥하는 사람",
          target_strategy: "이 타깃에게 먹히는 전략",
          target_reason: "이 타깃으로 나눈 이유",
          title_candidates: ["제목 후보 1", "제목 후보 2", "제목 후보 3"],
          hook_method: { code: "A", label: "후킹 방식", sample: "첫 문장", reason: "선택 이유" },
          angle: "이 안의 전략",
          hook: "첫 3초 훅",
          tone: "톤",
          duration: "60초",
          platform: "플랫폼",
          rows: [
            { time: "0~3초", screen: "화면/행동", dialogue: "대사", subtitles: "자막", anchor: "앵커", bridge: "브릿지" },
            { time: "3~10초", screen: "화면/행동", dialogue: "대사", subtitles: "자막", anchor: "앵커", bridge: "브릿지" },
            { time: "10~25초", screen: "화면/행동", dialogue: "대사", subtitles: "자막", anchor: "앵커", bridge: "브릿지" },
            { time: "25~40초", screen: "화면/행동", dialogue: "대사", subtitles: "자막", anchor: "앵커", bridge: "브릿지" },
            { time: "40~55초", screen: "화면/행동", dialogue: "대사", subtitles: "자막", anchor: "앵커", bridge: "브릿지" },
            { time: "마무리", screen: "화면/행동", dialogue: "대사", subtitles: "자막", anchor: "앵커", bridge: "브릿지" },
          ],
          anchor_bridges: [{ time: "0~3초", anchor: "앵커", bridge: "브릿지" }],
          shooting_guide: {
            visual: "촬영/화면 구성",
            audio_tone: "말투와 소리",
            energy: "에너지",
            expression_gesture: "표정/제스처",
            cut_points: "컷 전환 포인트",
          },
          cta_candidates: { comment: "댓글 CTA", follow: "팔로우 CTA", save: "저장 CTA" },
          script: "시간대별 대사를 합친 전체 대본",
        },
      ],
      final_recommendation: {
        recommended_code: "1",
        text: "최종 추천 이유",
        criteria: ["첫 3초 정지력", "타깃 공감도", "CTA 전환 가능성", "촬영 난이도"],
      },
    }),
    "",
    `모델: ${model}`,
    "입력:",
    JSON.stringify(promptInput, null, 2),
  ].join("\n");
}

function parseYunmiGeneratedJson(text) {
  const parsed = parseJsonObjectFromText(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("yunmi_ai_invalid_json");
    error.code = "yunmi_ai_invalid_json";
    throw error;
  }
  return parsed;
}

function yunmiNormalizeHook(raw, fallback = {}) {
  const item = raw && typeof raw === "object" ? raw : {};
  return {
    code: compactText(item.code || fallback.code || "", 12),
    label: compactText(item.label || fallback.label || "후킹 방식", 40),
    sample: compactText(item.sample || fallback.sample || "", 180),
    reason: compactText(item.reason || fallback.reason || "", 220),
  };
}

function yunmiNormalizeRows(rawRows, fallbackRows) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const fallback = Array.isArray(fallbackRows) ? fallbackRows : [];
  const normalized = rows.slice(0, 8).map((row, index) => {
    const item = row && typeof row === "object" ? row : {};
    const base = fallback[index] || {};
    const dialogue = compactText(item.dialogue || item.line || base.dialogue || "", 360);
    return {
      time: compactText(item.time || base.time || "", 30),
      screen: compactText(item.screen || item.visual || base.screen || "", 220),
      dialogue,
      subtitles: compactText(item.subtitles || item.caption || base.subtitles || dialogue, 220),
      anchor: compactText(item.anchor || base.anchor || "", 180),
      bridge: compactText(item.bridge || base.bridge || "", 220),
    };
  }).filter((row) => row.time || row.dialogue || row.screen);
  return normalized.length >= 4 ? normalized : fallback;
}

function yunmiNormalizeShootingGuide(raw, fallback = {}) {
  const guide = raw && typeof raw === "object" ? raw : {};
  return {
    visual: compactText(guide.visual || fallback.visual || "", 280),
    audio_tone: compactText(guide.audio_tone || guide.audio || fallback.audio_tone || fallback.audio || "", 220),
    energy: compactText(guide.energy || fallback.energy || "", 220),
    expression_gesture: compactText(guide.expression_gesture || guide.gesture || fallback.expression_gesture || fallback.gesture || "", 220),
    cut_points: compactText(guide.cut_points || guide.cuts || fallback.cut_points || fallback.cuts || "", 260),
  };
}

function yunmiNormalizeCtas(raw, fallback = {}) {
  const ctas = raw && typeof raw === "object" ? raw : {};
  return {
    comment: compactText(ctas.comment || fallback.comment || "", 180),
    follow: compactText(ctas.follow || fallback.follow || "", 180),
    save: compactText(ctas.save || fallback.save || "", 180),
  };
}

function yunmiNormalizeVariant(raw, fallback, input, index) {
  const item = raw && typeof raw === "object" ? raw : {};
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const hook = yunmiNormalizeHook(item.hook_method || {}, base.hook_method || {});
  const rows = yunmiNormalizeRows(item.rows || item.timeline, base.rows);
  const anchorBridges = Array.isArray(item.anchor_bridges)
    ? item.anchor_bridges.slice(0, 8).map((entry, rowIndex) => {
      const rawEntry = entry && typeof entry === "object" ? entry : {};
      const baseEntry = base.anchor_bridges?.[rowIndex] || rows[rowIndex] || {};
      return {
        time: compactText(rawEntry.time || baseEntry.time || "", 30),
        anchor: compactText(rawEntry.anchor || baseEntry.anchor || "", 180),
        bridge: compactText(rawEntry.bridge || baseEntry.bridge || "", 220),
      };
    })
    : rows.map((row) => ({ time: row.time, anchor: row.anchor, bridge: row.bridge }));
  return {
    code: compactText(item.code || base.code || String(index + 1), 12),
    title: compactText(item.title || base.title || `숏폼 스크립트 ${index + 1}안`, 80),
    target_label: compactText(item.target_label || base.target_label || "", 40),
    target_audience: compactText(item.target_audience || base.target_audience || "", 180),
    target_strategy: compactText(item.target_strategy || base.target_strategy || "", 260),
    target_reason: compactText(item.target_reason || base.target_reason || "", 220),
    title_candidates: stringList(item.title_candidates || base.title_candidates, 3, 60),
    hook_method: hook,
    angle: compactText(item.angle || base.angle || "", 300),
    hook: compactText(item.hook || hook.sample || base.hook || "", 180),
    tone: compactText(item.tone || base.tone || yunmiToneLabel(input.tone), 80),
    duration: compactText(item.duration || base.duration || input.duration || "60초", 40),
    platform: compactText(item.platform || base.platform || input.platform, 80),
    rows,
    anchor_bridges: anchorBridges,
    shooting_guide: yunmiNormalizeShootingGuide(item.shooting_guide, base.shooting_guide),
    cta_candidates: yunmiNormalizeCtas(item.cta_candidates, base.cta_candidates),
    script: cleanMultilineText(item.script || rows.map((row) => `[${row.time}] ${row.dialogue}`).join("\n"), 5000),
  };
}

function normalizeYunmiGeneratedResult(raw, input, options = {}) {
  const model = normalizeYunmiAiModel(options.model);
  const requestId = options.requestId || yunmiRequestId(options.idempotency_key);
  const base = buildYunmiScriptResult(input);
  const rawHooks = Array.isArray(raw.hook_options) ? raw.hook_options : [];
  const hookOptions = (rawHooks.length ? rawHooks : base.hook_options).slice(0, 3)
    .map((hook, index) => yunmiNormalizeHook(hook, base.hook_options?.[index] || {}));
  const rawVariants = Array.isArray(raw.script_options)
    ? raw.script_options
    : Array.isArray(raw.variants)
      ? raw.variants
      : [];
  const variantSource = rawVariants.length
    ? [rawVariants[0] || base.variants?.[0], rawVariants[1] || base.variants?.[1], rawVariants[2] || base.variants?.[2]].filter(Boolean)
    : base.variants;
  const variants = variantSource.slice(0, 3)
    .map((variant, index) => yunmiNormalizeVariant(variant, base.variants?.[index], input, index));
  const rawPatterns = Array.isArray(raw.patterns) ? raw.patterns : [];
  const patterns = (rawPatterns.length ? rawPatterns : base.patterns).slice(0, 5).map((item, index) => {
    const pattern = item && typeof item === "object" ? item : {};
    const fallback = base.patterns?.[index] || {};
    return {
      label: compactText(pattern.label || fallback.label || "관찰 패턴", 60),
      insight: compactText(pattern.insight || fallback.insight || "", 260),
      evidence: compactText(pattern.evidence || fallback.evidence || "", 220),
    };
  });
  const rawRecommendation = raw.final_recommendation && typeof raw.final_recommendation === "object"
    ? raw.final_recommendation
    : {};
  const baseRecommendation = base.final_recommendation || {};
  const usage = sanitizeUsage(options.usage);
  const result = {
    ...base,
    mode: "ai_generated",
    stage: "yunmi_ai_gemini",
    summary: compactText(raw.summary || base.summary || "윤미 AI가 입력 지침을 바탕으로 숏폼 스크립트를 생성했습니다.", 500),
    hook_options: hookOptions,
    patterns,
    variants,
    script_options: variants,
    final_recommendation: {
      recommended_code: compactText(rawRecommendation.recommended_code || baseRecommendation.recommended_code || "1", 12),
      text: compactText(rawRecommendation.text || baseRecommendation.text || "1안을 우선 추천합니다.", 360),
      criteria: stringList(rawRecommendation.criteria || baseRecommendation.criteria, 6, 180),
    },
    usage,
    cost: yunmiCostFromUsage(input, model, usage),
    paid_call: {
      confirmed: true,
      executed: true,
      status: "completed",
      provider: "gemini",
      model,
      model_label: YUNMI_AI_MODEL_PRICES[model]?.label || model,
      request_id: requestId,
      idempotency_key: requestId,
      auto_retry: false,
      resume_supported: true,
      diagnostic: "Gemini 실제 생성이 완료되었습니다.",
    },
    request_id: requestId,
    idempotency_key: requestId,
    posts: [{
      type: "script",
      keyword: input.topic,
      title: input.topic || "윤미 AI 생성 초안",
      status: "done",
      stage: "yunmi_ai_gemini",
      char_count: 0,
      target_char_count: 0,
    }],
  };
  result.copy_text = yunmiCopyText(input, result);
  result.posts[0].char_count = result.copy_text.length;
  return result;
}

function buildYunmiInvalidJsonFallbackResult(input, options = {}) {
  const model = normalizeYunmiAiModel(options.model);
  const requestId = options.requestId || yunmiRequestId(options.idempotency_key);
  const usage = sanitizeUsage(options.usage);
  const result = {
    ...buildYunmiScriptResult(input),
    mode: "ai_generated_fallback",
    stage: "yunmi_ai_invalid_json_fallback",
    summary: "Gemini 유료 호출 응답을 윤미 대본 JSON으로 해석하지 못해, 같은 입력으로 안전한 구조형 초안을 생성했습니다.",
    usage,
    cost: yunmiCostFromUsage(input, model, usage),
    paid_call: {
      confirmed: true,
      executed: true,
      status: "completed_with_fallback",
      provider: "gemini",
      model,
      model_label: YUNMI_AI_MODEL_PRICES[model]?.label || model,
      request_id: requestId,
      idempotency_key: requestId,
      auto_retry: false,
      resume_supported: true,
      diagnostic: "Gemini 응답 JSON 해석 실패로 무과금 구조형 초안을 대체 반환했습니다.",
    },
    request_id: requestId,
    idempotency_key: requestId,
  };
  result.posts = [{
    type: "script",
    keyword: input.topic,
    title: input.topic || "윤미 AI 대체 초안",
    status: "done",
    stage: "yunmi_ai_invalid_json_fallback",
    char_count: 0,
    target_char_count: 0,
  }];
  result.copy_text = yunmiCopyText(input, result);
  result.posts[0].char_count = result.copy_text.length;
  return result;
}

async function buildYunmiAiGeneratedResult(payload, options = {}) {
  const input = normalizeYunmiScriptPayload(payload);
  const model = normalizeYunmiAiModel(options.model || payload.ai_model || payload.model);
  const requestId = options.requestId || yunmiRequestId(payload.request_id || payload.idempotency_key);
  const price = YUNMI_AI_MODEL_PRICES[model] || YUNMI_AI_MODEL_PRICES[YUNMI_DEFAULT_AI_MODEL];
  if (price.provider !== "gemini") {
    const error = new Error("yunmi_ai_provider_not_supported");
    error.code = "yunmi_ai_provider_not_supported";
    error.provider = price.provider;
    throw error;
  }
  const apiKey = getUserOrStoredSecret(options.userId, "gemini");
  if (!apiKey) {
    const error = new Error("yunmi_ai_key_missing");
    error.code = "yunmi_ai_key_missing";
    throw error;
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await requestExternalJson(endpoint, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey },
    body: {
      contents: [
        {
          role: "user",
          parts: [{ text: buildYunmiGenerationPrompt(input, model) }],
        },
      ],
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    },
    timeoutMs: 60000,
    maxBytes: 2 * 1024 * 1024,
  });
  const usage = yunmiGeminiUsage(response.json?.usageMetadata);
  let parsed;
  try {
    parsed = parseYunmiGeneratedJson(extractGeminiText(response.json));
  } catch (error) {
    if (error?.code !== "yunmi_ai_invalid_json") throw error;
    return buildYunmiInvalidJsonFallbackResult(input, {
      model,
      requestId,
      usage,
    });
  }
  return normalizeYunmiGeneratedResult(parsed, input, {
    model,
    requestId,
    usage,
  });
}

function yunmiAiFailureResult(payload, options = {}) {
  const input = normalizeYunmiScriptPayload(payload);
  const model = normalizeYunmiAiModel(options.model || payload.ai_model || payload.model);
  const requestId = options.requestId || yunmiRequestId(payload.request_id || payload.idempotency_key);
  const rawError = options.error || {};
  const rawCode = String(rawError.code || "");
  const providerError = rawCode.startsWith("server_generation_") || rawCode.startsWith("yunmi_ai_")
    ? rawError
    : classifyYeriProviderError("gemini", rawError);
  const message = providerError.user_message
    || (providerError.code === "yunmi_ai_invalid_json"
      ? "Gemini 응답을 윤미 대본 형식으로 해석하지 못했습니다. 같은 요청 ID로 중복 실행하지 말고 오류 보고를 보내주세요."
      : "윤미 AI 생성 중 오류가 발생했습니다. 모델/API 설정을 확인해주세요.");
  const cost = estimateYunmiAiCost(input, model);
  return {
    ok: false,
    mode: "ai_generated",
    stage: "yunmi_ai_gemini_failed",
    input: {
      topic: input.topic,
      objective: input.objective,
      target_audience: input.target_audience,
      content_purpose: input.content_purpose,
      platform: input.platform,
      format: input.format,
      tone: input.tone,
      duration: input.duration,
      cta: input.cta,
      reference_url: input.reference_url,
    },
    summary: message,
    error: providerError.code || rawError.code || "yunmi_ai_generation_failed",
    error_message: message,
    error_detail: redactText(providerError.detail || rawError.detail || rawError.message || "").slice(0, 500),
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      billable_output_tokens: 0,
      total_tokens: 0,
    },
    cost,
    paid_call: {
      confirmed: true,
      executed: true,
      status: "failed",
      provider: "gemini",
      model,
      model_label: YUNMI_AI_MODEL_PRICES[model]?.label || model,
      request_id: requestId,
      idempotency_key: requestId,
      auto_retry: false,
      resume_supported: true,
      diagnostic: message,
    },
    request_id: requestId,
    idempotency_key: requestId,
    posts: [{
      type: "script",
      keyword: input.topic,
      title: input.topic || "윤미 AI 생성 실패",
      status: "failed",
      stage: "yunmi_ai_gemini_failed",
      error: providerError.code || rawError.code || "yunmi_ai_generation_failed",
      char_count: 0,
      target_char_count: 0,
    }],
  };
}

function findExistingYunmiJobByRequestId(jobs, userId, requestId) {
  if (!requestId) return null;
  return (jobs?.jobs || []).find((job) => (
    job.user_id === userId
    && job.kind === "yunmi_script"
    && (job.idempotency_key === requestId || job.result?.idempotency_key === requestId || job.result?.request_id === requestId)
  )) || null;
}

async function createYunmiScriptJob(auth, payload, jobs = null) {
  const input = normalizeYunmiScriptPayload(payload);
  if (!input.topic && !input.objective && !input.reference_text) {
    return { error: "yunmi_source_required", statusCode: 400 };
  }
  const mode = normalizeYunmiGenerationMode(payload.mode || payload.generation_mode);
  const model = normalizeYunmiAiModel(payload.ai_model || payload.model);
  const requestId = mode === "ai_beta" ? yunmiRequestId(payload.request_id || payload.idempotency_key) : "";
  if (mode === "ai_beta") {
    if (payload.confirm_paid !== true) {
      return { error: "yunmi_paid_confirmation_required", statusCode: 402 };
    }
    const price = YUNMI_AI_MODEL_PRICES[model] || YUNMI_AI_MODEL_PRICES[YUNMI_DEFAULT_AI_MODEL];
    if (price.provider !== "gemini") {
      return { error: "yunmi_ai_provider_not_supported", statusCode: 400, detail: price.provider };
    }
    if (!hasUserOrStoredSecret(auth.user.id, price.provider)) {
      return { error: "yunmi_ai_key_missing", statusCode: 409, detail: price.provider };
    }
    const existing = findExistingYunmiJobByRequestId(jobs, auth.user.id, requestId);
    if (existing) return { job: existing, existing: true };
  }
  const now = nowIso();
  let status = "done";
  let result = null;
  let logMessage = "윤미가 유료 AI 호출 없이 숏폼 스크립트 1안/2안/3안을 만들었습니다.";
  let logLevel = "info";
  if (mode === "ai_beta" && YUNMI_AI_MOCK_ENABLED) {
    result = buildYunmiAiBetaMockResult(input, { model, requestId });
    logMessage = "윤미 AI mock 흐름이 완료되었습니다. 테스트 플래그 때문에 실제 유료 AI 호출은 실행하지 않았습니다.";
  } else if (mode === "ai_beta") {
    try {
      result = await buildYunmiAiGeneratedResult(input, { model, requestId, userId: auth.user.id });
      logMessage = "윤미가 저장된 Gemini 키로 실제 AI 스크립트 초안을 생성했습니다.";
    } catch (error) {
      status = "failed";
      logLevel = "error";
      result = yunmiAiFailureResult(input, { model, requestId, error });
      logMessage = result.error_message || "윤미 AI 생성 중 오류가 발생했습니다.";
    }
  } else {
    result = buildYunmiScriptResult(input);
  }
  const payloadForStorage = {
    ...input,
    mode,
    ai_model: mode === "ai_beta" ? model : "",
    request_id: requestId,
    confirm_paid: mode === "ai_beta",
  };
  return {
    job: {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      kind: "yunmi_script",
      worker_code: "yunmi_script_writer",
      status,
      payload: redactPayload(payloadForStorage),
      idempotency_key: requestId,
      logs: [
        {
          at: now,
          level: logLevel,
          message: logMessage,
        },
      ],
      result,
      created_at: now,
      updated_at: now,
      finished_at: now,
    },
  };
}

function requestedImageCount(job) {
  if (!job || job.kind !== "yeri_write") return 0;
  const payload = job.payload && typeof job.payload === "object" ? job.payload : {};
  return safeInt(payload.image_count ?? payload.images, 0, 100);
}

function imageCompletionIssue(job, result) {
  const requested = requestedImageCount(job);
  if (!requested || !result || typeof result !== "object") return "";
  // 러너가 이미지 부족을 의도적으로 수용하고 발행/저장을 완료한 경우(신규 러너의 부분 이미지 진행)
  // done 을 failed 로 뒤집지 않는다. 기존 러너는 이 플래그를 보내지 않으므로 동작 변화 없음.
  if (
    result.image_shortfall_accepted === true ||
    result.images?.shortfall_accepted === true ||
    result.images?.soft_failure_accepted === true
  ) return "";
  const images = result.images && typeof result.images === "object" ? result.images : {};
  if (images.image_skipped_no_key === true) {
    return `이미지 ${requested}장을 요청했지만 이미지 생성용 로컬 API 키가 없어 이미지 없이 저장되었습니다. Mac/Windows 실행기의 AI/API 연결에 선택한 이미지 모델용 키를 저장해주세요.`;
  }
  if (images.mode_overridden_to_save === true) {
    return `이미지 ${requested}장을 요청했지만 이미지 키가 없어 공개 발행/예약 대신 임시저장으로 전환되었습니다.`;
  }
  const attempted = safeInt(images.attempted, 0, 100);
  const inserted = safeInt(images.inserted, 0, 100);
  if (inserted >= requested) return "";
  if (attempted <= 0) {
    return `이미지 ${requested}장을 요청했지만 이미지 프롬프트가 생성되지 않았습니다.`;
  }
  return `이미지 ${requested}장을 요청했지만 ${inserted}장만 첨부되었습니다. 이미지 생성 한도 또는 네이버 이미지 업로드 상태를 확인해주세요.`;
}

function publicCommand(command) {
  return {
    id: command.id,
    type: command.type,
    status: command.status,
    target_platform: command.target_platform || "",
    target_device_label: command.target_device_label || "",
    created_at: command.created_at,
    updated_at: command.updated_at,
    assigned_at: command.assigned_at || null,
    finished_at: command.finished_at || null,
    logs: (command.logs || []).slice(-10),
    result: command.result || null,
  };
}

function publicWorker(worker) {
  const executionOptions = Array.isArray(worker.executionOptions)
    ? worker.executionOptions.map((option) => ({
      kind: String(option.kind || ""),
      label: String(option.label || ""),
      platforms: Array.isArray(option.platforms) ? option.platforms.filter(Boolean) : [],
      status: ["available", "coming_soon", "testing", "unsupported"].includes(option.status) ? option.status : "coming_soon",
      url: String(option.url || ""),
      primary: Boolean(option.primary),
      description: String(option.description || ""),
    })).filter((option) => option.kind && option.label)
    : [];
  return {
    code: worker.code,
    staff_code: worker.staffCode,
    name: worker.name || worker.label,
    label: worker.label,
    role: worker.role,
    category: worker.category,
    product: worker.product,
    job_kind: worker.jobKind,
    execution: worker.execution || worker.type,
    type: worker.type,
    status: worker.status || "available",
    access_policy: worker.accessPolicy || "",
    required_settings: worker.requiredSettings || [],
    module_key: worker.moduleKey || "",
    profile_image: worker.profileImage || "",
    avatar_image: worker.avatarImage || "",
    repo_url: worker.repoUrl || "",
    release_url: worker.releaseUrl || "",
    setup_download_url: worker.setupDownloadUrl || "",
    portable_download_url: worker.portableDownloadUrl || "",
    download_label: worker.downloadLabel || "",
    supported_platforms: worker.supportedPlatforms || [],
    version: worker.version || "",
    short_description: worker.shortDescription || "",
    capabilities: worker.capabilities || [],
    execution_options: executionOptions,
  };
}

function publicJobKind(kind, config, user = null) {
  const worker = WORKERS[config.workerCode] || null;
  const row = {
    kind,
    label: config.label,
    required_product: config.requiredProduct,
    worker_code: config.workerCode,
    staff_code: worker?.staffCode || "",
    execution: worker?.execution || worker?.type || "",
    api_mode: config.apiMode || "job_api",
    queue: config.queue !== false,
  };
  if (kind === "yeri_write") row.server_generation = publicYeriServerGenerationConfig(user);
  return row;
}

function agentCommand(command) {
  return {
    ...publicCommand(command),
    payload: command.payload || {},
  };
}

function normalizeImportableUserSecretProviders(value) {
  const raw = Array.isArray(value) ? value : [];
  const selected = raw.length ? raw : IMPORTABLE_USER_SECRET_PROVIDERS;
  const providers = [];
  for (const item of selected) {
    const provider = normalizeSecretProvider(item);
    if (IMPORTABLE_USER_SECRET_PROVIDERS.includes(provider) && !providers.includes(provider)) {
      providers.push(provider);
    }
  }
  return providers.length ? providers : [...IMPORTABLE_USER_SECRET_PROVIDERS];
}

const READINESS_STATUSES = new Set(["ready", "missing", "needs_attention", "unknown", "unavailable"]);

function readinessStatus(value, fallback = "unknown") {
  const status = String(value || "").trim().toLowerCase();
  return READINESS_STATUSES.has(status) ? status : fallback;
}

function boundedCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(Math.floor(count), 1000));
}

function safeIsoOrNull(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function defaultReadiness() {
  return {
    web_login: false,
    naver_account: {
      status: "unknown",
      has_id: false,
      has_password: false,
    },
    ai_keys: {
      gemini: "unknown",
      claude: "unknown",
      openai: "unknown",
      apify: "unknown",
      selected_model: "",
      selected_model_ready: "unknown",
    },
    neighbor_messages: {
      status: "unknown",
      count: 0,
    },
    browser: {
      status: "unknown",
      last_check_at: null,
    },
    media_tools: {
      yt_dlp: "unknown",
      yt_dlp_version: "",
    },
    workers: {
      yeri_write: "unknown",
      hyunju_find: "unknown",
    },
  };
}

function sanitizeReadiness(value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const naver = data.naver_account && typeof data.naver_account === "object" ? data.naver_account : {};
  const ai = data.ai_keys && typeof data.ai_keys === "object" ? data.ai_keys : {};
  const neighbor = data.neighbor_messages && typeof data.neighbor_messages === "object" ? data.neighbor_messages : {};
  const browser = data.browser && typeof data.browser === "object" ? data.browser : {};
  const mediaTools = data.media_tools && typeof data.media_tools === "object" ? data.media_tools : {};
  const workers = data.workers && typeof data.workers === "object" ? data.workers : {};

  return {
    web_login: Boolean(data.web_login),
    naver_account: {
      status: readinessStatus(naver.status),
      has_id: Boolean(naver.has_id),
      has_password: Boolean(naver.has_password),
      // 로컬 설정에 네이버 자격증명이 저장된 시각. 러너가 안 보내면 null(하위호환).
      // P2 러너 릴리스부터 전송 예정 — 마지막 실패 이후 재저장 판단(M-2)에 쓰인다.
      saved_at: safeIsoOrNull(naver.saved_at),
    },
    ai_keys: {
      gemini: readinessStatus(ai.gemini),
      claude: readinessStatus(ai.claude),
      openai: readinessStatus(ai.openai),
      apify: readinessStatus(ai.apify),
      selected_model: redactText(ai.selected_model || "").slice(0, 80),
      selected_model_ready: readinessStatus(ai.selected_model_ready),
    },
    neighbor_messages: {
      status: readinessStatus(neighbor.status),
      count: boundedCount(neighbor.count),
    },
    browser: {
      status: readinessStatus(browser.status),
      last_check_at: safeIsoOrNull(browser.last_check_at),
    },
    media_tools: {
      yt_dlp: readinessStatus(mediaTools.yt_dlp),
      yt_dlp_version: redactText(mediaTools.yt_dlp_version || "").slice(0, 80),
    },
    workers: {
      yeri_write: readinessStatus(workers.yeri_write),
      hyunju_find: readinessStatus(workers.hyunju_find),
    },
  };
}

function sanitizeAgentDiagnostics(value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const providedWorkers = Array.isArray(data.provided_workers) ? data.provided_workers : [];
  const entitlementProducts = Array.isArray(data.entitlement_products) ? data.entitlement_products : [];
  return {
    app_mode: redactText(data.app_mode || "").slice(0, 40),
    build_flavor: redactText(data.build_flavor || "").slice(0, 40),
    provided_workers: providedWorkers.map((item) => redactText(item || "").slice(0, 60)).filter(Boolean).slice(0, 10),
    entitlement_product: redactText(data.entitlement_product || "").slice(0, 40),
    entitlement_products: entitlementProducts.map((item) => redactText(item || "").slice(0, 40)).filter(Boolean).slice(0, 10),
    bundle_split_mismatch: Boolean(data.bundle_split_mismatch),
    version: redactText(data.version || "").slice(0, 40),
    local_state: sanitizeLocalStateDiagnostics(data.local_state),
    polling: sanitizePollingDiagnostics(data.polling),
  };
}

function serverClaimDiagnostics() {
  return {
    ready_for_publish_claim_enabled: Boolean(YERI_READY_FOR_PUBLISH_CLAIM_ENABLED),
    claimable_statuses: Array.from(AGENT_CLAIMABLE_JOB_STATUSES),
  };
}

function sanitizePollingDiagnostics(value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    heartbeat_only: Boolean(data.heartbeat_only),
    skip_commands: Boolean(data.skip_commands),
    skip_jobs: Boolean(data.skip_jobs),
    last_next_job_at: safeIsoOrNull(data.last_next_job_at),
    last_next_job_status: redactText(data.last_next_job_status || "").slice(0, 40),
    last_next_job_id: redactText(data.last_next_job_id || "").slice(0, 80),
    last_next_job_job_status: redactText(data.last_next_job_job_status || "").slice(0, 40),
    last_next_job_error: redactText(data.last_next_job_error || "").slice(0, 200),
    active_job_id: redactText(data.active_job_id || "").slice(0, 80),
    active_job_kind: redactText(data.active_job_kind || "").slice(0, 80),
    active_job_stage: redactText(data.active_job_stage || "").slice(0, 80),
    active_job_age_seconds: boundedDiagnosticCount(data.active_job_age_seconds, 60 * 60 * 24 * 7),
    active_job_latest_stage_error: redactText(data.active_job_latest_stage_error || "").slice(0, 200),
  };
}

function boundedDiagnosticCount(value, max = 1000000) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(Math.floor(count), max));
}

function sanitizeLocalStateDiagnostics(value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (data.available === false) {
    return {
      available: false,
      error: redactText(data.error || "").slice(0, 200),
    };
  }
  const requestFiles = Array.isArray(data.request_files) ? data.request_files : [];
  return {
    available: Boolean(data.available),
    repair_available: Boolean(data.repair_available),
    repair_strategy: redactText(data.repair_strategy || "").slice(0, 80),
    legacy_candidate_count: boundedDiagnosticCount(data.legacy_candidate_count),
    stale_request_count: boundedDiagnosticCount(data.stale_request_count),
    lock_file_action: redactText(data.lock_file_action || "").slice(0, 80),
    request_files: requestFiles
      .map((item) => {
        const row = item && typeof item === "object" && !Array.isArray(item) ? item : {};
        return {
          name: redactText(row.name || "").slice(0, 80),
          exists: Boolean(row.exists),
          stale: Boolean(row.stale),
          repair_action: redactText(row.repair_action || "").slice(0, 80),
          age_seconds: boundedDiagnosticCount(row.age_seconds, 60 * 60 * 24 * 365),
        };
      })
      .slice(0, 5),
  };
}

function publicAgent(agent) {
  if (!agent) {
    return {
      connected: false,
      status: "disconnected",
      last_seen_at: null,
      readiness: defaultReadiness(),
      diagnostics: {
        ...sanitizeAgentDiagnostics({}),
        server_claim: serverClaimDiagnostics(),
      },
    };
  }
  const lastSeen = Date.parse(agent.last_seen_at || "");
  const connected = Number.isFinite(lastSeen) && Date.now() - lastSeen < 90 * 1000;
  return {
    connected,
    status: connected ? agent.status || "connected" : "disconnected",
    last_seen_at: agent.last_seen_at || null,
    version: agent.version || "",
    version_info: versionPayload(agent.version || "", agent.platform || ""),
    platform: agent.platform || "",
    device_label: agent.device_label || "",
    readiness: sanitizeReadiness(agent.readiness || defaultReadiness()),
    diagnostics: {
      ...sanitizeAgentDiagnostics(agent.diagnostics || {}),
      server_claim: serverClaimDiagnostics(),
    },
  };
}

function agentPlatformKey(agentOrPlatform) {
  const value = typeof agentOrPlatform === "string" ? agentOrPlatform : agentOrPlatform?.platform;
  return normalizePlatform(value || "");
}

function newestAgentFirst(a, b) {
  return String(b?.last_seen_at || b?.updated_at || b?.created_at || "")
    .localeCompare(String(a?.last_seen_at || a?.updated_at || a?.created_at || ""));
}

function findAgentForUser(agents, userId, platformValue = "") {
  const rows = (agents.agents || []).filter((item) => item.user_id === userId);
  const platform = normalizePlatform(platformValue);
  if (platform) {
    const platformRows = rows.filter((item) => agentPlatformKey(item) === platform).sort(newestAgentFirst);
    if (platformRows.length) return platformRows[0];
  }
  return rows.sort(newestAgentFirst)[0] || null;
}

function findHeartbeatAgent(agents, userId, platformValue = "", deviceLabel = "") {
  const platform = normalizePlatform(platformValue);
  const label = String(deviceLabel || "").trim();
  const rows = (agents.agents || []).filter((item) => item.user_id === userId);
  if (platform && label) {
    const exact = rows.find((item) => agentPlatformKey(item) === platform && String(item.device_label || "").trim() === label);
    if (exact) return exact;
  }
  if (platform) {
    const samePlatform = rows.find((item) => agentPlatformKey(item) === platform && !String(item.device_label || "").trim());
    if (samePlatform) return samePlatform;
  }
  if (!platform && label) {
    const sameDevice = rows.find((item) => String(item.device_label || "").trim() === label);
    if (sameDevice) return sameDevice;
  }
  return null;
}

function requestPlatform(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    return normalizePlatform(url.searchParams.get("platform") || "");
  } catch (_error) {
    return "";
  }
}

function requestDeviceLabel(req, auth = null) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const queryLabel = String(url.searchParams.get("device_label") || "").trim();
    if (queryLabel) return queryLabel.slice(0, 120);
  } catch (_error) {}
  return String(auth?.session?.device_label || "").trim().slice(0, 120);
}

function requestAgentPlatform(req, auth = null) {
  return requestPlatform(req) || normalizePlatform(requestDeviceLabel(req, auth));
}

function jobMatchesAgentTarget(job, platformValue, deviceLabelValue) {
  const targetPlatform = normalizePlatform(job?.target_platform || "");
  const targetDeviceLabel = String(job?.target_device_label || "").trim();
  const platform = normalizePlatform(platformValue || "");
  const deviceLabel = String(deviceLabelValue || "").trim();
  if (targetPlatform) {
    if (!platform || targetPlatform !== platform) return false;
  }
  if (targetDeviceLabel) {
    if (!deviceLabel || targetDeviceLabel !== deviceLabel) return false;
  }
  return true;
}

const emailRe = /\b([A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]*(@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g;
const homePathRe = /\/Users\/[^/\s]+|\/home\/[^/\s]+/g;
const secretAssignmentRe = /\b([\w.\-\s]*(?:password|passwd|pw|api[\s_-]?key|apikey|token|secret|cookie|session)[\w.\-\s]*)(["'\s:=]+)([^"'\s,;\]}]+)/gi;
const headerSecretRe = /\b(Authorization|Cookie|Set-Cookie)(\s*[:=]\s*)([^\r\n]+)/gi;
const naverCookieRe = /\b(NID_AUT|NID_SES)(=)([^;\s,]+)/gi;
const tokenPatterns = [
  /\bAIza[0-9A-Za-z_\-]{20,}\b/g,
  /\bsk-[0-9A-Za-z_\-]{20,}\b/g,
  /\b[a-zA-Z0-9_\-]{32,}\.[a-zA-Z0-9_\-]{16,}\.[a-zA-Z0-9_\-]{16,}\b/g,
  /\b[A-Za-z0-9_\-]{48,}\b/g,
];
const urlRe = /\bhttps?:\/\/[^\s<>"')\]}]+/gi;
const sensitiveUrlKeyRe = /(^|[-_])(x-amz|signature|sig|token|expires|expiry|policy|credential|key-pair-id|awsaccesskeyid|googleaccessid|signed|secret|session)([-_]|$)/i;
const sensitiveUrlTextRe = /\b(x-amz-|signature=|sig=|token=|expires=|expiry=|policy=|credential=|key-pair-id=|awsaccesskeyid=|googleaccessid=|signed|secret|\/private\/|\/signed\/)/i;

function isSensitiveUrl(value) {
  const raw = String(value || "");
  if (!raw) return false;
  if (sensitiveUrlTextRe.test(raw)) return true;
  try {
    const parsed = new URL(raw);
    for (const key of parsed.searchParams.keys()) {
      if (sensitiveUrlKeyRe.test(key)) return true;
    }
    const hostPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return /(^|\.)signed[.-]|(^|\.)private[.-]|\/private\/|\/signed\//i.test(hostPath);
  } catch (_error) {
    return false;
  }
}

function redactSensitiveUrls(input) {
  return String(input || "").replace(urlRe, (match) => {
    let url = match;
    let suffix = "";
    while (/[.,;:!?]$/.test(url)) {
      suffix = `${url.slice(-1)}${suffix}`;
      url = url.slice(0, -1);
    }
    return isSensitiveUrl(url) ? `[REDACTED_SENSITIVE_URL]${suffix}` : match;
  });
}

function redactText(input) {
  let text = String(input ?? "");
  text = text.replace(emailRe, "$1***$2");
  text = text.replace(homePathRe, (match) => {
    const parts = match.split("/");
    return `/${parts[1]}/***`;
  });
  text = redactSensitiveUrls(text);
  text = text.replace(secretAssignmentRe, "$1$2[REDACTED]");
  text = text.replace(headerSecretRe, "$1$2[REDACTED]");
  text = text.replace(naverCookieRe, "$1$2[REDACTED]");
  for (const pattern of tokenPatterns) {
    text = text.replace(pattern, "[REDACTED_TOKEN]");
  }
  return text;
}

function redactValue(key, value) {
  const lower = String(key || "").toLowerCase();
  if (/(password|passwd|pw|api[_-]?key|apikey|token|secret|cookie|session)/.test(lower)) {
    if (value === null || value === undefined || value === "") return value;
    return "[REDACTED]";
  }
  if (/(signed|private|media)[\w.-]*url|url[\w.-]*(signed|private|media)/.test(lower)) {
    if (value === null || value === undefined || value === "") return value;
    return "[REDACTED_SENSITIVE_URL]";
  }
  return redactPayload(value);
}

function redactPayload(value) {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(key, item)]));
  }
  if (typeof value === "string") return redactText(value);
  return value;
}

function safeReportId(value) {
  const cleaned = cleanReportId(value);
  if (cleaned) return cleaned;
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `AIMAX-RPT-${stamp}-${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeReportStatus(value) {
  const raw = String(value || "new").trim();
  const normalized = REPORT_STATUS_ALIASES[raw] || raw;
  return REPORT_STATUS_META[normalized] ? normalized : "new";
}

function reportStatusMeta(value) {
  return REPORT_STATUS_META[normalizeReportStatus(value)] || REPORT_STATUS_META.new;
}

function reportActionChecklist(row) {
  const status = normalizeReportStatus(row?.status || "new");
  if (isFeedbackReport(row)) return [];
  if (status !== "waiting_user") return [];
  const text = [
    row?.product,
    row?.os,
    row?.work_context,
    row?.visible_error,
    row?.public_message,
    row?.next_update_message,
  ].join(" ").toLowerCase();
  if (text.includes("서로이웃") || text.includes("현주") || text.includes("neighbor")) {
    return [
      "설정 탭을 엽니다.",
      "웹 작업 설정에서 서로이웃 신청 멘트를 1개 이상 저장합니다.",
      "현주 영업사원을 다시 실행합니다.",
      "문제가 계속되면 아래 '아직 안 돼요'를 눌러주세요.",
    ];
  }
  if (
    (text.includes("windows") || text.includes("윈도우"))
    && (
      text.includes("설치")
      || text.includes("인스톨")
      || text.includes("아무 변화")
      || text.includes("반응")
      || text.includes("열리지 않")
      || text.includes("v3")
      || text.includes("ahnlab")
      || text.includes("smartscreen")
      || text.includes("차단")
      || text.includes("격리")
    )
  ) {
    return [
      "다운로드 폴더에서 AIMAX 설치 파일 이름이 aimax-bundle-windows.exe인지 확인합니다.",
      "V3 Lite, SmartScreen, 회사 보안 프로그램의 보안 기록에서 AIMAX 설치 파일 차단 또는 앱 격리 검사 내역을 확인합니다.",
      "공식 AIMAX 앱에서 받은 파일이면 보안 프로그램에서 허용 또는 검사 예외로 설정한 뒤 설치 파일을 한 번만 다시 실행합니다.",
      "그래도 설치창이 안 보이면 보안 기록 화면과 작업 관리자에 AIMAX 또는 Setup 프로세스가 보이는지 캡처해 카카오채널로 알려주세요.",
    ];
  }
  if (text.includes("windows") || text.includes("윈도우") || text.includes("v1.0.3") || text.includes("실행기")) {
    const latestWindowsVersion = PLATFORM_AGENT_VERSIONS.windows?.latest || "최신 버전";
    return [
      "업데이트 탭 또는 설치 파일 메뉴에서 최신 Windows 설치 파일을 다운로드합니다.",
      "설치 후 웹앱을 새로고침합니다.",
      `실행기 연결을 다시 누르고 로컬 실행기 버전이 ${latestWindowsVersion}인지 확인합니다.`,
      "작업을 다시 실행한 뒤 결과를 아래 버튼으로 알려주세요.",
    ];
  }
  return [
    "운영팀 안내 내용을 순서대로 확인합니다.",
    "같은 작업을 다시 실행합니다.",
    "결과를 아래 버튼으로 알려주세요.",
  ];
}

function cleanSupportMessage(value, fallback) {
  const text = String(value || "").trim().slice(0, 500);
  return text || fallback;
}

function reportKind(report) {
  const kind = String(report?.report_kind || report?.kind || "").trim().toLowerCase();
  const source = String(report?.source || "").trim().toLowerCase();
  return kind === "feedback" || source === "staff_feedback" ? "feedback" : "error";
}

function isFeedbackReport(report) {
  return reportKind(report) === "feedback";
}

function feedbackStatusMeta(value) {
  const status = normalizeReportStatus(value);
  const meta = reportStatusMeta(status);
  const overrides = {
    new: {
      publicMessage: "직원 피드백이 접수되었습니다. 운영팀 알림이 전달되었습니다.",
      nextUpdateMessage: "운영팀이 확인한 뒤 필요한 개선사항에 반영합니다.",
    },
    reviewing: {
      publicMessage: "운영자가 피드백을 확인 중입니다.",
      nextUpdateMessage: "반영이 필요한 내용은 개선 목록으로 옮겨 검토합니다.",
    },
    working: {
      publicMessage: "피드백을 바탕으로 개선 작업을 검토하거나 진행 중입니다.",
      nextUpdateMessage: "반영이 끝나면 이 화면의 상태가 완료로 바뀝니다.",
    },
    waiting_user: {
      publicMessage: "피드백 확인을 위해 추가 정보가 필요합니다.",
      nextUpdateMessage: "운영팀 안내에 따라 필요한 정보를 카카오채널로 알려주세요.",
    },
    done: {
      publicMessage: "피드백 확인이 완료되었습니다.",
      nextUpdateMessage: "추가 의견이 있으면 직원 피드백으로 다시 남겨주세요.",
    },
  }[status] || {};
  return { ...meta, ...overrides };
}

function reportSupportMeta(report, status) {
  return isFeedbackReport(report) ? feedbackStatusMeta(status) : reportStatusMeta(status);
}

const REPORT_AUTO_GUIDANCE = {
  image_paid_required: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "이미지 생성 단계에서 선택된 이미지 모델을 현재 API 키/요금제에서 사용할 수 없어 실패했습니다. 글쓰기 기능 전체가 고장난 것은 아니며, 이미지 생성 권한 또는 유료 이미지 모델 사용 가능 여부 확인이 필요한 상태입니다.",
    next_update_message: "설정 > AI/API 연결에서 이미지 생성 가능한 Gemini 또는 OpenAI 키와 선택 모델 권한을 확인한 뒤, 이미지 1장짜리 새 작업 1건만 다시 시도해주세요. 급하면 이미지 0장으로 먼저 글쓰기만 진행할 수 있습니다.",
  },
  image_generation_failed: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "본문은 생성됐지만 이미지 생성 또는 네이버 이미지 첨부가 완료되지 않아 작업이 중단되었습니다. 생성된 원고는 로컬 실행기의 generated 폴더에 보존됩니다.",
    next_update_message: "이미지 0장 또는 1장으로 새 작업 1건만 다시 시도해주세요. 같은 문제가 반복되면 이미지 모델/API 권한을 확인하고, generated 폴더의 원고와 이미지 파일을 수동으로 붙여넣을 수 있습니다.",
  },
  api_key_missing: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "AI/API 키가 저장되어 있지 않거나 실행기/웹앱에서 사용할 수 없는 상태입니다.",
    next_update_message: "설정 > AI/API 연결에서 사용하는 제공자 키를 저장한 뒤 웹앱을 새로고침하고 새 작업 1건만 다시 시도해주세요.",
  },
  api_key_invalid: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "저장된 AI/API 키가 제공자 서버에서 인증 실패로 거부되었습니다. 키가 잘못 복사되었거나 폐기된 상태일 수 있습니다.",
    next_update_message: "제공자 콘솔에서 새 API 키를 발급해 설정 > AI/API 연결에 다시 저장한 뒤 새 작업 1건만 다시 시도해주세요.",
  },
  quota_exceeded: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "AI 제공자의 결제/크레딧/요금제 한도 때문에 작업이 중단되었습니다. AIMAX 실행기 오류가 아니라 API 계정 상태 확인이 필요한 케이스입니다.",
    next_update_message: "사용 중인 AI 제공자 콘솔에서 결제, 크레딧, 사용량 한도를 확인한 뒤 키를 다시 저장하거나 다른 사용 가능한 모델로 바꿔 1건만 테스트해주세요.",
  },
  rate_limited: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "AI 무료 사용량 또는 분당 호출 한도에 걸린 상태입니다. 같은 작업을 반복 제출하면 대기 시간이 더 길어질 수 있습니다.",
    next_update_message: "분당 한도면 10~30분 뒤, 일일 무료 한도면 다음 날 다시 시도해주세요. 급하면 본인 유료 API 키를 등록하거나 이미지 수/글 수를 줄여 1건만 테스트해주세요.",
  },
  model_not_found: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "선택한 AI 모델을 현재 계정에서 사용할 수 없거나 모델명이 맞지 않아 작업이 중단되었습니다.",
    next_update_message: "설정 > AI/API 연결에서 AIMAX 기본 모델 또는 현재 계정에서 사용 가능한 모델로 바꾼 뒤 새 작업 1건만 다시 시도해주세요.",
  },
  organization_verification_required: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "OpenAI 이미지 모델 사용에 필요한 조직 인증 또는 모델 권한이 완료되지 않아 이미지 생성이 중단되었습니다.",
    next_update_message: "OpenAI 개발자 콘솔에서 조직 인증과 이미지 모델 사용 권한을 확인한 뒤, 이미지 1장짜리 새 작업 1건만 다시 시도해주세요. 급하면 이미지 0장으로 먼저 글쓰기만 진행할 수 있습니다.",
  },
  provider_transient: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "AI 제공자 서버가 일시적으로 응답하지 않아 실패한 건입니다. 코드나 실행기 고장보다는 외부 제공자 일시 장애 가능성이 큽니다.",
    next_update_message: "같은 작업을 여러 번 반복하지 말고 10~30분 뒤 새 작업 1건만 다시 시도해주세요. 반복되면 이 접수 ID로 다시 알려주세요.",
  },
  web_login_failed: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "웹앱 로그인 이메일 또는 비밀번호가 맞지 않아 연결이 실패했습니다.",
    next_update_message: "이메일 대소문자/공백을 확인하고 비밀번호를 다시 입력해주세요. 계속 실패하면 비밀번호 재설정 또는 운영팀 확인이 필요합니다.",
  },
  naver_login_required: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "네이버 로그인 또는 2단계 인증/보안 확인 화면에서 다음 단계로 넘어가지 못한 상태입니다. 네이버 계정 보안 확인이 먼저 필요합니다.",
    next_update_message: "실행기에서 열린 브라우저에서 네이버 로그인, 2단계 인증, 새 기기 등록을 완료한 뒤 AIMAX 웹앱을 새로고침하고 새 작업 1건만 다시 시도해주세요.",
  },
  mac_gatekeeper: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "macOS 보안 허용 후 AIMAX 실행기가 바로 보이지 않는 상태입니다. 앱이 차단되었거나 백그라운드 실행/권한 허용이 끝나지 않았을 수 있습니다.",
    next_update_message: "AIMAX를 완전히 종료한 뒤 최신 macOS 설치 파일을 다시 설치하고, 시스템 설정 > 개인정보 보호 및 보안에서 허용 후 앱을 한 번 더 실행해주세요. 그래도 무반응이면 접수 ID와 함께 알려주세요.",
  },
  runner_update_required: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "로컬 실행기 버전 또는 연결 상태가 현재 웹 작업과 맞지 않아 업데이트/재연결이 필요한 상태입니다.",
    next_update_message: "웹앱 업데이트 탭에서 최신 설치 파일을 받은 뒤 AIMAX와 열린 브라우저를 모두 닫고 설치하세요. 설치 후 실행기 연결을 다시 누르고 새 작업 1건만 테스트해주세요.",
  },
  browser_driver_policy_blocked: {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "Windows 보안 또는 회사 보안 정책이 브라우저 드라이버 실행을 차단해 네이버 글쓰기 브라우저를 시작하지 못했습니다.",
    next_update_message: "Windows 보안 > 보호 기록 또는 사용 중인 보안 프로그램에서 chromedriver/undetected_chromedriver/AIMAX 차단 내역을 허용 또는 복원한 뒤, AIMAX와 Chrome을 모두 닫고 새 작업 1건만 다시 시도해주세요.",
  },
  staff_feedback_reviewing: {
    status: "reviewing",
    status_label: "확인 중",
    public_message: "남겨주신 직원 피드백을 운영팀이 확인 중입니다. 기능 오류인지, 설정/사용량/계정 상태 문제인지 함께 분류합니다.",
    next_update_message: "추가 조치가 확인되면 이 화면에 안내가 업데이트됩니다. 같은 증상은 여러 번 보내지 않아도 됩니다.",
  },
};

function reportAutoGuidanceText(report) {
  return [
    report.source,
    report.report_kind,
    report.user_input?.work_context,
    report.user_input?.visible_error,
    report.user_input?.user_note,
    report.feedback?.improve,
    report.feedback?.good,
    report.system?.runtime?.system,
    report.web_context?.platform,
    JSON.stringify(reportRecentJobs(report).slice(0, 5)),
  ].filter(Boolean).join(" ").toLowerCase();
}

function classifyReportAutoGuidance(report) {
  if (isFeedbackReport(report)) return REPORT_AUTO_GUIDANCE.staff_feedback_reviewing;
  const text = reportAutoGuidanceText(report);
  const rules = [
    ["browser_driver_policy_blocked", /browser_start|브라우저 시작|chromedriver|undetected_chromedriver|애플리케이션 제어 정책|application control policy|winerror 4551/],
    ["web_login_failed", /로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지/],
    ["naver_login_required", /네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리/],
    ["mac_gatekeeper", /macos|개인정보 보호 및 보안|그래도 열기|open anyway|다시실행 하면 아무 반응/],
    ["image_paid_required", /image_paid_reauired|image_paid_required|이미지.*유료|이미지.*사용불가|이미지 모델/],
    ["image_generation_failed", /image_generation_failed|이미지 생성 실패|이미지.*0장|요청 \d+장 중 0장|image_upload_failed|image_uploaded_but_not_inserted/],
    ["organization_verification_required", /organization_verification_required|organization verification|verify your organization|must be verified|조직 인증/],
    ["model_not_found", /model_not_found|unsupported model|모델.*잘못|모델.*사용할 수 없|ai모델 사용불가/],
    ["runner_update_required", /update_required|필수 업데이트|최신.*설치|구버전|실행기.*업데이트/],
    ["api_key_missing", /api[_ -]?key.*missing|key_missing|no api key|no api key was provided|키가.*없|키.*저장.*필요|api.*저장.*안/],
    ["api_key_invalid", /api_key_invalid|invalid api key|api key not valid|인증 실패|키 인증 실패|unauthorized/],
    ["quota_exceeded", /quota_exceeded|insufficient_quota|billing|payment|credit|balance|크레딧|결제|요금제 한도|한도 초과/],
    ["rate_limited", /rate_limited|rate limit|resource_exhausted|429|무료 사용량|분당|일일 한도/],
    ["provider_transient", /provider_transient|temporar|unavailable|overloaded|일시적 오류|잠시 후/],
  ];
  for (const [key, pattern] of rules) {
    if (pattern.test(text)) return { key, ...REPORT_AUTO_GUIDANCE[key] };
  }
  return null;
}

function applyReportAutoGuidance(report, storedAt) {
  const guidance = classifyReportAutoGuidance(report);
  if (!guidance) return null;
  report.support = {
    ...(report.support || {}),
    status: guidance.status,
    status_label: guidance.status_label,
    public_message: guidance.public_message,
    next_update_message: guidance.next_update_message,
    updated_at: storedAt,
    auto_guidance_category: guidance.key || "staff_feedback_reviewing",
    auto_guidance_source: "handleReport",
  };
  return guidance;
}

function reportFeedback(report) {
  const feedback = report?.feedback && typeof report.feedback === "object" && !Array.isArray(report.feedback)
    ? report.feedback
    : {};
  const userInput = report?.user_input || {};
  return {
    employee_code: compactText(feedback.employee_code || feedback.employee || "", 80),
    employee_label: compactText(feedback.employee_label || feedback.employee_name || "", 80),
    rating: compactText(feedback.rating || feedback.score || "", 20),
    good: compactText(feedback.good || feedback.positive || "", 700),
    improve: compactText(feedback.improve || feedback.request || userInput.visible_error || "", 700),
    contact_needed: Boolean(feedback.contact_needed),
  };
}

function reportAppVersion(report) {
  return report.system?.app?.version
    || report.system?.agent?.version
    || report.agent_context?.version
    || report.web_context?.agent?.version
    || "";
}

function reportOs(report) {
  return report.system?.runtime?.system
    || report.system?.runtime?.platform
    || report.web_context?.detected_platform
    || report.web_context?.platform
    || "";
}

function reportRecentJobs(report) {
  const candidates = [
    report.system?.agent?.jobs_recent,
    report.system?.jobs_recent,
    report.agent_context?.jobs_recent,
    report.jobs_recent,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  }
  return [];
}

function reportPrimaryJob(report) {
  const jobs = reportRecentJobs(report);
  if (!jobs.length) return null;
  if (isFeedbackReport(report)) return jobs[0];
  return jobs.find((job) => ["failed", "cancelled", "running"].includes(String(job.status || ""))) || jobs[0];
}

function reportJobStage(job) {
  if (!job || typeof job !== "object") return "";
  return job.failed_stage
    || job.result?.failed_stage
    || job.result?.stage
    || "";
}

function reportJobFailedKeyword(job) {
  if (!job || typeof job !== "object") return "";
  return job.failed_keyword
    || job.result?.failed_keyword
    || "";
}

function reportJobSummary(report) {
  const job = reportPrimaryJob(report);
  if (!job) {
    return {
      job_id: "",
      job_kind: "",
      job_worker: "",
      job_status: "",
      job_stage: "",
      job_failed_keyword: "",
    };
  }
  return {
    job_id: job.id || job.job_id || "",
    job_kind: job.kind || "",
    job_worker: job.worker_code || job.worker || "",
    job_status: job.status || "",
    job_stage: reportJobStage(job),
    job_failed_keyword: reportJobFailedKeyword(job),
  };
}

function reportMediaTools(report) {
  const candidates = [
    report.system?.research?.media_tools,
    report.research?.media_tools,
    report.media_tools,
  ];
  return candidates.find((value) => value && typeof value === "object" && !Array.isArray(value)) || null;
}

function reportMediaToolSummary(report) {
  const tools = reportMediaTools(report);
  if (!tools) {
    return {
      media_tools_ready: "",
      media_tools_missing: "",
    };
  }
  const missing = [
    tools.video_download?.available === false ? "yt-dlp" : "",
    tools.frame_extract?.available === false ? "ffmpeg" : "",
  ].filter(Boolean);
  return {
    media_tools_ready: tools.video_file_analysis_ready === true ? "ready" : missing.length ? "missing" : "",
    media_tools_missing: missing.join(", "),
  };
}

function compactJobLine(summary) {
  const parts = [
    summary.job_id ? `job=${summary.job_id}` : "",
    summary.job_kind ? `kind=${summary.job_kind}` : "",
    summary.job_worker ? `worker=${summary.job_worker}` : "",
    summary.job_status ? `status=${summary.job_status}` : "",
    summary.job_stage ? `stage=${summary.job_stage}` : "",
    summary.job_failed_keyword ? `keyword=${summary.job_failed_keyword}` : "",
  ].filter(Boolean);
  return parts.join(" / ");
}

function summaryFor(report, storedAt, dateKey) {
  const support = report.support || {};
  const account = report.account || {};
  const status = normalizeReportStatus(support.status || report.status || "new");
  const meta = reportSupportMeta(report, status);
  const jobSummary = reportJobSummary(report);
  const mediaToolSummary = reportMediaToolSummary(report);
  const feedback = reportFeedback(report);
  return {
    report_id: report.report_id,
    stored_at: storedAt,
    date: dateKey,
    source: report.source || "",
    report_kind: reportKind(report),
    account_user_id: account.user_id || "",
    account_email: account.email || "",
    product: account.product || "",
    app_version: reportAppVersion(report),
    os: reportOs(report),
    work_context: report.user_input?.work_context || "",
    visible_error: report.user_input?.visible_error || "",
    user_note: report.user_input?.user_note || "",
    feedback_employee_code: feedback.employee_code,
    feedback_employee_label: feedback.employee_label,
    feedback_rating: feedback.rating,
    feedback_good: feedback.good,
    feedback_improve: feedback.improve,
    feedback_contact_needed: feedback.contact_needed,
    ...jobSummary,
    ...mediaToolSummary,
    status,
    status_updated_at: support.updated_at || storedAt,
    status_label: support.status_label || meta.label,
    public_message: support.public_message || meta.publicMessage,
    next_update_message: support.next_update_message || meta.nextUpdateMessage,
    user_response: support.user_response || "",
    user_response_note: support.user_response_note || "",
    user_response_updated_at: support.user_response_updated_at || "",
    automation_ticket_id: support.automation_ticket_id || "",
  };
}

function automationTicketId(reportId, storedAt) {
  const stamp = String(storedAt || nowIso()).replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = crypto.createHash("sha256").update(String(reportId || "")).digest("hex").slice(0, 8);
  return `AIMAX-AUTO-${stamp}-${suffix}`;
}

function automationTicketCategory(summary, report) {
  if (isFeedbackReport(summary)) return "staff_feedback";
  const autoGuidanceCategory = sanitizeFailedStage(report?.support?.auto_guidance_category || summary.auto_guidance_category || "");
  if (/api_key|quota|rate_limit|provider_transient|model_not_found|image_paid_required/.test(autoGuidanceCategory)) return "user_ai_provider";
  if (/runner_update_required/.test(autoGuidanceCategory)) return "local_runner";
  if (/naver_login_required/.test(autoGuidanceCategory)) return "naver_editor";
  const diagnostic = report?.diagnostic || report?.system?.agent?.diagnostic || reportPrimaryJob(report)?.diagnostic || null;
  const diagnosticCode = sanitizeFailedStage(diagnostic?.code || "");
  const stage = sanitizeFailedStage(summary.job_stage || "");
  const worker = sanitizeFailedStage(summary.job_worker || summary.job_kind || "");
  if (/api_key|quota|rate_limit|provider_transient|model_not_found|image_paid_required/.test(diagnosticCode)) return "user_ai_provider";
  if (/runner|local_worker|local_ui_queue/.test(diagnosticCode) || /runner/.test(stage)) return "local_runner";
  if (/smart_editor|publish|save|image_upload|image_insert/.test(stage)) return "naver_editor";
  if (/yeri/.test(worker)) return "yeri";
  if (/songi|research|youtube/.test(worker) || /research|youtube/.test(stage)) return "songi_research";
  if (/yunmi/.test(worker)) return "yunmi";
  return "general_error";
}

function automationTicketPriority(summary, report) {
  if (isFeedbackReport(summary)) return summary.feedback_contact_needed ? "normal" : "low";
  const diagnostic = report?.diagnostic || report?.system?.agent?.diagnostic || reportPrimaryJob(report)?.diagnostic || null;
  if (diagnostic?.admin_action_required) return "high";
  const text = [
    summary.visible_error,
    summary.user_note,
    report?.user_input?.user_note,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/한번도|한 번도|단 한번도|발행.*된 적|never.*publish|never.*posted/.test(text)) return "high";
  if (summary.job_status === "failed" || summary.status === "new") return "normal";
  return "low";
}

function automationTicketNextAction(category) {
  if (category === "local_runner") return "실행기 로그/버전/큐 처리 상태를 확인하고 재현 테스트를 준비";
  if (category === "naver_editor") return "Smart Editor selector/저장/발행 경로를 재현하고 패치 후보 준비";
  if (category === "user_ai_provider") return "사용자 안내로 해결 가능한 API 키/한도/제공자 일시 오류인지 분류";
  if (category === "staff_feedback") return "직원 피드백을 개선 후보로 분류하고 필요 시 사용자 추가 정보 요청";
  if (category === "songi_research") return "송이/리서치 작업 로그와 외부 도구 상태를 확인";
  if (category === "yunmi") return "윤미 대본 생성 입력/AI 응답/후처리 단계를 확인";
  if (category === "yeri") return "예리 글 생성/이미지/네이버 저장 흐름을 확인";
  return "오류 보고 상세와 최근 job 로그를 확인해 수정 필요 여부 분류";
}

function buildAutomationTicketForReport(report, storedAt, dateKey) {
  const summary = summaryFor(report, storedAt, dateKey);
  const category = automationTicketCategory(summary, report);
  return {
    ticket_id: automationTicketId(summary.report_id, storedAt),
    source: "admin_report",
    status: automationTicketStatusForReportStatus(summary.status),
    priority: automationTicketPriority(summary, report),
    category,
    report_id: summary.report_id || "",
    report_kind: summary.report_kind || "error",
    created_at: storedAt,
    updated_at: storedAt,
    account_email: summary.account_email || "",
    product: summary.product || "",
    app_version: summary.app_version || "",
    os: summary.os || "",
    job_id: summary.job_id || "",
    job_kind: summary.job_kind || "",
    job_worker: summary.job_worker || "",
    job_status: summary.job_status || "",
    job_stage: summary.job_stage || "",
    user_note: compactText(summary.user_note || "", 500),
    visible_error: compactText(summary.visible_error || summary.feedback_improve || "", 700),
    work_context: compactText(summary.work_context || "", 500),
    suggested_next_action: automationTicketNextAction(category),
    admin_url: `${PUBLIC_BASE_URL}/admin#reports`,
  };
}

function automationTicketStatusForReportStatus(status) {
  const value = normalizeReportStatus(status || "new");
  if (value === "done") return "done";
  if (value === "waiting_user") return "waiting_user";
  if (value === "working") return "working";
  return "open";
}

function appendAutomationTicket(ticket) {
  appendJsonLineDurable(AUTOMATION_TICKETS_PATH, ticket);
  return ticket;
}

function appendAutomationTicketStatusUpdate(ticketId, reportId, status, updatedAt = nowIso()) {
  const cleanTicketId = String(ticketId || "").trim();
  if (!cleanTicketId) return null;
  const ticket = {
    ticket_id: cleanTicketId,
    source: "admin_report",
    status: automationTicketStatusForReportStatus(status),
    report_id: String(reportId || "").trim(),
    updated_at: updatedAt,
  };
  appendAutomationTicket(ticket);
  return ticket;
}

function loadAutomationTickets(limit = 200) {
  if (!fs.existsSync(AUTOMATION_TICKETS_PATH)) return [];
  return fs.readFileSync(AUTOMATION_TICKETS_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => JSON.parse(line));
}

function latestAutomationTickets(limit = 200) {
  const latest = new Map();
  for (const ticket of loadAutomationTickets(limit)) {
    const ticketId = String(ticket.ticket_id || "");
    if (!ticketId) continue;
    latest.set(ticketId, { ...(latest.get(ticketId) || {}), ...ticket });
  }
  return [...latest.values()];
}

function loadReportIndexRows(limit = 200) {
  if (!fs.existsSync(INDEX_PATH)) return [];
  return fs.readFileSync(INDEX_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => JSON.parse(line));
}

function publicReportSummary(row) {
  const status = normalizeReportStatus(row.status || "new");
  const meta = isFeedbackReport(row) ? feedbackStatusMeta(status) : reportStatusMeta(status);
  const actionChecklist = reportActionChecklist({ ...row, status });
  return {
    report_id: row.report_id || "",
    stored_at: row.stored_at || "",
    source: row.source || "",
    report_kind: row.report_kind || reportKind(row),
    status,
    status_updated_at: row.status_updated_at || row.stored_at || "",
    status_label: row.status_label || meta.label,
    public_message: row.public_message || meta.publicMessage,
    next_update_message: row.next_update_message || meta.nextUpdateMessage,
    user_action_title: status === "waiting_user" ? "확인 방법" : "",
    user_action_checklist: actionChecklist,
    user_response_required: status === "waiting_user" && actionChecklist.length > 0,
    user_response: row.user_response || "",
    user_response_updated_at: row.user_response_updated_at || "",
    automation_ticket_id: row.automation_ticket_id || "",
    work_context: row.work_context || "",
    visible_error: row.visible_error || "",
    user_note: row.user_note || "",
    feedback_employee_code: row.feedback_employee_code || "",
    feedback_employee_label: row.feedback_employee_label || "",
    feedback_rating: row.feedback_rating || "",
    feedback_good: row.feedback_good || "",
    feedback_improve: row.feedback_improve || "",
    feedback_contact_needed: Boolean(row.feedback_contact_needed),
    job_id: row.job_id || "",
    job_kind: row.job_kind || "",
    job_worker: row.job_worker || "",
    job_status: row.job_status || "",
    job_stage: row.job_stage || "",
    job_failed_keyword: row.job_failed_keyword || "",
    media_tools_ready: row.media_tools_ready || "",
    media_tools_missing: row.media_tools_missing || "",
  };
}

function adminReportSummary(row) {
  return {
    ...publicReportSummary(row),
    source: row.source || "",
    account_email: row.account_email || "",
    product: row.product || "",
    app_version: row.app_version || "",
    os: row.os || "",
    automation_ticket_id: row.automation_ticket_id || "",
    user_notified_at: row.user_notified_at || "",
    user_notify_failed_at: row.user_notify_failed_at || "",
  };
}

function cleanReportId(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 120);
}

function reportPathFromSummary(row) {
  const dateKey = String(row.date || row.stored_at || "").slice(0, 10);
  const reportId = cleanReportId(row.report_id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !reportId) return "";
  return path.join(REPORTS_DIR, dateKey, `${reportId}.json`);
}

function updateReportIndexSummary(reportId, summary) {
  const cleanId = cleanReportId(reportId);
  if (!cleanId || !fs.existsSync(INDEX_PATH)) return null;
  const rows = loadReportIndexRows(Number.MAX_SAFE_INTEGER);
  let updatedRow = null;
  const nextRows = rows.map((row) => {
    if (cleanReportId(row.report_id) !== cleanId) return row;
    updatedRow = { ...row, ...summary };
    return updatedRow;
  });
  if (!updatedRow) return null;
  writeJsonLinesAtomic(INDEX_PATH, nextRows);
  return updatedRow;
}

// I-1: 여러 행 패치를 한 번의 read-modify-write 로 반영한다(스윕당 파일 재작성 1회).
// aimax_report_auto_guidance.py 가 같은 파일을 크로스 프로세스로 재작성하는 경쟁은 이 배치로
// 줄지만 완전히 없애지는 못한다 — 남은 단일 경쟁 창은 C-2 인메모리 dedup 이 커버한다.
// patchesByReportId: Map<cleanReportId, patchObject>. 반영된 행 수를 반환한다.
function updateReportIndexSummaries(patchesByReportId) {
  if (!patchesByReportId || patchesByReportId.size === 0) return 0;
  if (!fs.existsSync(INDEX_PATH)) return 0;
  const rows = loadReportIndexRows(Number.MAX_SAFE_INTEGER);
  let applied = 0;
  const nextRows = rows.map((row) => {
    const cleanId = cleanReportId(row.report_id);
    if (!cleanId) return row;
    const patch = patchesByReportId.get(cleanId);
    if (!patch) return row;
    applied += 1;
    return { ...row, ...patch };
  });
  if (applied === 0) return 0;
  writeJsonLinesAtomic(INDEX_PATH, nextRows);
  return applied;
}

function loadReportDetail(reportId) {
  const cleanId = cleanReportId(reportId);
  if (!cleanId || !fs.existsSync(INDEX_PATH)) return null;
  const rows = loadReportIndexRows(1000).reverse();
  const row = rows.find((item) => cleanReportId(item.report_id) === cleanId);
  if (!row) return null;
  const reportPath = reportPathFromSummary(row);
  if (!reportPath || !fs.existsSync(reportPath)) return { row, report: null };
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return { row, report };
}

function saveReportDetail(reportPath, report) {
  writeJsonAtomic(reportPath, report);
}

function jsonStorageHealth() {
  const issues = [];
  let checkedFiles = 0;
  try {
    fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    issues.push({
      file: "data-dir",
      code: "storage_not_accessible",
      message: String(error.message || "storage_not_accessible").slice(0, 160),
    });
  }
  for (const spec of jsonStorageFileSpecs()) {
    if (!fs.existsSync(spec.filePath)) continue;
    checkedFiles += 1;
    let data = null;
    try {
      data = JSON.parse(fs.readFileSync(spec.filePath, "utf8"));
    } catch (error) {
      issues.push({
        file: storageFileLabel(spec.filePath),
        code: "json_read_failed",
        message: String(error.message || "json_read_failed").slice(0, 160),
      });
      continue;
    }
    for (const fieldName of spec.arrayFields || []) {
      if (!Array.isArray(data?.[fieldName])) {
        issues.push({
          file: storageFileLabel(spec.filePath),
          code: "json_shape_invalid",
          message: `${fieldName}_must_be_array`,
        });
      }
    }
  }
  if (fs.existsSync(INDEX_PATH)) {
    checkedFiles += 1;
    try {
      const lines = fs.readFileSync(INDEX_PATH, "utf8").split(/\r?\n/).filter(Boolean);
      for (let index = 0; index < lines.length; index += 1) {
        try {
          JSON.parse(lines[index]);
        } catch (error) {
          issues.push({
            file: storageFileLabel(INDEX_PATH),
            code: "jsonl_read_failed",
            message: `line_${index + 1}:${String(error.message || "jsonl_read_failed").slice(0, 120)}`,
          });
          break;
        }
      }
    } catch (error) {
      issues.push({
        file: storageFileLabel(INDEX_PATH),
        code: "jsonl_read_failed",
        message: String(error.message || "jsonl_read_failed").slice(0, 160),
      });
    }
  }
  return {
    ok: issues.length === 0,
    checked_files: checkedFiles,
    issues,
    recent_issues: recentStorageIssues.slice(-5),
  };
}

function workerCatalogContractIssues() {
  const issues = [];
  for (const worker of Object.values(WORKERS)) {
    if (!worker.code) issues.push({ code: "worker_code_missing", worker: worker.label || worker.name || "" });
    if (!worker.staffCode) issues.push({ code: "worker_staff_code_missing", worker: worker.code || "" });
    if (!worker.execution && !worker.type) issues.push({ code: "worker_execution_missing", worker: worker.code || "" });
    if (worker.jobKind) {
      const jobKind = JOB_KINDS[worker.jobKind];
      if (!jobKind) {
        issues.push({ code: "worker_job_kind_missing", worker: worker.code, job_kind: worker.jobKind });
      } else if (jobKind.workerCode !== worker.code) {
        issues.push({
          code: "worker_job_kind_owner_mismatch",
          worker: worker.code,
          job_kind: worker.jobKind,
          owner: jobKind.workerCode || "",
        });
      }
    }
    if ((worker.execution === "web_module" || worker.type === "web_module") && worker.requiredSettings?.includes("naver_account")) {
      issues.push({ code: "web_module_requires_naver_account", worker: worker.code });
    }
    if (worker.execution === "external_download") {
      if (!worker.setupDownloadUrl && !worker.releaseUrl) {
        issues.push({ code: "external_download_url_missing", worker: worker.code });
      }
      if (!Array.isArray(worker.supportedPlatforms) || !worker.supportedPlatforms.length) {
        issues.push({ code: "external_download_platform_missing", worker: worker.code });
      }
    }
  }
  for (const [kind, config] of Object.entries(JOB_KINDS)) {
    const worker = WORKERS[config.workerCode];
    if (!worker) {
      issues.push({ code: "job_kind_worker_missing", job_kind: kind, worker: config.workerCode || "" });
      continue;
    }
    if (worker.jobKind && worker.jobKind !== kind) {
      issues.push({ code: "job_kind_worker_reverse_mismatch", job_kind: kind, worker: worker.code, worker_job_kind: worker.jobKind });
    }
    if (config.queue === false && worker.execution !== "web_module" && worker.type !== "web_module") {
      issues.push({ code: "non_queue_job_kind_not_web_module", job_kind: kind, worker: worker.code });
    }
    if (!config.requiredProduct) issues.push({ code: "job_kind_required_product_missing", job_kind: kind });
  }
  return issues;
}

async function readJsonBody(req, res) {
  try {
    const body = await readBody(req);
    return JSON.parse(body || "{}");
  } catch (error) {
    const statusCode = error.statusCode || 400;
    json(req, res, statusCode, { ok: false, error: error.message || "invalid_json" });
    return null;
  }
}

function postJsonUrl(targetUrl, payload, headers = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (_error) {
      reject(Object.assign(new Error("invalid_mail_url"), { statusCode: 500, code: "invalid_mail_url" }));
      return;
    }
    const body = JSON.stringify(payload);
    const client = parsed.protocol === "https:" ? https : parsed.protocol === "http:" ? http : null;
    if (!client) {
      reject(Object.assign(new Error("unsupported_mail_protocol"), { statusCode: 500, code: "unsupported_mail_protocol" }));
      return;
    }
    const request = client.request(
      parsed,
      {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (response) => {
        const chunks = [];
        let total = 0;
        response.on("data", (chunk) => {
          total += chunk.length;
          if (total <= 1024 * 1024) chunks.push(chunk);
        });
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = text ? JSON.parse(text) : {};
          } catch (_error) {
            data = { text: redactText(text).slice(0, 1000) };
          }
          if (response.statusCode < 200 || response.statusCode >= 300 || data.ok === false) {
            reject(Object.assign(new Error(data.error || `mail_http_${response.statusCode}`), {
              statusCode: response.statusCode || 502,
              code: data.error || "mail_send_failed",
              body: redactPayload(data),
            }));
            return;
          }
          resolve(data);
        });
      },
    );
    request.setTimeout(timeoutMs, () => request.destroy(Object.assign(new Error("mail_request_timeout"), { code: "mail_request_timeout" })));
    request.on("error", (error) => reject(Object.assign(error, { code: error.code || "mail_send_failed" })));
    request.write(body);
    request.end();
  });
}

function guideHtmlFromText(text) {
  const escaped = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="ko">
<body style="margin:0;padding:0;background:#f4f6f3;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#191d1b;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #d9ddd6;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 28px;background:#0f766e;color:#fff;font-size:20px;font-weight:700;">AIMAX 이용 안내</div>
    <div style="padding:28px;line-height:1.65;font-size:15px;white-space:pre-wrap;">${escaped}</div>
    <div style="padding:18px 28px;border-top:1px solid #e5e7eb;color:#66736d;font-size:12px;">AIMAX · 이 메일은 구매자 온보딩 안내를 위해 발송되었습니다.</div>
  </div>
</body>
</html>`;
}

// 메일 발송 설정 여부 — 웹훅(Apps Script) 또는 Resend 중 하나라도 있으면 발송 가능.
function isMailConfigured() {
  return Boolean(MAIL_WEBHOOK_URL || RESEND_API_KEY);
}

// 공용 트랜잭션 메일 발송 — Apps Script 웹훅 우선, 없으면 Resend.
// sendAdminGuideEmail(온보딩)과 waiting_user 오류보고 알림이 함께 쓰는 단일 경로다.
async function sendTransactionalEmail({ to, subject, text, tags = null, emailType = "onboarding_guide" }) {
  if (!isValidEmail(to)) {
    throw Object.assign(new Error("invalid_email"), { statusCode: 400, code: "invalid_email" });
  }
  if (!String(text || "").trim()) {
    throw Object.assign(new Error("empty_mail_body"), { statusCode: 400, code: "empty_mail_body" });
  }
  const html = guideHtmlFromText(text);
  const mailTags = Array.isArray(tags) && tags.length
    ? tags
    : [{ name: "email_type", value: String(emailType || "onboarding_guide").slice(0, 80) }];
  if (MAIL_WEBHOOK_URL) {
    const data = await postJsonUrl(MAIL_WEBHOOK_URL, {
      secret: MAIL_WEBHOOK_SECRET,
      from: MAIL_FROM,
      reply_to: MAIL_REPLY_TO,
      to,
      subject,
      text,
      html,
      tags: mailTags,
    });
    return {
      provider: "apps_script",
      id: data.id || data.message_id || data.provider_message_id || "",
      response: redactPayload(data),
    };
  }
  if (RESEND_API_KEY) {
    const data = await postJsonUrl(
      "https://api.resend.com/emails",
      {
        from: MAIL_FROM,
        to,
        subject,
        html,
        text,
        tags: mailTags,
        reply_to: MAIL_REPLY_TO,
      },
      { authorization: `Bearer ${RESEND_API_KEY}` },
    );
    return {
      provider: "resend",
      id: data.id || "",
      response: redactPayload(data),
    };
  }
  throw Object.assign(new Error("mail_not_configured"), { statusCode: 503, code: "mail_not_configured" });
}

// 기존 온보딩 안내 메일 — 공용 발송 함수를 감싸 호출부 동작을 보존한다.
async function sendAdminGuideEmail({ to, subject, text }) {
  return sendTransactionalEmail({ to, subject, text, emailType: "onboarding_guide" });
}

// ---------------------------------------------------------------------------
// waiting_user 오류보고 이메일 알림 스윕
// 오류보고가 waiting_user 로 바뀌는 경로 중 오라클 auto-guidance 스크립트는 서버 API 를
// 거치지 않고 reports-index.jsonl 을 직접 수정한다. 따라서 전이 훅으로는 못 잡고,
// 주기 스윕으로 미발송 waiting_user 오류보고를 찾아 접수자에게 1회 안내 메일을 보낸다.
// 전체를 try/catch 로 감싸 스토어/메일 오류가 프로세스를 죽이지 않는다(H-1 교훈).
// ---------------------------------------------------------------------------
const WAITING_USER_MAIL_ENABLED = String(process.env.AIMAX_WAITING_USER_MAIL ?? "1").trim() !== "0";
const WAITING_USER_MAIL_LOOKBACK_DAYS = safeInt(process.env.AIMAX_WAITING_USER_MAIL_LOOKBACK_DAYS || "7", 1, 3650);
const WAITING_USER_MAIL_PER_SWEEP = safeInt(process.env.AIMAX_WAITING_USER_MAIL_PER_SWEEP || "10", 1, 1000);
const WAITING_USER_MAIL_INTERVAL_MS = safeInt(process.env.AIMAX_WAITING_USER_MAIL_INTERVAL_MS || "300000", 1000, 24 * 60 * 60 * 1000);
const WAITING_USER_MAIL_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const WAITING_USER_MAIL_MAX_ATTEMPTS = 3;
const WAITING_USER_MAIL_INITIAL_DELAY_MS = Math.min(60 * 1000, WAITING_USER_MAIL_INTERVAL_MS);
let waitingUserMailSweepBusy = false;
let waitingUserMailNotConfiguredWarned = false;
// C-2: 마커 기록이 빈 report_id 나 크로스 프로세스 파일 재작성 경쟁으로 실패해도 재발송하지
// 않도록, 프로세스 수명 동안 유지되는 인메모리 dedup. 발송 성공 직후·마커 기록 시도 전에 채운다.
// 파일에서 재구성되는 마커/쿨다운이 유실되는 단일 경쟁 창을 이 구조가 메꾼다(재시작 시 초기화).
const waitingUserMailSentReportIds = new Set();
const waitingUserMailLastSentByEmail = new Map();

// stored_at 등 ISO 시각을 KST(UTC+9) 표기 문자열로 수동 변환한다.
function waitingUserMailKstTimestamp(value) {
  const ms = Date.parse(String(value || ""));
  if (!Number.isFinite(ms)) return "";
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi} (KST)`;
}

// 메일 본문 구성 — 이모지 금지, redactText 적용 필드만 사용, 시크릿/원문 로그 인용 금지.
function buildWaitingUserReportMail(row) {
  const jobKind = String(row?.job_kind || "").trim();
  const kindLabel = (JOB_KINDS[jobKind] && JOB_KINDS[jobKind].label) || "작업";
  const subject = `[AIMAX] 오류 보고에 확인이 필요합니다 — ${kindLabel}`;
  const storedAtKst = waitingUserMailKstTimestamp(row?.stored_at || row?.status_updated_at || "");
  const publicMessage = redactText(String(row?.public_message || "")).trim();
  const checklist = reportActionChecklist(row);
  const lines = [];
  lines.push("안녕하세요, AIMAX입니다.");
  lines.push("");
  if (storedAtKst) lines.push(`접수 시각: ${storedAtKst}`);
  lines.push(`작업: ${kindLabel}`);
  lines.push("");
  lines.push("진행 중이던 작업에 확인이 필요한 오류가 접수되었습니다.");
  if (publicMessage) {
    lines.push("");
    lines.push(publicMessage);
  }
  if (checklist.length) {
    lines.push("");
    lines.push("확인 방법:");
    checklist.forEach((item, index) => {
      lines.push(`${index + 1}. ${redactText(String(item || "")).trim()}`);
    });
  }
  lines.push("");
  lines.push(`앱에 접속해 오류보고 탭에서 자세한 안내를 확인해주세요: ${PUBLIC_BASE_URL}/app`);
  lines.push("조치 후 상단 배너의 '조치했어요, 다시 시도' 버튼을 누르거나 작업을 다시 시도해주세요.");
  lines.push("");
  lines.push(`문의는 이 메일에 회신해주세요 (${MAIL_REPLY_TO}).`);
  return { subject, text: lines.join("\n") };
}

// 발송 성공 시 해당 유저의 email_events 에 기존 관례대로 기록한다. 유저를 못 찾으면
// 행 마커(user_notified_at)만으로 dedup 이 충분하므로 조용히 생략한다.
function recordWaitingUserMailEvent(email, event) {
  try {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    const users = loadUsers();
    const user = users.users.find((item) => normalizeEmail(item.email) === normalized);
    if (!user) return;
    rememberUserEmailEvent(user, {
      type: "error_report_waiting_user",
      provider: event.provider,
      provider_message_id: event.provider_message_id,
      to: normalized,
      subject: event.subject,
      sent_at: event.sent_at,
    });
    saveUsers(users);
  } catch (error) {
    console.warn("[waiting-user-mail] email_event record failed", error?.code || error?.message || error);
  }
}

async function sweepWaitingUserReportMail() {
  if (!WAITING_USER_MAIL_ENABLED) return { sent: 0, skipped: 0, disabled: true };
  if (waitingUserMailSweepBusy) return { sent: 0, skipped: 0, busy: true };
  waitingUserMailSweepBusy = true;
  try {
    if (!isMailConfigured()) {
      if (!waitingUserMailNotConfiguredWarned) {
        console.warn("[waiting-user-mail] mail not configured — sweep skipped");
        waitingUserMailNotConfiguredWarned = true;
      }
      return { sent: 0, skipped: 0, mail_not_configured: true };
    }
    // C-1: 보고 행의 account_* 필드를 신뢰하지 않는다. 공유 리포트 토큰 경로(hasReportAuth)는
    // 클라이언트가 보낸 account_email/user_id 를 그대로 저장하므로, 그대로 메일을 보내면
    // AIMAX 명의 메일을 임의의 제3자 주소로 보낼 수 있다. 발송 전 account_user_id 로 users.json 의
    // 실제 유저를 조회해 저장된 이메일과 일치할 때만, 그 정본 이메일(user.email)로 보낸다.
    // users.json 은 스윕당 1회만 로드한다.
    let usersById;
    try {
      const users = loadUsers();
      usersById = new Map();
      for (const item of users.users) {
        const id = String(item?.id || "").trim();
        if (id) usersById.set(id, item);
      }
    } catch (error) {
      // 유저 목록을 못 읽으면 아무도 검증할 수 없으므로 이번 스윕은 조용히 건너뛴다(fail-open).
      console.warn("[waiting-user-mail] users load failed — sweep skipped", error?.code || error?.message || error);
      return { sent: 0, skipped: 0, users_unavailable: true };
    }
    const rows = loadReportIndexRows(Number.MAX_SAFE_INTEGER);
    const nowMs = Date.now();
    const cutoffMs = nowMs - WAITING_USER_MAIL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    // 쿨다운 판단용: 같은 이메일 주소가 마지막으로 발송된 시각(ms). 다른 행의 user_notified_at 도 포함.
    const lastNotifiedByEmail = new Map();
    for (const row of rows) {
      const notifiedMs = Date.parse(String(row?.user_notified_at || ""));
      if (!Number.isFinite(notifiedMs)) continue;
      const email = normalizeEmail(row?.account_email || "");
      if (!email) continue;
      if (notifiedMs > (lastNotifiedByEmail.get(email) || 0)) lastNotifiedByEmail.set(email, notifiedMs);
    }
    // I-1: 행 패치를 모아 스윕 끝에 단 한 번의 read-modify-write 로 반영한다.
    const patches = new Map();
    const setPatch = (reportId, patch) => {
      const cleanId = cleanReportId(reportId);
      if (!cleanId) return;
      patches.set(cleanId, { ...(patches.get(cleanId) || {}), ...patch });
    };
    // 이번 스윕에서 실제로 메일이 나간 행. 배치 기록이 실패해도 attempts 를 올리지 않기 위해 분리한다.
    const sentReportIds = [];
    const eventsToRecord = [];
    let sent = 0;
    let skipped = 0;
    for (const row of rows) {
      if (sent >= WAITING_USER_MAIL_PER_SWEEP) break;
      if (normalizeReportStatus(row?.status || "") !== "waiting_user") continue;
      if (isFeedbackReport(row)) continue; // 오류보고만 (피드백 리포트 제외)
      // 이미 발송/실패확정/스킵된 행은 재발송하지 않는다 (같은 보고가 다시 waiting_user 여도 배너가 커버).
      if (row?.user_notified_at || row?.user_notify_failed_at || row?.user_notify_skipped) continue;
      // C-2: report_id 가 비면 마커를 남길 방법이 없어 스윕마다 재발송될 수 있다 → 발송 전에 건너뛴다.
      const cleanId = cleanReportId(row?.report_id);
      if (!cleanId) continue;
      // C-2: 이번 프로세스에서 이미 보낸 행이면(마커 기록 실패 포함) 다시 보내지 않는다.
      if (waitingUserMailSentReportIds.has(cleanId)) continue;
      const statusUpdatedMs = Date.parse(String(row?.status_updated_at || row?.stored_at || ""));
      // 시각 파싱 불가 또는 룩백 초과 행은 오발송 방지를 위해 건너뛴다.
      if (!Number.isFinite(statusUpdatedMs) || statusUpdatedMs < cutoffMs) continue;
      // C-1: account_user_id 로 실제 유저를 조회하고, 저장된 이메일이 정본과 일치할 때만 발송한다.
      const accountUserId = String(row?.account_user_id || "").trim();
      const rowEmail = normalizeEmail(row?.account_email || "");
      const user = accountUserId ? usersById.get(accountUserId) : null;
      const verified = Boolean(user) && rowEmail && normalizeEmail(user.email) === rowEmail;
      if (!verified) {
        // 리포트 토큰 경로가 저장한 미검증 account 필드 → 발송 금지, 스킵 마커만 남긴다.
        setPatch(row.report_id, { user_notify_skipped: "unverified_account", user_notify_skipped_at: nowIso() });
        skipped += 1;
        continue;
      }
      const recipient = String(user.email || "").trim(); // 정본 이메일로만 보낸다(클라이언트 원본 값 아님).
      const email = normalizeEmail(recipient);
      if (!isValidEmail(recipient)) {
        setPatch(row.report_id, { user_notify_skipped: "invalid_email", user_notify_skipped_at: nowIso() });
        skipped += 1;
        continue;
      }
      // 같은 이메일이 6시간 내 발송됐으면 이번 스윕은 건너뛰고 다음 스윕에서 재평가한다(실패 마킹 안 함).
      // C-2: 파일 기반 쿨다운과 인메모리 쿨다운 중 더 최근 값을 쓴다.
      const lastNotifiedMs = Math.max(
        lastNotifiedByEmail.get(email) || 0,
        waitingUserMailLastSentByEmail.get(email) || 0,
      );
      if (lastNotifiedMs && nowMs - lastNotifiedMs < WAITING_USER_MAIL_COOLDOWN_MS) {
        skipped += 1;
        continue;
      }
      const built = buildWaitingUserReportMail(row);
      let result;
      try {
        result = await sendTransactionalEmail({
          to: recipient,
          subject: built.subject,
          text: built.text,
          emailType: "error_report_waiting_user",
        });
      } catch (error) {
        // 발송 실패 경로에서만 attempts 를 올린다(실제로 메일이 나간 행은 절대 여기 오지 않는다).
        const attempts = safeInt(row?.user_notify_attempts, 0, 1000) + 1;
        const patch = { user_notify_attempts: attempts, user_notify_last_error_at: nowIso() };
        if (attempts >= WAITING_USER_MAIL_MAX_ATTEMPTS) patch.user_notify_failed_at = nowIso();
        setPatch(row.report_id, patch);
        console.warn("[waiting-user-mail] send failed", cleanId, error?.code || error?.message || "send_failed");
        continue;
      }
      // C-2: 발송 성공 → 마커 기록(배치) 시도 전에 인메모리 dedup 을 먼저 채운다.
      const notifiedAt = nowIso();
      waitingUserMailSentReportIds.add(cleanId);
      waitingUserMailLastSentByEmail.set(email, Date.parse(notifiedAt) || nowMs);
      lastNotifiedByEmail.set(email, Date.parse(notifiedAt) || nowMs);
      setPatch(row.report_id, {
        user_notified_at: notifiedAt,
        user_notified_channel: "email",
        user_notified_id: String(result?.id || "").slice(0, 160),
      });
      sentReportIds.push(cleanId);
      eventsToRecord.push({
        email,
        provider: result?.provider || "",
        provider_message_id: result?.id || "",
        subject: built.subject,
        sent_at: notifiedAt,
      });
      sent += 1;
    }
    // I-1/C-2: 모은 패치를 한 번에 반영한다. 배치 기록이 실패해도(파일 경쟁 등) 이미 보낸 메일은
    // 인메모리 dedup 이 커버하므로 재발송하지 않으며, 보낸 행의 attempts 도 올리지 않는다.
    try {
      const applied = updateReportIndexSummaries(patches);
      // 일부 패치가 반영 안 됐고 이번에 실제 발송한 행이 있으면, 발송 마커가 유실됐을 수 있어 크게 경고한다.
      if (applied < patches.size && sentReportIds.length > 0) {
        console.warn(
          "[waiting-user-mail] sent but marker write incomplete — memory dedup only until restart",
          `applied=${applied}`, `patches=${patches.size}`, `sent=${sentReportIds.length}`,
        );
      }
    } catch (error) {
      console.warn(
        "[waiting-user-mail] sent but marker write failed — memory dedup only until restart",
        error?.code || error?.message || error,
      );
    }
    // email_events 기록은 유저 파일 쪽이라 실패해도 발송/마커에 영향을 주지 않는다(개별 try/catch 내장).
    for (const event of eventsToRecord) {
      recordWaitingUserMailEvent(event.email, event);
    }
    return { sent, skipped };
  } catch (error) {
    console.warn("[waiting-user-mail] sweep failed", error?.code || error?.message || error);
    return { sent: 0, skipped: 0, error: true };
  } finally {
    waitingUserMailSweepBusy = false;
  }
}

function startWaitingUserReportMailSweep() {
  if (!WAITING_USER_MAIL_ENABLED) return null;
  const runSweep = () => {
    sweepWaitingUserReportMail().catch((error) => {
      console.warn("[waiting-user-mail] sweep failed", error?.code || error?.message || error);
    });
  };
  const initial = setTimeout(runSweep, WAITING_USER_MAIL_INITIAL_DELAY_MS);
  if (typeof initial.unref === "function") initial.unref();
  const timer = setInterval(runSweep, WAITING_USER_MAIL_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

function telegramAlertsConfigured() {
  return Boolean(TELEGRAM_ALERTS_ENABLED && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

function compactTelegramLine(value, limit = 700) {
  const text = String(value || "-").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text || "-";
  return `${text.slice(0, limit - 3)}...`;
}

function telegramReportAlertText(report, storedAt) {
  const summary = summaryFor(report, storedAt || nowIso(), String(storedAt || nowIso()).slice(0, 10));
  if (isFeedbackReport(summary)) {
    return [
      "[AIMAX 직원 피드백 접수]",
      `ID: ${summary.report_id || "-"}`,
      `구매자: ${summary.account_email || "-"}`,
      `상품: ${summary.product || "-"}`,
      `직원: ${summary.feedback_employee_label || summary.feedback_employee_code || "-"}`,
      `만족도: ${summary.feedback_rating || "-"}`,
      summary.feedback_good ? `좋았던 점: ${compactTelegramLine(summary.feedback_good, 700)}` : "",
      `개선 요청: ${compactTelegramLine(summary.feedback_improve || summary.visible_error, 900)}`,
      summary.feedback_contact_needed ? "확인 요청: 운영팀 답변/확인 필요" : "",
      summary.automation_ticket_id ? `자동화 티켓: ${summary.automation_ticket_id}` : "",
      `앱/OS: ${summary.app_version || "-"} / ${summary.os || "-"}`,
      `접수: ${summary.stored_at || "-"}`,
      `관리: ${PUBLIC_BASE_URL}/admin#reports`,
    ].filter(Boolean).join("\n");
  }
  const jobLine = compactJobLine(summary);
  return [
    "[AIMAX 오류 보고 접수]",
    `ID: ${summary.report_id || "-"}`,
    `구매자: ${summary.account_email || "-"}`,
    `상품: ${summary.product || "-"}`,
    `작업: ${compactTelegramLine(summary.work_context, 500)}`,
    jobLine ? `작업 ID/단계: ${compactTelegramLine(jobLine, 700)}` : "",
    summary.media_tools_missing ? `영상 도구: 누락 ${compactTelegramLine(summary.media_tools_missing, 120)}` : "",
    `화면 오류: ${compactTelegramLine(summary.visible_error, 900)}`,
    summary.automation_ticket_id ? `자동화 티켓: ${summary.automation_ticket_id}` : "",
    `앱/OS: ${summary.app_version || "-"} / ${summary.os || "-"}`,
    `접수: ${summary.stored_at || "-"}`,
    `관리: ${PUBLIC_BASE_URL}/admin#reports`,
  ].filter(Boolean).join("\n");
}

async function sendTelegramMessage(text, options = {}) {
  if (!telegramAlertsConfigured()) {
    throw Object.assign(new Error("telegram_not_configured"), { statusCode: 503, code: "telegram_not_configured" });
  }
  const messageThreadId = Object.prototype.hasOwnProperty.call(options, "messageThreadId")
    ? String(options.messageThreadId || "").trim()
    : TELEGRAM_MESSAGE_THREAD_ID;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: String(text || "").slice(0, 3900),
    disable_web_page_preview: true,
  };
  if (messageThreadId) {
    payload.message_thread_id = messageThreadId;
  }
  const data = await postJsonUrl(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, payload, {}, 12000);
  return redactPayload(data);
}

async function sendTelegramReportAlert(report, storedAt) {
  if (!telegramAlertsConfigured()) return null;
  return sendTelegramMessage(telegramReportAlertText(report, storedAt));
}

function cafe24ReviewIssueLabel(issue) {
  const value = String(issue || "").trim();
  if (value === "invalid_email") return "이메일 확인 필요";
  if (value === "ambiguous_product") return "상품 구분 애매함";
  if (value === "unknown_product") return "AIMAX 상품 아님/매핑 불가";
  if (value === "non_staff_product") return "AIMAX 직원 판매 아님";
  if (value === "amount_mismatch") return "직원 상품 금액 확인 필요";
  if (value === "product_not_ready") return "직원 기능/출시 상태 확인 필요";
  if (value === "invalid_product") return "상품 코드 확인 필요";
  return value || "주문 확인 필요";
}

function telegramCafe24ReviewAlertText(order) {
  const amount = Number(order?.amount || 0);
  const amountText = amount ? `${amount.toLocaleString("ko-KR")}원` : "-";
  return [
    "[AIMAX 카페24 주문 확인 필요]",
    "회사 비서 알림: 자동 계정 생성 보류",
    `사유: ${cafe24ReviewIssueLabel(order?.issue)}`,
    `구매자: ${compactTelegramLine([order?.email || "-", order?.name || ""].filter(Boolean).join(" / "), 240)}`,
    `상품명: ${compactTelegramLine(order?.product_name || "-", 260)}`,
    `금액: ${amountText}`,
    `접수: ${order?.created_at || order?.received_at || "-"}`,
    `주문 ID: ${compactTelegramLine(order?.external_id || order?.id || "-", 280)}`,
    `관리: ${PUBLIC_BASE_URL}/admin#orders`,
  ].join("\n");
}

function cafe24AutoStageLabel(stage) {
  const value = String(stage || "").trim();
  if (value === "locked") return "자동 처리 시작";
  if (value === "provisioning") return "계정 생성/권한 부여";
  if (value === "setup_link") return "설정 링크 생성";
  if (value === "mail_sending") return "안내 메일 발송";
  if (value === "sent") return "발송 완료";
  if (value === "failed") return "실패";
  return value || "자동 처리";
}

function cafe24AutoErrorCode(error) {
  return String(error?.code || error?.message || "auto_process_failed").slice(0, 160);
}

function telegramCafe24AutoFailureAlertText(order, error) {
  const amount = Number(order?.amount || 0);
  const amountText = amount ? `${amount.toLocaleString("ko-KR")}원` : "-";
  const stage = order?.auto_process_error_stage || order?.auto_process_stage || "";
  return [
    "[AIMAX 카페24 자동 처리 실패]",
    "회사 비서 알림: 계정 생성/메일 발송 확인 필요",
    `단계: ${cafe24AutoStageLabel(stage)}`,
    `오류: ${compactTelegramLine(cafe24AutoErrorCode(error || { code: order?.auto_process_error }), 260)}`,
    `구매자: ${compactTelegramLine([order?.email || "-", order?.name || ""].filter(Boolean).join(" / "), 240)}`,
    `AIMAX 상품: ${productLabel(order?.product || "")}`,
    `카페24 상품명: ${compactTelegramLine(order?.product_name || "-", 260)}`,
    `금액: ${amountText}`,
    `주문 ID: ${compactTelegramLine(order?.external_id || order?.id || "-", 280)}`,
    `관리: ${PUBLIC_BASE_URL}/admin#orders`,
  ].join("\n");
}

function shouldSendCafe24ReviewAlert(order) {
  if (!CAFE24_REVIEW_ALERTS_ENABLED) return false;
  if (String(order?.status || "") !== "needs_review") return false;
  if (order?.review_alert_sent_at) return false;
  return true;
}

async function sendCafe24ReviewAlert(order) {
  if (!shouldSendCafe24ReviewAlert(order)) return null;
  if (!telegramAlertsConfigured()) return null;
  return sendTelegramMessage(telegramCafe24ReviewAlertText(order), {
    messageThreadId: CAFE24_TELEGRAM_MESSAGE_THREAD_ID,
  });
}

function patchCafe24OrderAlertStatus(orderId, patch) {
  if (!orderId) return null;
  const data = loadCafe24Orders();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return null;
  Object.assign(order, patch, { updated_at: nowIso() });
  saveCafe24Orders(data);
  return order;
}

function queueCafe24ReviewAlert(order) {
  if (!shouldSendCafe24ReviewAlert(order)) return false;
  const snapshot = { ...order };
  sendCafe24ReviewAlert(snapshot)
    .then((result) => {
      if (!result) return;
      patchCafe24OrderAlertStatus(snapshot.id, {
        review_alert_sent_at: nowIso(),
        review_alert_error: "",
        review_alert_error_at: null,
      });
    })
    .catch((error) => {
      patchCafe24OrderAlertStatus(snapshot.id, {
        review_alert_error: String(error.code || error.message || "telegram_send_failed").slice(0, 160),
        review_alert_error_at: nowIso(),
      });
      console.warn("[telegram alert] cafe24 review send failed", error.code || error.message || "telegram_send_failed");
  });
  return true;
}

async function sendCafe24AutoFailureAlert(order, error) {
  if (!order || !telegramAlertsConfigured()) return null;
  return sendTelegramMessage(telegramCafe24AutoFailureAlertText(order, error), {
    messageThreadId: CAFE24_TELEGRAM_MESSAGE_THREAD_ID,
  });
}

function queueCafe24AutoFailureAlert(order, error) {
  if (!order || ["sent", "ignored"].includes(String(order.status || ""))) return false;
  const snapshot = { ...order };
  sendCafe24AutoFailureAlert(snapshot, error)
    .then((result) => {
      if (!result) return;
      patchCafe24OrderAutoStatus(snapshot.id, {
        auto_process_alert_sent_at: nowIso(),
        auto_process_alert_error: "",
        auto_process_alert_error_at: null,
      });
    })
    .catch((alertError) => {
      patchCafe24OrderAutoStatus(snapshot.id, {
        auto_process_alert_error: String(alertError.code || alertError.message || "telegram_send_failed").slice(0, 160),
        auto_process_alert_error_at: nowIso(),
      });
      console.warn("[telegram alert] cafe24 auto failure send failed", alertError.code || alertError.message || "telegram_send_failed");
    });
  return true;
}

function shouldAutoProcessCafe24Order(order) {
  if (!CAFE24_AUTO_SEND_ENABLED) return false;
  if (String(order?.status || "") !== "pending") return false;
  if (order?.issue) return false;
  if (!isValidEmail(order?.email)) return false;
  if (!PRODUCTS.has(String(order?.product || "").trim())) return false;
  if (order?.sent_at) return false;
  if (order?.auto_process_started_at) {
    const startedAt = Date.parse(order.auto_process_started_at);
    if (Number.isFinite(startedAt) && Date.now() - startedAt < CAFE24_AUTO_PROCESS_LOCK_MS) return false;
  }
  return true;
}

function lockCafe24AutoProcess(orderId) {
  const data = loadCafe24Orders();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order || !shouldAutoProcessCafe24Order(order)) return null;
  const lockedAt = nowIso();
  order.auto_process_started_at = lockedAt;
  order.auto_process_stage = "locked";
  order.auto_process_attempts = Number(order.auto_process_attempts || 0) + 1;
  order.auto_process_error = "";
  order.auto_process_error_at = null;
  order.auto_process_error_stage = "";
  order.updated_at = lockedAt;
  saveCafe24Orders(data);
  return { ...order };
}

function patchCafe24OrderAutoStatus(orderId, patch) {
  if (!orderId) return null;
  const data = loadCafe24Orders();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return null;
  Object.assign(order, patch, { updated_at: patch.updated_at || nowIso() });
  saveCafe24Orders(data);
  return order;
}

function markCafe24AutoProcessFailure(orderId, error, stage) {
  const failedAt = nowIso();
  const current = loadCafe24Orders().orders.find((item) => item.id === orderId);
  const failed = patchCafe24OrderAutoStatus(orderId, {
    status: current && ["sent", "ignored"].includes(String(current.status || "")) ? current.status : "failed",
    auto_process_stage: "failed",
    auto_process_error_stage: stage || current?.auto_process_stage || "",
    auto_process_error: cafe24AutoErrorCode(error),
    auto_process_error_at: failedAt,
    updated_at: failedAt,
  });
  queueCafe24AutoFailureAlert(failed, error);
  return failed;
}

function cafe24GuideForProvision(provision, product, setupTokens, now, source, options = {}) {
  const needsSetupLink = Boolean(options.forceSetupLink || provision.created || provision.temporaryPassword || provision.user.must_change_password);
  if (needsSetupLink) {
    const setupLink = createSetupLinkForUser(setupTokens, provision.user, now, source);
    return {
      email: provision.user.email,
      subject: onboardingGuideSubject(provision.user),
      text: onboardingSetupLinkText(provision.user, setupLink.setup_url, product, setupLink.expires_at),
      setup_url_visible_once: true,
      setup_url_expires_at: setupLink.expires_at,
    };
  }
  return {
    email: provision.user.email,
    subject: onboardingGuideSubject(provision.user),
    text: onboardingGuideText(provision.user.email, null, product),
    setup_url_visible_once: false,
    setup_url_expires_at: null,
  };
}

async function autoProcessCafe24Order(snapshot, options = {}) {
  const data = loadCafe24Orders();
  const order = data.orders.find((item) => item.id === snapshot.id);
  if (!order) return null;
  const status = String(order.status || "pending");
  const allowSent = Boolean(options.resendGuide || options.allowSent);
  if (order.sent_at && !allowSent) {
    throw Object.assign(new Error("order_already_done"), { code: "order_already_done", statusCode: 409, stage: "validate" });
  }
  if (
    !options.force
    && (status !== "pending" || order.issue || !isValidEmail(order.email) || !PRODUCTS.has(String(order.product || "").trim()) || order.sent_at)
  ) {
    return null;
  }
  if (options.force && !["pending", "failed", "provisioned", "sent"].includes(status)) {
    throw Object.assign(new Error("invalid_order_status"), { code: "invalid_order_status", statusCode: 400, stage: "validate" });
  }
  if (order.issue || !isValidEmail(order.email) || !PRODUCTS.has(String(order.product || "").trim())) {
    throw Object.assign(new Error("invalid_order_for_auto_process"), { code: "invalid_order_for_auto_process", statusCode: 400, stage: "validate" });
  }

  const users = loadUsers();
  const setupTokens = loadSetupTokens();
  const now = nowIso();
  const product = String(order.product || "").trim();
  order.auto_process_started_at = now;
  order.auto_process_stage = "provisioning";
  order.auto_process_attempts = Number(order.auto_process_attempts || 0) + (options.countAttempt === false ? 0 : 1);
  order.auto_process_error = "";
  order.auto_process_error_at = null;
  order.auto_process_error_stage = "";
  order.auto_process_alert_error = "";
  order.auto_process_alert_error_at = null;
  order.updated_at = now;
  saveCafe24Orders(data);

  const provision = provisionAdminUser(users, {
    email: order.email,
    name: order.name,
    product,
    source: options.provisionSource || (options.resendGuide ? "cafe24_order_admin_resend" : "cafe24_order_auto"),
    admin_note: [
      `${options.resendGuide ? "Cafe24 안내 메일 재발송" : options.adminRetry ? "Cafe24 자동 처리 재시도" : "Cafe24 주문 자동 처리"}: ${order.external_id || order.id}`,
      order.product_name ? `상품명: ${order.product_name}` : "",
      order.amount ? `금액: ${order.amount}` : "",
    ].filter(Boolean).join("\n"),
  }, now);
  if (provision.error) {
    throw Object.assign(new Error(provision.error), { code: provision.error, stage: "provisioning" });
  }

  order.auto_process_stage = "setup_link";
  order.updated_at = nowIso();
  saveCafe24Orders(data);
  const guide = cafe24GuideForProvision(
    provision,
    product,
    setupTokens,
    now,
    options.setupSource || (options.resendGuide ? "cafe24_order_admin_resend_setup_link" : "cafe24_order_auto_setup_link"),
    { forceSetupLink: Boolean(options.forceSetupLink || options.resendGuide) },
  );
  order.product = product;
  order.product_confidence = order.product_confidence === "explicit" ? "explicit" : order.product_confidence || "auto";
  order.issue = "";
  order.status = "provisioned";
  order.processed_at = now;
  order.auto_process_stage = "mail_sending";
  order.updated_at = nowIso();
  order.user_id = provision.user.id;
  order.auto_process_error = "";
  order.auto_process_error_at = null;
  order.auto_process_error_stage = "";
  saveUsers(users);
  saveSetupTokens(setupTokens);
  saveCafe24Orders(data);

  const sentAt = nowIso();
  let mail;
  try {
    mail = await sendAdminGuideEmail({
      to: guide.email,
      subject: guide.subject,
      text: guide.text,
    });
  } catch (error) {
    error.stage = error.stage || "mail_sending";
    throw error;
  }

  const latestUsers = loadUsers();
  const latestUser = latestUsers.users.find((item) => item.id === provision.user.id || item.email === guide.email);
  if (latestUser) {
    rememberUserEmailEvent(latestUser, {
      type: options.emailEventType || (options.resendGuide ? "cafe24_onboarding_guide_resend" : options.adminRetry ? "cafe24_onboarding_guide_retry" : "cafe24_onboarding_guide_auto"),
      provider: mail.provider,
      provider_message_id: mail.id,
      to: guide.email,
      subject: guide.subject,
      sent_at: sentAt,
    });
    saveUsers(latestUsers);
  }

  patchCafe24OrderAutoStatus(order.id, {
    status: "sent",
    sent_at: sentAt,
    auto_process_stage: "sent",
    auto_process_error: "",
    auto_process_error_at: null,
    auto_process_error_stage: "",
    updated_at: sentAt,
  });
  return { order_id: order.id, email: guide.email, sent_at: sentAt, provider: mail.provider };
}

function queueCafe24AutoProcess(order) {
  const locked = lockCafe24AutoProcess(order?.id);
  if (!locked) return false;
  autoProcessCafe24Order(locked, { countAttempt: false }).catch((error) => {
    markCafe24AutoProcessFailure(locked.id, error, error.stage || "auto");
    console.warn("[cafe24 auto] processing failed", error.code || error.message || "auto_process_failed");
  });
  return true;
}

async function handleAdminLogin(req, res) {
  if (!adminSecret()) {
    json(req, res, 503, { ok: false, error: "admin_auth_not_configured" });
    return;
  }
  const body = await readJsonBody(req, res);
  if (!body) return;
  const password = String(body.password || body.token || "");
  if (!timingSafeEqual(password, adminSecret())) {
    json(req, res, 401, { ok: false, error: "invalid_admin_credentials" });
    return;
  }
  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000;
  const session = signAdminPayload({
    scope: "admin",
    iat: now,
    exp: expiresAt,
  });
  json(
    req,
    res,
    200,
    {
      ok: true,
      expires_at: new Date(expiresAt).toISOString(),
    },
    {
      "set-cookie": adminCookie(req, session, Math.round((expiresAt - now) / 1000)),
    },
  );
}

function handleAdminLogout(req, res) {
  json(
    req,
    res,
    200,
    { ok: true },
    {
      "set-cookie": adminCookie(req, "", 0),
    },
  );
}

function handleAdminMe(req, res) {
  if (!requireAdmin(req, res)) return;
  const users = loadUsers();
  const agents = loadAgents();
  json(req, res, 200, {
    ok: true,
    admin: { authenticated: true },
    stats: adminStats(users.users, agents.agents),
  });
}

function handleAdminCatalog(req, res) {
  if (!requireAdmin(req, res)) return;
  json(req, res, 200, {
    ok: true,
    products: adminProductCatalog(),
    workers: Object.values(WORKERS).map(publicWorker),
    job_kinds: Object.entries(JOB_KINDS).map(([kind, config]) => publicJobKind(kind, config)),
    feature_flags: {
      yunmi: {
        public_enabled: YUNMI_PUBLIC_ENABLED,
        allowed_users: YUNMI_DEFAULT_ALLOWED_USERS,
      },
    },
  });
}

function handleAdminListReports(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = loadReportIndexRows(300)
      .reverse()
      .map(adminReportSummary)
      .slice(0, 100);
    json(req, res, 200, { ok: true, reports: rows });
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "reports_read_failed" });
  }
}

function handleAdminListAutomationTickets(req, res, url) {
  if (!requireAdmin(req, res)) return;
  try {
    const statusFilter = String(url.searchParams.get("status") || "").trim();
    const rows = latestAutomationTickets(500)
      .reverse()
      .filter((ticket) => !statusFilter || String(ticket.status || "") === statusFilter)
      .slice(0, 100);
    json(req, res, 200, { ok: true, tickets: rows });
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "automation_tickets_read_failed" });
  }
}

function handleAdminGetReport(req, res, reportId) {
  if (!requireAdmin(req, res)) return;
  try {
    const loaded = loadReportDetail(reportId);
    if (!loaded) {
      json(req, res, 404, { ok: false, error: "report_not_found" });
      return;
    }
    json(req, res, 200, {
      ok: true,
      summary: adminReportSummary(loaded.row),
      report: loaded.report,
    });
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "report_read_failed" });
  }
}

async function handleAdminTelegramTest(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!telegramAlertsConfigured()) {
    json(req, res, 503, { ok: false, error: "telegram_not_configured" });
    return;
  }
  const parsed = await readJsonBody(req, res);
  if (!parsed) return;
  const text = String(parsed.message || "").trim() || [
    "[AIMAX 오류 알림 테스트]",
    `시간: ${nowIso()}`,
    `관리: ${PUBLIC_BASE_URL}/admin#reports`,
  ].join("\n");
  try {
    const result = await sendTelegramMessage(text);
    json(req, res, 200, { ok: true, provider: "telegram", result });
  } catch (error) {
    json(req, res, error.statusCode || 502, { ok: false, error: error.code || "telegram_send_failed" });
  }
}

async function handleAdminUpdateReportStatus(req, res, reportId) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const rawStatus = String(body.status || "").trim();
  const status = REPORT_STATUS_ALIASES[rawStatus] || rawStatus;
  if (!rawStatus || !REPORT_STATUS_META[status]) {
    json(req, res, 400, { ok: false, error: "invalid_report_status" });
    return;
  }
  try {
    const loaded = loadReportDetail(reportId);
    if (!loaded) {
      json(req, res, 404, { ok: false, error: "report_not_found" });
      return;
    }
    const updatedAt = nowIso();
    const meta = reportSupportMeta(loaded.report || loaded.row, status);
    const publicMessage = cleanSupportMessage(body.public_message, meta.publicMessage);
    const nextUpdateMessage = cleanSupportMessage(body.next_update_message, meta.nextUpdateMessage);
    let nextSummary = {
      ...loaded.row,
      status,
      status_updated_at: updatedAt,
      status_label: meta.label,
      public_message: publicMessage,
      next_update_message: nextUpdateMessage,
    };
    const reportPath = reportPathFromSummary(loaded.row);
    if (loaded.report && reportPath) {
      loaded.report.support = {
        ...(loaded.report.support || {}),
        status,
        status_label: meta.label,
        public_message: publicMessage,
        next_update_message: nextUpdateMessage,
        updated_at: updatedAt,
      };
      saveReportDetail(reportPath, loaded.report);
      nextSummary = summaryFor(loaded.report, loaded.row.stored_at || updatedAt, loaded.row.date || (loaded.row.stored_at || updatedAt).slice(0, 10));
    }
    const updatedRow = updateReportIndexSummary(reportId, nextSummary);
    if (!updatedRow) {
      json(req, res, 404, { ok: false, error: "report_not_found" });
      return;
    }
    if (updatedRow.automation_ticket_id) {
      appendAutomationTicketStatusUpdate(updatedRow.automation_ticket_id, reportId, status, updatedAt);
    }
    json(req, res, 200, { ok: true, report: adminReportSummary(updatedRow) });
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "report_update_failed" });
  }
}

function validateAdminProvisionInput(body) {
  const email = normalizeEmail(body.email);
  const product = String(body.product || "").trim();
  if (!isValidEmail(email)) {
    return { error: "invalid_email", email, product };
  }
  if (!PRODUCTS.has(product)) {
    return { error: "invalid_product", email, product };
  }
  const requestedSegment = normalizeAccountSegment(body.account_segment || body.accountSegment || body.member_segment || body.memberSegment || "", defaultAccountSegmentForSource(body.source || "buyer"));
  if (MEMBER_ONLY_PRODUCTS.has(product) && !isMakefamilyMemberSegment(requestedSegment)) {
    return { error: "member_only_product_requires_makefamily_member", email, product };
  }
  return { email, product };
}

function provisionAdminUser(users, body, now) {
  const email = normalizeEmail(body.email);
  const product = String(body.product || "").trim();
  const source = String(body.source || "buyer").trim() || "buyer";
  const fallbackSegment = defaultAccountSegmentForSource(source);
  const requestedSegment = body.account_segment || body.accountSegment || body.member_segment || body.memberSegment || "";
  let user = users.users.find((item) => item.email === email);
  const created = !user;
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name: "",
      status: "active",
      account_segment: normalizeAccountSegment(requestedSegment, fallbackSegment),
      must_change_password: true,
      created_at: now,
      updated_at: now,
    };
    users.users.push(user);
  }

  const shouldResetPassword = created || Boolean(body.reset_password) || !user.password_hash;
  let temporaryPassword = null;
  if (shouldResetPassword) {
    temporaryPassword = String(body.temporary_password || "") || generateTemporaryPassword();
    const validationError = validateNewPassword(temporaryPassword, email);
    if (validationError) {
      return { error: validationError };
    }
    user.password_hash = hashPassword(temporaryPassword);
    user.must_change_password = true;
  }

  user.name = String(body.name || user.name || "").trim();
  user.status = String(body.status || "active").trim();
  user.account_segment = normalizeAccountSegment(requestedSegment, user.account_segment || fallbackSegment);
  if (created) {
    user.entitlements = {
      product,
      products: productList(product),
      status: "active",
      source,
      granted_at: now,
      expires_at: body.expires_at || null,
    };
  } else {
    grantProductToUser(user, product, now, source);
    user.entitlements = {
      ...(user.entitlements || {}),
      source: user.entitlements?.source || source,
      expires_at: body.expires_at || user.entitlements?.expires_at || null,
    };
  }
  user.admin_note = body.admin_note ? redactText(body.admin_note) : user.admin_note || "";
  user.updated_at = now;

  return {
    created,
    user,
    temporaryPassword,
  };
}

function entitlementProductsForMerge(entitlements) {
  const products = new Set();
  for (const item of Array.isArray(entitlements?.products) ? entitlements.products : []) {
    if (PRODUCTS.has(item)) products.add(item);
  }
  if (PRODUCTS.has(entitlements?.product || "")) {
    productList(entitlements.product).forEach((item) => products.add(item));
  }
  return products;
}

function orderedProducts(products) {
  return PRODUCT_ORDER.filter((product) => products.has(product));
}

function primaryProductForEntitlements(entitlements, fallbackProduct = "") {
  const products = entitlementProductsForMerge(entitlements || {});
  if (products.has("bundle")) return "bundle";
  if (products.has("blog_team")) return "blog_team";
  const current = String(entitlements?.product || "").trim();
  if (PRODUCTS.has(current) && products.has(current)) return current;
  const fallback = String(fallbackProduct || "").trim();
  if (PRODUCTS.has(fallback) && products.has(fallback)) return fallback;
  return orderedProducts(products)[0] || "";
}

function grantProductToUser(user, product, now, source = "admin_product_grant") {
  if (!user || !PRODUCTS.has(product)) return false;
  const entitlements = user.entitlements || {};
  const products = entitlementProductsForMerge(entitlements);
  const before = orderedProducts(products).join("|");
  productList(product).forEach((item) => products.add(item));
  const nextProducts = orderedProducts(products);
  const primaryProduct = primaryProductForEntitlements({ ...entitlements, products: nextProducts }, product);
  user.entitlements = {
    ...entitlements,
    product: primaryProduct,
    products: nextProducts,
    status: "active",
    source: entitlements.source || source,
    granted_at: entitlements.granted_at || now,
    updated_at: now,
    expires_at: entitlements.expires_at || null,
  };
  user.updated_at = now;
  return before !== nextProducts.join("|") || entitlements.status !== "active";
}

async function handleAdminGrantProduct(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const product = String(body.product || "").trim();
  if (!PRODUCTS.has(product)) {
    json(req, res, 400, { ok: false, error: "invalid_product" });
    return;
  }
  const email = normalizeEmail(body.email);
  if (email && !isValidEmail(email)) {
    json(req, res, 400, { ok: false, error: "invalid_email" });
    return;
  }
  const scope = String(body.scope || "active").trim() || "active";
  if (!["active", "all", "makefamily_members"].includes(scope)) {
    json(req, res, 400, { ok: false, error: "invalid_scope" });
    return;
  }
  if (MEMBER_ONLY_PRODUCTS.has(product) && !email && scope !== "makefamily_members") {
    json(req, res, 400, { ok: false, error: "member_only_product_requires_makefamily_member_scope" });
    return;
  }

  const users = loadUsers();
  const now = nowIso();
  let scanned = 0;
  let updated = 0;

  if (email) {
    const user = users.users.find((item) => item.email === email);
    if (!user) {
      json(req, res, 404, { ok: false, error: "user_not_found" });
      return;
    }
    if (MEMBER_ONLY_PRODUCTS.has(product) && !isMakefamilyMemberAccount(user)) {
      json(req, res, 403, { ok: false, error: "member_only_product_requires_makefamily_member" });
      return;
    }
    scanned = 1;
    if (grantProductToUser(user, product, now, `admin_grant_${product}`)) updated = 1;
    saveUsers(users);
    json(req, res, 200, {
      ok: true,
      product,
      product_label: productLabel(product),
      scope: "user",
      email,
      scanned_count: scanned,
      updated_count: updated,
      user: adminUserRow(user),
    });
    return;
  }

  for (const user of users.users) {
    const isActiveUser = user.status === "active" && (user.entitlements?.status || "") === "active";
    const isMakefamilyMember = normalizeAccountSegment(user.account_segment || user.accountSegment || "", "paid_buyer") === "makefamily_member";
    if (scope === "active" && !isActiveUser) continue;
    if (scope === "makefamily_members" && !(user.status === "active" && isMakefamilyMember)) continue;
    scanned += 1;
    if (grantProductToUser(user, product, now, `admin_grant_${product}`)) updated += 1;
  }
  saveUsers(users);
  json(req, res, 200, {
    ok: true,
    product,
    product_label: productLabel(product),
    scope,
    scanned_count: scanned,
    updated_count: updated,
  });
}

async function handleAdminProvisionUser(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const validation = validateAdminProvisionInput(body);
  if (validation.error) {
    json(req, res, 400, { ok: false, error: validation.error });
    return;
  }

  const users = loadUsers();
  const now = nowIso();
  const result = provisionAdminUser(users, body, now);
  if (result.error) {
    json(req, res, 400, { ok: false, error: result.error });
    return;
  }
  saveUsers(users);
  const agents = loadAgents();
  const agent = agents.agents.find((item) => item.user_id === result.user.id);

  json(req, res, 201, {
    ok: true,
    created: result.created,
    user: adminUserRow(result.user, agent),
    temporary_password: result.temporaryPassword,
    temporary_password_visible_once: Boolean(result.temporaryPassword),
  });
}

async function handleAdminSendGuideEmail(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const email = normalizeEmail(body.email || body.to);
  const subject = String(body.subject || "AIMAX 이용 안내입니다.").trim().slice(0, 160);
  const text = String(body.text || body.guide_text || "").trim();
  if (!isValidEmail(email)) {
    json(req, res, 400, { ok: false, error: "invalid_email" });
    return;
  }
  if (!text) {
    json(req, res, 400, { ok: false, error: "empty_mail_body" });
    return;
  }

  const users = loadUsers();
  const user = users.users.find((item) => item.email === email);
  if (!user || user.status !== "active") {
    json(req, res, 404, { ok: false, error: "user_not_found_or_inactive" });
    return;
  }

  try {
    const sentAt = nowIso();
    const mail = await sendAdminGuideEmail({ to: email, subject, text });
    rememberUserEmailEvent(user, {
      type: "onboarding_guide",
      provider: mail.provider,
      provider_message_id: mail.id,
      to: email,
      subject,
      sent_at: sentAt,
    });
    saveUsers(users);
    json(req, res, 200, {
      ok: true,
      sent_at: sentAt,
      provider: mail.provider,
      provider_message_id: mail.id,
    });
  } catch (error) {
    json(req, res, error.statusCode || 502, {
      ok: false,
      error: error.code || error.message || "mail_send_failed",
      detail: redactText(error.message || "").slice(0, 300),
    });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleAdminSendGuideEmailsBatch(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const rows = Array.isArray(body.guides) ? body.guides : Array.isArray(body.users) ? body.users : Array.isArray(body.emails) ? body.emails : [];
  if (!rows.length) {
    json(req, res, 400, { ok: false, error: "empty_batch" });
    return;
  }
  if (rows.length > 200) {
    json(req, res, 400, { ok: false, error: "batch_too_large", max: 200 });
    return;
  }

  const normalizedRows = rows.map((row) => {
    if (typeof row === "string") return { email: normalizeEmail(row) };
    return {
      email: normalizeEmail(row.email || row.to),
      subject: String(row.subject || "").trim().slice(0, 160),
      text: String(row.text || row.guide_text || "").trim(),
    };
  });
  const seen = new Set();
  const errors = [];
  normalizedRows.forEach((row, index) => {
    if (!isValidEmail(row.email)) errors.push({ index, email: row.email, error: "invalid_email" });
    if (row.email && seen.has(row.email)) errors.push({ index, email: row.email, error: "duplicate_email" });
    if (row.email) seen.add(row.email);
  });
  if (errors.length) {
    json(req, res, 400, { ok: false, error: "invalid_batch", errors });
    return;
  }

  const users = loadUsers();
  const setupTokens = loadSetupTokens();
  const userByEmail = new Map(users.users.map((user) => [user.email, user]));
  const sent = [];

  for (let index = 0; index < normalizedRows.length; index += 1) {
    const row = normalizedRows[index];
    const user = userByEmail.get(row.email);
    if (!user || user.status !== "active") {
      errors.push({ index, email: row.email, error: "user_not_found_or_inactive" });
      continue;
    }

    const now = nowIso();
    const product = primaryProductForEntitlements(user.entitlements || {}, user.product || "");
    const setupLink = row.text ? null : createSetupLinkForUser(setupTokens, user, now, "admin_batch_guide_email");
    const subject = row.subject || onboardingGuideSubject(user);
    const text = row.text || onboardingSetupLinkText(user, setupLink.setup_url, product, setupLink.expires_at);

    try {
      const mail = await sendAdminGuideEmail({ to: row.email, subject, text });
      const sentAt = nowIso();
      rememberUserEmailEvent(user, {
        type: "onboarding_guide_batch",
        provider: mail.provider,
        provider_message_id: mail.id,
        to: row.email,
        subject,
        sent_at: sentAt,
      });
      sent.push({
        email: row.email,
        sent_at: sentAt,
        provider: mail.provider,
        provider_message_id: mail.id,
      });
      if (index < normalizedRows.length - 1) await delay(600);
    } catch (error) {
      errors.push({
        index,
        email: row.email,
        error: error.code || error.message || "mail_send_failed",
        detail: redactText(error.message || "").slice(0, 300),
      });
    }
  }

  saveUsers(users);
  saveSetupTokens(setupTokens);
  json(req, res, 200, {
    ok: true,
    sent_count: sent.length,
    error_count: errors.length,
    sent,
    errors,
  });
}

async function handleAdminProvisionBatch(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const defaultProduct = String(body.product || "").trim();
  const rows = Array.isArray(body.buyers) ? body.buyers : Array.isArray(body.users) ? body.users : [];
  if (!rows.length) {
    json(req, res, 400, { ok: false, error: "empty_batch" });
    return;
  }
  if (rows.length > 100) {
    json(req, res, 400, { ok: false, error: "batch_too_large", max: 100 });
    return;
  }

  const normalizedRows = rows.map((row) => ({
    email: normalizeEmail(row.email),
    name: String(row.name || "").trim(),
    product: String(row.product || defaultProduct).trim(),
    expires_at: row.expires_at || body.expires_at || null,
    admin_note: String(row.admin_note || body.admin_note || "").trim(),
    account_segment: normalizeAccountSegment(
      row.account_segment || row.accountSegment || row.member_segment || row.memberSegment || body.account_segment || body.accountSegment || body.member_segment || body.memberSegment || "",
      defaultAccountSegmentForSource(row.source || body.source || "admin_batch"),
    ),
    temporary_password: String(row.temporary_password || row.temporaryPassword || "").trim(),
    reset_password: Boolean(body.reset_password || row.reset_password || row.temporary_password || row.temporaryPassword),
    source: String(row.source || body.source || "admin_batch").trim() || "admin_batch",
  }));
  const seen = new Set();
  const errors = [];
  normalizedRows.forEach((row, index) => {
    const validation = validateAdminProvisionInput(row);
    if (validation.error) errors.push({ index, email: row.email, error: validation.error });
    if (row.email && seen.has(row.email)) errors.push({ index, email: row.email, error: "duplicate_email" });
    if (row.email) seen.add(row.email);
  });
  if (errors.length) {
    json(req, res, 400, { ok: false, error: "invalid_batch", errors });
    return;
  }

  const users = loadUsers();
  const now = nowIso();
  const results = normalizedRows.map((row) => provisionAdminUser(users, row, now));
  const provisionError = results.find((result) => result.error);
  if (provisionError) {
    json(req, res, 400, { ok: false, error: provisionError.error });
    return;
  }
  saveUsers(users);
  const agents = loadAgents();
  const agentByUserId = new Map(agents.agents.map((agent) => [agent.user_id, agent]));

  json(req, res, 201, {
    ok: true,
    count: results.length,
    users: results.map((result) => ({
      created: result.created,
      user: adminUserRow(result.user, agentByUserId.get(result.user.id)),
      temporary_password: result.temporaryPassword,
      temporary_password_visible_once: Boolean(result.temporaryPassword),
    })),
  });
}

async function handleCafe24OrderWebhook(req, res) {
  if (!requireCafe24Webhook(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const now = nowIso();
  const incoming = buildCafe24Order(body, now);
  const data = loadCafe24Orders();
  const existing = data.orders.find((order) => order.external_id && order.external_id === incoming.external_id);
  const order = existing ? mergeCafe24Order(existing, incoming, now) : incoming;
  if (!existing) data.orders.push(order);
  saveCafe24Orders(data);
  const reviewAlertQueued = queueCafe24ReviewAlert(order);
  const autoProcessQueued = queueCafe24AutoProcess(order);

  json(req, res, existing ? 200 : 201, {
    ok: true,
    created: !existing,
    order: adminCafe24OrderRow(order),
    review_alert_queued: reviewAlertQueued,
    auto_process_queued: autoProcessQueued,
  });
}

function handleAdminListCafe24Orders(req, res) {
  if (!requireAdmin(req, res)) return;
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const status = String(url.searchParams.get("status") || "open").trim();
  const data = loadCafe24Orders();
  const rows = data.orders
    .filter((order) => {
      if (!status || status === "open") return !["sent", "ignored"].includes(String(order.status || "pending"));
      if (status === "all") return true;
      return String(order.status || "pending") === status;
    })
    .map(adminCafe24OrderRow)
    .sort((a, b) => String(b.created_at || b.received_at).localeCompare(String(a.created_at || a.received_at)))
    .slice(0, 300);
  json(req, res, 200, {
    ok: true,
    orders: rows,
    stats: cafe24OrderStats(data.orders),
  });
}

async function handleAdminUpdateCafe24Order(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const orderId = String(body.order_id || body.id || "").trim();
  if (!orderId) {
    json(req, res, 400, { ok: false, error: "order_not_found" });
    return;
  }
  const data = loadCafe24Orders();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) {
    json(req, res, 404, { ok: false, error: "order_not_found" });
    return;
  }
  const product = String(Object.prototype.hasOwnProperty.call(body, "product") ? body.product : order.product || "").trim();
  if (product && !PRODUCTS.has(product)) {
    json(req, res, 400, { ok: false, error: "invalid_product" });
    return;
  }
  const status = String(Object.prototype.hasOwnProperty.call(body, "status") ? body.status : order.status || "").trim();
  const allowedStatuses = new Set(["pending", "needs_review", "provisioned", "sent", "ignored", "failed"]);
  if (status && !allowedStatuses.has(status)) {
    json(req, res, 400, { ok: false, error: "invalid_order_status" });
    return;
  }
  order.product = product;
  order.product_confidence = product ? "admin" : "needs_review";
  order.issue = product && isValidEmail(order.email) ? "" : order.issue || "invalid_order";
  order.status = status || (order.issue ? "needs_review" : "pending");
  order.admin_note = compactText(body.admin_note || order.admin_note || "", 1000);
  order.updated_at = nowIso();
  saveCafe24Orders(data);
  const autoProcessQueued = queueCafe24AutoProcess(order);
  const latestOrder = autoProcessQueued
    ? loadCafe24Orders().orders.find((item) => item.id === order.id) || order
    : order;
  json(req, res, 200, {
    ok: true,
    order: adminCafe24OrderRow(latestOrder),
    auto_process_queued: autoProcessQueued,
  });
}

async function handleAdminRetryCafe24Orders(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const ids = [...new Set((Array.isArray(body.order_ids) ? body.order_ids : Array.isArray(body.ids) ? body.ids : body.order_id ? [body.order_id] : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean))];
  if (!ids.length) {
    json(req, res, 400, { ok: false, error: "empty_selection" });
    return;
  }
  if (ids.length > 100) {
    json(req, res, 400, { ok: false, error: "batch_too_large", max: 100 });
    return;
  }
  const mode = String(body.mode || "").trim();
  const resendGuide = Boolean(body.resend_guide || mode === "resend" || mode === "resend_guide");
  const results = [];
  const errors = [];

  for (const [index, orderId] of ids.entries()) {
    const current = loadCafe24Orders().orders.find((order) => order.id === orderId);
    if (!current) {
      errors.push({ index, order_id: orderId, error: "order_not_found" });
      continue;
    }
    try {
      const attempt = await autoProcessCafe24Order({ id: orderId }, {
        force: true,
        adminRetry: !resendGuide,
        resendGuide,
        forceSetupLink: resendGuide,
        setupSource: resendGuide ? "cafe24_order_admin_resend_setup_link" : "cafe24_order_admin_retry_setup_link",
        provisionSource: resendGuide ? "cafe24_order_admin_resend" : "cafe24_order_admin_retry",
        emailEventType: resendGuide ? "cafe24_onboarding_guide_resend" : "cafe24_onboarding_guide_retry",
      });
      const latest = loadCafe24Orders().orders.find((order) => order.id === orderId) || current;
      results.push({
        order: adminCafe24OrderRow(latest),
        sent: attempt,
      });
    } catch (error) {
      const shouldMark = !["order_already_done", "invalid_order_status"].includes(String(error.code || ""));
      const failed = shouldMark ? markCafe24AutoProcessFailure(orderId, error, error.stage || "admin_retry") : current;
      errors.push({
        index,
        order_id: orderId,
        email: current.email,
        error: error.code || error.message || "auto_process_failed",
        stage: error.stage || failed?.auto_process_error_stage || "",
        detail: redactText(error.message || "").slice(0, 300),
      });
    }
  }

  json(req, res, 200, {
    ok: true,
    count: results.length,
    error_count: errors.length,
    results,
    errors,
  });
}

async function handleAdminProvisionCafe24Orders(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const ids = [...new Set((Array.isArray(body.order_ids) ? body.order_ids : Array.isArray(body.ids) ? body.ids : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean))];
  if (!ids.length) {
    json(req, res, 400, { ok: false, error: "empty_selection" });
    return;
  }
  if (ids.length > 100) {
    json(req, res, 400, { ok: false, error: "batch_too_large", max: 100 });
    return;
  }

  const data = loadCafe24Orders();
  const orderById = new Map(data.orders.map((order) => [order.id, order]));
  const overrides = body.product_overrides && typeof body.product_overrides === "object" ? body.product_overrides : {};
  const errors = [];
  const selected = ids.map((id, index) => {
    const order = orderById.get(id);
    if (!order) {
      errors.push({ index, order_id: id, error: "order_not_found" });
      return null;
    }
    const product = String(overrides[id] || order.product || "").trim();
    if (String(order.status || "") === "sent" && !body.force) errors.push({ index, order_id: id, email: order.email, error: "order_already_done" });
    if (!isValidEmail(order.email)) errors.push({ index, order_id: id, email: order.email, error: "invalid_email" });
    if (!PRODUCTS.has(product)) errors.push({ index, order_id: id, email: order.email, error: "invalid_product" });
    return { order, product };
  }).filter(Boolean);
  if (errors.length) {
    json(req, res, 400, { ok: false, error: "invalid_order_selection", errors });
    return;
  }

  const users = loadUsers();
  const setupTokens = loadSetupTokens();
  const now = nowIso();
  const resetPassword = Boolean(body.reset_password);
  const expiresAt = body.expires_at || null;
  const results = selected.map(({ order, product }) => {
    const provision = provisionAdminUser(users, {
      email: order.email,
      name: order.name,
      product,
      expires_at: expiresAt,
      reset_password: resetPassword,
      source: "cafe24_order",
      admin_note: [
        `Cafe24 주문: ${order.external_id || order.id}`,
        order.product_name ? `상품명: ${order.product_name}` : "",
        order.amount ? `금액: ${order.amount}` : "",
      ].filter(Boolean).join("\n"),
    }, now);
    if (provision.error) return { order, product, error: provision.error };
    order.product = product;
    order.product_confidence = order.product_confidence === "explicit" ? "explicit" : "admin";
    order.issue = "";
    order.status = "provisioned";
    order.processed_at = now;
    order.updated_at = now;
    order.user_id = provision.user.id;
    const guide = {
      ...cafe24GuideForProvision(provision, product, setupTokens, now, "cafe24_order_admin_setup_link"),
      order_id: order.id,
    };
    return {
      order,
      product,
      created: provision.created,
      user: provision.user,
      temporaryPassword: provision.temporaryPassword,
      guide,
    };
  });
  const provisionError = results.find((result) => result.error);
  if (provisionError) {
    json(req, res, 400, { ok: false, error: provisionError.error });
    return;
  }
  saveUsers(users);
  saveSetupTokens(setupTokens);
  saveCafe24Orders(data);
  const agents = loadAgents();
  const agentByUserId = new Map(agents.agents.map((agent) => [agent.user_id, agent]));

  json(req, res, 201, {
    ok: true,
    count: results.length,
    results: results.map((result) => ({
      order: adminCafe24OrderRow(result.order),
      created: result.created,
      user: adminUserRow(result.user, agentByUserId.get(result.user.id)),
      product: result.product,
      temporary_password_visible_once: Boolean(result.temporaryPassword || result.guide?.setup_url_visible_once),
      guide: result.guide,
    })),
  });
}

async function handleAdminSendCafe24Guides(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const guides = Array.isArray(body.guides) ? body.guides : [];
  if (!guides.length) {
    json(req, res, 400, { ok: false, error: "empty_selection" });
    return;
  }
  if (guides.length > 100) {
    json(req, res, 400, { ok: false, error: "batch_too_large", max: 100 });
    return;
  }

  const data = loadCafe24Orders();
  const orderById = new Map(data.orders.map((order) => [order.id, order]));
  const users = loadUsers();
  const sent = [];
  const errors = [];

  for (const [index, guide] of guides.entries()) {
    const orderId = String(guide.order_id || "").trim();
    const email = normalizeEmail(guide.email || guide.to);
    const subject = String(guide.subject || "AIMAX 이용 안내입니다.").trim().slice(0, 160);
    const text = String(guide.text || guide.guide_text || "").trim();
    const order = orderById.get(orderId);
    const user = users.users.find((item) => item.email === email);
    if (!order) {
      errors.push({ index, order_id: orderId, email, error: "order_not_found" });
      continue;
    }
    if (!isValidEmail(email)) {
      errors.push({ index, order_id: orderId, email, error: "invalid_email" });
      continue;
    }
    if (!text) {
      errors.push({ index, order_id: orderId, email, error: "empty_mail_body" });
      continue;
    }
    if (!user || user.status !== "active") {
      errors.push({ index, order_id: orderId, email, error: "user_not_found_or_inactive" });
      continue;
    }
    try {
      const sentAt = nowIso();
      const mail = await sendAdminGuideEmail({ to: email, subject, text });
      rememberUserEmailEvent(user, {
        type: "cafe24_onboarding_guide",
        provider: mail.provider,
        provider_message_id: mail.id,
        to: email,
        subject,
        sent_at: sentAt,
      });
      order.status = "sent";
      order.sent_at = sentAt;
      order.auto_process_stage = "sent";
      order.auto_process_error = "";
      order.auto_process_error_at = null;
      order.auto_process_error_stage = "";
      order.updated_at = sentAt;
      sent.push({
        order_id: order.id,
        email,
        sent_at: sentAt,
        provider: mail.provider,
        provider_message_id: mail.id,
      });
    } catch (error) {
      const failedAt = nowIso();
      order.status = "failed";
      order.auto_process_stage = "failed";
      order.auto_process_error_stage = "manual_mail_sending";
      order.auto_process_error = cafe24AutoErrorCode(error);
      order.auto_process_error_at = failedAt;
      order.updated_at = failedAt;
      queueCafe24AutoFailureAlert(order, error);
      errors.push({
        index,
        order_id: orderId,
        email,
        error: error.code || error.message || "mail_send_failed",
        detail: redactText(error.message || "").slice(0, 300),
      });
    }
  }

  saveUsers(users);
  saveCafe24Orders(data);
  json(req, res, 200, {
    ok: true,
    sent_count: sent.length,
    error_count: errors.length,
    sent,
    errors,
  });
}

async function handleAdminCreateSetupLinks(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const rows = Array.isArray(body.buyers) ? body.buyers : Array.isArray(body.users) ? body.users : Array.isArray(body.emails) ? body.emails : [];
  if (!rows.length) {
    json(req, res, 400, { ok: false, error: "empty_batch" });
    return;
  }
  if (rows.length > 200) {
    json(req, res, 400, { ok: false, error: "batch_too_large", max: 200 });
    return;
  }

  const normalizedRows = rows.map((row) => {
    if (typeof row === "string") return { email: normalizeEmail(row) };
    return { email: normalizeEmail(row.email), name: String(row.name || "").trim() };
  });
  const seen = new Set();
  const errors = [];
  normalizedRows.forEach((row, index) => {
    if (!isValidEmail(row.email)) errors.push({ index, email: row.email, error: "invalid_email" });
    if (row.email && seen.has(row.email)) errors.push({ index, email: row.email, error: "duplicate_email" });
    if (row.email) seen.add(row.email);
  });
  if (errors.length) {
    json(req, res, 400, { ok: false, error: "invalid_batch", errors });
    return;
  }

  const users = loadUsers();
  const userByEmail = new Map(users.users.map((user) => [user.email, user]));
  normalizedRows.forEach((row, index) => {
    const user = userByEmail.get(row.email);
    if (!user || user.status !== "active") {
      errors.push({ index, email: row.email, error: "user_not_found_or_inactive" });
    }
  });
  if (errors.length) {
    json(req, res, 400, { ok: false, error: "setup_link_errors", errors });
    return;
  }

  const setupTokens = loadSetupTokens();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results = [];

  for (const row of normalizedRows) {
    const user = userByEmail.get(row.email);

    const setupLink = createSetupLinkForUser(setupTokens, user, now, String(body.source || "admin_setup_links").trim() || "admin_setup_links");

    const product = user.entitlements?.product || "";
    results.push({
      email: user.email,
      name: user.name || row.name || "",
      product,
      product_label: productLabel(product),
      setup_url: setupLink.setup_url,
      expires_at: setupLink.expires_at,
      setup_url_visible_once: true,
    });
  }

  saveUsers(users);
  saveSetupTokens(setupTokens);

  json(req, res, 201, {
    ok: true,
    count: results.length,
    expires_at: expiresAt,
    users: results,
  });
}

function revokeUserSessions(userId) {
  const sessions = loadSessions();
  const before = sessions.sessions.length;
  sessions.sessions = sessions.sessions.filter((session) => session.user_id !== userId);
  saveSessions(sessions);
  return before - sessions.sessions.length;
}

function revokeUserSetupTokens(userId, now) {
  const setupTokens = loadSetupTokens();
  let revoked = 0;
  setupTokens.tokens.forEach((tokenRow) => {
    if (tokenRow.user_id === userId && !tokenRow.used_at && !tokenRow.revoked_at) {
      tokenRow.revoked_at = now;
      tokenRow.used_at = now;
      revoked += 1;
    }
  });
  saveSetupTokens(setupTokens);
  return revoked;
}

async function handleAdminExpireUser(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    json(req, res, 400, { ok: false, error: "invalid_email" });
    return;
  }

  const users = loadUsers();
  const user = users.users.find((item) => item.email === email);
  if (!user) {
    json(req, res, 404, { ok: false, error: "user_not_found" });
    return;
  }

  const now = nowIso();
  user.status = "expired";
  user.entitlements = {
    ...(user.entitlements || {}),
    status: "expired",
    expires_at: now,
    expired_at: now,
    expired_source: String(body.source || "admin_expire").slice(0, 80),
  };
  user.updated_at = now;
  if (body.admin_note) {
    user.admin_note = [user.admin_note || "", redactText(String(body.admin_note))].filter(Boolean).join("\n").slice(-2000);
  }
  saveUsers(users);

  const revokedSessions = revokeUserSessions(user.id);
  const revokedSetupTokens = revokeUserSetupTokens(user.id, now);
  const agents = loadAgents();
  const agent = agents.agents.find((item) => item.user_id === user.id);

  json(req, res, 200, {
    ok: true,
    user: adminUserRow(user, agent),
    revoked_sessions: revokedSessions,
    revoked_setup_tokens: revokedSetupTokens,
  });
}

// 지원용: 특정 사용자의 웹 AI/API 키 "사용 가능 여부"(서버 복호화 성공 boolean)와 에이전트 readiness 확인.
// 키 값/원문은 절대 반환하지 않는다(publicUserSecretStatuses 는 configured/source/fingerprint/updated_at 만).
async function handleAdminUserSecretStatus(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    json(req, res, 400, { ok: false, error: "invalid_email" });
    return;
  }
  const users = loadUsers();
  const user = users.users.find((item) => item.email === email);
  if (!user) {
    json(req, res, 404, { ok: false, error: "user_not_found" });
    return;
  }
  const agents = loadAgents();
  const agent = agents.agents.find((item) => item.user_id === user.id);
  json(req, res, 200, {
    ok: true,
    user: adminUserRow(user, agent),
    secrets: publicUserSecretStatuses(user.id),
    server_generation: publicYeriServerGenerationConfig(user),
  });
}

async function handleAdminDeleteUser(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    json(req, res, 400, { ok: false, error: "invalid_email" });
    return;
  }

  const users = loadUsers();
  const user = users.users.find((item) => item.email === email);
  if (!user) {
    json(req, res, 404, { ok: false, error: "user_not_found" });
    return;
  }

  const userId = user.id;
  users.users = users.users.filter((item) => item.id !== userId);
  saveUsers(users);

  const revokedSessions = revokeUserSessions(userId);
  const now = nowIso();
  const revokedSetupTokens = revokeUserSetupTokens(userId, now);
  const removedSecrets = deleteUserSecretsForUser(userId);

  const agents = loadAgents();
  const removedAgents = agents.agents.filter((agent) => agent.user_id === userId).length;
  agents.agents = agents.agents.filter((agent) => agent.user_id !== userId);
  saveAgents(agents);

  const commands = loadCommands();
  const removedCommands = commands.commands.filter((command) => command.user_id === userId).length;
  commands.commands = commands.commands.filter((command) => command.user_id !== userId);
  saveCommands(commands);

  const jobs = loadJobs();
  const removedJobs = jobs.jobs.filter((job) => job.user_id === userId).length;
  jobs.jobs = jobs.jobs.filter((job) => job.user_id !== userId);
  saveJobs(jobs);

  json(req, res, 200, {
    ok: true,
    deleted_email: email,
    revoked_sessions: revokedSessions,
    revoked_setup_tokens: revokedSetupTokens,
    removed_secrets: removedSecrets,
    removed_agents: removedAgents,
    removed_commands: removedCommands,
    removed_jobs: removedJobs,
  });
}

function handleAdminListUsers(req, res) {
  if (!requireAdmin(req, res)) return;
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const query = normalizeEmail(url.searchParams.get("query"));
  const product = String(url.searchParams.get("product") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const segment = String(url.searchParams.get("segment") || "").trim();
  const users = loadUsers();
  const agents = loadAgents();
  const agentByUserId = new Map(agents.agents.map((agent) => [agent.user_id, agent]));
  const rows = users.users
    .filter((user) => {
      if (query && !user.email.includes(query) && !String(user.name || "").toLowerCase().includes(query)) return false;
      if (product && !entitlementProductsForMerge(user.entitlements || {}).has(product)) return false;
      if (segment && normalizeAccountSegment(user.account_segment || user.accountSegment || "", "paid_buyer") !== segment) return false;
      if (status === "must_change_password" && !user.must_change_password) return false;
      if (status === "executable" && !canExecute(user)) return false;
      if (status === "expired" && !isExpiredUser(user)) return false;
      if (status === "inactive" && user.status === "active") return false;
      return true;
    })
    .map((user) => adminUserRow(user, agentByUserId.get(user.id)))
    .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
    .slice(0, 200);
  json(req, res, 200, { ok: true, users: rows, stats: adminStats(users.users, agents.agents) });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) return;

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const users = loadUsers();
  const user = users.users.find((item) => item.email === email);
  if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) {
    json(req, res, 401, { ok: false, error: "invalid_credentials" });
    return;
  }

  const sessions = loadSessions();
  const token = crypto.randomBytes(32).toString("base64url");
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  sessions.sessions.push({
    id: crypto.randomUUID(),
    user_id: user.id,
    token_hash: hashToken(token),
    created_at: now,
    expires_at: expiresAt,
    last_seen_at: now,
    device_label: String(body.device_label || "").slice(0, 120),
  });
  saveSessions(sessions);

  user.last_login_at = now;
  user.updated_at = now;
  saveUsers(users);

  json(req, res, 200, {
    ok: true,
    session_token: token,
    expires_at: expiresAt,
    requires_password_change: Boolean(user.must_change_password),
    can_execute: canExecute(user),
    user: publicUser(user),
  });
}

function handleMe(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  json(req, res, 200, {
    ok: true,
    requires_password_change: Boolean(auth.user.must_change_password),
    can_execute: canExecute(auth.user),
    user: publicUser(auth.user),
  });
}

function handleUserSecrets(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  json(req, res, 200, {
    ok: true,
    secrets: publicUserSecretStatuses(auth.user.id),
  });
}

async function handlePutUserSecret(req, res, provider) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const value = body.value || body.secret || body.api_key || body.token || "";
  let verification = null;
  const providerConfig = secretProviderConfig(provider);
  if (providerConfig?.secretName === "APIFY_API_TOKEN" && String(value || "").trim()) {
    try {
      const me = await requestExternalJson("https://api.apify.com/v2/users/me", {
        headers: { authorization: `Bearer ${String(value).trim()}` },
        timeoutMs: 8000,
        maxBytes: 256 * 1024,
      });
      const data = me.json?.data || {};
      verification = {
        verified: true,
        username: compactText(data.username, 60),
        plan: compactText(data.plan?.id, 30),
      };
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        json(req, res, 400, {
          ok: false,
          error: "apify_token_invalid",
          message: "Apify 키가 유효하지 않습니다. Apify 콘솔 > API & Integrations에서 키를 다시 복사해주세요.",
        });
        return;
      }
      verification = { verified: false, reason: "network_unreachable" };
    }
  }
  const result = setUserSecret(auth.user.id, provider, value);
  if (result.error) {
    const statusCode = result.error === "invalid_secret_provider" ? 404 : 400;
    json(req, res, statusCode, { ok: false, error: result.error });
    return;
  }
  // AI 키를 새로 저장했으므로 키 인증/결제 한도 관련 연속 실패 가드를 자동 해제한다.
  if (["gemini", "openai", "claude"].includes(result.config.provider)) {
    releaseJobGuardsForClasses(auth.user.id, ["ai_key_invalid", "billing_quota"]);
  }
  json(req, res, 200, {
    ok: true,
    verification,
    secret: publicUserSecretStatus(auth.user.id, result.config.provider),
    secrets: publicUserSecretStatuses(auth.user.id),
  });
}

function handleDeleteUserSecret(req, res, provider) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const result = deleteUserSecret(auth.user.id, provider);
  if (result.error) {
    json(req, res, 404, { ok: false, error: result.error });
    return;
  }
  json(req, res, 200, {
    ok: true,
    deleted: result.deleted,
    secret: publicUserSecretStatus(auth.user.id, result.config.provider),
    secrets: publicUserSecretStatuses(auth.user.id),
  });
}

function findValidSetupToken(token) {
  const tokenHash = hashToken(token);
  const setupTokens = loadSetupTokens();
  const tokenRow = setupTokens.tokens.find((item) => item.token_hash === tokenHash);
  if (!tokenRow || tokenRow.used_at || tokenRow.revoked_at || Date.parse(tokenRow.expires_at || "") <= Date.now()) {
    return null;
  }
  const users = loadUsers();
  const user = users.users.find((item) => item.id === tokenRow.user_id && item.email === tokenRow.email);
  if (!user || user.status !== "active") return null;
  return { setupTokens, tokenRow, users, user };
}

function handleSetupTokenInfo(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const token = String(url.searchParams.get("token") || "").trim();
  const found = findValidSetupToken(token);
  if (!found) {
    json(req, res, 404, { ok: false, error: "invalid_or_expired_setup_token" });
    return;
  }
  const product = found.user.entitlements?.product || "";
  json(req, res, 200, {
    ok: true,
    email: found.user.email,
    name: found.user.name || "",
    product,
    product_label: productLabel(product),
    expires_at: found.tokenRow.expires_at,
  });
}

async function handleSetupPassword(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) return;

  const token = String(body.token || "").trim();
  const newPassword = String(body.new_password || "");
  const confirmPassword = Object.prototype.hasOwnProperty.call(body, "confirm_password")
    ? String(body.confirm_password || "")
    : newPassword;
  const found = findValidSetupToken(token);
  if (!found) {
    json(req, res, 404, { ok: false, error: "invalid_or_expired_setup_token" });
    return;
  }
  if (newPassword !== confirmPassword) {
    json(req, res, 400, { ok: false, error: "password_mismatch" });
    return;
  }
  const validationError = validateNewPassword(newPassword, found.user.email);
  if (validationError) {
    json(req, res, 400, { ok: false, error: validationError });
    return;
  }

  const now = nowIso();
  found.user.password_hash = hashPassword(newPassword);
  found.user.must_change_password = false;
  found.user.updated_at = now;
  found.tokenRow.used_at = now;
  saveUsers(found.users);
  saveSetupTokens(found.setupTokens);

  json(req, res, 200, {
    ok: true,
    email: found.user.email,
    requires_password_change: false,
    can_execute: canExecute(found.user),
  });
}

async function handleChangePassword(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;

  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");
  const needsCurrentPassword = !auth.user.must_change_password;
  if (needsCurrentPassword && !verifyPassword(currentPassword, auth.user.password_hash)) {
    json(req, res, 401, { ok: false, error: "invalid_current_password" });
    return;
  }
  const validationError = validateNewPassword(newPassword, auth.user.email);
  if (validationError) {
    json(req, res, 400, { ok: false, error: validationError });
    return;
  }

  auth.user.password_hash = hashPassword(newPassword);
  auth.user.must_change_password = false;
  auth.user.updated_at = nowIso();
  saveUsers(auth.users);
  json(req, res, 200, {
    ok: true,
    requires_password_change: false,
    can_execute: canExecute(auth.user),
    user: publicUser(auth.user),
  });
}

function handleLogout(req, res) {
  const token = sessionTokenFromReq(req);
  if (token) {
    const sessions = loadSessions();
    const tokenHash = hashToken(token);
    sessions.sessions = sessions.sessions.filter((item) => item.token_hash !== tokenHash);
    saveSessions(sessions);
  }
  json(req, res, 200, { ok: true });
}

function handleAgentStatus(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const agents = loadAgents();
  const agent = findAgentForUser(agents, auth.user.id, requestPlatform(req));
  json(req, res, 200, { ok: true, agent: publicAgent(agent) });
}

function handleVersion(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const currentVersion = String(url.searchParams.get("current") || "");
  const platform = String(url.searchParams.get("platform") || "");
  json(req, res, 200, {
    ok: true,
    agent: versionPayload(currentVersion, platform),
  });
}

function handleDownloadOptions(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const platforms = ["macos", "windows"];
  const downloads = [];
  for (const platform of platforms) {
    const products = platform === "windows"
      ? ["bundle"]
      : ["bundle", "yeri", "hyunju", "eunseo"].filter((product) => downloadProductAllowed(auth.user, platform, product));
    for (const product of products) {
      downloads.push(downloadInfo(auth.user, platform, product));
    }
  }
  json(req, res, 200, {
    ok: true,
    downloads: downloads.map(({ filePath: _filePath, ...item }) => item),
  });
}

async function handleCreateDownloadTicket(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const body = await readJsonBody(req, res);
  if (!body) return;
  const result = createDownloadTicket(auth.user, body.platform, body.product);
  if (result.error) {
    const statusCode = result.error === "download_not_allowed"
      ? 403
      : result.error === "download_file_not_uploaded"
        ? 404
        : 400;
    json(req, res, statusCode, { ok: false, error: result.error });
    return;
  }
  const { filePath: _filePath, ...download } = result.info;
  json(req, res, 201, {
    ok: true,
    ticket: result.ticket,
    url: result.url,
    expires_at: result.expires_at,
    download,
  });
}

function handleCreateEunseoLaunch(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const result = createEunseoLaunchTicket(auth.user);
  if (result.error) {
    json(req, res, 403, { ok: false, error: result.error });
    return;
  }
  json(req, res, 201, {
    ok: true,
    url: result.url,
    expires_at: result.expires_at,
  });
}

function handleDownloadAgent(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const ticket = String(url.searchParams.get("ticket") || "").trim();
  let info = null;
  if (ticket) {
    info = downloadInfoFromTicket(ticket);
  } else {
    const auth = requireSession(req, res);
    if (!auth) return;
    if (!canExecute(auth.user)) {
      json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
      return;
    }
    info = downloadInfo(auth.user, url.searchParams.get("platform"), url.searchParams.get("product"));
  }
  if (info.error) {
    const statusCode = info.error === "download_not_allowed"
      ? 403
      : info.error === "download_ticket_invalid" || info.error === "download_ticket_expired"
        ? 403
        : 400;
    json(req, res, statusCode, { ok: false, error: info.error });
    return;
  }
  if (!info.exists) {
    json(req, res, 404, { ok: false, error: "download_file_not_uploaded" });
    return;
  }
  const safeFilename = info.filename.replace(/[^A-Za-z0-9_.-]/g, "_");
  res.writeHead(200, {
    "content-type": info.filename.toLowerCase().endsWith(".exe") ? "application/octet-stream" : downloadContentType(info.filename),
    "content-length": info.size,
    "content-disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(info.filename)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  fs.createReadStream(info.filePath).pipe(res);
}

function handlePublicDownload(req, res, url) {
  let filename = "";
  try {
    filename = decodeURIComponent(url.pathname.replace(/^\/downloads\//, ""));
  } catch (_error) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  if (!PUBLIC_DOWNLOAD_FILES.has(filename)) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const filePath = path.normalize(path.join(DOWNLOAD_DIR, filename));
  if (!filePath.startsWith(`${DOWNLOAD_DIR}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    json(req, res, 404, { ok: false, error: "download_file_not_uploaded" });
    return;
  }
  const stat = fs.statSync(filePath);
  const safeFilename = filename.replace(/[^A-Za-z0-9_.-]/g, "_");
  res.writeHead(200, {
    "content-type": filename.toLowerCase().endsWith(".exe") ? "application/octet-stream" : downloadContentType(filename),
    "content-length": stat.size,
    "content-disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "cache-control": "public, max-age=3600",
    "x-content-type-options": "nosniff",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function handleWorkers(req, res) {
  const auth = lookupSession(req);
  const user = auth?.user || null;
  const workers = Object.values(WORKERS)
    .filter((worker) => workerVisibleToUser(worker, user))
    .map(publicWorker);
  const jobKinds = Object.entries(JOB_KINDS)
    .filter(([kind]) => jobKindVisibleToUser(kind, user))
    .map(([kind, config]) => publicJobKind(kind, config, user));
  json(req, res, 200, {
    ok: true,
    catalog_version: 1,
    workers,
    job_kinds: jobKinds,
  });
}

function requireResearchAccess(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return null;
  if (!canUseResearch(auth.user)) {
    json(req, res, 403, { ok: false, error: "research_not_allowed" });
    return null;
  }
  return auth;
}

function handleListResearchProjects(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const research = loadResearch();
  const projects = research.projects
    .filter((project) => project.user_id === auth.user.id)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
    .map(publicResearchProject);
  json(req, res, 200, { ok: true, projects });
}

async function handleCreateResearchProject(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const name = compactText(body.name, 80);
  if (!name) {
    json(req, res, 400, { ok: false, error: "project_name_required" });
    return;
  }
  const now = nowIso();
  const project = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    name,
    goal: compactText(body.goal, 220),
    industry: compactText(body.industry, 80),
    ...researchPersonalizationFromBody(body),
    created_at: now,
    updated_at: now,
  };
  const research = loadResearch();
  research.projects.push(project);
  saveResearch(research);
  json(req, res, 201, { ok: true, project: publicResearchProject(project) });
}

async function handleUpdateResearchProject(req, res, projectId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const research = loadResearch();
  const project = research.projects.find((item) => item.id === projectId && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = compactText(body.name, 80);
    if (!name) {
      json(req, res, 400, { ok: false, error: "project_name_required" });
      return;
    }
    project.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "goal")) project.goal = compactText(body.goal, 220);
  if (Object.prototype.hasOwnProperty.call(body, "industry")) project.industry = compactText(body.industry, 80);
  const personalization = researchPersonalizationFromBody(body);
  for (const key of ["instagram_profile_url", "content_category", "content_topic"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) project[key] = personalization[key];
  }
  project.updated_at = nowIso();
  saveResearch(research);
  json(req, res, 200, { ok: true, project: publicResearchProject(project) });
}

function handleDeleteResearchProject(req, res, projectId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const research = loadResearch();
  const project = research.projects.find((item) => item.id === projectId && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const beforeItems = research.items.length;
  research.projects = research.projects.filter((item) => !(item.id === project.id && item.user_id === auth.user.id));
  research.items = research.items.filter((item) => !(item.project_id === project.id && item.user_id === auth.user.id));
  research.discovery_subscriptions = (research.discovery_subscriptions || []).filter((item) => item.project_id !== project.id);
  saveResearch(research);
  json(req, res, 200, {
    ok: true,
    deleted_project_id: project.id,
    deleted_item_count: beforeItems - research.items.length,
  });
}

function handleListResearchItems(req, res, url) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const projectId = String(url.searchParams.get("project_id") || "").trim();
  const research = loadResearch();
  const allowedProjects = new Set(research.projects.filter((project) => project.user_id === auth.user.id).map((project) => project.id));
  const items = research.items
    .filter((item) => item.user_id === auth.user.id)
    .filter((item) => allowedProjects.has(item.project_id))
    .filter((item) => !projectId || item.project_id === projectId)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
    .map(publicResearchItem);
  json(req, res, 200, { ok: true, items });
}

async function handleCreateResearchItem(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const projectId = String(body.project_id || "").trim();
  const research = loadResearch();
  const project = research.projects.find((item) => item.id === projectId && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const url = compactText(body.url, 1000);
  const userSourceText = cleanMultilineText(body.source_text, 8000);
  const personalization = researchPersonalizationFromBody(body);
  if (!userSourceText && !url) {
    json(req, res, 400, { ok: false, error: "research_source_required" });
    return;
  }
  const apifyEligible = url ? canUseApifyForResearchUrl(url) : false;
  const apifyState = apifyEligible ? researchApifyIntegrationState(agentForUserId(auth.user.id), auth.user) : null;
  let linkData = null;
  let linkFetchError = "";
  if (url) {
    try {
      linkData = await fetchResearchLink(url, { apifyState });
    } catch (error) {
      linkFetchError = researchFetchErrorCode(error);
      if (!userSourceText && !apifyEligible) {
        json(req, res, 422, { ok: false, error: "research_link_fetch_failed", detail: linkFetchError });
        return;
      }
    }
  }
  const apifyPendingText = !linkData && apifyEligible
    ? [
      `SNS 링크: ${url}`,
      apifyState?.server_configured
        ? "Apify 수집 승인을 기다리는 자료입니다. 버튼 확인 후 Instagram/TikTok 메타데이터를 읽습니다."
        : apifyState?.local_configured
          ? "Apify 토큰은 이 PC에만 저장되어 있습니다. 설정 탭의 AI/API 연결에서 웹 보안 저장소로 저장하면 송이가 브라우저에서 바로 수집할 수 있습니다."
          : "Apify 토큰이 없어서 SNS 메타데이터 수집을 아직 실행할 수 없습니다.",
    ].join("\n")
    : "";
  const sourceText = cleanMultilineText([
    project.profile_source_text ? `사용자 인스타그램 프로필 분석:\n${project.profile_source_text}` : "",
    linkData?.source_text || "",
    apifyPendingText,
    researchPersonalizationText(personalization),
    userSourceText ? `사용자 입력:\n${userSourceText}` : "",
  ].filter(Boolean).join("\n\n"), 8000);
  const title = compactText(body.title, 180) || compactText(linkData?.title, 180) || compactText(url, 120) || "직접 입력 자료";
  const analysis = analyzeResearchInput({
    ...body,
    title,
    url,
    category: compactText(body.category, 40) || personalization.content_category,
    source_text: sourceText,
  });
  const now = nowIso();
  const item = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    project_id: project.id,
    type: "reference",
    url,
    title,
    source_text: sourceText,
    instagram_profile_url: personalization.instagram_profile_url,
    content_category: personalization.content_category,
    content_topic: personalization.content_topic,
    memo: cleanMultilineText(body.memo, 2000),
    link_fetch_status: linkData?.fetch_status || (apifyEligible ? (apifyState?.server_configured ? "apify_needs_approval" : apifyState?.local_configured ? "apify_local_pending" : "apify_key_missing") : (url ? "failed_with_manual_text" : "manual")),
    link_fetch_error: linkFetchError,
    link_final_url: linkData?.final_url || "",
    link_fetched_at: linkData && !String(linkData.fetch_status || "").startsWith("apify_") ? now : "",
    ...analysis,
    created_at: now,
    updated_at: now,
  };
  research.items.push(item);
  project.updated_at = now;
  saveResearch(research);
  json(req, res, 201, { ok: true, item: publicResearchItem(item) });
}

function handleListResearchDiscovery(req, res, url) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const projectId = String(url.searchParams.get("project_id") || "").trim();
  const research = loadResearch();
  pruneResearchDiscovery(research);
  const projects = new Set(research.projects.filter((project) => project.user_id === auth.user.id).map((project) => project.id));
  const runs = research.discovery_runs
    .filter((run) => run.user_id === auth.user.id && projects.has(run.project_id))
    .filter((run) => !projectId || run.project_id === projectId)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, 10);
  const runIds = new Set(runs.map((run) => run.id));
  const candidates = research.discovery_candidates
    .filter((candidate) => candidate.user_id === auth.user.id && runIds.has(candidate.run_id))
    .sort((a, b) => Number(b.candidate_score || 0) - Number(a.candidate_score || 0));
  saveResearch(research);
  json(req, res, 200, {
    ok: true,
    runs: runs.map(publicResearchDiscoveryRun),
    candidates: candidates.map(publicResearchDiscoveryCandidate),
  });
}

async function runSongiApifyDiscoveryRequest(req, res, auth, research, project, { platform, keyword, body }) {
  const sortMode = String(body.sort_mode || "top").trim() === "recent" ? "recent" : "top";
  let maxResults = boundedInteger(body.max_results, 12, 5, 25);
  if (platform === "meta_ads") maxResults = Math.max(SONGI_META_ADS_MIN_RESULTS, maxResults);
  const token = getUserSecret(auth.user.id, "apify");
  if (!token) {
    json(req, res, 400, {
      ok: false,
      error: "research_apify_key_missing",
      message: "이 플랫폼 수집에는 본인 Apify 키가 필요합니다. 비용이 본인 Apify 계정에서 차감되도록 설정 > AI/API 연결에서 키를 저장해주세요.",
    });
    return;
  }
  const config = songiApifyDiscoveryConfig(platform, keyword, maxResults);
  if (!config) {
    json(req, res, 400, {
      ok: false,
      error: "research_discovery_keyword_invalid",
      message: "이 키워드로는 해시태그를 만들 수 없습니다. 특수문자를 빼고 다시 입력해주세요.",
    });
    return;
  }
  const lockKey = researchPaidLockKey(auth.user.id, "discovery_apify", project.id);
  if (!acquireResearchPaidLock(lockKey)) {
    json(req, res, 409, {
      ok: false,
      error: "research_paid_operation_in_progress",
      message: "이 프로젝트에서 유료 수집이 이미 진행 중입니다. 잠시 뒤 다시 시도해주세요.",
    });
    return;
  }
  try {
    const now = nowIso();
    const resumableRun = research.discovery_runs.find((item) => item.user_id === auth.user.id
      && item.project_id === project.id
      && item.platform === platform
      && item.keyword === keyword
      && item.status === "running"
      && item.source_mode === "server_apify"
      && !item.subscription_id
      && item.apify_run_id);
    const run = resumableRun || {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      project_id: project.id,
      keyword,
      platform,
      sort_mode: sortMode,
      date_range_days: boundedInteger(body.date_range_days, 30, 1, 90),
      max_results: maxResults,
      status: "running",
      source_mode: "server_apify",
      quota_units_estimate: 0,
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (resumableRun) {
      resumableRun.updated_at = now;
    } else {
      research.discovery_runs.push(run);
    }
    pruneResearchDiscovery(research);
    project.updated_at = now;
    saveResearch(research);
    let failureInfo = null;
    let rows = [];
    try {
      const { items } = await runSongiApifyDiscovery(config, token, maxResults, {
        existingRunId: resumableRun ? resumableRun.apify_run_id : "",
        onRunStarted: (apifyRunId) => {
          const current = loadResearch();
          const currentRun = current.discovery_runs.find((item) => item.id === run.id && item.user_id === auth.user.id);
          if (currentRun && currentRun.apify_run_id !== apifyRunId) {
            currentRun.apify_run_id = apifyRunId;
            currentRun.updated_at = nowIso();
            saveResearch(current);
          }
        },
      });
      rows = songiApifyDiscoveryRows(platform, keyword, items);
      if (!rows.length) failureInfo = songiApifyEmptyResultInfo(platform);
    } catch (error) {
      failureInfo = songiApifyDiscoveryErrorInfo(error, platform);
    }
    const nextResearch = loadResearch();
    const nextRun = nextResearch.discovery_runs.find((item) => item.id === run.id && item.user_id === auth.user.id);
    if (!nextRun) {
      json(req, res, 404, { ok: false, error: "research_discovery_run_not_found" });
      return;
    }
    if (failureInfo) {
      // 실행이 Apify에서 아직 도는 중이면 running 유지 → 재시도 시 같은 실행을 재개해 중복 과금을 막는다
      const stillRunning = failureInfo.code === "research_apify_run_still_running";
      nextRun.status = stillRunning ? "running" : "failed";
      nextRun.error = failureInfo.code;
      nextRun.error_detail = compactText(failureInfo.message, 500);
      nextRun.updated_at = nowIso();
      saveResearch(nextResearch);
      json(req, res, 422, {
        ok: false,
        error: failureInfo.code,
        message: failureInfo.message,
        run: publicResearchDiscoveryRun(nextRun),
      });
      return;
    }
    const candidates = materializeSongiApifyDiscoveryCandidates(nextResearch, nextRun, auth.user.id, rows, { sortMode });
    saveResearch(nextResearch);
    json(req, res, 200, {
      ok: true,
      pending_runner: false,
      run: publicResearchDiscoveryRun(nextRun),
      command: null,
      candidates: candidates.map(publicResearchDiscoveryCandidate),
    });
  } finally {
    releaseResearchPaidLock(lockKey);
  }
}

async function handleRunResearchDiscovery(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const projectId = String(body.project_id || "").trim();
  const keyword = compactText(body.keyword, 120);
  const platform = String(body.platform || "youtube").trim().toLowerCase();
  const research = loadResearch();
  const project = research.projects.find((item) => item.id === projectId && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  if (!keyword) {
    json(req, res, 400, { ok: false, error: "research_discovery_keyword_required" });
    return;
  }
  if (SONGI_APIFY_DISCOVERY_PLATFORMS.has(platform)) {
    await runSongiApifyDiscoveryRequest(req, res, auth, research, project, { platform, keyword, body });
    return;
  }
  if (platform !== "youtube") {
    json(req, res, 400, { ok: false, error: "research_discovery_platform_not_ready", message: "지원하지 않는 플랫폼입니다. 유튜브/인스타그램/틱톡/스레드/메타 광고 중에서 선택해주세요." });
    return;
  }

  const days = boundedInteger(body.date_range_days, 30, 1, 90);
  const maxResults = boundedInteger(body.max_results, 12, 5, 25);
  const regionCode = compactText(body.region_code || "KR", 2).toUpperCase();
  const relevanceLanguage = compactText(body.relevance_language || "ko", 12).toLowerCase();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString();
  const agents = loadAgents();
  const requestedAgentPlatform = normalizePlatform(body.target_platform || body.agent_platform || "");
  const agent = publicAgent(findAgentForUser(agents, auth.user.id, requestedAgentPlatform));
  const localYtDlpReady = Boolean(agent.connected && agent.readiness?.media_tools?.yt_dlp === "ready");
  const serverYtDlpReady = Boolean(SONGI_SERVER_YTDLP_DISCOVERY_ENABLED && researchMediaToolStatus().video_download.available);
  const run = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    project_id: project.id,
    keyword,
    platform: "youtube",
    date_range_days: days,
    region_code: regionCode,
    relevance_language: relevanceLanguage,
    max_results: maxResults,
    status: serverYtDlpReady ? "running" : "queued",
    source_mode: serverYtDlpReady ? "server_ytdlp" : "local_ytdlp",
    quota_units_estimate: 0,
    created_at: now,
    updated_at: now,
    expires_at: expiresAt,
  };
  research.discovery_runs.push(run);
  pruneResearchDiscovery(research);
  if (serverYtDlpReady) {
    project.updated_at = now;
    saveResearch(research);
    try {
      const result = await discoverYouTubeCandidatesWithServerYtDlp({ keyword, days, maxResults });
      const nextResearch = loadResearch();
      const nextRun = nextResearch.discovery_runs.find((item) => item.id === run.id && item.user_id === auth.user.id);
      if (!nextRun) {
        json(req, res, 404, { ok: false, error: "research_discovery_run_not_found" });
        return;
      }
      const candidates = materializeSongiDiscoveryCandidates(nextResearch, nextRun, auth.user.id, result.candidates, {
        sourceMode: "server_ytdlp",
        sourceVersion: result.source_version || "",
      });
      saveResearch(nextResearch);
      json(req, res, 200, {
        ok: true,
        pending_runner: false,
        run: publicResearchDiscoveryRun(nextRun),
        command: null,
        candidates: candidates.map(publicResearchDiscoveryCandidate),
      });
      return;
    } catch (error) {
      if (!localYtDlpReady) {
        run.status = "failed";
        run.error = error.code || "server_ytdlp_discovery_failed";
        run.error_detail = compactText(error.stderr || error.message || "", 500);
        run.updated_at = nowIso();
        saveResearch(research);
        json(req, res, 500, {
          ok: false,
          error: "songi_youtube_discovery_failed",
          detail: run.error,
          run: publicResearchDiscoveryRun(run),
        });
        return;
      }
      run.status = "queued";
      run.source_mode = "local_ytdlp";
      run.error = "server_ytdlp_discovery_failed";
      run.error_detail = compactText(error.stderr || error.message || "", 300);
    }
  }
  if (!localYtDlpReady) {
    run.status = "failed";
    run.error = "songi_youtube_runner_or_server_unavailable";
    run.error_detail = "웹 서버 공개 검색 또는 로컬 실행기 yt-dlp 준비 상태가 필요합니다.";
    run.updated_at = nowIso();
    saveResearch(research);
    json(req, res, 503, {
      ok: false,
      error: run.error,
      message: run.error_detail,
      run: publicResearchDiscoveryRun(run),
    });
    return;
  }
  try {
    const command = createSongiDiscoveryCommand(auth, run, body);
    run.command_id = command.id;
    run.updated_at = nowIso();
    project.updated_at = run.updated_at;
    saveResearch(research);
    json(req, res, 202, {
      ok: true,
      pending_runner: true,
      run: publicResearchDiscoveryRun(run),
      command: publicCommand(command),
      candidates: [],
    });
  } catch (error) {
    run.status = "failed";
    run.error = "local_command_create_failed";
    run.error_detail = compactText(error.detail || error.message, 500);
    run.updated_at = nowIso();
    saveResearch(research);
    json(req, res, 500, {
      ok: false,
      error: "songi_youtube_discovery_failed",
      detail: run.error,
      run: publicResearchDiscoveryRun(run),
    });
  }
}

async function handleImportResearchDiscoveryCandidate(req, res, candidateId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const research = loadResearch();
  pruneResearchDiscovery(research);
  const candidate = research.discovery_candidates.find((item) => item.id === candidateId && item.user_id === auth.user.id);
  if (!candidate) {
    json(req, res, 404, { ok: false, error: "research_discovery_candidate_not_found" });
    return;
  }
  const project = research.projects.find((item) => item.id === candidate.project_id && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const existing = candidate.imported_item_id
    ? research.items.find((item) => item.id === candidate.imported_item_id && item.user_id === auth.user.id)
    : null;
  if (existing) {
    json(req, res, 200, {
      ok: true,
      item: publicResearchItem(existing),
      candidate: publicResearchDiscoveryCandidate(candidate),
    });
    return;
  }
  const now = nowIso();
  const platformLabel = compactText(candidate.platform, 30) || "YouTube";
  const isYouTubeCandidate = /youtube/i.test(platformLabel) || /^youtube/.test(String(candidate.content_format || ""));
  let transcriptText = "";
  let transcriptStatus = "";
  if (isYouTubeCandidate && candidate.url && SONGI_SERVER_YTDLP_DISCOVERY_ENABLED && researchMediaToolStatus().video_download.available) {
    try {
      transcriptText = await fetchYouTubeAutoTranscript(candidate.url);
      transcriptStatus = transcriptText ? "fetched" : "unavailable";
    } catch (error) {
      transcriptStatus = "failed";
      console.warn("[songi] 자막 추출 실패", error.code || error.message || "transcript_failed");
    }
  }
  const sourceText = cleanMultilineText([
    candidate.source_text || youtubeDiscoverySourceText(candidate),
    transcriptText ? `자동 자막 발췌:\n${transcriptText}` : "",
  ].filter(Boolean).join("\n\n"), 8000);
  const analysis = analyzeResearchInput({
    title: candidate.title,
    url: candidate.url,
    source_text: sourceText,
    category: project.industry || "벤치마킹 후보",
    tags: [candidate.keyword, platformLabel, "키워드 후보"],
    content_category: project.content_category || project.industry || "",
    content_topic: project.content_topic || candidate.keyword || "",
  });
  const item = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    project_id: project.id,
    type: "reference",
    url: candidate.url || "",
    title: candidate.title || candidate.url || `${platformLabel} 후보`,
    source_text: sourceText,
    discovery_candidate_id: candidate.id,
    discovery_metrics: candidate.metrics || {},
    transcript_status: transcriptStatus,
    link_fetch_status: isYouTubeCandidate ? "youtube_discovery" : "apify_discovery",
    link_final_url: candidate.url || "",
    link_fetched_at: now,
    ...analysis,
    memo: "",
    created_at: now,
    updated_at: now,
  };
  research.items.push(item);
  candidate.imported_item_id = item.id;
  candidate.imported_at = now;
  project.updated_at = now;
  saveResearch(research);
  json(req, res, 201, {
    ok: true,
    item: publicResearchItem(item),
    candidate: publicResearchDiscoveryCandidate(candidate),
  });
}

function songiDiscoveryRunCostUsd(platform, resultCount) {
  if (!SONGI_APIFY_DISCOVERY_PLATFORMS.has(platform)) return 0;
  const pricing = SONGI_APIFY_DISCOVERY_PRICING_USD[platform];
  if (!pricing) return 0;
  return Number(pricing.start || 0) + Math.max(0, Number(resultCount || 0)) * Number(pricing.per_result || 0);
}

function songiDiscoverySubscriptionEstimates(platform, maxResults, frequency) {
  const perRun = songiDiscoveryRunCostUsd(platform, maxResults);
  const config = SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES[frequency];
  const monthly = perRun * Number(config?.runs_per_month || 0);
  return {
    per_run_estimate_usd: Math.round(perRun * 10000) / 10000,
    monthly_estimate_usd: Math.round(monthly * 10000) / 10000,
  };
}

function publicResearchDiscoverySubscription(subscription) {
  const platform = subscription.platform || "youtube";
  const estimates = songiDiscoverySubscriptionEstimates(platform, subscription.max_results, subscription.frequency);
  return {
    id: subscription.id,
    project_id: subscription.project_id,
    keyword: subscription.keyword || "",
    platform,
    sort_mode: subscription.sort_mode || "top",
    date_range_days: Number(subscription.date_range_days || 30),
    max_results: Number(subscription.max_results || 12),
    frequency: subscription.frequency || "weekly",
    frequency_label: SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES[subscription.frequency]?.label || subscription.frequency || "",
    status: subscription.status || "active",
    pause_reason: subscription.pause_reason || "",
    next_run_at: subscription.next_run_at || "",
    last_run_at: subscription.last_run_at || "",
    last_run_status: subscription.last_run_status || "",
    last_run_error: subscription.last_run_error || "",
    last_new_count: Number(subscription.last_new_count || 0),
    run_count: Number(subscription.run_count || 0),
    total_cost_usd: Math.round(Number(subscription.total_cost_usd || 0) * 10000) / 10000,
    per_run_estimate_usd: estimates.per_run_estimate_usd,
    monthly_estimate_usd: estimates.monthly_estimate_usd,
    created_at: subscription.created_at || "",
    updated_at: subscription.updated_at || "",
  };
}

function handleListResearchDiscoverySubscriptions(req, res, url) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const projectId = String(url.searchParams.get("project_id") || "").trim();
  const research = loadResearch();
  pruneResearchDiscovery(research);
  const projects = new Set(research.projects.filter((project) => project.user_id === auth.user.id).map((project) => project.id));
  const subscriptions = (research.discovery_subscriptions || [])
    .filter((subscription) => subscription.user_id === auth.user.id && projects.has(subscription.project_id))
    .filter((subscription) => !projectId || subscription.project_id === projectId)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  json(req, res, 200, { ok: true, subscriptions: subscriptions.map(publicResearchDiscoverySubscription) });
}

async function handleCreateResearchDiscoverySubscription(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const projectId = String(body.project_id || "").trim();
  const keyword = compactText(body.keyword, 120);
  const platform = String(body.platform || "youtube").trim().toLowerCase();
  const frequency = String(body.frequency || "").trim();
  const sortMode = String(body.sort_mode || "top").trim() === "recent" ? "recent" : "top";
  const research = loadResearch();
  const project = research.projects.find((item) => item.id === projectId && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  if (!keyword) {
    json(req, res, 400, { ok: false, error: "research_discovery_keyword_required" });
    return;
  }
  if (platform !== "youtube" && !SONGI_APIFY_DISCOVERY_PLATFORMS.has(platform)) {
    json(req, res, 400, { ok: false, error: "research_discovery_platform_not_ready", message: "지원하지 않는 플랫폼입니다. 유튜브/인스타그램/틱톡/스레드/메타 광고 중에서 선택해주세요." });
    return;
  }
  if (!SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES[frequency]) {
    json(req, res, 400, { ok: false, error: "research_discovery_subscription_frequency_invalid", message: "수집 주기는 매일 또는 매주만 지원합니다." });
    return;
  }
  let maxResults = boundedInteger(body.max_results, 12, 5, 25);
  if (platform === "meta_ads") maxResults = Math.max(SONGI_META_ADS_MIN_RESULTS, maxResults);
  if (SONGI_APIFY_DISCOVERY_PLATFORMS.has(platform)) {
    if (!hasUserSecret(auth.user.id, "apify")) {
      json(req, res, 400, {
        ok: false,
        error: "research_apify_key_missing",
        message: "이 플랫폼 자동수집에는 본인 Apify 키가 필요합니다. 설정 > AI/API 연결에서 키를 저장해주세요.",
      });
      return;
    }
    if (!songiApifyDiscoveryConfig(platform, keyword, maxResults)) {
      json(req, res, 400, {
        ok: false,
        error: "research_discovery_keyword_invalid",
        message: "이 키워드로는 해시태그를 만들 수 없습니다. 특수문자를 빼고 다시 입력해주세요.",
      });
      return;
    }
  }
  pruneResearchDiscovery(research);
  const mySubscriptions = (research.discovery_subscriptions || []).filter((item) => item.user_id === auth.user.id);
  if (mySubscriptions.length >= SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_USER) {
    json(req, res, 400, {
      ok: false,
      error: "research_discovery_subscription_limit",
      message: `구독은 계정당 최대 ${SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_USER}개까지 만들 수 있습니다. 기존 구독을 정리해주세요.`,
    });
    return;
  }
  const duplicate = mySubscriptions.find((item) => item.project_id === projectId
    && item.platform === platform
    && item.keyword === keyword
    && (item.sort_mode || "top") === sortMode);
  if (duplicate) {
    json(req, res, 409, {
      ok: false,
      error: "research_discovery_subscription_exists",
      message: "같은 프로젝트에 동일한 키워드·플랫폼·모드 구독이 이미 있습니다.",
      subscription: publicResearchDiscoverySubscription(duplicate),
    });
    return;
  }
  const now = nowIso();
  const platformLabel = SONGI_DISCOVERY_PLATFORM_LABELS[platform] || platform;
  const seedUrls = (research.discovery_candidates || [])
    .filter((candidate) => candidate.user_id === auth.user.id
      && candidate.project_id === projectId
      && candidate.keyword === keyword
      && String(candidate.platform || "") === platformLabel
      && candidate.url)
    .map((candidate) => candidate.url);
  const subscription = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    project_id: projectId,
    keyword,
    platform,
    sort_mode: sortMode,
    date_range_days: boundedInteger(body.date_range_days, 30, 1, 90),
    max_results: maxResults,
    frequency,
    status: "active",
    pause_reason: "",
    next_run_at: new Date(Date.now() + SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES[frequency].interval_ms).toISOString(),
    last_run_at: "",
    last_run_status: "",
    last_run_error: "",
    last_new_count: 0,
    run_count: 0,
    total_cost_usd: 0,
    consecutive_failures: 0,
    seen_urls: Array.from(new Set(seedUrls)).slice(-SONGI_DISCOVERY_SUBSCRIPTION_SEEN_URL_LIMIT),
    created_at: now,
    updated_at: now,
  };
  research.discovery_subscriptions = research.discovery_subscriptions || [];
  research.discovery_subscriptions.push(subscription);
  project.updated_at = now;
  saveResearch(research);
  json(req, res, 201, { ok: true, subscription: publicResearchDiscoverySubscription(subscription) });
}

async function handleUpdateResearchDiscoverySubscription(req, res, subscriptionId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const action = String(body.action || "").trim();
  if (!["pause", "resume"].includes(action)) {
    json(req, res, 400, { ok: false, error: "research_discovery_subscription_action_invalid", message: "지원하는 동작은 일시정지/재개입니다." });
    return;
  }
  const research = loadResearch();
  const subscription = (research.discovery_subscriptions || []).find((item) => item.id === subscriptionId && item.user_id === auth.user.id);
  if (!subscription) {
    json(req, res, 404, { ok: false, error: "research_discovery_subscription_not_found" });
    return;
  }
  const now = nowIso();
  if (action === "pause") {
    subscription.status = "paused";
    subscription.pause_reason = "user_paused";
  } else {
    if (SONGI_APIFY_DISCOVERY_PLATFORMS.has(subscription.platform) && !hasUserSecret(auth.user.id, "apify")) {
      json(req, res, 400, {
        ok: false,
        error: "research_apify_key_missing",
        message: "재개하려면 설정 > AI/API 연결에서 본인 Apify 키를 먼저 저장해주세요.",
      });
      return;
    }
    subscription.status = "active";
    subscription.pause_reason = "";
    subscription.consecutive_failures = 0;
    const nextRunTime = Date.parse(subscription.next_run_at || "");
    if (!Number.isFinite(nextRunTime) || nextRunTime <= Date.now()) {
      subscription.next_run_at = new Date(Date.now() + 60 * 1000).toISOString();
    }
  }
  subscription.updated_at = now;
  saveResearch(research);
  json(req, res, 200, { ok: true, subscription: publicResearchDiscoverySubscription(subscription) });
}

function handleDeleteResearchDiscoverySubscription(req, res, subscriptionId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const research = loadResearch();
  const subscription = (research.discovery_subscriptions || []).find((item) => item.id === subscriptionId && item.user_id === auth.user.id);
  if (!subscription) {
    json(req, res, 404, { ok: false, error: "research_discovery_subscription_not_found" });
    return;
  }
  research.discovery_subscriptions = research.discovery_subscriptions.filter((item) => item.id !== subscription.id);
  saveResearch(research);
  json(req, res, 200, { ok: true, deleted_subscription_id: subscription.id });
}

function pauseSongiDiscoverySubscription(research, subscription, reason, message) {
  subscription.status = "paused";
  subscription.pause_reason = reason;
  subscription.last_run_status = "failed";
  subscription.last_run_error = compactText(message, 300);
  subscription.updated_at = nowIso();
  saveResearch(research);
}

async function runSongiDiscoverySubscriptionOnce(subscriptionId) {
  const research = loadResearch();
  const subscription = (research.discovery_subscriptions || []).find((item) => item.id === subscriptionId);
  if (!subscription || subscription.status !== "active") return { skipped: "not_active" };
  const project = research.projects.find((item) => item.id === subscription.project_id && item.user_id === subscription.user_id);
  if (!project) {
    pruneResearchDiscovery(research);
    saveResearch(research);
    return { skipped: "project_missing" };
  }
  const userRecord = loadUsers().users.find((item) => item.id === subscription.user_id);
  if (!userRecord || !canUseResearch(userRecord)) {
    pauseSongiDiscoverySubscription(research, subscription, "research_access_expired", "이용 권한이 만료되거나 비활성화되어 자동수집을 일시정지했습니다.");
    return { paused: "research_access_expired" };
  }
  const platform = subscription.platform || "youtube";
  const isApify = SONGI_APIFY_DISCOVERY_PLATFORMS.has(platform);
  let maxResults = boundedInteger(subscription.max_results, 12, 5, 25);
  if (platform === "meta_ads") maxResults = Math.max(SONGI_META_ADS_MIN_RESULTS, maxResults);
  let token = "";
  let apifyConfig = null;
  if (isApify) {
    token = getUserSecret(subscription.user_id, "apify");
    if (!token) {
      pauseSongiDiscoverySubscription(research, subscription, "research_apify_key_missing", "Apify 키가 없어 자동수집을 일시정지했습니다. 설정 > AI/API 연결에서 키를 저장한 뒤 재개해주세요.");
      return { paused: "research_apify_key_missing" };
    }
    apifyConfig = songiApifyDiscoveryConfig(platform, subscription.keyword, maxResults);
    if (!apifyConfig) {
      pauseSongiDiscoverySubscription(research, subscription, "research_discovery_keyword_invalid", "키워드로 해시태그를 만들 수 없어 자동수집을 일시정지했습니다.");
      return { paused: "research_discovery_keyword_invalid" };
    }
  } else if (platform === "youtube") {
    const serverReady = SONGI_SERVER_YTDLP_DISCOVERY_ENABLED && researchMediaToolStatus().video_download.available;
    if (!serverReady) {
      subscription.last_run_status = "failed";
      subscription.last_run_error = "웹 서버 yt-dlp가 준비되지 않아 다음 주기에 다시 시도합니다.";
      subscription.consecutive_failures = Number(subscription.consecutive_failures || 0) + 1;
      if (subscription.consecutive_failures >= SONGI_DISCOVERY_SUBSCRIPTION_MAX_CONSECUTIVE_FAILURES) {
        subscription.status = "paused";
        subscription.pause_reason = "repeated_failures";
      } else {
        subscription.next_run_at = new Date(Date.now() + SONGI_DISCOVERY_SUBSCRIPTION_RETRY_MS).toISOString();
      }
      subscription.updated_at = nowIso();
      saveResearch(research);
      return { skipped: "server_ytdlp_unavailable" };
    }
  } else {
    pauseSongiDiscoverySubscription(research, subscription, "research_discovery_platform_not_ready", "지원하지 않는 플랫폼이라 자동수집을 일시정지했습니다.");
    return { paused: "research_discovery_platform_not_ready" };
  }
  const lockKey = researchPaidLockKey(subscription.user_id, "discovery_apify", subscription.project_id);
  if (isApify && !acquireResearchPaidLock(lockKey)) return { skipped: "paid_lock_busy" };
  try {
    const now = nowIso();
    // 타임아웃으로 failed 강등된 런도 apify_run_id가 있으면 재개 — 새 실행을 또 시작하면 이중 과금
    const resumableRun = isApify
      ? [...research.discovery_runs].reverse().find((item) => item.subscription_id === subscription.id
        && item.source_mode === "server_apify"
        && item.apify_run_id
        && (item.status === "running" || (item.status === "failed" && item.error === "research_discovery_timeout")))
      : null;
    const run = resumableRun || {
      id: crypto.randomUUID(),
      user_id: subscription.user_id,
      project_id: subscription.project_id,
      keyword: subscription.keyword,
      platform,
      sort_mode: subscription.sort_mode || "top",
      date_range_days: boundedInteger(subscription.date_range_days, 30, 1, 90),
      max_results: maxResults,
      status: "running",
      source_mode: isApify ? "server_apify" : "server_ytdlp",
      subscription_id: subscription.id,
      quota_units_estimate: 0,
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (resumableRun) {
      resumableRun.status = "running";
      resumableRun.error = "";
      resumableRun.error_detail = "";
      resumableRun.updated_at = now;
    } else {
      research.discovery_runs.push(run);
    }
    pruneResearchDiscovery(research);
    saveResearch(research);
    let failureInfo = null;
    let rows = [];
    let chargedCount = 0;
    let sourceVersion = "";
    if (isApify) {
      try {
        const { items } = await runSongiApifyDiscovery(apifyConfig, token, maxResults, {
          existingRunId: resumableRun ? resumableRun.apify_run_id : "",
          onRunStarted: (apifyRunId) => {
            const current = loadResearch();
            const currentRun = current.discovery_runs.find((item) => item.id === run.id);
            if (currentRun && currentRun.apify_run_id !== apifyRunId) {
              currentRun.apify_run_id = apifyRunId;
              currentRun.updated_at = nowIso();
              saveResearch(current);
            }
          },
        });
        chargedCount = Array.isArray(items) ? items.length : 0;
        rows = songiApifyDiscoveryRows(platform, subscription.keyword, items);
      } catch (error) {
        failureInfo = songiApifyDiscoveryErrorInfo(error, platform);
      }
    } else {
      try {
        const result = await discoverYouTubeCandidatesWithServerYtDlp({
          keyword: subscription.keyword,
          days: boundedInteger(subscription.date_range_days, 30, 1, 90),
          maxResults,
        });
        rows = Array.isArray(result.candidates) ? result.candidates : [];
        sourceVersion = result.source_version || "";
      } catch (error) {
        failureInfo = {
          code: String(error.code || "server_ytdlp_discovery_failed"),
          message: compactText(error.stderr || error.message || "서버 YouTube 수집에 실패했습니다.", 300),
        };
      }
    }
    const next = loadResearch();
    const nextRun = next.discovery_runs.find((item) => item.id === run.id);
    const nextSubscription = (next.discovery_subscriptions || []).find((item) => item.id === subscription.id);
    if (!nextSubscription) {
      if (nextRun && nextRun.status === "running") {
        nextRun.status = "failed";
        nextRun.error = "research_discovery_subscription_deleted";
        nextRun.updated_at = nowIso();
        saveResearch(next);
      }
      return { skipped: "subscription_deleted" };
    }
    const nowAfter = nowIso();
    if (failureInfo) {
      const stillRunning = failureInfo.code === "research_apify_run_still_running";
      if (nextRun) {
        nextRun.status = stillRunning ? "running" : "failed";
        nextRun.error = failureInfo.code;
        nextRun.error_detail = compactText(failureInfo.message, 500);
        nextRun.updated_at = nowAfter;
      }
      // 시작은 됐는데 실패한 유료 런은 Apify 시작 수수료가 이미 과금됨 — 추정치로 계상
      if (!stillRunning && isApify && nextRun?.apify_run_id) {
        const startFeeUsd = Number(SONGI_APIFY_DISCOVERY_PRICING_USD[platform]?.start || 0);
        nextRun.cost_usd = Math.round(startFeeUsd * 10000) / 10000;
        nextSubscription.total_cost_usd = Math.round((Number(nextSubscription.total_cost_usd || 0) + startFeeUsd) * 10000) / 10000;
      }
      if (stillRunning) {
        nextSubscription.still_running_checks = Number(nextSubscription.still_running_checks || 0) + 1;
        if (nextSubscription.still_running_checks >= 12) {
          nextSubscription.still_running_checks = 0;
          nextSubscription.last_run_status = "failed";
          nextSubscription.last_run_error = "Apify 실행이 1시간 넘게 끝나지 않아 다음 재시도에서 다시 확인합니다.";
          nextSubscription.last_run_at = nowAfter;
          nextSubscription.consecutive_failures = Number(nextSubscription.consecutive_failures || 0) + 1;
          if (nextSubscription.consecutive_failures >= SONGI_DISCOVERY_SUBSCRIPTION_MAX_CONSECUTIVE_FAILURES) {
            nextSubscription.status = "paused";
            nextSubscription.pause_reason = "repeated_failures";
          } else {
            nextSubscription.next_run_at = new Date(Date.now() + SONGI_DISCOVERY_SUBSCRIPTION_RETRY_MS).toISOString();
          }
        } else {
          nextSubscription.last_run_status = "running";
          nextSubscription.next_run_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        }
      } else if (["research_apify_invalid_token", "research_apify_credit_exhausted"].includes(failureInfo.code)) {
        nextSubscription.still_running_checks = 0;
        nextSubscription.status = "paused";
        nextSubscription.pause_reason = failureInfo.code;
        nextSubscription.last_run_status = "failed";
        nextSubscription.last_run_error = compactText(failureInfo.message, 300);
        nextSubscription.last_run_at = nowAfter;
      } else {
        nextSubscription.still_running_checks = 0;
        nextSubscription.last_run_status = "failed";
        nextSubscription.last_run_error = compactText(failureInfo.message, 300);
        nextSubscription.last_run_at = nowAfter;
        nextSubscription.consecutive_failures = Number(nextSubscription.consecutive_failures || 0) + 1;
        if (nextSubscription.consecutive_failures >= SONGI_DISCOVERY_SUBSCRIPTION_MAX_CONSECUTIVE_FAILURES) {
          nextSubscription.status = "paused";
          nextSubscription.pause_reason = "repeated_failures";
        } else {
          nextSubscription.next_run_at = new Date(Date.now() + SONGI_DISCOVERY_SUBSCRIPTION_RETRY_MS).toISOString();
        }
      }
      nextSubscription.updated_at = nowAfter;
      saveResearch(next);
      return { failed: failureInfo.code, still_running: stillRunning };
    }
    const seen = new Set(Array.isArray(nextSubscription.seen_urls) ? nextSubscription.seen_urls : []);
    let freshCandidates = [];
    if (nextRun) {
      const candidates = isApify
        ? materializeSongiApifyDiscoveryCandidates(next, nextRun, subscription.user_id, rows, { sortMode: subscription.sort_mode || "top" })
        : materializeSongiDiscoveryCandidates(next, nextRun, subscription.user_id, rows, { sourceMode: "server_ytdlp", sourceVersion });
      freshCandidates = candidates.filter((candidate) => candidate.url && !seen.has(candidate.url));
      const dropIds = new Set(candidates.filter((candidate) => !freshCandidates.includes(candidate)).map((candidate) => candidate.id));
      if (dropIds.size) {
        next.discovery_candidates = next.discovery_candidates.filter((candidate) => !dropIds.has(candidate.id));
      }
      nextRun.result_count = freshCandidates.length;
      nextRun.cost_usd = Math.round(songiDiscoveryRunCostUsd(platform, chargedCount) * 10000) / 10000;
    }
    for (const candidate of freshCandidates) seen.add(candidate.url);
    nextSubscription.seen_urls = Array.from(seen).slice(-SONGI_DISCOVERY_SUBSCRIPTION_SEEN_URL_LIMIT);
    nextSubscription.last_run_at = nowAfter;
    nextSubscription.last_run_status = "completed";
    nextSubscription.last_run_error = "";
    nextSubscription.last_new_count = freshCandidates.length;
    nextSubscription.run_count = Number(nextSubscription.run_count || 0) + 1;
    nextSubscription.total_cost_usd = Math.round((Number(nextSubscription.total_cost_usd || 0) + songiDiscoveryRunCostUsd(platform, chargedCount)) * 10000) / 10000;
    nextSubscription.consecutive_failures = 0;
    nextSubscription.still_running_checks = 0;
    nextSubscription.next_run_at = new Date(Date.now() + (SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES[nextSubscription.frequency]?.interval_ms || SONGI_DISCOVERY_SUBSCRIPTION_FREQUENCIES.weekly.interval_ms)).toISOString();
    nextSubscription.updated_at = nowAfter;
    saveResearch(next);
    return { completed: true, new_count: freshCandidates.length };
  } finally {
    if (isApify) releaseResearchPaidLock(lockKey);
  }
}

let songiDiscoverySubscriptionSweepBusy = false;

async function runDueSongiDiscoverySubscriptions(referenceTime = Date.now()) {
  if (songiDiscoverySubscriptionSweepBusy) return { ran: 0, skipped: "busy" };
  songiDiscoverySubscriptionSweepBusy = true;
  try {
    const research = loadResearch();
    const due = (research.discovery_subscriptions || [])
      .filter((subscription) => subscription.status === "active"
        && subscription.next_run_at
        && Date.parse(subscription.next_run_at) <= referenceTime)
      .sort((a, b) => String(a.next_run_at || "").localeCompare(String(b.next_run_at || "")))
      .slice(0, SONGI_DISCOVERY_SUBSCRIPTION_MAX_PER_TICK);
    let ran = 0;
    for (const subscription of due) {
      try {
        await runSongiDiscoverySubscriptionOnce(subscription.id);
        ran += 1;
      } catch (error) {
        console.warn("[songi subscription] run failed", subscription.id, error.code || error.message || "subscription_run_failed");
      }
    }
    return { ran };
  } finally {
    songiDiscoverySubscriptionSweepBusy = false;
  }
}

function startSongiDiscoverySubscriptionPoller() {
  const timer = setInterval(() => {
    runDueSongiDiscoverySubscriptions().catch((error) => {
      console.warn("[songi subscription] sweep failed", error.code || error.message || "subscription_sweep_failed");
    });
  }, SONGI_DISCOVERY_SUBSCRIPTION_POLL_MS);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

async function handleUpdateResearchItem(req, res, itemId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const research = loadResearch();
  const item = research.items.find((entry) => entry.id === itemId && entry.user_id === auth.user.id);
  if (!item) {
    json(req, res, 404, { ok: false, error: "research_item_not_found" });
    return;
  }
  const project = research.projects.find((entry) => entry.id === item.project_id && entry.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  if (Object.prototype.hasOwnProperty.call(body, "title")) item.title = compactText(body.title, 180);
  if (Object.prototype.hasOwnProperty.call(body, "url")) item.url = compactText(body.url, 1000);
  if (Object.prototype.hasOwnProperty.call(body, "source_text")) item.source_text = cleanMultilineText(body.source_text, 8000);
  if (Object.prototype.hasOwnProperty.call(body, "memo")) item.memo = cleanMultilineText(body.memo, 2000);
  if (Object.prototype.hasOwnProperty.call(body, "category")) item.category = compactText(body.category, 40);
  const personalization = researchPersonalizationFromBody(body);
  for (const key of ["instagram_profile_url", "content_category", "content_topic"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) item[key] = personalization[key];
  }
  const urlChanged = Object.prototype.hasOwnProperty.call(body, "url");
  const shouldRefreshLink = Boolean(item.url) && (urlChanged || body.refresh_link === true);
  if (shouldRefreshLink) {
    try {
      const refreshApifyState = canUseApifyForResearchUrl(item.url) ? researchApifyIntegrationState(agentForUserId(auth.user.id), auth.user) : null;
      const linkData = await fetchResearchLink(item.url, { apifyState: refreshApifyState });
      item.title = item.title || compactText(linkData.title, 180) || compactText(item.url, 120);
      const manualSourceText = Object.prototype.hasOwnProperty.call(body, "source_text")
        ? item.source_text
        : (!urlChanged ? item.source_text : "");
      item.source_text = cleanMultilineText([
        linkData.source_text || "",
        manualSourceText,
      ].filter(Boolean).join("\n\n"), 8000);
      item.link_fetch_status = linkData.fetch_status || "fetched";
      item.link_fetch_error = "";
      item.link_final_url = linkData.final_url || "";
      item.link_fetched_at = String(linkData.fetch_status || "").startsWith("apify_") ? "" : nowIso();
    } catch (error) {
      item.link_fetch_status = "failed";
      item.link_fetch_error = researchFetchErrorCode(error);
    }
  }
  const shouldReanalyze = shouldRefreshLink || ["title", "url", "source_text", "memo", "category", "tags", "instagram_profile_url", "content_category", "content_topic"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (shouldReanalyze) {
    const analysis = analyzeResearchInput({
      title: item.title,
      url: item.url,
      source_text: item.source_text,
      memo: item.memo,
      category: item.category || item.content_category,
      tags: Object.prototype.hasOwnProperty.call(body, "tags") ? body.tags : item.tags,
      instagram_profile_url: item.instagram_profile_url,
      content_category: item.content_category,
      content_topic: item.content_topic,
    });
    Object.assign(item, analysis);
  }
  item.updated_at = nowIso();
  project.updated_at = item.updated_at;
  saveResearch(research);
  json(req, res, 200, { ok: true, item: publicResearchItem(item) });
}

function handleResearchBrief(req, res, url) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const projectId = String(url.searchParams.get("project_id") || "").trim();
  const research = loadResearch();
  const project = research.projects.find((item) => item.id === projectId && item.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const items = research.items
    .filter((item) => item.user_id === auth.user.id && item.project_id === project.id)
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  json(req, res, 200, {
    ok: true,
    brief: buildResearchBrief(project, items),
    project: publicResearchProject(project),
    item_count: items.length,
  });
}

function handleResearchIntegrations(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  json(req, res, 200, {
    ok: true,
    integrations: researchIntegrationStatus({ agent: agentForUserId(auth.user.id), user: auth.user }),
  });
}

async function handleUpdateResearchStorage(req, res) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  try {
    const storage = setResearchStorageDir(body.data_dir || body.path || body.directory);
    json(req, res, 200, {
      ok: true,
      storage,
      integrations: researchIntegrationStatus({ agent: agentForUserId(auth.user.id), user: auth.user }),
    });
  } catch (error) {
    json(req, res, 400, {
      ok: false,
      error: error.code || "research_storage_update_failed",
    });
  }
}

async function handleRunResearchProfileApify(req, res, projectId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  if (body.confirm_paid !== true) {
    json(req, res, 402, { ok: false, error: "research_paid_confirmation_required" });
    return;
  }
  const token = getUserOrStoredSecret(auth.user.id, "APIFY_API_TOKEN");
  if (!token) {
    json(req, res, 409, { ok: false, error: "research_apify_key_missing" });
    return;
  }
  const research = loadResearch();
  const project = research.projects.find((entry) => entry.id === projectId && entry.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const profileUrl = compactText(body.instagram_profile_url, 500) || project.instagram_profile_url || "";
  if (!profileUrl || !instagramUsernameFromUrl(profileUrl)) {
    json(req, res, 400, { ok: false, error: "research_apify_profile_not_supported" });
    return;
  }
  project.instagram_profile_url = profileUrl;
  const lockKey = researchPaidLockKey(auth.user.id, "profile_apify", project.id);
  if (!acquireResearchPaidLock(lockKey)) {
    json(req, res, 409, { ok: false, error: "research_paid_operation_in_progress" });
    return;
  }
  try {
    const existingRunId = ["started", "running"].includes(String(project.profile_apify_collection?.status || "").toLowerCase())
      ? project.profile_apify_collection?.run_id || ""
      : "";
    const result = await runApifyInstagramProfileCollection(profileUrl, token, existingRunId);
    const extracted = apifyProfileItemsToProjectProfile(result, profileUrl);
    project.profile_source_text = extracted.profile_source_text;
    project.profile_snapshot = extracted.profile_snapshot;
    project.profile_fetch_status = "apify_scraped";
    project.profile_fetch_error = "";
    project.profile_fetched_at = nowIso();
    project.profile_apify_collection = {
      status: "succeeded",
      actor_id: result.actorId,
      run_id: result.run?.id || "",
      dataset_id: result.run?.defaultDatasetId || "",
      status_url: result.run?.id ? `https://console.apify.com/actors/runs/${result.run.id}` : "",
      completed_at: nowIso(),
    };
    project.updated_at = nowIso();
    saveResearch(research);
    json(req, res, 200, { ok: true, project: publicResearchProject(project) });
  } catch (error) {
    const run = error.run || null;
    project.profile_fetch_status = "apify_failed";
    project.profile_fetch_error = researchFetchErrorCode(error);
    project.profile_apify_collection = {
      status: "failed",
      actor_id: apifyProfileRunConfigForInstagram(profileUrl)?.actorId || "",
      run_id: run?.id || project.profile_apify_collection?.run_id || "",
      dataset_id: run?.defaultDatasetId || project.profile_apify_collection?.dataset_id || "",
      status_url: run?.id ? `https://console.apify.com/actors/runs/${run.id}` : (project.profile_apify_collection?.status_url || ""),
      error: project.profile_fetch_error,
      failed_at: nowIso(),
    };
    project.updated_at = nowIso();
    saveResearch(research);
    json(req, res, 502, { ok: false, error: "research_apify_failed", detail: project.profile_fetch_error, project: publicResearchProject(project) });
  } finally {
    releaseResearchPaidLock(lockKey);
  }
}

async function handleRunResearchApify(req, res, itemId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  if (body.confirm_paid !== true) {
    json(req, res, 402, { ok: false, error: "research_paid_confirmation_required" });
    return;
  }
  const token = getUserOrStoredSecret(auth.user.id, "APIFY_API_TOKEN");
  if (!token) {
    json(req, res, 409, { ok: false, error: "research_apify_key_missing" });
    return;
  }
  const research = loadResearch();
  const item = research.items.find((entry) => entry.id === itemId && entry.user_id === auth.user.id);
  if (!item) {
    json(req, res, 404, { ok: false, error: "research_item_not_found" });
    return;
  }
  const project = research.projects.find((entry) => entry.id === item.project_id && entry.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  if (!item.url || !canUseApifyForResearchUrl(item.url)) {
    json(req, res, 400, { ok: false, error: "research_apify_not_supported" });
    return;
  }
  const lockKey = researchPaidLockKey(auth.user.id, "item_apify", item.id);
  if (!acquireResearchPaidLock(lockKey)) {
    json(req, res, 409, { ok: false, error: "research_paid_operation_in_progress" });
    return;
  }
  try {
    const existingRunId = ["started", "running"].includes(String(item.apify_collection?.status || "").toLowerCase())
      ? item.apify_collection?.run_id || ""
      : "";
    const result = await runApifyResearchCollection(item.url, token, existingRunId);
    const extracted = apifyItemsToResearchSource(result, item.url);
    item.title = extracted.title || item.title || compactText(item.url, 120);
    item.source_text = cleanMultilineText([
      extracted.source_text,
      item.source_text && !/Apify 수집 승인/.test(item.source_text) ? item.source_text : "",
    ].filter(Boolean).join("\n\n"), 8000);
    item.tags = normalizeResearchTags([...(extracted.tags || []), ...(item.tags || [])]);
    item.link_fetch_status = "apify_scraped";
    item.link_fetch_error = "";
    item.link_final_url = item.url;
    item.link_fetched_at = nowIso();
    item.apify_collection = {
      status: "completed",
      actor_id: result.actorId,
      run_id: result.run?.id || existingRunId,
      dataset_id: result.run?.defaultDatasetId || "",
      platform: result.platform,
      item_count: result.items.length,
      collected_at: item.link_fetched_at,
      pricing_label: result.pricingLabel,
      status_url: result.run?.id ? `https://console.apify.com/actors/runs/${result.run.id}` : "",
    };
    const analysis = analyzeResearchInput({
      title: item.title,
      url: item.url,
      source_text: item.source_text,
      memo: item.memo,
      category: item.category,
      tags: item.tags,
      instagram_profile_url: item.instagram_profile_url,
      content_category: item.content_category,
      content_topic: item.content_topic,
    });
    Object.assign(item, analysis);
    item.updated_at = nowIso();
    project.updated_at = item.updated_at;
    saveResearch(research);
    json(req, res, 200, {
      ok: true,
      item: publicResearchItem(item),
      apify: {
        status: "completed",
        actor_id: result.actorId,
        item_count: result.items.length,
        pricing_label: result.pricingLabel,
      },
    });
  } catch (error) {
    const run = error.run || null;
    item.link_fetch_status = "apify_failed";
    item.link_fetch_error = researchFetchErrorCode(error);
    item.apify_collection = {
      status: String(run?.status || "").toUpperCase() === "RUNNING" ? "running" : "failed",
      actor_id: apifyRunConfigForUrl(item.url)?.actorId || "",
      run_id: run?.id || item.apify_collection?.run_id || "",
      dataset_id: run?.defaultDatasetId || item.apify_collection?.dataset_id || "",
      status_url: run?.id ? `https://console.apify.com/actors/runs/${run.id}` : (item.apify_collection?.status_url || ""),
      error: researchFetchErrorCode(error),
      collected_at: nowIso(),
    };
    item.updated_at = nowIso();
    project.updated_at = item.updated_at;
    saveResearch(research);
    json(req, res, 502, { ok: false, error: "research_apify_failed", detail: item.link_fetch_error, item: publicResearchItem(item) });
  } finally {
    releaseResearchPaidLock(lockKey);
  }
}

async function handleRunResearchAiAnalysis(req, res, itemId) {
  const auth = requireResearchAccess(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  if (body.confirm_paid !== true) {
    json(req, res, 402, { ok: false, error: "research_paid_confirmation_required" });
    return;
  }
  const apiKey = getUserOrStoredSecret(auth.user.id, "GEMINI_API_KEY");
  if (!apiKey) {
    json(req, res, 409, { ok: false, error: "research_gemini_key_missing" });
    return;
  }
  const model = compactText(body.model, 80) || SONGI_GEMINI_MODEL;
  const research = loadResearch();
  const item = research.items.find((entry) => entry.id === itemId && entry.user_id === auth.user.id);
  if (!item) {
    json(req, res, 404, { ok: false, error: "research_item_not_found" });
    return;
  }
  const project = research.projects.find((entry) => entry.id === item.project_id && entry.user_id === auth.user.id);
  if (!project) {
    json(req, res, 404, { ok: false, error: "research_project_not_found" });
    return;
  }
  const lockKey = researchPaidLockKey(auth.user.id, "item_ai_analysis", item.id);
  if (!acquireResearchPaidLock(lockKey)) {
    json(req, res, 409, { ok: false, error: "research_paid_operation_in_progress" });
    return;
  }
  try {
    const result = await runGeminiResearchAnalysis(item, apiKey, model, {
      includeVideo: body.include_video !== false,
    });
    Object.assign(item, result.analysis);
    const frames = await extractSongiFlowFrames(item, result.media_file_path, item.flow);
    item.frame_captures = frames.captures;
    item.frame_capture = {
      status: frames.status,
      error: frames.error,
      captured_at: frames.captures.length ? nowIso() : "",
    };
    item.ai_analysis = {
      status: "completed",
      provider: "gemini",
      model,
      media: result.media || {},
      analyzed_at: nowIso(),
      usage: redactValue("usage", result.usage || {}),
    };
    item.updated_at = nowIso();
    project.updated_at = item.updated_at;
    saveResearch(research);
    json(req, res, 200, {
      ok: true,
      item: publicResearchItem(item),
      ai_analysis: {
        status: "completed",
        provider: "gemini",
        model,
        media: item.ai_analysis.media,
        usage: item.ai_analysis.usage,
      },
    });
  } catch (error) {
    item.ai_analysis = {
      status: "failed",
      provider: "gemini",
      model,
      error: researchGeminiErrorCode(error),
      error_detail: compactText(error.detail || error.message || "", 500),
      analyzed_at: nowIso(),
    };
    item.updated_at = nowIso();
    project.updated_at = item.updated_at;
    saveResearch(research);
    json(req, res, 502, { ok: false, error: "research_gemini_failed", detail: item.ai_analysis.error, item: publicResearchItem(item) });
  } finally {
    releaseResearchPaidLock(lockKey);
  }
}

async function handleAgentHeartbeat(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const platform = String(body.platform || "").slice(0, 120);
  const deviceLabel = String(body.device_label || "").slice(0, 120);

  const agents = loadAgents();
  const now = nowIso();
  let agent = findHeartbeatAgent(agents, auth.user.id, platform, deviceLabel);
  if (!agent) {
    agent = {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      created_at: now,
    };
    agents.agents.push(agent);
  }
  agent.status = String(body.status || "connected").slice(0, 80);
  agent.version = String(body.version || "").slice(0, 80);
  agent.platform = platform;
  agent.device_label = deviceLabel;
  const previousNaverStatus = String(agent.readiness?.naver_account?.status || "");
  agent.readiness = sanitizeReadiness(body.readiness);
  // 네이버 로그인 가드 자동 해제는 두 가지 근거에서만 한다 — "ready 면 해제"는 금지(무력화 위험).
  //  (1) 전이: not_ready → ready 로 바뀐 경우.
  //  (2) M-2 재저장: saved_at 이 마지막 실패(last_error_at) 이후인 경우(P2 러너부터 전송).
  // 그 외(전이 없는 ready 재보고 + saved_at 없음)는 acknowledge(조치했어요) 경로가 커버한다.
  const naverStatus = String(agent.readiness?.naver_account?.status || "");
  const naverSavedAt = agent.readiness?.naver_account?.saved_at || "";
  // M-4: 이 에이전트(기기) 스코프로만 해제한다 — 기기 B 의 전이가 기기 A 가드를 풀지 않게.
  const agentDeviceKey = jobDeviceKey(platform, deviceLabel);
  if (naverStatus === "ready"
    && (previousNaverStatus !== "ready" || naverCredentialResavedAfterFailure(auth.user.id, naverSavedAt))) {
    releaseJobGuardsForClasses(auth.user.id, ["naver_login_failed"], agentDeviceKey);
  }
  const readinessDiagnostics = body.readiness && typeof body.readiness === "object" ? body.readiness.diagnostics : null;
  agent.diagnostics = sanitizeAgentDiagnostics(body.diagnostics || readinessDiagnostics || {});
  // 하트비트 공백 3분 이상 후 재개 = 실행기 재시작으로 간주한다.
  // runner_not_started 가드의 조치 안내가 "실행기 재시작"이므로, 재시작이 감지되면
  // 가드를 자동 해제해 사용자가 acknowledge 버튼까지 찾아가지 않아도 되게 한다.
  // M-4: 재시작한 그 기기 스코프로만 해제한다.
  const previousSeenMs = Date.parse(agent.last_seen_at || "");
  if (!Number.isFinite(previousSeenMs) || Date.now() - previousSeenMs > 3 * 60 * 1000) {
    releaseJobGuardsForClasses(auth.user.id, ["runner_not_started"], agentDeviceKey);
  }
  agent.last_seen_at = now;
  agent.updated_at = now;
  saveAgents(agents);
  const jobs = loadJobs();
  const timedOut = markRunnerStartTimeouts(jobs, {
    userId: auth.user.id,
    platform,
    deviceLabel,
  });
  const stale = failStaleRunningJobs(jobs, {
    userId: auth.user.id,
    platform,
    deviceLabel,
    agents,
  });
  if (timedOut || stale) saveJobs(jobs);
  json(req, res, 200, { ok: true, agent: publicAgent(agent) });
}

async function handleCreateAgentCommand(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const body = await readJsonBody(req, res);
  if (!body) return;
  const type = String(body.type || "").trim();
  if (!AGENT_COMMAND_TYPES.has(type)) {
    json(req, res, 400, { ok: false, error: "unsupported_command" });
    return;
  }
  const rawPayload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const targetPlatform = normalizePlatform(body.target_platform || body.platform || rawPayload.target_platform || rawPayload.platform || "");
  const targetDeviceLabel = String(body.target_device_label || body.device_label || rawPayload.target_device_label || rawPayload.device_label || "").trim().slice(0, 120);
  const payload = type === "import_local_provider_secrets"
    ? { providers: normalizeImportableUserSecretProviders(rawPayload.providers || body.providers) }
    : type === "songi_youtube_discovery"
      ? {
          run_id: compactText(rawPayload.run_id || "", 80),
          project_id: compactText(rawPayload.project_id || "", 80),
          keyword: compactText(rawPayload.keyword || "", 120),
          date_range_days: boundedInteger(rawPayload.date_range_days, 30, 1, 90),
          max_results: boundedInteger(rawPayload.max_results, 12, 5, 25),
        }
      : {};

  const commands = loadCommands();
  const now = nowIso();
  const command = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    type,
    status: "queued",
    target_platform: targetPlatform,
    target_device_label: targetDeviceLabel,
    payload,
    logs: [
      {
        at: now,
        level: "info",
        message: type === "import_local_provider_secrets"
          ? "로컬 실행기 AI/API 키 가져오기 명령이 생성되었습니다."
          : "로컬 실행기 명령이 생성되었습니다.",
      },
    ],
    created_at: now,
    updated_at: now,
  };
  commands.commands.push(command);
  saveCommands(commands);
  json(req, res, 201, { ok: true, command: publicCommand(command) });
}

function handleAgentNextCommand(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const platform = requestPlatform(req);
  const deviceLabel = String(new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("device_label") || "").trim();
  const commands = loadCommands();
  const command = commands.commands
    .filter((item) => item.user_id === auth.user.id && item.status === "queued")
    .filter((item) => {
      const target = normalizePlatform(item.target_platform || "");
      if (!target) return true;
      return platform && target === platform;
    })
    .filter((item) => {
      const targetDevice = String(item.target_device_label || "").trim();
      if (!targetDevice) return true;
      return deviceLabel && targetDevice === deviceLabel;
    })
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
  if (command) {
    const now = nowIso();
    command.status = "delivered";
    command.assigned_at = now;
    command.updated_at = now;
    command.logs = command.logs || [];
    command.logs.push({ at: now, level: "info", message: "로컬 실행기에 명령을 전달했습니다." });
    saveCommands(commands);
  }
  json(req, res, 200, { ok: true, command: command ? agentCommand(command) : null });
}

function handleGetAgentCommand(req, res, commandId) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const commands = loadCommands();
  const command = commands.commands.find((item) => item.user_id === auth.user.id && item.id === commandId);
  if (!command) {
    json(req, res, 404, { ok: false, error: "command_not_found" });
    return;
  }
  json(req, res, 200, { ok: true, command: publicCommand(command) });
}

async function handleAgentCommandUpdate(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const commandId = String(body.command_id || "");
  const status = String(body.status || "").trim();
  if (!["done", "failed"].includes(status)) {
    json(req, res, 400, { ok: false, error: "invalid_status" });
    return;
  }
  const commands = loadCommands();
  const command = commands.commands.find((item) => item.user_id === auth.user.id && item.id === commandId);
  if (!command) {
    json(req, res, 404, { ok: false, error: "command_not_found" });
    return;
  }
  const now = nowIso();
  command.status = status;
  command.finished_at = now;
  command.updated_at = now;
  command.logs = command.logs || [];
  command.logs.push({
    at: now,
    level: status === "failed" ? "error" : "info",
    message: redactText(body.log || (status === "done" ? "명령이 완료되었습니다." : "명령 처리에 실패했습니다.")),
  });
  if (Object.prototype.hasOwnProperty.call(body, "result")) {
    command.result = redactPayload(body.result);
  }
  completeSongiDiscoveryCommand(command, body);
  saveCommands(commands);
  json(req, res, 200, { ok: true, command: publicCommand(command) });
}

async function handleCreateJob(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const body = await readJsonBody(req, res);
  if (!body) return;
  const kind = String(body.kind || "").trim();
  const jobPayload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? { ...body.payload }
    : {};
  if (!isJobAllowed(auth.user, kind)) {
    json(req, res, 403, { ok: false, error: "job_not_allowed" });
    return;
  }
  const jobKindConfig = JOB_KINDS[kind] || {};
  if (jobKindConfig.queue === false) {
    json(req, res, 400, {
      ok: false,
      error: "job_kind_uses_module_api",
      api_mode: jobKindConfig.apiMode || "",
      message: "이 직원은 별도 웹 작업 화면에서 실행합니다.",
    });
    return;
  }
  // 연속 실패 가드 — 같은 오류가 반복 중이면 조치 안내와 함께 생성 자체를 차단한다.
  // M-4: 새 잡의 타겟 기기 스코프로 차단 판정한다(다른 기기 실패가 이 기기 생성을 막지 않게).
  const createDeviceKey = jobDeviceKey(
    body.target_platform || body.platform || "",
    body.target_device_label || body.device_label || "",
  );
  const pausedGuard = pausedJobGuard(auth.user.id, kind, createDeviceKey);
  if (pausedGuard) {
    json(req, res, 409, {
      ok: false,
      error: "guard_paused",
      guard_class: String(pausedGuard.signature || "other"),
      consecutive_count: safeInt(pausedGuard.consecutive_count, 0, 1000000),
      message: jobGuardMessage(pausedGuard),
    });
    return;
  }
  // 구버전 러너 preflight — 러너가 필요한 잡 종류만 검사한다.
  const runnerRequirement = runnerUpdateRequirement(
    auth.user.id,
    kind,
    normalizePlatform(body.target_platform || body.platform || ""),
  );
  if (runnerRequirement) {
    json(req, res, 409, {
      ok: false,
      error: "runner_update_required",
      ...runnerRequirement,
    });
    return;
  }
  const explicitYeriServerGeneration = kind === "yeri_write" && body.server_generation === true;
  // 자동 서버생성: 웹 AI 키를 가진(서버가 복호화 가능한) 사용자는 서버생성을 기본으로 한다.
  // 러너가 웹키를 'ai_keys ready'로 보고해 웹이 로컬생성으로 보내지만, 러너 로컬엔 실제 키 값이
  // 없어 "API 키가 없습니다"로 실패하던 함정을 우회한다(서버가 본인 웹키로 생성, 비용 동일).
  // 웹키가 없는 로컬전용 사용자는 canUseYeriServerGeneration=false → 자동 적용 안 됨(무영향).
  const autoYeriServerGeneration = kind === "yeri_write"
    && !explicitYeriServerGeneration
    && yeriServerGenerationModeForUser(auth.user) === "gemini"
    && hasYeriServerGenerationSecret(auth.user);
  const requestedYeriServerGeneration = explicitYeriServerGeneration || autoYeriServerGeneration;
  const yeriGenerationMode = requestedYeriServerGeneration ? yeriServerGenerationModeForUser(auth.user) : "";
  if (explicitYeriServerGeneration && !yeriGenerationMode) {
    json(req, res, 403, {
      ok: false,
      error: "yeri_server_generation_not_allowed",
      message: "이 계정은 예리 서버 글 생성 테스트 대상이 아닙니다.",
    });
    return;
  }
  const yeriProviderIssue = requestedYeriServerGeneration
    ? yeriServerGenerationProviderIssue(jobPayload, yeriGenerationMode)
    : null;
  if (yeriProviderIssue) {
    json(req, res, 400, {
      ok: false,
      error: "yeri_server_generation_provider_mismatch",
      provider: yeriProviderIssue.provider,
      model: yeriProviderIssue.model,
      message: "선택한 예리 AI 모델을 확인할 수 없어 서버 글 생성을 시작하지 않았습니다.",
    });
    return;
  }
  if (yeriGenerationMode === "gemini" && explicitYeriServerGeneration && body.confirm_paid !== true) {
    json(req, res, 402, {
      ok: false,
      error: "yeri_paid_confirmation_required",
      message: "서버 글 생성은 선택한 AI 모델의 API 비용이 발생할 수 있어 confirm_paid=true가 필요합니다.",
    });
    return;
  }
  if (yeriGenerationMode === "gemini") {
    const limitIssue = yeriRealTestLimitIssue(jobPayload);
    if (limitIssue) {
      json(req, res, 400, {
        ok: false,
        error: "yeri_real_test_limit_exceeded",
        ...limitIssue,
        message: "실제 유료 테스트 모드에서는 짧은 글과 이미지 1장 범위만 허용합니다.",
      });
      return;
    }
  }
  if (kind === "yeri_write" && yeriSeoResearchEnabled(jobPayload) && !jobPayload.seo_brief) {
    const seoBrief = await buildYeriSeoBriefFromPayload(jobPayload);
    if (seoBrief) jobPayload.seo_brief = seoBrief;
  }

  const jobs = loadJobs();
  if (kind === "yunmi_script") {
    const created = await createYunmiScriptJob(auth, body.payload || {}, jobs);
    if (created.error) {
      json(req, res, created.statusCode || 400, { ok: false, error: created.error, detail: created.detail || "" });
      return;
    }
    if (!created.existing) {
      jobs.jobs.push(created.job);
      saveJobs(jobs);
      // 윤미는 생성 시점에 터미널 상태로 확정될 수 있어 여기서 가드를 갱신한다.
      if (created.job?.status === "failed") recordJobFailureGuard(created.job);
      else if (created.job?.status === "done") clearJobGuardOnSuccess(auth.user.id, kind);
    }
    json(req, res, created.existing ? 200 : 201, { ok: true, existing: Boolean(created.existing), job: publicJob(created.job) });
    return;
  }

  const now = nowIso();
  const targetPlatform = normalizePlatform(body.target_platform || body.platform || "");
  const targetDeviceLabel = String(body.target_device_label || body.device_label || "").trim().slice(0, 120);
  const job = {
    id: crypto.randomUUID(),
    user_id: auth.user.id,
    kind,
    worker_code: JOB_KINDS[kind]?.workerCode || "",
    status: yeriGenerationMode ? "generating" : "queued",
    server_generation: yeriGenerationMode || "",
    target_platform: targetPlatform,
    target_device_label: targetDeviceLabel,
    payload: redactPayload(jobPayload),
    logs: [
      {
        at: now,
        level: "info",
        message: yeriGenerationMode
          ? "작업 요청이 생성되어 서버 글 생성 단계로 들어갔습니다."
          : "작업 요청이 생성되었습니다.",
      },
    ],
    created_at: now,
    updated_at: now,
  };
  jobs.jobs.push(job);
  saveJobs(jobs);
  if (yeriGenerationMode) scheduleYeriArtifactGeneration(job, auth.user, yeriGenerationMode);
  json(req, res, 201, { ok: true, job: publicJob(job) });
}

function handleListJobs(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const jobs = loadJobs();
  const timedOut = markRunnerStartTimeouts(jobs, { userId: auth.user.id });
  const stale = failStaleRunningJobs(jobs, { userId: auth.user.id });
  if (timedOut || stale) saveJobs(jobs);
  const rows = jobs.jobs
    .filter((job) => job.user_id === auth.user.id)
    .filter((job) => jobVisibleToUser(job, auth.user))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 50)
    .map(publicJob);
  json(req, res, 200, { ok: true, jobs: rows });
}

async function handleCancelJob(req, res, jobId) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const jobs = loadJobs();
  const job = jobs.jobs.find((item) => item.id === jobId && item.user_id === auth.user.id);
  if (!job || !jobVisibleToUser(job, auth.user)) {
    json(req, res, 404, { ok: false, error: "job_not_found" });
    return;
  }
  if (TERMINAL_JOB_STATUSES.has(job.status)) {
    json(req, res, 200, { ok: true, job: publicJob(job), command: null, already_terminal: true });
    return;
  }

  const now = nowIso();
  const previousStatus = String(job.status || "");
  job.status = "cancelled";
  job.cancelled_at = now;
  job.finished_at = job.finished_at || now;
  job.updated_at = now;
  job.failed_stage = job.failed_stage || "user_cancelled";
  job.failed_reason = "사용자가 작업을 중단했습니다.";
  job.logs = job.logs || [];
  job.logs.push({
    at: now,
    level: "warn",
    message: redactText(body.reason || "사용자가 작업을 중단했습니다."),
  });

  let command = null;
  if (["running", "ready_for_publish", "generating"].includes(previousStatus)) {
    const commands = loadCommands();
    command = {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      type: "stop_current_job",
      status: "queued",
      target_platform: normalizePlatform(job.target_platform || body.target_platform || ""),
      target_device_label: String(job.target_device_label || body.target_device_label || "").trim().slice(0, 120),
      payload: {
        job_id: job.id,
        reason: compactText(body.reason || "user_cancelled", 120),
      },
      logs: [{ at: now, level: "info", message: "작업 중단 명령이 생성되었습니다." }],
      created_at: now,
      updated_at: now,
    };
    commands.commands.push(command);
    saveCommands(commands);
  }

  saveJobs(jobs);
  json(req, res, 200, { ok: true, job: publicJob(job), command: command ? publicCommand(command) : null });
}

async function handleRetryJob(req, res, jobId) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const body = await readJsonBody(req, res);
  if (!body) return;
  const jobs = loadJobs();
  const job = jobs.jobs.find((item) => item.id === jobId && item.user_id === auth.user.id);
  if (!job || !jobVisibleToUser(job, auth.user)) {
    json(req, res, 404, { ok: false, error: "job_not_found" });
    return;
  }
  if (!isJobAllowed(auth.user, job.kind)) {
    json(req, res, 403, { ok: false, error: "job_not_allowed" });
    return;
  }
  if (job.status !== "failed") {
    json(req, res, 409, { ok: false, error: "job_not_failed", job: publicJob(job) });
    return;
  }
  const retryCount = safeInt(job.retry_count, 0, 100);
  if (retryCount >= YERI_RETRY_LIMIT) {
    json(req, res, 429, { ok: false, error: "retry_limit_reached", retry_limit: YERI_RETRY_LIMIT, job: publicJob(job) });
    return;
  }
  // 연속 실패 가드 — 같은 오류 반복 재시도를 차단한다.
  // M-4: 재시도할 잡의 타겟 기기 스코프로 차단 판정한다.
  const retryDeviceKey = jobDeviceKey(
    job.target_platform || body.target_platform || "",
    job.target_device_label || body.target_device_label || "",
  );
  const pausedGuard = pausedJobGuard(auth.user.id, job.kind, retryDeviceKey);
  if (pausedGuard) {
    json(req, res, 409, {
      ok: false,
      error: "guard_paused",
      guard_class: String(pausedGuard.signature || "other"),
      consecutive_count: safeInt(pausedGuard.consecutive_count, 0, 1000000),
      message: jobGuardMessage(pausedGuard),
      job: publicJob(job),
    });
    return;
  }
  // 구버전 러너 preflight — 재시도도 러너로 다시 가므로 동일하게 검사한다.
  const runnerRequirement = runnerUpdateRequirement(
    auth.user.id,
    job.kind,
    normalizePlatform(job.target_platform || body.target_platform || ""),
  );
  if (runnerRequirement) {
    json(req, res, 409, {
      ok: false,
      error: "runner_update_required",
      ...runnerRequirement,
      job: publicJob(job),
    });
    return;
  }

  const now = nowIso();
  const stage = sanitizeFailedStage(body.failed_stage || job.failed_stage || "");
  const hasReusableArtifact = job.kind === "yeri_write" && stage !== YERI_CONTENT_GENERATION_STAGE && Boolean(loadYeriArtifact(job));
  const requestedYeriServerGeneration = job.kind === "yeri_write" && body.server_generation === true;
  const persistedYeriProviderIssue = job.kind === "yeri_write"
    ? yeriServerGenerationProviderIssue(job.payload || {}, yeriServerGenerationModeForUser(auth.user))
    : null;
  const shouldRegenerateServerArtifact = job.kind === "yeri_write"
    && !hasReusableArtifact
    && !persistedYeriProviderIssue
    && (requestedYeriServerGeneration || Boolean(job.server_generation));
  const yeriGenerationMode = shouldRegenerateServerArtifact
    ? yeriServerGenerationModeForUser(auth.user)
    : "";
  if (requestedYeriServerGeneration && persistedYeriProviderIssue) {
    json(req, res, 400, {
      ok: false,
      error: "yeri_server_generation_provider_mismatch",
      provider: persistedYeriProviderIssue.provider,
      model: persistedYeriProviderIssue.model,
      message: "선택한 예리 AI 모델을 확인할 수 없어 서버 글 재생성을 시작하지 않았습니다.",
      job: publicJob(job),
    });
    return;
  }
  if (requestedYeriServerGeneration && !yeriGenerationMode) {
    json(req, res, 403, {
      ok: false,
      error: "yeri_server_generation_not_allowed",
      message: "이 계정은 예리 서버 글 생성 테스트 대상이 아닙니다.",
      job: publicJob(job),
    });
    return;
  }
  if (yeriGenerationMode === "gemini" && body.confirm_paid !== true) {
    json(req, res, 402, {
      ok: false,
      error: "yeri_paid_confirmation_required",
      message: "서버 글 재생성은 선택한 AI 모델의 API 비용이 발생할 수 있어 confirm_paid=true가 필요합니다.",
      job: publicJob(job),
    });
    return;
  }
  if (yeriGenerationMode === "gemini") {
    const limitIssue = yeriRealTestLimitIssue(job.payload || {});
    if (limitIssue) {
      json(req, res, 400, {
        ok: false,
        error: "yeri_real_test_limit_exceeded",
        ...limitIssue,
        message: "실제 유료 테스트 모드에서는 짧은 글과 이미지 1장 범위만 허용합니다.",
        job: publicJob(job),
      });
      return;
    }
  }

  job.retry_count = retryCount + 1;
  job.result = null;
  delete job.finished_at;
  delete job.failed_stage;
  delete job.failed_reason;
  delete job.diagnostic;
  delete job.claim_expires_at;
  job.updated_at = now;
  if (hasReusableArtifact) {
    job.status = "ready_for_publish";
    appendJobLog(job, "info", "생성된 글을 보존한 채 네이버 입력 단계만 다시 시도하도록 대기 상태로 돌렸습니다.", now);
  } else if (yeriGenerationMode) {
    job.status = "generating";
    appendJobLog(job, "info", "작업을 서버 글 생성 단계부터 다시 시작합니다.", now);
  } else {
    job.status = "queued";
    appendJobLog(job, "info", "작업을 다시 대기열에 넣었습니다.", now);
  }
  saveJobs(jobs);
  if (yeriGenerationMode) scheduleYeriArtifactGeneration(job, auth.user, yeriGenerationMode);
  json(req, res, 200, { ok: true, reused_artifact: hasReusableArtifact, job: publicJob(job) });
}

// 본인 활성 가드 조회 — 본인 것만 반환한다.
function handleListJobGuards(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  let guards = [];
  try {
    guards = loadJobGuards().guards.filter((row) => row.user_id === auth.user.id);
  } catch (error) {
    console.warn("[job-guard] list failed", error?.code || error?.message || error);
    guards = [];
  }
  json(req, res, 200, { ok: true, guards: guards.map(publicJobGuard) });
}

// 명시적 가드 해제 — paused 를 풀고 count=0 으로 리셋해, 다음 실패 시 즉시 재차단이 아니라
// 다시 연속 임계 기준이 적용되도록 한다.
async function handleAcknowledgeJobGuard(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const kind = String(body.job_kind || body.kind || "").trim();
  if (!kind) {
    json(req, res, 400, { ok: false, error: "job_kind_required" });
    return;
  }
  // 가드 저장소 손상이 서버 프로세스를 죽이면 안 된다(레드팀 H-1).
  // 읽기/쓰기 실패 시 503으로 응답하고 프로세스는 살린다.
  try {
    const data = loadJobGuards();
    // M-4: user+kind 의 모든 기기 행을 함께 해제한다(사용자 의사 존중, UI 단순 유지).
    const matched = data.guards.filter((row) => row.user_id === auth.user.id && row.job_kind === kind);
    if (!matched.length) {
      json(req, res, 404, { ok: false, error: "guard_not_found" });
      return;
    }
    const now = nowIso();
    for (const guard of matched) {
      guard.paused = false;
      guard.consecutive_count = 0;
      guard.acknowledged_at = now;
      guard.updated_at = now;
    }
    saveJobGuards(data);
    json(req, res, 200, { ok: true, guard: publicJobGuard(matched[0]), guards: matched.map(publicJobGuard) });
  } catch (error) {
    console.warn("[job-guard] acknowledge failed", error?.code || error?.message || error);
    json(req, res, 503, { ok: false, error: "guard_store_unavailable" });
  }
}

function handleAgentNextJob(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  if (!canExecute(auth.user)) {
    json(req, res, 403, { ok: false, error: "password_change_or_entitlement_required" });
    return;
  }
  const jobs = loadJobs();
  const now = nowIso();
  const agentPlatform = requestAgentPlatform(req, auth);
  const agentDeviceLabel = requestDeviceLabel(req, auth);
  const timedOut = markRunnerStartTimeouts(jobs, {
    userId: auth.user.id,
    platform: agentPlatform,
    deviceLabel: agentDeviceLabel,
  });
  const stale = failStaleRunningJobs(jobs, {
    userId: auth.user.id,
    platform: agentPlatform,
    deviceLabel: agentDeviceLabel,
  });
  const job = jobs.jobs
    .filter((item) => item.user_id === auth.user.id && AGENT_CLAIMABLE_JOB_STATUSES.has(item.status))
    .filter((item) => isJobAllowed(auth.user, item.kind))
    .filter((item) => jobMatchesAgentTarget(item, agentPlatform, agentDeviceLabel))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
  if (job) {
    job.status = "running";
    job.assigned_at = job.assigned_at || now;
    job.updated_at = now;
    job.runner_claimed_at = now;
    delete job.runner_started_at;
    job.claim_expires_at = new Date(Date.now() + AGENT_JOB_CLAIM_TTL_SECONDS * 1000).toISOString();
    job.logs = job.logs || [];
    job.logs.push({
      at: now,
      level: "info",
      message: "작업이 실행기에 전달되었습니다.",
    });
  }
  if (timedOut || stale || job) saveJobs(jobs);
  json(req, res, 200, { ok: true, job: job ? agentJob(job) : null });
}

async function handleAgentJobUpdate(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const jobs = loadJobs();
  const job = jobs.jobs.find((item) => item.id === body.job_id && item.user_id === auth.user.id);
  if (!job || !jobVisibleToUser(job, auth.user)) {
    json(req, res, 404, { ok: false, error: "job_not_found" });
    return;
  }
  const nextStatus = String(body.status || job.status);
  if (!JOB_STATUSES.has(nextStatus)) {
    json(req, res, 400, { ok: false, error: "invalid_status" });
    return;
  }
  if (TERMINAL_JOB_STATUSES.has(job.status) && job.status !== nextStatus) {
    json(req, res, 200, { ok: true, ignored: true, job: publicJob(job) });
    return;
  }
  const previousStatus = String(job.status || "");
  const now = nowIso();
  job.status = nextStatus;
  job.updated_at = now;
  if (nextStatus === "running") {
    job.assigned_at = job.assigned_at || now;
    const runnerEvent = jobRunnerEventFromUpdate(body);
    if (runnerEvent === "claimed") {
      job.runner_claim_ack_at = now;
    } else {
      job.runner_started_at = job.runner_started_at || now;
    }
    job.claim_expires_at = new Date(Date.now() + AGENT_JOB_CLAIM_TTL_SECONDS * 1000).toISOString();
  }
  if (TERMINAL_JOB_STATUSES.has(nextStatus)) {
    job.finished_at = now;
    delete job.claim_expires_at;
  }
  if (!TERMINAL_JOB_STATUSES.has(nextStatus)) {
    delete job.finished_at;
  }
  if (body.log) {
    appendJobLog(job, body.level || "info", body.log, now);
  }
  if (Object.prototype.hasOwnProperty.call(body, "result")) {
    job.result = sanitizeJobResult(body.result);
  }
  if (nextStatus === "failed") {
    job.failed_stage = failedStageFromJobUpdate(body) || job.failed_stage || "unknown";
    job.failed_reason = failedReasonFromJobUpdate(body);
    delete job.diagnostic;
    job.diagnostic = jobFailureDiagnostic(job);
  } else if (nextStatus === "running" || nextStatus === "done" || nextStatus === "queued" || nextStatus === "generating" || nextStatus === "ready_for_publish") {
    delete job.failed_stage;
    delete job.failed_reason;
    delete job.diagnostic;
  }
  if (job.status === "done") {
    const imageIssue = imageCompletionIssue(job, job.result);
    if (imageIssue) {
      job.status = "failed";
      job.failed_stage = "image_completion";
      job.failed_reason = imageIssue;
      job.result = {
        ...(job.result || {}),
        ok: false,
        error: imageIssue,
      };
      job.diagnostic = jobFailureDiagnostic(job);
      appendJobLog(job, "error", imageIssue, now);
    }
  }
  saveJobs(jobs);
  // 연속 실패 가드 갱신 — 같은 failed 상태의 중복 보고로 이중 집계되지 않도록
  // 상태 전이(비-failed → failed / 비-done → done)에서만 반영한다.
  if (job.status === "failed" && previousStatus !== "failed") {
    recordJobFailureGuard(job);
  } else if (job.status === "done" && previousStatus !== "done") {
    clearJobGuardOnSuccess(job.user_id, job.kind);
  }
  json(req, res, 200, { ok: true, job: publicJob(job) });
}

async function handleReport(req, res) {
  const reportSession = lookupSession(req);
  const hasActiveSession = Boolean(reportSession && reportSession.user.status === "active");
  if (!hasActiveSession && !hasReportAuth(req)) {
    json(req, res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const parsed = await readJsonBody(req, res);
  if (!parsed) return;
  if (hasActiveSession) {
    parsed.account = {
      user_id: reportSession.user.id,
      email: reportSession.user.email,
      product: reportSession.user.entitlements?.product || "",
    };
  }

  const report = redactPayload(parsed);
  report.report_id = safeReportId(report.report_id);
  const storedAt = nowIso();
  report.server_received_at = storedAt;
  report.server_redacted = true;
  const supportMeta = reportSupportMeta(report, "new");
  report.support = {
    status: "new",
    status_label: supportMeta.label,
    public_message: supportMeta.publicMessage,
    next_update_message: supportMeta.nextUpdateMessage,
    updated_at: storedAt,
  };
  applyReportAutoGuidance(report, storedAt);

  const dateKey = storedAt.slice(0, 10);
  const dayDir = path.join(REPORTS_DIR, dateKey);
  fs.mkdirSync(dayDir, { recursive: true });
  const reportPath = path.join(dayDir, `${report.report_id}.json`);
  const automationTicket = buildAutomationTicketForReport(report, storedAt, dateKey);
  report.support.automation_ticket_id = automationTicket.ticket_id;
  writeJsonAtomic(reportPath, report);
  appendJsonLineDurable(INDEX_PATH, summaryFor(report, storedAt, dateKey));
  appendAutomationTicket(automationTicket);
  sendTelegramReportAlert(report, storedAt).catch((error) => {
    console.warn("[telegram alert] send failed", error.code || error.message || "telegram_send_failed");
  });

  json(req, res, 201, {
    ok: true,
    report_id: report.report_id,
    stored_at: storedAt,
    status: report.support.status,
    status_label: report.support.status_label,
    public_message: report.support.public_message,
    next_update_message: report.support.next_update_message,
    status_updated_at: storedAt,
    automation_ticket_id: automationTicket.ticket_id,
    auto_guidance_category: report.support.auto_guidance_category || "",
  });
}

function handleHealth(req, res) {
  const storage = jsonStorageHealth();
  json(req, res, 200, {
    ok: storage.ok,
    service: "aimax-reports-api",
    time: nowIso(),
    storage,
  });
}

function handleList(req, res) {
  if (!requireAuth(req, res)) return;
  let rows = [];
  try {
    rows = loadReportIndexRows(100).reverse();
  } catch (error) {
    json(req, res, 500, { ok: false, error: "index_read_failed" });
    return;
  }
  json(req, res, 200, { ok: true, reports: rows });
}

function handleMyReports(req, res) {
  const auth = requireSession(req, res);
  if (!auth) return;
  let rows = [];
  try {
    rows = loadReportIndexRows(300)
      .filter((row) => row.account_user_id === auth.user.id)
      .sort((a, b) => String(b.stored_at).localeCompare(String(a.stored_at)))
      .slice(0, 20)
      .map(publicReportSummary);
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "reports_read_failed" });
    return;
  }
  json(req, res, 200, { ok: true, reports: rows });
}

async function handleReportUserResponse(req, res, reportId) {
  const auth = requireSession(req, res);
  if (!auth) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  const response = String(body.response || "").trim();
  if (!["resolved", "still_failing"].includes(response)) {
    json(req, res, 400, { ok: false, error: "invalid_report_response" });
    return;
  }

  try {
    const loaded = loadReportDetail(reportId);
    if (!loaded || loaded.row.account_user_id !== auth.user.id) {
      json(req, res, 404, { ok: false, error: "report_not_found" });
      return;
    }

    const updatedAt = nowIso();
    const note = redactText(compactText(body.note || "", 700));
    const nextStatus = response === "resolved" ? "done" : "reviewing";
    const meta = reportSupportMeta(loaded.report || loaded.row, nextStatus);
    const publicMessage = response === "resolved"
      ? "사용자가 안내 확인 후 해결 완료로 표시했습니다."
      : "사용자가 안내대로 확인했지만 문제가 계속된다고 표시했습니다. 운영팀이 다시 확인 중입니다.";
    const nextUpdateMessage = response === "resolved"
      ? "같은 문제가 다시 생기면 이 접수 ID와 함께 알려주세요."
      : "운영팀이 재확인한 뒤 이 화면에 다음 안내를 남깁니다.";
    const feedbackEntry = {
      response,
      note,
      updated_at: updatedAt,
      user_id: auth.user.id,
    };
    let nextSummary = {
      ...loaded.row,
      status: nextStatus,
      status_updated_at: updatedAt,
      status_label: meta.label,
      public_message: publicMessage,
      next_update_message: nextUpdateMessage,
      user_response: response,
      user_response_note: note,
      user_response_updated_at: updatedAt,
    };
    const reportPath = reportPathFromSummary(loaded.row);
    if (loaded.report && reportPath) {
      loaded.report.support = {
        ...(loaded.report.support || {}),
        status: nextStatus,
        status_label: meta.label,
        public_message: publicMessage,
        next_update_message: nextUpdateMessage,
        updated_at: updatedAt,
        user_response: response,
        user_response_note: note,
        user_response_updated_at: updatedAt,
        user_feedback: [
          ...(Array.isArray((loaded.report.support || {}).user_feedback) ? loaded.report.support.user_feedback : []),
          feedbackEntry,
        ].slice(-20),
      };
      saveReportDetail(reportPath, loaded.report);
      nextSummary = summaryFor(loaded.report, loaded.row.stored_at || updatedAt, loaded.row.date || (loaded.row.stored_at || updatedAt).slice(0, 10));
    }
    const updatedRow = updateReportIndexSummary(reportId, nextSummary);
    if (!updatedRow) {
      json(req, res, 404, { ok: false, error: "report_not_found" });
      return;
    }

    if (updatedRow.automation_ticket_id) {
      appendAutomationTicketStatusUpdate(updatedRow.automation_ticket_id, reportId, nextStatus, updatedAt);
    }

    if (response === "still_failing") {
      const jobLine = compactJobLine(updatedRow);
      sendTelegramMessage([
        "[AIMAX 오류 보고 재확인 요청]",
        `ID: ${updatedRow.report_id || "-"}`,
        `구매자: ${updatedRow.account_email || "-"}`,
        `상품: ${updatedRow.product || "-"}`,
        `작업: ${compactTelegramLine(updatedRow.work_context, 500)}`,
        jobLine ? `작업 ID/단계: ${compactTelegramLine(jobLine, 700)}` : "",
        updatedRow.media_tools_missing ? `영상 도구: 누락 ${compactTelegramLine(updatedRow.media_tools_missing, 120)}` : "",
        `사용자 메모: ${compactTelegramLine(note, 700)}`,
        `관리: ${PUBLIC_BASE_URL}/admin#reports`,
      ].filter(Boolean).join("\n")).catch((error) => {
        console.warn("[telegram alert] report follow-up send failed", error.code || error.message || "telegram_send_failed");
      });
    }

    json(req, res, 200, { ok: true, report: publicReportSummary(updatedRow) });
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "report_response_failed" });
  }
}

function redirect(res, location) {
  res.writeHead(302, {
    location,
    "cache-control": "no-store",
  });
  res.end();
}

function serveApp(req, res) {
  try {
    const body = fs.readFileSync(APP_HTML_PATH);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      "x-frame-options": "DENY",
    });
    res.end(body);
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "app_not_available" });
  }
}

function serveAdmin(req, res) {
  try {
    const body = fs.readFileSync(ADMIN_HTML_PATH);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      "x-frame-options": "DENY",
    });
    res.end(body);
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "admin_app_not_available" });
  }
}

function serveSetup(req, res) {
  try {
    const body = fs.readFileSync(SETUP_HTML_PATH);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      "x-frame-options": "DENY",
    });
    res.end(body);
  } catch (_error) {
    json(req, res, 500, { ok: false, error: "setup_app_not_available" });
  }
}

function serveStaticAsset(req, res, url) {
  let rawPath = "";
  try {
    rawPath = decodeURIComponent(url.pathname.replace(/^\/assets\//, ""));
  } catch (_error) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  if (!rawPath || rawPath.includes("\0")) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const assetRoot = path.join(STATIC_DIR, "assets");
  const filePath = path.normalize(path.join(assetRoot, rawPath));
  if (!filePath.startsWith(`${assetRoot}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const stat = fs.statSync(filePath);
  const contentType = downloadContentType(filePath);
  const baseHeaders = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  };
  const range = String(req.headers.range || "").trim();
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { ...baseHeaders, "content-range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stat.size - 1;
    if (!match[1] && match[2]) {
      const suffixLength = Number(match[2]);
      start = Math.max(0, stat.size - suffixLength);
      end = stat.size - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= stat.size) {
      res.writeHead(416, { ...baseHeaders, "content-range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      ...baseHeaders,
      "content-range": `bytes ${start}-${end}/${stat.size}`,
      "content-length": end - start + 1,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    ...baseHeaders,
    "content-length": stat.size,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function serveEunseoWebApp(req, res, url) {
  let rawPath = "";
  try {
    rawPath = decodeURIComponent(url.pathname.replace(/^\/eunseo\/?/, ""));
  } catch (_error) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  if (!rawPath) rawPath = "index.html";
  if (rawPath.includes("\0")) {
    json(req, res, 404, { ok: false, error: "not_found" });
    return;
  }
  const auth = lookupSession(req);
  let accessCookie = "";
  let allowed = Boolean(auth?.user && canAccessEunseo(auth.user));
  if (!allowed) {
    const queryTicket = String(url.searchParams.get("ticket") || "").trim();
    const cookieTicket = parseCookies(req)[EUNSEO_ACCESS_COOKIE_NAME] || "";
    const access = eunseoAccessFromTicket(queryTicket || cookieTicket);
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
  if (req.method === "POST" && url.pathname === "/api/admin/users/send-guides-batch") {
    handleAdminSendGuideEmailsBatch(req, res);
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
  if (req.method === "GET" && url.pathname === "/api/jobs/guards") {
    handleListJobGuards(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/jobs/guard/acknowledge") {
    handleAcknowledgeJobGuard(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/jobs/") && url.pathname.endsWith("/retry")) {
    const rawId = url.pathname.slice("/api/jobs/".length, -"/retry".length);
    handleRetryJob(req, res, decodeURIComponent(rawId));
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/jobs/") && url.pathname.endsWith("/cancel")) {
    const rawId = url.pathname.slice("/api/jobs/".length, -"/cancel".length);
    handleCancelJob(req, res, decodeURIComponent(rawId));
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
  startWaitingUserReportMailSweep();
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
  __jobGuardTest: {
    JOB_GUARDS_PATH,
    JOB_GUARD_MAX_ROWS_PER_USER,
    appendJobLogById,
    classifyJobFailureSignature,
    clearJobGuardOnSuccess,
    jobDeviceKey,
    jobFailureSignatureClass,
    jobGuardMessage,
    jobGuardSignatureScope,
    jobGuardPauseThreshold,
    jobKindRequiresRunner,
    loadJobGuards,
    pausedJobGuard,
    publicJobGuard,
    recordJobFailureGuard,
    releaseJobGuardsForClasses,
    requestYeriProviderJson,
    runnerUpdateRequirement,
    saveJobGuards,
  },
};
