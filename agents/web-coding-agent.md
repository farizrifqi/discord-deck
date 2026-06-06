# Web/Coding Agent - DiscordDeck

## Project Overview
DiscordDeck is a TweetDeck-style real-time Discord message monitor with multi-guild support.

## Core Features (Must Preserve)

### Multi-Guild & Dynamic Channels
- Guilds and channels are discovered dynamically from incoming messages (no static `.env` config)
- Frontend supports guild-first selection when adding keywords
- Channel list preserves user selection state when new channels appear
- Real-time guild/channel updates while "Add Keyword" modal is open

### Keyword Columns
- Each keyword gets its own draggable column
- Per-column options: Show/Hide Hidden messages, Show/Hide Blocked messages
- Columns support drag & drop reordering

### Message Cards
- Real-time message streaming via WebSocket
- Timestamp on every message
- **Favorited users** → Yellow border (global across all keywords)
- **Temporarily shown blocked/hidden messages** → Red border
- Per-message actions: Favorite, Hide, Block, Copy

### Favorites System (Global)
- Favoriting a user shows their messages with yellow border in **all** keyword columns
- Dedicated Favorites modal with ability to unfavorite individually or all at once

### Blacklist System (Per-Keyword)
- Blocking a user only affects that specific keyword
- Dedicated Blacklist modal with per-keyword management
- Option to temporarily show blocked messages per column

### Hidden Messages
- Hide individual messages
- Per-column toggle to temporarily show hidden messages (red border)

### Channel Selection (Add Keyword Modal)
- Multi-select channel list with preserved state on refresh
- Auto-pauses refresh while user is hovering on the channel list
- Real-time update of available channels without closing the modal

## Important Technical Details

- WebSocket connection must be stable (`resync`, `init`, `message`, `guilds_updated`, `blacklist_updated`)
- `state.guilds` structure must be maintained on backend
- `favorites` is global, while `blacklistByKeyword` is per-keyword
- `showHiddenTemporarily` and `showBlockedTemporarily` are per-keyword

## UI/UX Rules
- Buttons must have distinct colors:
  - Favorite → Orange/Yellow
  - Block → Red
  - Hide → Gray
  - Copy → Blue
- All action buttons must have hover effects
- Message content must remain selectable
- Channel checkboxes must preserve state when list refreshes

Last Updated: 2026-06-06
