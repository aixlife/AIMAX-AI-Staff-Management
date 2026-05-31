"""Sensitive-data masking for diagnostics payloads."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any


_HEADER_PATTERNS = [
    re.compile(r"\b(Authorization|Cookie|Set-Cookie)(\s*[:=]\s*)([^\r\n]+)", re.IGNORECASE),
    re.compile(r"\b(NID_AUT|NID_SES)(=)([^;\s,]+)", re.IGNORECASE),
]

_TOKEN_PATTERNS = [
    re.compile(r"\bAIza[0-9A-Za-z_\-]{20,}\b"),
    re.compile(r"\bsk-[0-9A-Za-z_\-]{20,}\b"),
    re.compile(r"\b[a-zA-Z0-9_\-]{32,}\.[a-zA-Z0-9_\-]{16,}\.[a-zA-Z0-9_\-]{16,}\b"),
    re.compile(r"\b[A-Za-z0-9_\-]{48,}\b"),
]

_SECRET_ASSIGNMENT = re.compile(
    r"(?i)\b([\w.\-]*(?:password|passwd|pw|api[_-]?key|apikey|token|secret|cookie|session)[\w.\-]*)([\"'\s:=]+)([^\"'\s,;\]\}]+)"
)

_EMAIL = re.compile(r"\b([A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]*(@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b")


def mask_text(value: Any) -> str:
    text = "" if value is None else str(value)
    if not text:
        return text

    home = str(Path.home())
    if home and home in text:
        text = text.replace(home, str(Path.home().parent / "***"))

    text = _EMAIL.sub(r"\1***\2", text)
    text = _SECRET_ASSIGNMENT.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", text)
    for pattern in _HEADER_PATTERNS:
        text = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", text)

    for pattern in _TOKEN_PATTERNS:
        text = pattern.sub("[REDACTED_TOKEN]", text)
    return text


def mask_value(key: str, value: Any) -> Any:
    key_lower = (key or "").lower()
    if any(part in key_lower for part in ("password", "passwd", "pw", "api_key", "apikey", "token", "secret", "cookie", "session")):
        if value in (None, "", []):
            return value
        return "[REDACTED]"
    if isinstance(value, str):
        return mask_text(value)
    return mask_payload(value)


def mask_payload(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): mask_value(str(k), v) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_payload(item) for item in value]
    if isinstance(value, tuple):
        return [mask_payload(item) for item in value]
    if isinstance(value, str):
        return mask_text(value)
    return value
