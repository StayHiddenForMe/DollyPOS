import os
import sys
import io
import webbrowser
import threading
import time

# --- WINDOWS GUI / FROZEN STREAMS SAFETY ---
# In PyInstaller windowed mode, sys.stdout/stderr are None, causing logging formatters to crash.
class SafeNullStream:
    def write(self, s):
        pass
    def flush(self):
        pass
    def isatty(self):
        return False

if sys.stdout is None or not hasattr(sys.stdout, "isatty"):
    sys.stdout = SafeNullStream()
if sys.stderr is None or not hasattr(sys.stderr, "isatty"):
    sys.stderr = SafeNullStream()

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Determine base directory for both frozen PyInstaller binary and normal script
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

# Mount frontend static build if it exists
if os.path.exists(FRONTEND_DIST_DIR):
    assets_dir = os.path.join(FRONTEND_DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        api_app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Catch-all route to serve SPA index.html for client-side routing
    @api_app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path == "health" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = os.path.join(FRONTEND_DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST_DIR, "index.html"))

def open_browser():
    """Wait for server to start and open default browser window."""
    time.sleep(1.8)
    url = "http://127.0.0.1:8000"
    try:
        webbrowser.open(url)
    except Exception:
        pass

def main():
    # Start browser in separate daemon thread
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # Configure uvicorn logging safely without terminal colors requirement
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
        log_level="info",
        log_config=log_config
    )
    server = uvicorn.Server(config)
    server.run()

if __name__ == "__main__":
    main()
