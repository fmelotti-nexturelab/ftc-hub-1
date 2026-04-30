# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['nav_agent.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['win32com', 'win32com.client', 'win32com.server', 'win32com.server.util', 'win32gui', 'win32process', 'win32con', 'win32api', 'pywintypes', 'psutil', 'openpyxl', 'openpyxl.cell._writer'],
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
    a.binaries,
    a.datas,
    [],
    name='ftchub-nav-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
