import os
import yaml
from dotenv import load_dotenv
from paths import ENV_PATH, USER_CONFIG_PATH, BUNDLED_CONFIG_PATH

# .env: 사용자 데이터 디렉토리 우선, 없으면 현재 경로(dev) fallback
if ENV_PATH.exists():
    load_dotenv(dotenv_path=str(ENV_PATH))
else:
    load_dotenv()

def load_config():
    # 사용자 커스텀 config.yaml 우선, 없으면 번들된 기본값
    for candidate in (USER_CONFIG_PATH, BUNDLED_CONFIG_PATH):
        if candidate.exists():
            with open(candidate, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
    return {}

_config = load_config()

# Environment variables
NAVER_ID = os.getenv("NAVER_ID", "")
NAVER_PW = os.getenv("NAVER_PW", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Browser settings
BROWSER = _config.get("browser", {})
HEADLESS = BROWSER.get("headless", False)
PROXY = BROWSER.get("proxy", None)
BROWSER_EXECUTABLE_PATH = os.getenv(
    "BROWSER_EXECUTABLE_PATH",
    BROWSER.get("executable_path", ""),
).strip()
VIEWPORT_MIN = tuple(BROWSER.get("viewport_min", [1280, 720]))
VIEWPORT_MAX = tuple(BROWSER.get("viewport_max", [1920, 1080]))

# Delay settings
DELAYS = _config.get("delays", {})
TYPING_AVG = DELAYS.get("typing_avg", 0.05)
TYPING_STD = DELAYS.get("typing_std", 0.02)
ACTION_AVG = DELAYS.get("action_avg", 1.5)
ACTION_STD = DELAYS.get("action_std", 0.5)
BETWEEN_POSTS = DELAYS.get("between_posts", 10)
BETWEEN_LIKES = DELAYS.get("between_likes", 2)
BETWEEN_COMMENTS = DELAYS.get("between_comments", 3)

# Publishing settings
PUBLISHING = _config.get("publishing", {})
SCHEDULE_HOUR_MIN = PUBLISHING.get("schedule_hour_min", 9)
SCHEDULE_HOUR_MAX = PUBLISHING.get("schedule_hour_max", 18)
SCHEDULE_DAYS_AHEAD = PUBLISHING.get("schedule_days_ahead", 1)

# Engagement settings
ENGAGEMENT = _config.get("engagement", {})
MAX_LIKES = ENGAGEMENT.get("max_likes_per_session", 30)
MAX_COMMENTS = ENGAGEMENT.get("max_comments_per_session", 15)
SCROLL_COUNT = ENGAGEMENT.get("scroll_count", 3)
TEST_CBOX_POST_URL = ENGAGEMENT.get("test_cbox_post_url", None)

# Selector overrides (config.yaml selectors section)
SELECTORS = _config.get("selectors", {})
