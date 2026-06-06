# ⚠️ 100% AI Generated

# DiscordDeck 🎯

A **TweetDeck-style** real-time Discord message monitor with **multi-guild support**. Each keyword gets its own column. Messages matching keywords stream in live via WebSocket.

```
┌─────────────────────────────────────────────────┐
│  DiscordDeck  ● connected  @user#1234  [+ kw]  │
├──┬──────────────┬──────────────┬─────────────────┤
│  │  crypto      │  drop        │  sale            │
│  │──────────────│──────────────│─────────────────│
│  │ [msg card]   │ [msg card]   │ [msg card]       │
│  │ [msg card]   │              │ [msg card]       │
│  │              │              │                  │
└──┴──────────────┴──────────────┴─────────────────┘
```

## Features

- **Multi-Guild Support** — Guilds and channels are discovered dynamically from incoming messages (no static guild config)
- **Real-time Updates** — Messages appear instantly via WebSocket
- **Per-Keyword Columns** — Draggable columns with independent settings
- **Favorites** — Global favorite users appear with yellow border across all columns
- **Blacklist** — Per-keyword user blocking with temporary view option
- **Hide Messages** — Per-message hide with temporary view toggle per column
- **Channel Filtering** — Multi-select channels when adding keywords (preserves selection on refresh)
- **Timestamps** — Every message shows time
- **Message Actions** — Favorite, Hide, Block, Copy per message

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure
```bash
cp .env.example .env
# Edit .env with your Discord token and initial keywords
```

**Finding your Discord token:**
1. Open Discord in browser or desktop app
2. Open DevTools → Network tab
3. Look for any request with `Authorization` header — that's your token

> ⚠️ Never share your token. This is your personal account token.

### 3. Run
```bash
node src/server.js
# or for auto-reload:
npm run dev
```

Open **http://localhost:2607** in your browser.

## Configuration

| Variable           | Description                                      |
|--------------------|--------------------------------------------------|
| `DISCORD_TOKEN`    | Your Discord user token                          |
| `KEYWORDS`         | Initial keyword columns (comma separated)        |
| `PORT`             | Web server port (default: 2607)                  |

> Note: Guild and channel filtering is now handled dynamically in the UI. No need to set `DISCORD_GUILD` anymore.

## REST API

| Method | Endpoint                  | Description                  |
|--------|---------------------------|------------------------------|
| GET    | `/api/state`              | Current state (keywords, guilds, etc.) |
| POST   | `/api/keywords`           | Add a keyword                |
| DELETE | `/api/keywords/:kw`       | Remove a keyword             |

## Important Notes

- Using a self-bot (user token) violates Discord's Terms of Service. Use at your own risk.
- Favorites are **global** (yellow border across all columns)
- Blacklist is **per-keyword**
- You can temporarily show hidden or blocked messages per column using the column header buttons

Last Updated: 2026-06-06
