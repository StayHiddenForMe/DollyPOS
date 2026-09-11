import os
import sys
import time
import urllib.request
import threading
import webbrowser
import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure sys.stdout and sys.stderr are safe streams in windowed mode
class SafeNullStream:
    def write(self, text):
        pass
    def flush(self):
        pass
    def isatty(self):
        return False

if sys.stdout is None:
    sys.stdout = SafeNullStream()
if sys.stderr is None:
    sys.stderr = SafeNullStream()

# Setup base directory
if getattr(sys, "frozen", False):
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    FRONTEND_DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")
    if not os.path.exists(FRONTEND_DIST_DIR):
        FRONTEND_DIST_DIR = os.path.join(os.path.dirname(sys.executable), "frontend", "dist")
else:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    FRONTEND_DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.main import app as api_app
from app.config import settings

# Mount frontend static build
if os.path.exists(FRONTEND_DIST_DIR):
    assets_dir = os.path.join(FRONTEND_DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        api_app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @api_app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path == "health" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = os.path.join(FRONTEND_DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST_DIR, "index.html"))

import subprocess

def find_browser_exe():
    candidates = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def open_browser():
    """Wait for backend health endpoint, then open Chrome / default browser in true full-screen mode."""
    for _ in range(30):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.2)

    browser_exe = find_browser_exe()
    if browser_exe:
        try:
            subprocess.Popen([browser_exe, "--start-fullscreen", "http://127.0.0.1:8000"])
            return
        except Exception:
            pass
    webbrowser.open("http://127.0.0.1:8000")

def main():
    # 1. Start browser opener thread
    threading.Thread(target=open_browser, daemon=True).start()

    # 2. Configure and run Uvicorn server on main thread
    log_config = uvicorn.config.LOGGING_CONFIG.copy()
    if "formatters" in log_config:
        if "default" in log_config["formatters"]:
            log_config["formatters"]["default"]["use_colors"] = False
        if "access" in log_config["formatters"]:
            log_config["formatters"]["access"]["use_colors"] = False

    config = uvicorn.Config(
        app=api_app,
        host="127.0.0.1",
        port=8000,
        log_level="warning",
        log_config=log_config
    )
    server = uvicorn.Server(config)
    server.run()

if __name__ == "__main__":
    main()
