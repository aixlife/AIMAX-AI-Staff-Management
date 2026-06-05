import json
import os
import sys
import tempfile
from pathlib import Path

os.environ["AIMAX_DISABLE_KEYCHAIN"] = "1"
for name in (
    "AIMAX_GEMINI_API_KEY",
    "AIMAX_CLAUDE_API_KEY",
    "AIMAX_OPENAI_API_KEY",
    "OPENAI_API_KEY",
    "openai_api_key",
    "AIMAX_APIFY_API_TOKEN",
    "APIFY_API_TOKEN",
    "apify_api_token",
):
    os.environ.pop(name, None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: E402


def check_module(module) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        module.SETTINGS_PATH = str(root / "settings.json")
        module.SECRET_FALLBACK_PATH = str(root / ".settings_secrets.json")

        module.save_settings(
            "naver-before",
            "naver-pw-before",
            "gemini-secret-before",
            "gemini-2.5-pro",
            "claude-secret-before",
            "openai-secret-before",
            "apify-secret-before",
        )

        module.save_local_security_settings("naver-after", "naver-pw-after", "gpt-5-mini")
        loaded = module.load_settings()
        assert loaded[0] == "naver-after"
        assert loaded[1] == "naver-pw-after"
        assert loaded[2] == "gemini-secret-before"
        assert loaded[3] == "gpt-5-mini"
        assert loaded[4] == "claude-secret-before"
        assert loaded[5] == "openai-secret-before"
        assert loaded[6] == "apify-secret-before"

        module.save_settings("naver-third", "", "", "gemini-2.5-flash", "", "", "")
        loaded = module.load_settings()
        assert loaded[0] == "naver-third"
        assert loaded[1] == "naver-pw-after"
        assert loaded[2] == "gemini-secret-before"
        assert loaded[3] == "gemini-2.5-flash"
        assert loaded[4] == "claude-secret-before"
        assert loaded[5] == "openai-secret-before"
        assert loaded[6] == "apify-secret-before"

        data = json.loads(Path(module.SETTINGS_PATH).read_text(encoding="utf-8"))
        data["cleared_secret_keys"] = ["gemini_api_key", "apify_api_token", "naver_pw"]
        Path(module.SETTINGS_PATH).write_text(json.dumps(data), encoding="utf-8")
        repaired = module.repair_accidental_provider_clear_markers()
        assert repaired == ["apify_api_token", "gemini_api_key"]
        data = json.loads(Path(module.SETTINGS_PATH).read_text(encoding="utf-8"))
        assert data["cleared_secret_keys"] == ["naver_pw"]


def main() -> None:
    # split_version 포크 통합(Phase C) 이후 단일 app.py 만 검증한다.
    check_module(app)
    print("LOCAL_SETTINGS_PRESERVE_SECRETS_OK")


if __name__ == "__main__":
    main()
