# civmc-shops — agent handoff (compact)

Static CivMC shop directory: HTML/CSS/vanilla JS, `USE_MOCK` + Supabase. **Diamonds only.** Do not resurrect removed features unless asked.

## Conventions
- Head-only impersonation; mock uses user id as access token for restore.
- Live DB: soft-upgrade SQL in `setup.sql` comments (`is_open`, `group_icons`, etc.).
- Themed `confirmModal` / `promptModal` — no native `confirm`/`prompt`.
- Git: commit only when Mahdi asks.

## Recent product state (Oct 2026)
- **Shop open/close:** `shops.is_open`; hidden from Find/favourites/market/public profiles when closed; owner/staff still see. `shopListedPublicly()` in `app.js`.
- **Dashboard:** collapsible shop cards; inline listing edit; groups + drag; **Undo stock** after mark-all / bulk-save.
- **shop.html:** group sidebar; OOS faded; **owner review replies** + review sort.
- **profile.html:** Shops / Reviews tabs; pronouns + timezone; member since in facts; shop grid polish.
- **admin.html:** head-only **Transfer shop** + **Purge unverified**; `confirmModal` / `promptModal`.
- **Timeouts:** duration presets 1h / 1d / 7d / until removed (`timed_out_until`).
- **Settings:** light/dark theme (`civmc_theme` localStorage).
- **Tips:** login required (no guest tip votes).
- **market.html:** nation/city scope; **Export CSV removed**.

## Key files
`app.js`, `dashboard.html`, `shop.html`, `profile.html`, `market.html`, `admin.html`, `mock.js`, `style.css`, `setup.sql`

## Backlog
See `IDEAS.md`.

## New chat
Paste **`HANDOFF_PROMPT.md`** into a fresh session (or `@HANDOFF_PROMPT.md`).

## Full chat history
Past agent transcript (if needed): `.cursor/projects/.../agent-transcripts/5be50c08-7047-4761-9a67-6c61a25b46c9.jsonl`
