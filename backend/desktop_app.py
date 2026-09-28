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
    Prevents spawning duplicate instances.
    If Dolly POS is already alive on port 8000:
    - Launches/focuses the UI window for the user.
    - Exits the second process immediately (no duplicate PID).
    If port 8000 is held by an unresponsive zombie process:
    - Kills the zombie PID and allows this instance to start fresh.
    """
    if is_port_in_use(8000):
        try:
            req = urllib.request.Request("http://127.0.0.1:8000/health", headers={"User-Agent": "DollyPOS-Launcher"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    # Dolly POS is ALREADY RUNNING and healthy! Focus window & exit launcher.
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

        # Port 8000 is occupied but /health didn't respond (stale zombie process)
        cleanup_stale_zombies()
        time.sleep(1.0)

IS_SHUTTING_DOWN = False
SHUTDOWN_LOCK = threading.Lock()

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

def safe_fast_exit(server=None):
    """
    Guarantees instant process shutdown within 2.5 seconds with ZERO zombie PIDs.
    Runs fast on-close cloud sync in a daemon worker capped at 2.0s,
    then terminates the process completely via os._exit(0).
    """
    global IS_SHUTTING_DOWN
    with SHUTDOWN_LOCK:
        if IS_SHUTTING_DOWN:
            return
        IS_SHUTTING_DOWN = True

    if server:
        server.should_exit = True

    try:
        sync_thread = threading.Thread(target=perform_on_close_sync, daemon=True)
        sync_thread.start()
        sync_thread.join(timeout=2.0)
    except Exception:
        pass
    finally:
        os._exit(0)

def watchdog_monitor(server):
    """
    Monitors browser heartbeat.
    If the user closes the Chrome/Edge window (clicking [X], closing the tab, or killing the process),
    heartbeats stop. If 6 seconds elapse with no heartbeat, cleanly execute end-of-day cloud backup
    and terminate the process completely.
    """
    global LAST_HEARTBEAT_TIME, FIRST_HEARTBEAT_RECEIVED
    # Initial grace period for browser window to launch and begin sending heartbeats
    time.sleep(18)
    while True:
        time.sleep(1.5)
        if FIRST_HEARTBEAT_RECEIVED:
            if time.time() - LAST_HEARTBEAT_TIME > 6.0:
                safe_fast_exit(server)

def open_and_monitor_browser(server):
    """Wait for backend health endpoint, then open Chrome/Edge in app mode and monitor its lifecycle."""
    for _ in range(40):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.2)

    browser_exe = find_browser_exe()
    if browser_exe:
        try:
            profile_dir = os.path.join(tempfile.gettempdir(), "DollyPOS_BrowserProfile")
            os.makedirs(profile_dir, exist_ok=True)
            proc = subprocess.Popen([
                browser_exe,
                f"--user-data-dir={profile_dir}",
                "--disable-background-mode",
                "--disable-background-networking",
                "--disable-component-update",
                "--disable-sync",
                "--no-first-run",
                "--no-default-browser-check",
                "--start-maximized",
                "--app=http://127.0.0.1:8000"
            ])
            # Wait for user to close the app window
            proc.wait()
            # Once window is closed, immediately trigger fast shutdown
            safe_fast_exit(server)
            return
        except Exception:
            pass

    webbrowser.open("http://127.0.0.1:8000")

def main():
    # 1. Enforce Single Instance: focus existing if already running, or kill dead zombies on port 8000
    check_single_instance_or_focus()

    # 2. Configure Uvicorn server
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

    # 3. Start browser opener and process monitor thread
    threading.Thread(target=open_and_monitor_browser, args=(server,), daemon=True).start()

    # 4. Start watchdog monitor (terminates backend within 6s if UI window closes)
    threading.Thread(target=watchdog_monitor, args=(server,), daemon=True).start()

    # 5. Run Uvicorn server on main thread
    server.run()
    safe_fast_exit()

if __name__ == "__main__":
    main()
