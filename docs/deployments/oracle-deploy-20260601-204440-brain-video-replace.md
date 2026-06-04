# Oracle Deploy 20260601-204440 Brain Video Replace

- mode: `targeted-web-assets`
- host: `oracle-server`
- app_dir: `/home/ubuntu/aimax-reports-api`
- remote_backup: `/home/ubuntu/aimax-backups/20260601-204440-brain-video-replace`
- remote_tmp: `/tmp/aimax-deploy-20260601-204440-brain-video-replace`

## Purpose

Replace the AIMAX dashboard `AIMAX Brain` preview video with the user-provided source:

- `/Users/aixlife/Downloads/Telegram Desktop/회사옵시디언.mp4`

The previous 720x492 asset looked soft on larger dashboard cards. The new assets keep the existing dashboard aspect ratio but use a 1440x984 encode.

## Files

| label | local | remote | sha256 |
|---|---|---|---|
| web app | `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/oracle/aimax-reports-api/static/app.html` | `/home/ubuntu/aimax-reports-api/static/app.html` | `6674ec091b970df529a4581fca55f02450282752eca0fa602b241c32af90d414` |
| aimax brain preview mp4 | `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/oracle/aimax-reports-api/static/assets/aimax-brain-preview.mp4` | `/home/ubuntu/aimax-reports-api/static/assets/aimax-brain-preview.mp4` | `7c983ee48442d3706064f14131dadf38c00c28c25af5b2d5ba27e4d3eccac8a9` |
| aimax brain preview webm | `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/oracle/aimax-reports-api/static/assets/aimax-brain-preview.webm` | `/home/ubuntu/aimax-reports-api/static/assets/aimax-brain-preview.webm` | `51f650f7dedead93b2a8c8cc57f5e8d62f195c034df3e341ef71a6ca4f9bac6b` |

## Encoding

- Source: 3840x2160 HEVC, 9.845s, audio removed.
- Output ratio: dashboard card ratio `720 / 492`.
- MP4: H.264, 1440x984, 24fps, 9.833s, 8,279,760 bytes, `video/mp4`.
- WebM fallback: VP9, 1440x984, 24fps, 9.834s, 9,922,139 bytes, `video/webm`.
- Browser source order changed to MP4 first because this source compressed smaller and cleaner as H.264 than VP9.
- Asset URLs include `?v=20260601-hires` so users do not remain on the cached 720px file.
- Dashboard playback now calls muted `video.play()` once after login view activation to avoid hidden-at-load autoplay stalls.
- Removed the old "actual personal note names are not exposed" wording because the provided company Obsidian video contains visible note titles.

## Local Verification

```text
node --check oracle/aimax-reports-api/server.js -> pass
node scripts/smoke_worker_catalog_contract.mjs -> WORKER_CATALOG_CONTRACT_SMOKE_OK
app.html inline scripts ok: 1
git diff --check -- oracle/aimax-reports-api/static/app.html -> pass
ffprobe mp4 -> 1440x984, h264, 24fps, 9.833s, no audio
ffprobe webm -> 1440x984, vp9, 24fps, 9.834s, no audio
local browser desktop 1440x900 -> MP4 selected, videoWidth=1440, videoHeight=984, readyState=4, paused=false, currentTime advanced
local browser mobile 390x844 -> MP4 selected, no horizontal overflow, paused=false, currentTime advanced
```

Evidence:

- `docs/testing/evidence/aimax-brain-video-replace-20260601/dashboard-video-local-large-clean.png`
- `docs/testing/evidence/aimax-brain-video-replace-20260601/dashboard-video-local-mobile.png`

## Remote Verification

```text
service -> active
remote app.html sha256 -> 6674ec091b970df529a4581fca55f02450282752eca0fa602b241c32af90d414
remote mp4 sha256 -> 7c983ee48442d3706064f14131dadf38c00c28c25af5b2d5ba27e4d3eccac8a9
remote webm sha256 -> 51f650f7dedead93b2a8c8cc57f5e8d62f195c034df3e341ef71a6ca4f9bac6b
production mp4 HEAD -> 200, content-type video/mp4, accept-ranges bytes, content-length 8279760
production webm HEAD -> 200, content-type video/webm, accept-ranges bytes, content-length 9922139
production mp4 Range bytes=0-1023 -> 206, content-range bytes 0-1023/8279760
production /app HTML -> MP4/WebM `?v=20260601-hires` sources and `ensureBrainVideoPlayback` present
production browser unauthenticated DOM -> video metadata ready, currentSrc points to MP4, videoWidth=1440, videoHeight=984
```

## Scope Notes

- No installer, version API, paid API, Apify, Gemini, OpenAI, Naver automation, or local runner behavior was changed.
- This was a targeted deploy of `app.html` and the two dashboard video assets only.
- Windows postdeploy browser verification handoff was prepared separately.
