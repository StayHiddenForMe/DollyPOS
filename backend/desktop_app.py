import os
import sys
import time
import urllib.request
import threading
import uvicorn
import webview
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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

def run_uvicorn_server():
    """Run uvicorn backend server."""
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

def wait_for_server():
    """Poll health endpoint until server is ready."""
    for _ in range(30):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.2)
    return False

def main():
    # 1. Start backend server in a background daemon thread
    server_thread = threading.Thread(target=run_uvicorn_server, daemon=True)
    server_thread.start()

    # 2. Wait for backend to be ready
    wait_for_server()

    # 3. Create and launch Native Desktop Application Window
    window = webview.create_window(
        title="Dolly Toys & Kids Wear - POS System",
        url="http://127.0.0.1:8000",
        width=1366,
        height=820,
        min_size=(1024, 700),
        confirm_close=False,
        text_select=True
    )

    # 4. Start GUI event loop
    webview.start(gui="edgechromium", debug=False)

if __name__ == "__main__":
    main()
