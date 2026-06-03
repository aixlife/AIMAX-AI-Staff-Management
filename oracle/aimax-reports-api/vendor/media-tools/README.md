# AIMAX media tool bundle

Songi video-file analysis needs `yt-dlp` for video download and `ffmpeg` for frame extraction.

Windows x64 release builds should place the tools here:

```text
oracle/aimax-reports-api/vendor/media-tools/win32/x64/yt-dlp.exe
oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffmpeg.exe
oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffprobe.exe
```

Use:

```powershell
.\scripts\fetch_windows_media_tools.ps1
```

The reports API prefers explicit environment variables first:

- `AIMAX_SONGI_YTDLP_PATH`
- `AIMAX_SONGI_FFMPEG_PATH`

When those variables are not set, the API searches this bundled directory before falling back to `PATH`.

Distribution note: use an FFmpeg build whose license terms are acceptable for the release channel. The helper script currently downloads the BtbN LGPL Windows x64 build.
