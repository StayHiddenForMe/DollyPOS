@echo off
:: BatchGotAdmin
:-------------------------------------
REM --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting Administrative Privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*:"=""
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

title Dolly POS - Unblock Shop Wi-Fi Connection
color 0a
cls
echo =====================================================================
echo          DOLLY POS - ONE-CLICK LOCAL WI-FI UNBLOCK UTILITY
echo =====================================================================
echo.
echo 1. Configuring Windows Firewall to allow incoming Port 8000...
netsh advfirewall firewall delete rule name="DollyPOS Port 8000" >nul 2>&1
netsh advfirewall firewall add rule name="DollyPOS Port 8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1
if %errorlevel% equ 0 (
    echo    [SUCCESS] Inbound Port 8000 allowed in Windows Firewall!
) else (
    echo    [WARNING] Could not add firewall rule automatically.
)

echo.
echo 2. Setting current Wi-Fi profile to 'Private' (allows LAN devices to connect)...
powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private" >nul 2>&1
if %errorlevel% equ 0 (
    echo    [SUCCESS] Wi-Fi network profile set to Private!
) else (
    echo    [INFO] Wi-Fi profile left unchanged.
)

echo.
echo 3. Checking your current Laptop IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr "192.168"') do (
    set LAPTOP_IP=%%a
)
set LAPTOP_IP=%LAPTOP_IP: =%

echo    Your Laptop IP Address is: %LAPTOP_IP%
echo.
echo =====================================================================
echo                       HOW TO TEST FROM PHONE
echo =====================================================================
echo.
echo 1. Ensure your phone is connected to the SAME shop Wi-Fi as this laptop.
echo 2. Open Google Chrome or Safari on your phone.
echo 3. Enter this test address in the browser bar:
echo.
echo       http://%LAPTOP_IP%:8000/api/v1/mobile/network-info
echo.
echo If you see: {"shop_name":"Dolly Toys & Kids Wear", "status":"ONLINE"}
echo it means your phone and laptop can communicate directly!
echo.
echo =====================================================================
pause
