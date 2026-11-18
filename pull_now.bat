@echo off
title Sri Nathi Business Console - Quick Update
color 0A

echo ============================================================
echo   Sri Nathi Business Console - Pulling Latest from GitHub
echo ============================================================

cd /d "%~dp0"
git pull origin main

echo.
echo [SUCCESS] Business Console update completed.
pause
