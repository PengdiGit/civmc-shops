# CivMC Shops — feature ideas

## Shipped
- City + nation filters with URL params
- Compare tray, bulk stock editor, market intel
- Find-me / transit notes on shops (Places directory page removed)
- **Compare tray** + markdown export + guest `#cmp=` share
- **Compare tray on shop page** — pin listings without returning to search (shared sessionStorage + `#cmp=`)
- **Stock honesty score** chip on shop cards / shop page
- **Honesty history sparkline** — nightly `shop_honesty_history` via `take_market_snapshot`
- **Tip-jar votes** (`tip_votes`) — Fair / High / Low on shop listings
- **Guest tip votes** — localStorage until login, then flush/merge
- **Tip-jar brigading mod tools** — burst/spam heuristics on mod page + clear votes
- **City aliases** — `PLACE_ALIASES` in `app.js`
- **Admin alias rewrite tool** — optional city/nation DB cleanup on admin page
- **Sign-dump paste helper** on dashboard — ChestShop-ish lines → listings
- **Sign-dump stock suffixes** — optional `[64]` → listing stock
- Mock: reviews `traded`, soft-migrate `tip_votes` / `transit_note` / `shop_honesty_history`
- Find: Esc clears search, arrow-key result hop, recent searches, Near me, updated-this-week / min-max d/item / unit filters, result counts, autocomplete (all modes + Tab), compact board after search, hot/traction strip, empty shops hidden on browse
- Shop page: hide out-of-stock by default + disclosure; listing groups/`sort_order`
- Dashboard: mark all in/out, duplicate listing, ↑↓ reorder + groups (kits removed)
- Reports: modal + reason chips; mod cards show category
- Market: best ~3 shops per item row
- **Head-admin shop transfer** — admin page Transfer (head-only; DB trigger)
- **Undo last bulk stock change** — dashboard Undo after mark-all / bulk-save
- **Profile shops grid polish** + **Shops / Reviews written tabs**
- **Pronouns + timezone** optional profile fields
- **Member since** in profile facts (+ stats)
- **Owner reply to reviews** + **sort reviews** (newest / oldest / rating)
- **Timeout duration presets** — 1h / 1d / 7d / until removed (`timed_out_until`)
- **Head-only purge unverified** — admin button (24h rule)
- **Light / dark theme** — Settings → Appearance (`civmc_theme`)
- **Dashboard leave confirm** — unsaved listing/shop edits
- **Tips require login** — guest tip localStorage removed
- ~~Listing kits~~ — removed (disliked)
- ~~Image banners~~ / ~~weekday hours picker~~ / ~~map~~ / ~~route~~ / ~~feed~~ / ~~watches~~ / ~~following~~ / ~~density toggle~~ — removed

## Intentionally left (skip for now)
- **Discord digests / webhooks** — needs secrets + outbound infra
- **Tip-jar on reviews** — `tip_votes` is listing-scoped; review “helpful” needs a separate table

## Next when you want
_(backlog cleared — pick more numbers from the brainstorm list in prior chat if needed)_
