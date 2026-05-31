"""PyInstaller 런타임 훅 — macOS Tk deprecation 경고 억제"""
import os
os.environ.setdefault("TK_SILENCE_DEPRECATION", "1")
