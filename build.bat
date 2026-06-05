@echo off
setlocal
cd /d "%~dp0"
set LOG=build-log.txt

echo [DiscordDeck] Start build > %LOG%
echo [DiscordDeck] Installing dependencies...
call npm install >> %LOG% 2>&1
if errorlevel 1 (
  echo Install failed. See %LOG%
  type %LOG%
  pause
  exit /b 1
)

echo [DiscordDeck] Building Windows .exe...
call npm run build:win >> %LOG% 2>&1
if errorlevel 1 (
  echo Build failed. See %LOG%
  type %LOG%
  pause
  exit /b 1
)

echo Done. Check dist\ folder.
dir dist
pause
