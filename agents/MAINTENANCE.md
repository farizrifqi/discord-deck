# DiscordDeck Maintenance Guide

## Core Rules (Never Break)
- Real-time WebSocket message streaming
- Multi-guild dynamic discovery (no static guild config)
- Per-keyword columns with drag & drop
- Favorites (global) with yellow border
- Blacklist (per-keyword) with red border when temporarily shown
- Hide messages with per-column temporary view
- Timestamp on every message
- Channel selection preserves user choices on refresh

## Key Files
- `index.html` — Main frontend (contains all UI logic)
- `src/server.js` — Backend API + WebSocket
- `src/state.js` — State management (keywords, guilds, blacklist, etc.)
- `src/discord.js` — Discord connection + dynamic guild/channel registration

## Recent Important Features
- Real-time guild/channel list update in "Add Keyword" modal
- Pause channel list refresh on hover
- Preserve checked/unchecked state when channels update
- Per-column "Show Hidden" and "Show Blocked" toggles
- Yellow border for favorited users
- Red border for temporarily shown blocked/hidden messages

## Testing Checklist After Changes
1. WebSocket connects and receives `init` + `message` events
2. Adding keyword with guild + multiple channels works
3. Favoriting a user shows yellow border across all columns
4. Blocking a user only affects that keyword
5. "Show Hidden" and "Show Blocked" per column work correctly
6. Channel checkboxes keep their state when list refreshes
7. Dragging columns works
8. Message actions (Fav, Hide, Block, Copy) all function

Last Updated: 2026-06-06
