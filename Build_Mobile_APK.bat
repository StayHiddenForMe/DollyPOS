@echo off
title Dolly POS Companion - Standalone APK Builder
color 0b
chcp 65001 >nul

echo =====================================================================
echo           DOLLY POS COMPANION - ANDROID STANDALONE APK BUILDER
echo =====================================================================
echo.
echo This utility compiles the Dolly POS Companion mobile application into
echo a standalone Android .apk file that installs directly on any phone.
echo.
echo [1] Build Standalone Android APK (EAS Cloud Build - Free, Instant Link)
echo [2] Prebuild Native Android Project Folder (For Local Android Studio)
echo [3] Launch Live Companion in Expo Go (Scan QR Code from Phone)
echo [4] Exit
echo.
echo =====================================================================
set /p choice="Select an option [1, 2, 3, or 4]: "

if "%choice%"=="1" goto BUILD_EAS_APK
if "%choice%"=="2" goto PREBUILD_LOCAL
if "%choice%"=="3" goto RUN_EXPO_GO
if "%choice%"=="4" goto QUIT
goto QUIT

:BUILD_EAS_APK
cls
echo =====================================================================
echo            BUILDING STANDALONE ANDROID APK (.apk)
echo =====================================================================
echo.
echo Step 1: Navigating to mobile project directory...
cd /d "%~dp0mobile"

echo.
echo Step 2: Initiating EAS Android APK Preview Build...
echo (If prompted, log in with your free Expo account or press Enter to register)
echo.
call npx --yes eas-cli build -p android --profile preview
echo.
if %errorlevel% neq 0 (
    echo [ERROR] EAS build stopped or was cancelled.
    echo Tip: You can create a free Expo account at https://expo.dev/signup
) else (
    echo [SUCCESS] APK build complete! Download and install the .apk on your phone.
)
goto END

:PREBUILD_LOCAL
cls
echo =====================================================================
echo          GENERATING NATIVE ANDROID PROJECT FOLDER
echo =====================================================================
echo.
cd /d "%~dp0mobile"
echo Generating Android native Gradle project...
call npx expo prebuild --platform android --clean
echo.
echo Native Android folder created at: mobile\android
echo You can open this directory in Android Studio and click Build -> Build APK.
goto END

:RUN_EXPO_GO
cls
echo =====================================================================
echo          STARTING EXPO LIVE TESTING COMPANION
echo =====================================================================
echo.
cd /d "%~dp0mobile"
call npx expo start --tunnel
goto END

:QUIT
exit /b 0

:END
echo.
echo =====================================================================
pause
