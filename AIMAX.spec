# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules
from PyInstaller.utils.hooks import collect_all
from aimax_compliance import APP_VERSION

ROOT = Path(__file__).resolve().parent
BUNDLE_VERSION = APP_VERSION.removeprefix("v")

datas = [('config.yaml', '.'), ('assets', 'assets')]
binaries = []
hiddenimports = ['auth', 'aimax_compliance', 'browser', 'bulk', 'content', 'content.neighbor_message_ai', 'content.ai_text', 'content.gemini_text', 'content.gemini_image', 'content.openai_image', 'content.prompts', 'content.markdown_parser', 'engagement', 'engagement.neighbor_quota', 'engagement.auto_neighbor', 'local_agent', 'local_agent.runtime', 'local_agent.single_instance', 'diagnostics', 'diagnostics.error_reporter', 'diagnostics.redaction', 'diagnostics.system_info', 'posting', 'scraper', 'scraper.follower_scraper', 'utils', 'web_agent', 'web_agent.client', 'ttkbootstrap', 'ttkbootstrap.themes', 'selenium_stealth', 'google.genai', 'google.genai.types', 'anthropic', 'PIL._tkinter_finder', 'keyring.backends', 'undetected_chromedriver', 'undetected_chromedriver.patcher', 'yt_dlp', 'setuptools', 'setuptools._distutils', 'packaging', 'keyring.backends.macOS']
hiddenimports += collect_submodules('content')
hiddenimports += collect_submodules('diagnostics')
hiddenimports += collect_submodules('engagement')
hiddenimports += collect_submodules('local_agent')
hiddenimports += collect_submodules('scraper')
hiddenimports += collect_submodules('web_agent')
hiddenimports += collect_submodules('yt_dlp')
tmp_ret = collect_all('ttkbootstrap')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('selenium_stealth')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('undetected_chromedriver')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('google.genai')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('anthropic')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    [str(ROOT / 'app.py')],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[str(ROOT / 'hooks' / 'macos_tk_fix.py')],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='AIMAX',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='AIMAX',
)
app = BUNDLE(
    coll,
    name='AIMAX.app',
    icon=None,
    bundle_identifier='kr.makefamily.aimax',
    info_plist={
        'CFBundleDisplayName': 'AIMAX',
        'CFBundleName': 'AIMAX',
        'CFBundleShortVersionString': BUNDLE_VERSION,
        'CFBundleVersion': BUNDLE_VERSION,
        'CFBundleURLTypes': [
            {
                'CFBundleURLName': 'AIMAX Local Agent',
                'CFBundleURLSchemes': ['aimax'],
            },
        ],
        'NSHighResolutionCapable': True,
    },
)
