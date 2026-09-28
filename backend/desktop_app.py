import os
import sys
import time
import socket
import urllib.request
import threading
import webbrowser
import subprocess
import tempfile
import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import multiprocessing
import traceback

BOOT_LOG = os.path.join(tempfile.gettempdir(), "dollypos_boot.log")
try:
    log_fp = open(BOOT_LOG, "a", buffering=1, encoding="utf-8", errors="replace")
except Exception:
    log_fp = None

def log_boot(msg):
    try:
        if log_fp:
            log_fp.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
            log_fp.flush()
    except Exception:
        pass

if log_fp:
    sys.stdout = log_fp
    sys.stderr = log_fp

if sys.stdin is None:
    try:
        sys.stdin = open(os.devnull, "r")
    except Exception:
        pass

log_boot(f"=== DollyPOS Starting (frozen={getattr(sys, 'frozen', False)}) ===")

try:
    log_boot("Resolving BASE_DIR and paths...")
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

    log_boot(f"BASE_DIR={BASE_DIR}, sys.path={sys.path[:3]}")
    log_boot("Importing app.main...")
    from app.main import app as api_app
    log_boot("Importing app.config...")
    from app.config import settings
    log_boot("Module imports successful.")
except BaseException as e:
    log_boot(f"FATAL MODULE IMPORT ERROR ({type(e).__name__}): {e}\n{traceback.format_exc()}")
    raise


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

# -------------------------------------------------------------
# Heartbeat & Liveness State
# -------------------------------------------------------------
LAST_HEARTBEAT_TIME = time.time()
FIRST_HEARTBEAT_RECEIVED = False

@api_app.post("/api/v1/system/heartbeat")
def desktop_heartbeat():
    global LAST_HEARTBEAT_TIME, FIRST_HEARTBEAT_RECEIVED
    LAST_HEARTBEAT_TIME = time.time()
    FIRST_HEARTBEAT_RECEIVED = True
    return {"status": "alive"}

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

def is_port_in_use(port=8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_process_on_port(port=8000):
    """Terminates stale zombie processes holding port 8000 on Windows."""
    try:
        output = subprocess.check_output('netstat -ano -p tcp', shell=True).decode()
        current_pid = os.getpid()
        for line in output.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                if pid and pid.isdigit() and int(pid) != current_pid:
                    subprocess.call(f'taskkill /F /PID {pid}', shell=True)
    except Exception:
        pass

def cleanup_stale_zombies():
    """Kills orphan processes holding port 8000 and orphan DollyPOS.exe processes from earlier crashes."""
    kill_process_on_port(8000)
    try:
        current_pid = os.getpid()
        output = subprocess.check_output('tasklist /FI "IMAGENAME eq DollyPOS.exe" /FO CSV /NH', shell=True).decode()
        for line in output.splitlines():
            parts = line.strip().replace('"', '').split(',')
            if len(parts) >= 2 and parts[0].lower() == 'dollypos.exe':
                pid_str = parts[1].strip()
                if pid_str.isdigit() and int(pid_str) != current_pid:
                    subprocess.call(f'taskkill /F /PID {pid_str}', shell=True)
    except Exception:
        pass

def check_single_instance_or_focus():
    """
    Prevents spawning duplicate instances while ensuring stale orphans are cleared.
    If Dolly POS is already alive on port 8000 AND actively serving the UI:
    - Focuses the UI window for the user and exits the launcher process.
    If port 8000 is held by an orphaned terminal or stale zombie:
    - Kills the zombie on port 8000 so this instance starts cleanly.
    """
    if is_port_in_use(8000):
        try:
            req = urllib.request.Request("http://127.0.0.1:8000/", headers={"User-Agent": "DollyPOS-Launcher"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                content = resp.read(200).decode(errors="ignore")
                if resp.status == 200 and ("<html" in content.lower() or "<!doctype" in content.lower()):
                    # An active, functional DollyPOS UI is ALREADY running! Focus window and exit.
                    browser_exe = find_browser_exe()
                    if browser_exe:
                        subprocess.Popen([
                            browser_exe,
                            "--no-first-run",
                            "--no-default-browser-check",
                            "--disable-background-mode",
                            "--app=http://127.0.0.1:8000"
                        ])
                    else:
                        webbrowser.open("http://127.0.0.1:8000")
                    sys.exit(0)
        except Exception:
            pass

        # Port 8000 is occupied by a stale/broken process or orphan that cannot serve UI. Kill it!
        cleanup_stale_zombies()
        time.sleep(1.0)

def perform_on_close_sync():
    """Executes on-close Cloud Hub sync and local database snapshot."""
    try:
        from app.core.database import SessionLocal
        from app.services.backup_service import backup_service
        exit_db = SessionLocal()
        try:
            backup_service.handle_on_close_backup(exit_db)
        finally:
            exit_db.close()
    except Exception:
        pass

def open_browser():
    """Wait for backend health endpoint, then open Chrome/Edge in app mode."""
    for _ in range(120):  # Wait up to 24s for PostgreSQL connection & migrations
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as resp:
                if resp.status == 200:
                    log_boot("open_browser(): Backend is healthy on port 8000.")
                    break
        except Exception:
            time.sleep(0.2)

    browser_exe = find_browser_exe()
    if browser_exe:
        try:
            profile_dir = os.path.join(tempfile.gettempdir(), "DollyPOS_BrowserProfile")
            os.makedirs(profile_dir, exist_ok=True)
            log_boot(f"open_browser(): Launching browser {browser_exe}...")
            subprocess.Popen([
                browser_exe,
                f"--user-data-dir={profile_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--start-maximized",
                "--app=http://127.0.0.1:8000"
            ])
            log_boot("open_browser(): Browser launched successfully.")
            return
        except Exception as e:
            log_boot(f"open_browser(): Browser launch error: {e}")

    log_boot("open_browser(): Falling back to webbrowser.open...")
    webbrowser.open("http://127.0.0.1:8000")

def main():
    log_boot("main() entered")
    # 1. Enforce Single Instance: focus existing if already running, or kill dead zombies on port 8000
    log_boot("Running check_single_instance_or_focus()...")
    check_single_instance_or_focus()
    log_boot("Single instance check passed.")

    # 2. Start browser opener thread
    log_boot("Starting open_browser thread...")
    threading.Thread(target=open_browser, daemon=True).start()

    # 3. Configure Uvicorn server
    log_boot("Configuring Uvicorn server...")
    log_config = uvicorn.config.LOGGING_CONFIG.copy()
    if "formatters" in log_config:
        if "default" in log_config["formatters"]:
            log_config["formatters"]["default"]["use_colors"] = False
        if "access" in log_config["formatters"]:
            log_config["formatters"]["access"]["use_colors"] = False

    config = uvicorn.Config(
        app=api_app,
        host="0.0.0.0",
        port=8000,
        log_level="warning",
        log_config=log_config
    )
    server = uvicorn.Server(config)

    # 4. Run Uvicorn server on main thread - stays permanently running
    try:
        log_boot("Calling server.run()...")
        server.run()
        log_boot(f"server.run() returned. server.started={server.started}")
    except BaseException as e:
        log_boot(f"server.run() exited with {type(e).__name__}: {e}\n{traceback.format_exc()}")
    finally:
        log_boot("Running perform_on_close_sync()...")
        perform_on_close_sync()
        log_boot("perform_on_close_sync() finished.")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    try:
        main()
    except BaseException as e:
        log_boot(f"FATAL IN __MAIN__ ({type(e).__name__}): {e}\n{traceback.format_exc()}")



