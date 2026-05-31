# Windows Handoff: Songi YouTube Local Discovery

Date: 2026-05-28

## Goal

Verify and prepare the Windows runner/web source for Songi YouTube keyword discovery using the free local yt-dlp path, including the updated two-tab UI and multi-card benchmarking board.

## Context

Mac-side implementation changed Songi keyword discovery from a YouTube Data API default to a local-runner-assisted flow:

1. Web UI calls /api/research/discovery/search.
2. Oracle API creates a discovery run and queues a songi_youtube_discovery agent command.
3. Local runner executes yt-dlp with --skip-download and returns only whitelisted metadata fields.
4. Server materializes returned candidates into discovery_candidates.
5. User imports a candidate into the existing Songi link-analysis item flow.

No Apify, Gemini, paid API, YouTube Data API key, or video download is required for this default path.

Latest Mac-side update:

- The Songi job UI now separates the two tab pages more clearly:
  - 키워드로 찾기: a standalone YouTube keyword benchmarking task page.
  - 링크로 분석: the existing direct-link analysis workflow.
- The tab selector now appears immediately under the Songi job heading. The old shared fields are no longer shown before the tabs.
- The link-analysis fields stay inside 링크로 분석 only: project, Instagram profile, video category, desired topic, URL input, cost estimate, submit, and brief copy.
- The keyword-discovery page has its own lightweight project selector plus keyword/date/result-count controls, with no profile/category/topic inputs in front of it.
- Multiple benchmarking candidates render as a responsive card grid with stable thumbnails, wrapped titles, compact metrics, and no text overflow in the tested viewport.
- Server integration status now uses the newest agent record for the user, so stale runner records should not make YouTube discovery look disconnected.
- Headless local_agent/runtime.py now handles songi_youtube_discovery commands, matching app.py behavior.

## Source Files Provided

Copy these out of Syncthing into a local Windows work folder before editing/building:

- source-files/app.py
- source-files/split_version/app.py
- source-files/local_agent/runtime.py
- source-files/oracle/aimax-reports-api/server.js
- source-files/oracle/aimax-reports-api/static/app.html
- source-files/scripts/smoke_songi_discovery.mjs
- source-files/scripts/dev_songi_discovery_runner.py
- source-files/docs/songi_free_keyword_discovery_plan_20260528.md

Do not build inside the shared folder. Do not put secrets, passphrases, cookies, or customer data into Syncthing.

## Windows Tasks

1. Apply or compare the provided source files against the current Windows work folder.
2. Confirm Windows runner can locate yt-dlp. Preferred sources are existing bundled/local media-tools or PATH. Do not download paid tools or use paid APIs.
3. Run syntax checks:
   - python -m py_compile app.py split_version/app.py local_agent/runtime.py scripts/dev_songi_discovery_runner.py
   - node --check oracle/aimax-reports-api/server.js
   - node --check scripts/smoke_songi_discovery.mjs
4. Run no-cost smoke:
   - node scripts/smoke_songi_discovery.mjs
   Expected: SONGI_DISCOVERY_SMOKE_OK
5. If Windows network policy allows, run a no-download yt-dlp check with a harmless keyword:
   - yt-dlp --skip-download --flat-playlist --no-warnings --dump-json --playlist-end 3 "ytsearch3:AI 직원"
   Expected: JSON lines with id/title/channel/view_count/url. Do not download video.
6. Open the web UI from the smoke server or local dev server, log in with the smoke account, select 작업 > 송이, and verify:
   - default tab is 키워드로 찾기
   - tab selector appears before project/profile/category/topic fields
   - 키워드로 찾기 and 링크로 분석 appear as separate task pages
   - 키워드로 찾기 does not show Instagram profile/category/topic fields before search
   - 링크로 분석 contains the existing project/profile/category/topic/link workflow
   - status says local/yt-dlp ready when runner heartbeat reports yt-dlp ready
   - 8+ candidate cards render as a responsive board without text overflow
   - candidate import still creates an item with link_fetch_status youtube_discovery
7. If building installer, build in the normal Windows local build folder, not this shared folder.

## Return Evidence

Write a Windows result Markdown back to this same folder with:

- commit/source basis or copied file list
- Windows OS and runner version/build flavor
- syntax/smoke command outputs
- yt-dlp availability/version
- UI screenshots or visible text evidence
- whether no paid/API calls were made
- blockers if any

## Mac-Side Evidence

Mac-side verification passed:

- python -m py_compile local_agent/runtime.py scripts/dev_songi_discovery_runner.py app.py split_version/app.py
- node --check oracle/aimax-reports-api/server.js
- node --check scripts/smoke_songi_discovery.mjs
- APP_HTML_SCRIPT_SYNTAX_OK
- SONGI_DISCOVERY_SMOKE_OK
- actual local UI at http://127.0.0.1:19400 opened with smoke account
- local dev runner processed AI 직원 keyword search through yt-dlp and returned 8 cards
- UI evidence: Songi heading -> tablist first, no common profile fields before tabs, keyword tab visible, link tab contains existing workflow, status 로컬 검색 준비됨, summary 8개 후보, grid columns 2, visible overflow []
- screenshots on Mac: /tmp/songi-keyword-board-updated.png and /tmp/songi-keyword-cards-compact.png
