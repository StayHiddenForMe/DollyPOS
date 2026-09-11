# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:/Users/SomeshBang/Desktop/Antigravity DollyPos/backend/desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[('C:/Users/SomeshBang/Desktop/Antigravity DollyPos/frontend/dist', 'frontend/dist'), ('C:/Users/SomeshBang/Desktop/Antigravity DollyPos/docs', 'docs')],
    hiddenimports=['webview', 'webview.platforms', 'webview.platforms.winforms', 'webview.platforms.edgechromium', 'clr_loader', 'pythonnet', 'uvicorn', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'fastapi', 'starlette', 'pydantic', 'pydantic_settings', 'reportlab', 'reportlab.platypus', 'reportlab.lib', 'reportlab.pdfgen', 'pandas', 'openpyxl', 'psycopg2', 'passlib', 'passlib.handlers', 'passlib.handlers.bcrypt', 'bcrypt', 'qrcode', 'barcode', 'sqlalchemy', 'sqlalchemy.dialects.postgresql', 'sqlalchemy.dialects.sqlite'],
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
    name='DollyPOS',
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
    name='DollyPOS',
)
