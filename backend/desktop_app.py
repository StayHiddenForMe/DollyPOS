import os
import sys
import webbrowser
import threading
import time
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware

# Ensure app package is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app as api_app, lifespan
from app.config import settings

# Path to built frontend
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

# Mount frontend static build if it exists
if os.path.exists(FRONTEND_DIST_DIR):
    # Assets directory
    assets_dir = os.path.join(FRONTEND_DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        api_app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Catch-all route to serve SPA index.html for client-side routing
    @api_app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If requested path is an API route, let router handle it
        if full_path.startswith("api") or full_path == "health" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = os.path.join(FRONTEND_DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST_DIR, "index.html"))

def open_browser():
    """Wait for server to start and open default browser window."""
    time.sleep(1.5)
    url = "http://127.0.0.1:8000"
    print(f"Launching Dolly POS Desktop Interface at {url}...")
    webbrowser.open(url)

def main():
    print("=" * 60)
    print("  Dolly Toys & Kids Wear - POS & Retail Management System")
    print("  Starting Standalone Server on http://127.0.0.1:8000...")
    print("=" * 60)
    
    # Start browser in separate daemon thread
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # Run uvicorn server
    uvicorn.run(api_app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()
