# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
from PyInstaller.utils.hooks import collect_all

datas = [('config.yaml', '.'), ('assets', 'assets')]
binaries = []
hiddenimports = ['aimax_compliance', 'auth', 'browser', 'bulk', 'content', 'content.neighbor_message_ai', 'content.ai_text', 'content.gemini_text', 'content.gemini_image', 'content.prompts', 'content.markdown_parser', 'engagement', 'engagement.neighbor_quota', 'engagement.auto_neighbor', 'posting', 'scraper', 'scraper.follower_scraper', 'utils', 'ttkbootstrap', 'ttkbootstrap.themes', 'selenium_stealth', 'google.genai', 'google.genai.types', 'anthropic', 'PIL._tkinter_finder', 'keyring.backends', 'undetected_chromedriver', 'undetected_chromedriver.patcher', 'setuptools', 'setuptools._distutils', 'packaging', 'keyring.backends.Windows']
hiddenimports += collect_submodules('content')
hiddenimports += collect_submodules('engagement')
hiddenimports += collect_submodules('scraper')
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
    ['app.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
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
