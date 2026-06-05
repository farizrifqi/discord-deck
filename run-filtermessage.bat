@echo off
setlocal
cd /d "%~dp0"

echo [DiscordDeck] Starting...

if not exist node_modules (
  echo [DiscordDeck] Installing dependencies first...
  call npm install
)

if not exist .env (
  if exist .env.example (
    echo [DiscordDeck] .env not found, creating from .env.example
    copy /Y .env.example .env >nul
    echo [DiscordDeck] Please edit .env (DISCORD_TOKEN, DISCORD_GUILD), then run again.
    pause
    exit /b 1
  )
)

call npm start
