import os
import sys
import zipfile
import shutil
import subprocess

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
DIST_APP_DIR = os.path.join(BASE_DIR, "dist_app", "DollyPOS")
DIST_INSTALLER_DIR = os.path.join(BASE_DIR, "dist_installer")
os.makedirs(DIST_INSTALLER_DIR, exist_ok=True)

print("=" * 60)
print("  Building Single Standalone Installer: DollyPOS_Setup_v1.0.0.exe")
print("=" * 60)

# 1. Ensure dist_app/DollyPOS exists
if not os.path.exists(DIST_APP_DIR):
    print("Building base standalone app first...")
    subprocess.run([sys.executable, os.path.join(BACKEND_DIR, "build_standalone_exe.py")], check=True)

# 2. Compress dist_app/DollyPOS into zip payload
zip_payload_path = os.path.join(BACKEND_DIR, "app_payload.zip")
print(f"Compressing application payload into {zip_payload_path}...")
with zipfile.ZipFile(zip_payload_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(DIST_APP_DIR):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, DIST_APP_DIR)
            zf.write(file_path, arcname)

print("Compressed payload ready.")

# 3. Create Setup Wizard Python Script
wizard_code = r"""
import os
import sys
import time
import zipfile
import subprocess
import winreg
import tkinter as tk
from tkinter import ttk, messagebox
import threading

APP_NAME = "Dolly POS"
TARGET_DIR = os.path.expandvars(r"%LOCALAPPDATA%\\DollyPOS")

UNINSTALL_BAT_CONTENT = r'''@echo off
title Dolly POS - Uninstaller
echo ======================================================================
echo             Dolly Toys & Kids Wear - Dolly POS Uninstaller
echo ======================================================================
echo.
set /p CONFIRM="Are you sure you want to uninstall Dolly POS? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Uninstall cancelled.
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo Stopping any running Dolly POS processes...
taskkill /F /IM DollyPOS.exe /T >nul 2>&1

echo Removing Desktop and Start Menu Shortcuts...
del /f /q "%USERPROFILE%\\Desktop\\Dolly POS.lnk" >nul 2>&1
rd /s /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Dolly POS" >nul 2>&1

echo Removing Windows Control Panel Registration...
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DollyPOS" /f >nul 2>&1

echo.
echo ======================================================================
echo Dolly POS application files removed successfully!
echo [NOTE] Your database and store backups in "%USERPROFILE%\\DollyPOS_Backups"
echo have been safely preserved.
echo ======================================================================
echo.
pause

:: Cleanly remove installation directory in background after exit
start /b "" cmd /c "timeout /t 2 /nobreak >nul & rd /s /q \"%~dp0\" >nul 2>&1"
exit
'''

def register_windows_control_panel(target_dir, exe_path, uninstall_bat_path):
    try:
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, "Dolly POS - Retail Management")
            winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, "1.0.0")
            winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, "Dolly Toys & Kids Wear")
            winreg.SetValueEx(key, "InstallLocation", 0, winreg.REG_SZ, target_dir)
            winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, exe_path)
            winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'cmd.exe /c "{uninstall_bat_path}"')
            winreg.SetValueEx(key, "URLInfoAbout", 0, winreg.REG_SZ, "https://github.com/StayHiddenForMe/DollyPOS")
            winreg.SetValueEx(key, "NoModify", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "NoRepair", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "EstimatedSize", 0, winreg.REG_DWORD, 184320) # ~180MB
    except Exception as ex:
        print(f"Registry Warning: {ex}")

def extract_and_install(progress_var, status_var, root, on_complete):
    try:
        status_var.set("Preparing installation directory...")
        progress_var.set(10)
        time.sleep(0.3)

        os.makedirs(TARGET_DIR, exist_ok=True)

        if getattr(sys, "frozen", False):
            base_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
        else:
            base_dir = os.path.dirname(__file__)

        zip_path = os.path.join(base_dir, "app_payload.zip")
        if not os.path.exists(zip_path):
            messagebox.showerror("Installation Error", "Installation payload not found.")
            root.destroy()
            return

        status_var.set("Extracting Dolly POS files...")
        progress_var.set(25)

        with zipfile.ZipFile(zip_path, "r") as zf:
            total_files = len(zf.namelist())
            for i, member in enumerate(zf.namelist()):
                zf.extract(member, TARGET_DIR)
                if i % 20 == 0:
                    prog = 25 + int((i / total_files) * 50)
                    progress_var.set(prog)

        status_var.set("Creating Desktop & Start Menu shortcuts...")
        progress_var.set(80)
        time.sleep(0.2)

        exe_path = os.path.join(TARGET_DIR, "DollyPOS.exe")
        desktop_dir = os.path.expandvars(r"%USERPROFILE%\\Desktop")
        desktop_shortcut = os.path.join(desktop_dir, "Dolly POS.lnk")

        # Create Desktop Shortcut via PowerShell
        ps_cmd = f"$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{desktop_shortcut}'); $s.TargetPath = '{exe_path}'; $s.WorkingDirectory = '{TARGET_DIR}'; $s.Description = 'Dolly Toys & Kids Wear POS System'; $s.Save()"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], creationflags=0x08000000)

        # Create Start Menu Shortcut
        start_dir = os.path.expandvars(r"%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Dolly POS")
        os.makedirs(start_dir, exist_ok=True)
        start_shortcut = os.path.join(start_dir, "Dolly POS.lnk")
        ps_cmd2 = f"$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{start_shortcut}'); $s.TargetPath = '{exe_path}'; $s.WorkingDirectory = '{TARGET_DIR}'; $s.Description = 'Dolly Toys & Kids Wear POS System'; $s.Save()"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd2], creationflags=0x08000000)

        # Write uninstall.bat into TARGET_DIR
        uninstall_bat_path = os.path.join(TARGET_DIR, "uninstall.bat")
        with open(uninstall_bat_path, "w", encoding="utf-8") as f:
            f.write(UNINSTALL_BAT_CONTENT.strip())

        # Create Uninstall Start Menu Shortcut
        uninstall_shortcut = os.path.join(start_dir, "Uninstall Dolly POS.lnk")
        ps_cmd3 = f"$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{uninstall_shortcut}'); $s.TargetPath = '{uninstall_bat_path}'; $s.WorkingDirectory = '{TARGET_DIR}'; $s.Description = 'Uninstall Dolly POS'; $s.Save()"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd3], creationflags=0x08000000)

        # Ensure .env configuration is copied or preserved in TARGET_DIR
        target_env = os.path.join(TARGET_DIR, ".env")
        if not os.path.exists(target_env):
            installer_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(__file__)
            installer_env = os.path.join(installer_dir, ".env")
            cwd_env = os.path.join(os.getcwd(), ".env")
            backup_env = os.path.expandvars(r"%USERPROFILE%\DollyPOS_Backups\.env")
            
            if os.path.exists(installer_env):
                shutil.copy2(installer_env, target_env)
            elif os.path.exists(cwd_env):
                shutil.copy2(cwd_env, target_env)
            elif os.path.exists(backup_env):
                shutil.copy2(backup_env, target_env)
            else:
                with open(target_env, "w", encoding="utf-8") as fe:
                    fe.write("DB_USER=postgres\nDB_PASSWORD=somesh123\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_NAME=dollytoyskidswear\n")

        # Register in Windows Control Panel (Programs and Features / Installed Apps)
        status_var.set("Registering with Windows Control Panel...")
        progress_var.set(92)
        time.sleep(0.2)
        register_windows_control_panel(TARGET_DIR, exe_path, uninstall_bat_path)

        progress_var.set(100)
        status_var.set("Installation complete! Ready to launch.")
        time.sleep(0.4)
        on_complete(exe_path)
    except Exception as ex:
        messagebox.showerror("Installation Error", f"Failed to install: {ex}")
        root.destroy()

def main():
    root = tk.Tk()
    root.title("Dolly POS - Setup & Installation Wizard")
    root.geometry("480x280")
    root.resizable(False, False)
    root.configure(bg="#0F172A")

    # Center window
    root.eval('tk::PlaceWindow . center')

    title_label = tk.Label(root, text="Dolly Toys & Kids Wear", font=("Helvetica", 16, "bold"), fg="#DB2777", bg="#0F172A")
    title_label.pack(pady=(20, 2))

    sub_label = tk.Label(root, text="POS & Retail System Installation Wizard", font=("Helvetica", 10), fg="#94A3B8", bg="#0F172A")
    sub_label.pack(pady=(0, 20))

    progress_var = tk.DoubleVar(value=0)
    status_var = tk.StringVar(value="Initializing setup wizard...")

    status_label = tk.Label(root, textvariable=status_var, font=("Helvetica", 9), fg="#E2E8F0", bg="#0F172A")
    status_label.pack(pady=(0, 8))

    style = ttk.Style()
    style.theme_use('clam')
    style.configure("Pink.Horizontal.TProgressbar", foreground="#DB2777", background="#DB2777", troughcolor="#1E293B", thickness=14)

    prog_bar = ttk.Progressbar(root, variable=progress_var, maximum=100, style="Pink.Horizontal.TProgressbar", length=400)
    prog_bar.pack(pady=(0, 20))

    btn_frame = tk.Frame(root, bg="#0F172A")
    btn_frame.pack(fill="x", padx=40)

    def on_complete(exe_path):
        def launch_now():
            subprocess.Popen([exe_path], cwd=TARGET_DIR)
            root.destroy()

        for w in btn_frame.winfo_children():
            w.destroy()

        launch_btn = tk.Button(btn_frame, text="Launch Dolly POS Now", font=("Helvetica", 10, "bold"), bg="#DB2777", fg="white", activebackground="#BE185D", activeforeground="white", relief="flat", padx=15, pady=8, cursor="hand2", command=launch_now)
        launch_btn.pack(side="right")

        close_btn = tk.Button(btn_frame, text="Close", font=("Helvetica", 10), bg="#334155", fg="white", activebackground="#475569", activeforeground="white", relief="flat", padx=15, pady=8, cursor="hand2", command=root.destroy)
        close_btn.pack(side="left")

    threading.Thread(target=extract_and_install, args=(progress_var, status_var, root, on_complete), daemon=True).start()

    root.mainloop()

if __name__ == "__main__":
    main()
"""

wizard_path = os.path.join(BACKEND_DIR, "setup_wizard_script.py")
with open(wizard_path, "w", encoding="utf-8") as f:
    f.write(wizard_code.strip())

# 4. Compile Setup Wizard into Single Standalone Executable with PyInstaller
print("Compiling Single Standalone Installer (.exe)...")
cmd = [
    sys.executable, "-m", "PyInstaller",
    "--noconfirm",
    "--onefile",
    "--windowed",
    "--name", "DollyPOS_Setup_v1.0.0",
    "--distpath", DIST_INSTALLER_DIR,
    "--workpath", os.path.join(BACKEND_DIR, "build_installer"),
    "--specpath", BACKEND_DIR,
    f"--add-data={zip_payload_path};.",
    wizard_path
]

res = subprocess.run(cmd, cwd=BACKEND_DIR)
if res.returncode == 0:
    setup_exe = os.path.join(DIST_INSTALLER_DIR, "DollyPOS_Setup_v1.0.0.exe")
    print(f"\n[SUCCESS] Single Standalone Installer created at: {setup_exe}")
else:
    print(f"\n[FAILED] PyInstaller exited with code {res.returncode}")
