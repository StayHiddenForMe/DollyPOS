@echo off
title Dolly POS - Remote API Tunnel (Port 8000)
color 0A
cls
echo ======================================================================
echo           DOLLY POS - REMOTE BACKEND TUNNEL
echo ======================================================================
echo.
echo  This creates a secure HTTPS tunnel for your Dolly POS Backend (Port 8000).
echo  Use this if your phone is on Mobile Data (4G/5G) or Windows Firewall
echo  is blocking local Wi-Fi connections.
echo.
echo ======================================================================
echo  Generating secure HTTPS Tunnel URL...
echo ======================================================================
echo.

call npx --yes localtunnel --port 8000

pause
