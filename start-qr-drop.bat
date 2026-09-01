@echo off
title QR Drop - Fast QR File & Photo Sharing
color 0b
echo ========================================================
echo        QR Drop - Fast QR Photo & File Sharing
echo ========================================================
echo.
echo Starting server at http://localhost:3001 ...
echo.

cd /d "C:\Users\Sameth\.gemini\antigravity\scratch\qr-share-app"

:: Open browser after 1 second delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001"

:: Start Node Express Server
node server/server.js

pause
