#!/usr/bin/env python3
"""Static no-paid contract smoke for Yeri local artifact consumption."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "app.py",
]


def assert_contains(source: str, needle: str, label: str) -> None:
    if needle not in source:
        raise AssertionError(f"{label}: missing {needle!r}")


def main() -> None:
    for file_path in FILES:
        source = file_path.read_text(encoding="utf-8")
        label = str(file_path.relative_to(ROOT))
        assert_contains(source, "def _remote_job_artifact(self, job):", label)
        assert_contains(source, "def _remote_artifact_image_count(self, artifact):", label)
        assert_contains(source, "def _fetch_web_secret_statuses(self):", label)
        assert_contains(source, "def _has_local_or_web_ai_key(self, ai_model=None, web_secrets=None):", label)
        assert_contains(source, "def _has_local_or_web_image_key(self, web_secrets=None):", label)
        assert_contains(source, "_validate_credentials(need_api=False)", label)
        assert_contains(source, "_has_local_or_web_ai_key(ai_model, web_secrets)", label)
        assert_contains(source, "_has_local_or_web_image_key(web_secrets)", label)
        assert_contains(source, "def _remote_write_kwargs(self, payload, artifact=None):", label)
        assert_contains(source, "\"artifact\": artifact if isinstance(artifact, dict) else None", label)
        assert_contains(source, "def _worker_write(self, keywords, md_file, mode", label)
        assert_contains(source, "artifact=None", label)
        assert_contains(source, "post_stage = \"server_artifact_parse\"", label)
        assert_contains(source, "generate_blog_content(keyword, text_api_key", label)
        assert_contains(source, "if post[\"type\"] == \"artifact\":", label)
    print("YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK")


if __name__ == "__main__":
    main()
