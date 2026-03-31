# PyInstaller spec — FTC HUB NAV Agent
# Genera: dist/ftchub-nav-agent.exe
#
# Per buildare:
#   pip install pyinstaller
#   pyinstaller build.spec

a = Analysis(
    ["nav_agent.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="ftchub-nav-agent",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,       # nessuna finestra console
    disable_windowed_traceback=False,
    argv_emulation=False,
    icon=None,           # aggiungere icon.ico se disponibile
)
