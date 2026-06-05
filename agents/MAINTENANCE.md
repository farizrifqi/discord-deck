# DiscordDeck Maintenance Guide

## Core Rules (Never Break)
- Realtime WebSocket message streaming
- Per-keyword columns + config (channels, caseSensitive, showBlacklisted)
- Blacklist + favorites handling
- Ring buffer (MAX_PER_KEYWORD = 30)
- Persistence via data/settings.json
- UI in index.html + values.html (drag, pills, overlays)

## Small Refactor / Optimization Guidelines
- Prefer readability: break long one-liners into multi-line with clear steps.
- Keep all functions pure where possible; state mutations only in state.js.
- Add JSDoc only for complex keywordHit / matching logic.
- No new deps without updating package.json + README.
- Always test WS reconnect + keyword add/remove after changes.

## Future Update Workflow
1. `npm install` (if package changed)
2. Run `node src/server.js`
3. Open http://localhost:2607
4. Verify: add keyword, receive messages, blacklist, persist after restart
5. Check console for errors

## Agents
- Use `web-coding-agent.md` for implementation tasks.
- Update this file + web-coding-agent.md when adding new features.

Last updated: 2026-06-06 (post-initial commit)
