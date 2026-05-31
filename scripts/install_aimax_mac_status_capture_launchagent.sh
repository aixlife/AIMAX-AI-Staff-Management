#!/usr/bin/env bash
set -euo pipefail

LABEL="com.aimax.mac-status-capture"
REPO_DIR="/Users/aixlife/Projects/AIMAX-AI-Staff-Management"
SOURCE_PLIST="${REPO_DIR}/launchd/${LABEL}.plist"
TARGET_DIR="${HOME}/Library/LaunchAgents"
TARGET_PLIST="${TARGET_DIR}/${LABEL}.plist"
GUI_DOMAIN="gui/$(id -u)"

mkdir -p "${TARGET_DIR}"
cp "${SOURCE_PLIST}" "${TARGET_PLIST}"

launchctl bootout "${GUI_DOMAIN}" "${TARGET_PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "${GUI_DOMAIN}" "${TARGET_PLIST}"
launchctl enable "${GUI_DOMAIN}/${LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${LABEL}"
launchctl print "${GUI_DOMAIN}/${LABEL}"
