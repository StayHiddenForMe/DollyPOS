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
wizard_code = """
import os
import sys
import time
import zipfile
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
import threading

APP_NAME = "Dolly POS"
TARGET_DIR = os.path.expandvars(r"%LOCALAPPDATA%\\DollyPOS")

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
        progress_var.set(30)

        with zipfile.ZipFile(zip_path, "r") as zf:
            total_files = len(zf.namelist())
            for i, member in enumerate(zf.namelist()):
                zf.extract(member, TARGET_DIR)
                if i % 20 == 0:
                    prog = 30 + int((i / total_files) * 45)
                    progress_var.set(prog)

        status_var.set("Creating Desktop & Start Menu shortcuts...")
        progress_var.set(85)
        time.sleep(0.3)

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

        progress_var.set(100)
        status_var.set("Installation complete! Ready to launch.")
        time.sleep(0.5)
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
