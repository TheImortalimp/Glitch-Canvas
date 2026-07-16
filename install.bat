@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts\install-glitch-canvas-vlc.ps1"
set "DLL_LATEST=%SCRIPT_DIR%..\glitch-canvas-vlc-plugin-windows-latest\glitch_canvas.dll"
set "DLL_DEFAULT=%SCRIPT_DIR%..\glitch-canvas-vlc-plugin-windows\glitch_canvas.dll"

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Missing installer script:
  echo %PS_SCRIPT%
  pause
  exit /b 1
)

if exist "%DLL_LATEST%" (
  echo Installing from latest artifact:
  echo %DLL_LATEST%
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Mode install -PluginDllPath "%DLL_LATEST%"
) else if exist "%DLL_DEFAULT%" (
  echo Installing from default artifact:
  echo %DLL_DEFAULT%
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Mode install -PluginDllPath "%DLL_DEFAULT%"
) else (
  echo Installing using script auto-detect...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Mode install
)

if errorlevel 1 (
  echo.
  echo [ERROR] Install failed.
  pause
  exit /b 1
)

echo.
echo [OK] Glitch Canvas installed and enabled.
echo Launching VLC...
start "" "C:\Program Files\VideoLAN\VLC\vlc.exe" --video-filter=glitch_canvas
echo.
pause
exit /b 0
