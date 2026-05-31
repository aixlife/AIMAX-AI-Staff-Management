param(
  [ValidateSet("User", "Repo")]
  [string]$InstallScope = "User",
  [string]$TargetDir = "",
  [switch]$KeepDownloads
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $TargetDir) {
  if ($InstallScope -eq "Repo") {
    $TargetDir = Join-Path $RepoRoot "oracle\aimax-reports-api\vendor\media-tools\win32\x64"
  } else {
    $localAppData = $env:LOCALAPPDATA
    if (-not $localAppData) {
      $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
    }
    if (-not $localAppData) {
      throw "LOCALAPPDATA is not available; pass -TargetDir explicitly."
    }
    $TargetDir = Join-Path $localAppData "AIMAX\media-tools\win32\x64"
  }
}
$TargetDir = [System.IO.Path]::GetFullPath($TargetDir)
$DownloadDir = Join-Path $env:TEMP ("aimax-media-tools-" + [System.Guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
New-Item -ItemType Directory -Path $DownloadDir -Force | Out-Null

$ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
$ffmpegUrls = @(
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-lgpl-7.1.zip",
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip",
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-05-18-18-09/ffmpeg-n7.1.4-5-ged860ef7d9-win64-lgpl-7.1.zip"
)

function Download-File {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$OutFile
  )
  Write-Host "[download] $Url"
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & $curl.Source -L --fail --connect-timeout 30 --max-time 300 -o $OutFile $Url
    if ($LASTEXITCODE -ne 0) {
      throw "curl.exe failed with exit code $LASTEXITCODE"
    }
  } else {
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 300
  }
  $file = Get-Item -LiteralPath $OutFile -ErrorAction Stop
  if ($file.Length -lt 1024) {
    throw "Downloaded file is unexpectedly small: $($file.Length) bytes"
  }
}

function First-Line {
  param([string[]]$Lines)
  foreach ($line in $Lines) {
    if ($line -and $line.Trim()) {
      return $line.Trim()
    }
  }
  return ""
}

function File-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

try {
  $ytDlpPath = Join-Path $TargetDir "yt-dlp.exe"
  Download-File -Url $ytDlpUrl -OutFile $ytDlpPath

  $ffmpegZip = Join-Path $DownloadDir "ffmpeg.zip"
  $downloadedFfmpeg = $false
  foreach ($url in $ffmpegUrls) {
    try {
      Download-File -Url $url -OutFile $ffmpegZip
      $downloadedFfmpeg = $true
      break
    } catch {
      Write-Warning ("FFmpeg download failed: " + $_.Exception.Message)
    }
  }
  if (-not $downloadedFfmpeg) {
    throw "Unable to download FFmpeg LGPL Windows build from configured URLs."
  }

  $extractDir = Join-Path $DownloadDir "ffmpeg"
  Expand-Archive -LiteralPath $ffmpegZip -DestinationPath $extractDir -Force
  $ffmpegExe = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
  $ffprobeExe = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter "ffprobe.exe" | Select-Object -First 1
  if (-not $ffmpegExe) {
    throw "ffmpeg.exe was not found in the downloaded FFmpeg archive."
  }
  Copy-Item -LiteralPath $ffmpegExe.FullName -Destination (Join-Path $TargetDir "ffmpeg.exe") -Force
  if ($ffprobeExe) {
    Copy-Item -LiteralPath $ffprobeExe.FullName -Destination (Join-Path $TargetDir "ffprobe.exe") -Force
  }

  $ffmpegPath = Join-Path $TargetDir "ffmpeg.exe"
  $ffprobePath = Join-Path $TargetDir "ffprobe.exe"
  $ytVersion = First-Line (& (Join-Path $TargetDir "yt-dlp.exe") --version 2>&1)
  $ffmpegVersion = First-Line (& $ffmpegPath -version 2>&1)
  $manifest = [ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    install_scope = $InstallScope
    target_dir = $TargetDir
    yt_dlp = [ordered]@{
      url = $ytDlpUrl
      path = "yt-dlp.exe"
      version = $ytVersion
      sha256 = File-Sha256 -Path $ytDlpPath
      size_bytes = (Get-Item -LiteralPath $ytDlpPath).Length
    }
    ffmpeg = [ordered]@{
      urls_tried = $ffmpegUrls
      path = "ffmpeg.exe"
      ffprobe_path = if ($ffprobeExe) { "ffprobe.exe" } else { "" }
      version = $ffmpegVersion
      build_family = "BtbN LGPL Windows x64"
      sha256 = File-Sha256 -Path $ffmpegPath
      size_bytes = (Get-Item -LiteralPath $ffmpegPath).Length
      ffprobe_sha256 = if (Test-Path -LiteralPath $ffprobePath) { File-Sha256 -Path $ffprobePath } else { "" }
      ffprobe_size_bytes = if (Test-Path -LiteralPath $ffprobePath) { (Get-Item -LiteralPath $ffprobePath).Length } else { 0 }
    }
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $TargetDir "manifest.json") -Encoding UTF8

  Write-Host "[ok] media tools installed in $TargetDir"
  Write-Host "[ok] install scope: $InstallScope"
  Write-Host "[ok] yt-dlp: $ytVersion"
  Write-Host "[ok] ffmpeg: $ffmpegVersion"
} finally {
  if (-not $KeepDownloads) {
    Remove-Item -LiteralPath $DownloadDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
