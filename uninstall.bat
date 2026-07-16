@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts\install-glitch-canvas-vlc.ps1"

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Missing installer script:
  echo %PS_SCRIPT%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Mode uninstall
if errorlevel 1 (
  echo.
  echo [ERROR] Uninstall failed.
  pause
  exit /b 1
)

echo.
echo [OK] Glitch Canvas uninstalled and disabled.
echo.
pause
exit /b 0
