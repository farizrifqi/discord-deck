# DiscordDeck 🎯

A **TweetDeck-style** real-time Discord message monitor. Each keyword gets its own column. Messages matching keywords stream in live via WebSocket.

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

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure
```bash
cp .env.example .env
# Edit .env with your token, guild ID, and keywords
```

**Finding your Discord token:**
1. Open Discord in browser or desktop app
2. Open DevTools → Network tab
3. Look for any request with `Authorization` header — that's your token
> ⚠️ Never share your token. This is your personal account token.

**Finding Guild/Channel IDs:**
- Enable Developer Mode in Discord settings → Right-click server/channel → Copy ID

### 3. Run
```bash
node src/server.js
# or for auto-reload:
npm run dev
```

Open **http://localhost:3000** in your browser.

## Features

- 📡 **Real-time** — WebSocket push from Discord to browser, no polling
- 🗂 **Multi-column** — one column per keyword, like TweetDeck
- ➕ **Live keyword management** — add/remove columns from the UI without restarting
- 🔄 **Auto-reconnect** — WebSocket reconnects if connection drops
- 🖼 **Image attachments** — inline preview for image attachments
- 💾 **Ring buffer** — keeps last 100 messages per column in memory
- 🎨 **Color-coded** — each keyword column gets a distinct accent color

## Architecture

```
Discord Gateway
      │  (discord.js-selfbot-v13)
      ▼
  src/discord.js   ← listens to messageCreate, filters by guild/channel/keyword
      │
      ▼
  src/server.js    ← Express HTTP + ws WebSocket server
      │               REST: GET /api/state, POST /api/keywords, DELETE /api/keywords/:kw
      │
      ▼  (WebSocket broadcast)
  public/index.html ← TweetDeck UI, WS client, column rendering
```

## Configuration

| Variable           | Default               | Description                          |
|--------------------|-----------------------|--------------------------------------|
| `DISCORD_TOKEN`    | —                     | Your Discord user token              |
| `DISCORD_GUILD`    | —                     | Guild ID to monitor                  |
| `DISCORD_CHANNELS` | —                     | Deprecated (channel filtering now managed in UI per keyword) |
| `KEYWORDS`         | crypto,drop,free,...  | Initial keyword columns (seed only at startup) |
| `PORT`             | 3000                  | Web server port                      |

## REST API

| Method | Endpoint              | Body / Params         | Description             |
|--------|-----------------------|-----------------------|-------------------------|
| GET    | `/api/state`          | —                     | Current keywords + msgs |
| POST   | `/api/keywords`       | `{ "keyword": "kw" }` | Add a keyword column    |
| DELETE | `/api/keywords/:kw`   | —                     | Remove a keyword column |

## Keyword behavior (important)

- `DISCORD_GUILD` in `.env` is the only source filter for incoming messages.
- Channels are auto-discovered from real incoming messages in that guild (cached in memory).
- When adding a keyword in the UI, select target channel (or "All channels").
- `KEYWORDS` in `.env` is only used as **initial seed** when server starts.
- If you edit `.env` keywords, restart server to apply that new startup seed.

## Disclaimer

Using a self-bot (user token automation) violates Discord's Terms of Service. Use at your own risk.
