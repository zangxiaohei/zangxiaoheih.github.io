@echo off
chcp 65001 >nul
title Company Site - Local Server
cd /d "%~dp0"

echo.
echo  Starting local server for this website...
echo  Folder: %CD%
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8080/index.html
    echo  Server: http://127.0.0.1:8080
    echo  Press Ctrl+C to stop.
    echo.
    python -m http.server 8080
    goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8080/index.html
    echo  Server: http://127.0.0.1:8080
    echo  Press Ctrl+C to stop.
    echo.
    npx --yes http-server -p 8080 -c-1
    goto :eof
)

echo  No Python or Node.js found on this computer.
echo.
echo  Option 1: install Python from https://www.python.org/downloads/
echo  Option 2: just double-click index.html to open it directly.
echo.
pause
