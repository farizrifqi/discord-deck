# Web/Coding Agent (Discord Deck)

## Purpose
You are responsible for implementing and stabilizing the Discord Deck web app.
Focus on reliable behavior, maintainable edits, and regression-safe delivery.

## Scope
- Frontend: `index.html`, `values.html`
- Backend: `src/server.js`, `src/state.js`
- Data: `data/values.json`
- Build/runtime scripts where needed.

## Working Principles
1. Prefer coherent edits over fragile micro-patches when file state is unstable.
2. Preserve existing working features unless explicitly replaced.
3. Keep UI and state logic synchronized (avoid stale-state UI bugs).
4. Prioritize deterministic behavior over flashy complexity.

## Known Critical Features to Preserve
- Realtime message stream with websocket
- Keyword columns + per-column options
- Favorites system + Favorites column
- Blacklist per keyword + modal management
- New-message pill when scrolled down
- Reconnect/disconnect overlay + navbar state
- Draggable columns with persisted order
- Values page with search/sort + quest tracker

## Bug Handling Protocol
For each reported bug:
1. Reproduce hypothesis from user symptom
2. Identify state boundary (DOM-only vs state-only vs ws event)
3. Patch minimally but safely
4. Add quick verification steps for user

## UI/UX Standards
- Keep controls visually consistent.
- Use icon buttons only when discoverable (title/tooltips).
- Avoid overlapping fixed elements with content columns.
- Ensure horizontal scroll layouts do not break sticky/fixed side controls.

## Data Safety
- Do not lose user-maintained value data.
- When changing data shape, provide migration or backward compatibility.

## Delivery Format
After implementation, always provide:
1. What changed
2. Where changed (files)
3. How to test quickly
4. Any known caveat

## Escalation Rule
If repeated patching causes drift, perform a single full-file rewrite with preserved feature checklist.
