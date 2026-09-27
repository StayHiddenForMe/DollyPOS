@echo off
title Dolly POS - Mobile Companion Server
color 0B
cls
echo ======================================================================
echo           DOLLY POS - MOBILE EXECUTIVE COMPANION
echo ======================================================================
echo.
echo  Choose how to connect your phone:
echo.
echo   [1] Tunnel Mode (RECOMMENDED - Works on any Wi-Fi or 4G/5G,
echo       bypasses Windows Firewall and router isolation)
echo.
echo   [2] Local LAN Wi-Fi Mode (Requires same Wi-Fi with no router isolation)
echo.
echo   [3] Clear Cache & Restart (Fixes stale bundler state)
echo.
echo ======================================================================
set /p choice="Enter choice (1, 2, or 3) [Default: 1]: "

if "%choice%"=="" set choice=1

cd /d "%~dp0mobile"

if "%choice%"=="1" (
    echo.
    echo Starting Expo in TUNNEL mode...
    echo (Scan the QR code in Expo Go app on your phone)
    call npx expo start --tunnel -c
) else if "%choice%"=="2" (
    echo.
    echo Starting Expo in LOCAL LAN mode...
    echo (Make sure Windows Firewall allows Node.js on Private networks)
    call npx expo start -c
) else if "%choice%"=="3" (
    echo.
    echo Clearing Expo cache and restarting...
    call npx expo start -c --tunnel
) else (
    call npx expo start --tunnel -c
)

pause
