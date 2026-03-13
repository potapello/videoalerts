@echo off
title Videoalerts

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found! At least the 24.12.0 version is required.
) else (
    node main.js
)

pause