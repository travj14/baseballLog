import os

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=[],
    datas=[
        ("ui", "ui"),
    ],
    hiddenimports=["webview"],
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
    [],
    exclude_binaries=True,
    name="BaseballLog",
    debug=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    name="BaseballLog",
)

if os.name != "nt":
    app = BUNDLE(
        coll,
        name="BaseballLog.app",
        bundle_identifier="com.baseballlog.app",
    )
