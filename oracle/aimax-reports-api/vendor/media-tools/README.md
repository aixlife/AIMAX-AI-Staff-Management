# AIMAX media tool bundle

Songi video-file analysis needs `yt-dlp` for video download and `ffmpeg` for frame extraction.

Windows x64 on-demand installs should place the tools here by default:

```text
%LOCALAPPDATA%\AIMAX\media-tools\win32\x64\yt-dlp.exe
%LOCALAPPDATA%\AIMAX\media-tools\win32\x64\ffmpeg.exe
%LOCALAPPDATA%\AIMAX\media-tools\win32\x64\ffprobe.exe
```

The old bundled release location is still supported as a fallback:

```text
oracle/aimax-reports-api/vendor/media-tools/win32/x64/yt-dlp.exe
oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffmpeg.exe
oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffprobe.exe
```

Use:

```powershell
.\scripts\fetch_windows_media_tools.ps1
```

This installs into the user-writable on-demand cache. For an intentional
repo-local/bundled test only, use `-InstallScope Repo`.

The reports API prefers explicit environment variables first:

- `AIMAX_SONGI_YTDLP_PATH`
- `AIMAX_SONGI_FFMPEG_PATH`
- `AIMAX_MEDIA_TOOLS_DIR`

When those variables are not set, the API searches the on-demand user cache,
then the bundled directory, then falls back to `PATH`.

Distribution note: use an FFmpeg build whose license terms are acceptable for the release channel. The helper script currently downloads the BtbN LGPL Windows x64 build.
