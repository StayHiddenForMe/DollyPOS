================================================================================
  DOLLY POS - COMPLETE NEW LAPTOP SETUP & DISASTER RECOVERY GUIDE
  Dolly Toys & Kids Wear, Dhule
================================================================================

Target OS : Windows 10 / Windows 11 (64-Bit)
Database  : PostgreSQL 16 (64-Bit) with Local SQLite Zero-Config Fallback


================================================================================
1. FILES YOU NEED ON THE NEW LAPTOP
================================================================================

Copy the "dist_installer" folder onto your new laptop. It contains:

1. Setup_PostgreSQL_Database.bat  --> [STEP 1] Run this first (Installs PG16 & DB)
2. setup_database.ps1             --> Core engine script (Called automatically)
3. DollyToys_Publisher.cer        --> Digital Security Certificate
4. DollyPOS_Setup_v1.0.0.exe      --> [STEP 2] Run this second (Installs POS App)
5. newLaptopSetup_Readme.txt      --> This guide for quick reference


================================================================================
2. DEFAULT CREDENTIALS & DATABASE PARAMETERS
================================================================================

- Database Engine    : PostgreSQL 16 (64-bit)
- Database Name      : dollytoyskidswear
- Host / IP          : localhost or 127.0.0.1
- Port               : 5432
- Superuser          : postgres
- Database Password  : somesh123
- Encoding           : UTF8

- Owner POS Login    : Username: admin    | Password: somesh123
- Staff POS Login    : Username: staff    | Password: staff123


================================================================================
3. STEP-BY-STEP INSTALLATION INSTRUCTIONS
================================================================================

[STEP 1] RUN "Setup_PostgreSQL_Database.bat" (Database Setup)
------------------------------------------------------------
1. Right-click "Setup_PostgreSQL_Database.bat" and click "Run as administrator"
   (or double-click it).
2. If Windows asks for permission (UAC), click "Yes".
3. A terminal window will open and perform all 4 steps automatically:
   - Step 1: Detects existing PostgreSQL or checks if download is needed.
   - Step 2: Downloads official PostgreSQL 16 (~380MB) & installs silently.
   - Step 3: Starts the PostgreSQL Windows service.
   - Step 4: Creates the "dollytoyskidswear" database and verifies connection.
4. When you see the green success message, press ENTER to close the window.


[STEP 2] RUN "DollyPOS_Setup_v1.0.0.exe" (Application Setup)
-----------------------------------------------------------
1. Double-click "DollyPOS_Setup_v1.0.0.exe".
2. The installation wizard will extract all files and create:
   - Desktop Icon: "Dolly POS"
   - Start Menu Shortcut: "Dolly POS"
3. Click "Launch Dolly POS Now".
4. The software will open in Maximized App Mode directly to the login screen.
5. Check the bottom status bar: It will show "PostgreSQL Live (1ms)".
6. Log in with admin / somesh123.
7. You are ready for billing!


================================================================================
4. EXPECTED SCREEN PROMPTS & WHAT TO DO
================================================================================

- User Account Control (UAC) ("Do you want to allow this app..."):
  --> Click "Yes".

- Windows SmartScreen ("Windows protected your PC..."):
  --> Click "More info" --> Click "Run anyway".

- Windows Defender Firewall ("Allow access..."):
  --> Check "Private networks" --> Click "Allow access".


================================================================================
5. FILES & FOLDERS CREATED ON THE LAPTOP
================================================================================

Application Files:
- Main Program Folder: C:\Users\<Username>\AppData\Local\DollyPOS\
- Executable File    : C:\Users\<Username>\AppData\Local\DollyPOS\DollyPOS.exe
- Desktop Shortcut   : C:\Users\<Username>\Desktop\Dolly POS.lnk
- Start Menu Shortcut: C:\Users\<Username>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Dolly POS\

Database & Backups:
- PostgreSQL Storage : C:\Program Files\PostgreSQL\16\data\
- Automatic Backups  : C:\Users\<Username>\DollyPOS_Backups\
- SQLite Fallback    : C:\Users\<Username>\AppData\Local\DollyPOS\dollypos_local.db


================================================================================
6. TROUBLESHOOTING & COMMON SCENARIOS
================================================================================

Scenario A: PostgreSQL is already installed on the laptop
--> The script detects it automatically, skips downloading, and creates the
    "dollytoyskidswear" database.
    If your postgres password is not "somesh123", change it in pgAdmin 4 or run:
    psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'somesh123';"

Scenario B: Status bar shows "Local SQLite Live" instead of "PostgreSQL Live"
--> PostgreSQL service is stopped. Start it by opening CMD as Admin and running:
    net start postgresql-x64-16
    Then restart Dolly POS.

Scenario C: Restoring store data from old laptop to new laptop
--> 1. On old laptop: Settings -> Backup & Restore -> "Create Full Backup Now".
       Copy the .sql file to your pen drive.
    2. On new laptop: Settings -> Backup & Restore -> Upload .sql file ->
       Click "Restore Database". Done in 2 seconds!

Scenario D: Thermal Printer & Barcode Scanner Setup
--> 1. Thermal Printer: Plug USB -> Install manufacturer driver -> In Dolly POS
       Settings, select 80mm or 58mm.
    2. Barcode Scanner: Plug USB -> 100% Plug & Play (no driver needed).


================================================================================
7. QUICK COMMANDS (Run in PowerShell / CMD as Administrator)
================================================================================

Start PostgreSQL Service : net start postgresql-x64-16
Stop PostgreSQL Service  : net stop postgresql-x64-16
Test Connection          : psql -U postgres -h 127.0.0.1 -p 5432 -d dollytoyskidswear
Kill Running POS App     : taskkill /F /IM DollyPOS.exe

================================================================================
