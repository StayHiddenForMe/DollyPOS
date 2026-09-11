import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
DIST_EXE_DIR = os.path.join(BASE_DIR, "dist_app")

os.makedirs(DIST_EXE_DIR, exist_ok=True)

print("=" * 60)
print("  Dolly POS - Building Standalone Windows Executable (.exe)")
print("=" * 60)

# 1. Verify frontend dist exists
if not os.path.exists(FRONTEND_DIST):
    print("Building frontend production bundle...")
    subprocess.run("npm run build", cwd=os.path.join(BASE_DIR, "frontend"), shell=True, check=True)

# 2. PyInstaller command
cmd = [
    sys.executable, "-m", "PyInstaller",
    "--noconfirm",
    "--onedir",
    "--windowed", # No black console window
    "--name", "DollyPOS",
    "--distpath", DIST_EXE_DIR,
    "--workpath", os.path.join(BACKEND_DIR, "build"),
    "--specpath", BACKEND_DIR,
    f"--add-data={FRONTEND_DIST};frontend/dist",
    f"--add-data={DOCS_DIR};docs",
    "--hidden-import=uvicorn",
    "--hidden-import=uvicorn.logging",
    "--hidden-import=uvicorn.loops",
    "--hidden-import=uvicorn.loops.auto",
    "--hidden-import=uvicorn.protocols",
    "--hidden-import=uvicorn.protocols.http",
    "--hidden-import=uvicorn.protocols.http.auto",
    "--hidden-import=uvicorn.protocols.websockets",
    "--hidden-import=uvicorn.protocols.websockets.auto",
    "--hidden-import=uvicorn.lifespans",
    "--hidden-import=uvicorn.lifespans.on",
    "--hidden-import=fastapi",
    "--hidden-import=starlette",
    "--hidden-import=pydantic",
    "--hidden-import=pydantic_settings",
    "--hidden-import=reportlab",
    "--hidden-import=reportlab.platypus",
    "--hidden-import=reportlab.lib",
    "--hidden-import=reportlab.pdfgen",
    "--hidden-import=pandas",
    "--hidden-import=openpyxl",
    "--hidden-import=psycopg2",
    "--hidden-import=passlib",
    "--hidden-import=passlib.handlers",
    "--hidden-import=passlib.handlers.bcrypt",
    "--hidden-import=bcrypt",
    "--hidden-import=qrcode",
    "--hidden-import=barcode",
    "--hidden-import=sqlalchemy",
    "--hidden-import=sqlalchemy.dialects.postgresql",
    "--hidden-import=sqlalchemy.dialects.sqlite",
    os.path.join(BACKEND_DIR, "desktop_app.py")
]

print("Executing PyInstaller compilation...")
res = subprocess.run(cmd, cwd=BACKEND_DIR)
if res.returncode == 0:
    print("\n[SUCCESS] Standalone DollyPOS package built successfully in dist_app/DollyPOS/")
    exe_path = os.path.join(DIST_EXE_DIR, "DollyPOS", "DollyPOS.exe")
    print(f"Target Executable: {exe_path}")
else:
    print(f"\n[FAILED] PyInstaller exited with code {res.returncode}")
