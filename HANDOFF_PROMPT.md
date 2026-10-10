# CivMC Shops — Handoff Prompt (paste into new chat)

You are continuing work on **CivMC Shops**, a static CivMC Minecraft shop directory. **Workspace:** `C:\Users\Pengd\Downloads\civmc-shops (4)`. **User:** Mahdi — prefers direct code edits; keep diffs minimal and focused.

---

## Tech stack & architecture

- **Frontend:** Multi-page static site — HTML + **vanilla JS** + CSS (**no React, no bundler**).
- **Backend (prod):** **Supabase** — Auth, Postgres + RLS, Storage (`uploads` bucket), Edge Functions under `supabase/functions/` (`manage-user`, `signup`, `create-user`, `review-signup`).
- **Local dev:** `config.js` → **`USE_MOCK = true`** (in-browser **`mock.js`** fake Supabase). Set `USE_MOCK = false` + real `SUPABASE_URL` / `SUPABASE_ANON_KEY` for live.
- **Shared modules:** `app.js` (nav, auth, market math, modals, compare tray, honesty, tip votes, place aliases), `items.js`, `item-picker.js`, `style.css` (dark CivMC theme — match existing CSS variables; no generic AI-purple aesthetics).
- **SQL:** `setup.sql` (schema + RLS + `market_now()` / `take_market_snapshot()`), `market-snapshot.sql`, `purge-unverified.sql`.
- **Backlog doc:** `IDEAS.md` (shipped vs skip). Compact notes: `PROJECT_CONTEXT.md`.

**Pages (live):** `index.html` (Find), `market.html`, `dashboard.html`, `shop.html`, `profile.html`, `favourites.html`, `settings.html`, `mod.html`, `admin.html`, `login.html`, `signup.html`.

**Deleted / do not rebuild unless Mahdi asks:** `places.html`, map, route, feed, watches/following UI pages, listing kits, image banners, weekday hours picker, density toggle, **Market Export CSV** (removed).

---

## Current project status (Oct 2026)

### Shipped in the long session (see `IDEAS.md` “Shipped”)
Compare tray (+ shop page pins + `#cmp=` guest share), honesty badge + **sparkline** (`shop_honesty_history`), **guest tip votes** (localStorage → flush on login), **tip-jar brigading** heuristics on mod page, **`PLACE_ALIASES`** + **admin alias rewrite** tool, sign-dump paste on dashboard (+ **`[64]` stock suffix** parsing), impersonation (head-only), profile **highlight_color**, nav drawer in `app.js`, diamonds-only currency, and more listed in `IDEAS.md`.

### Shipped in the latest UX pass
- **`shops.is_open`:** Dashboard **Close shop / Open shop**. Closed shops hidden from Find, favourites, market, public profiles via **`shopListedPublicly(s, ownerProfile)`** in `app.js`. Owner/staff still see. RLS `read shops` includes `is_open`.
- **`shops.group_icons` (jsonb):** Per-group icon for catalog sidebar; **`groupIconHtml()`** / **`normalizeGroupIcons()`** in `app.js`.
- **Dashboard:** Collapsible shop cards (`localStorage` key `civmc_dash_shop_collapse`); **inline listing edit** (item picker, blur-save amounts/units, stock, in-stock toggle); **Add group** via **`promptModal`**; drag-reorder + **drag listings between groups** (handle is `<div draggable class="dash-drag-handle">`, not a button); per-group **+** to add listing; removed Archive, Touch all, bottom bulk add form; **+ New Shop** reveals create form.
- **`shop.html`:** Left **group sidebar** with icons; OOS listings **faded** (not hidden); default listing filter shows all.
- **`market.html`:** **Market for** nation + city scope (`?nation=&city=` URL, **`computeMarketNow(..., placeFilter)`** + **`placeFilterMatch`**); scope note in UI; Find links carry scope. **No CSV export.**
- **`index.html` (Find):** Hero + search strip merged; filter icon + overlay panel; coords / **Near me**; save defaults (`civmc_find_defaults` in localStorage); wider layout.
- **Modals:** **`confirmModal`** / **`promptModal`** in `app.js` — used on dashboard, admin (no native `confirm`/`prompt`).

### Intentionally not built (skip unless asked)
- Discord digests / webhooks (needs secrets + outbound infra).
- Tip-jar on **reviews** (would need a separate table from listing-scoped `tip_votes`).

### Known follow-ups / QA
- **Drag between groups:** was fixed twice; if broken, debug drop targets + mock listing `group_name` / `sort_order` persistence (`applyListingDisplayOrder` must snapshot before mutate).
- **Live Supabase:** If DB predates columns, run commented **`ALTER`s** at bottom of `setup.sql` (especially `is_open`, `group_icons`, `read shops` policy). Deploy **`manage-user`** for head impersonation in prod.
- **`IDEAS.md` “Next when you want”:** _(backlog cleared)_ — **no feature queued.**

---

## Files created or edited recently

| File | Role / recent changes |
|------|------------------------|
| **`HANDOFF_PROMPT.md`** | This handoff (new). |
| **`PROJECT_CONTEXT.md`** | Short living notes (new). |
| **`IDEAS.md`** | Shipped backlog; “Next” empty. |
| **`app.js`** | `shopListedPublicly`, `computeMarketNow` + place filter, `confirmModal`/`promptModal`, group icons, compare/honesty/guest tips/brigading helpers, `PLACE_ALIASES`, nav/impersonation, Find helpers. |
| **`mock.js`** | `is_open`, `group_icons`, honesty history, tip votes, impersonation, soft migrations. |
| **`setup.sql`** | `shops.is_open`, `shops.group_icons`; RLS `read shops` + `market_now()` respect `is_open`; upgrade comment block lines ~541–581. |
| **`dashboard.html`** | Open/close shop, groups, drag-drop, inline edit, modals, sign dump. |
| **`shop.html`** | Group sidebar, OOS styling, compare/tips/honesty integration. |
| **`market.html`** | Nation/city scope UI; CSV export **removed**. |
| **`index.html`** | Find UX (filters overlay, defaults, layout). |
| **`admin.html`** | `confirmModal`; alias rewrite section. |
| **`mod.html`** | Brigading tools; `confirmModal` / timeout styling. |
| **`style.css`** | Dash drag handles, shop catalog sidebar, market scope, Find overlay, honesty sparkline, nav drawer. |
| **`profile.html`**, **`favourites.html`** | Respect public shop visibility / highlight colour (as applicable). |
| **`supabase/functions/manage-user/index.ts`** | Head-only `impersonate` (from earlier in session). |

**Unchanged core but important:** `config.js`, `items.js`, `item-picker.js`, `settings.html`, edge functions besides `manage-user`.

**Full verbatim chat (if needed):**  
`C:\Users\Pengd\.cursor\projects\c-Users-Pengd-Downloads-civmc-shops-4\agent-transcripts\5be50c08-7047-4761-9a67-6c61a25b46c9\5be50c08-7047-4761-9a67-6c61a25b46c9.jsonl`

---

## Database schema / state

**Currency:** `market_currency` — diamonds only (`diamond` → 1). Keep in sync with `CURRENCY` in `app.js`.

**Core tables:**
- **`profiles`** — `mc_username`, `discord_username`, `bio`, `highlight_color`, `avatar_path`, `last_seen_at`, `is_admin` / `is_head` / `is_mod`, `timed_out`, `verified_at`, `must_change_password`, `alerts_enabled`, `created_at`.
- **`shops`** — location (`city`, `nation`, `x`, `z`), copy fields (`description`, `styled_name`, `hours`, `find_note`, `transit_note`), icons (`icon_item`, `icon_path`), **`archived`**, **`is_open`** (default true), **`group_icons` jsonb**, sale fields + `sale_admin_id`, `timed_out`, `owner_id`.
- **`listings`** — sell/want item+amount+unit (`''`|`ci`|`cs`), **`stock`** (null=in stock no count, 0=OOS, N=count), **`in_stock`**, **`sort_order`**, **`group_name`**, sale restore `sale_orig_want_amount`, alert ack timestamps, `timed_out`, `updated_at`.
- **`comments`**, **`reviews`** (+ `traded`), **`favorites`**, **`tip_votes`** (fair/high/low per listing), **`reports`** (+ `reason_category`).
- **Legacy tables (no UI):** `watches`, `follows`, `place_follows` — exist in SQL; don’t rebuild pages unless asked.
- **Market:** `market_history`, functions **`market_now()`**, **`take_market_snapshot()`** (also writes **`shop_honesty_history`**).
- **`admin_sales`**, **`notifications`**.

**RLS highlights:**
- Public **`read shops`:** `(not timed_out and not archived and is_open and account_ok(owner_id)) OR owner_id = auth.uid() OR is_staff()`.
- Verified users for writes on listings/comments/reviews; staff/mod guard triggers on `timed_out`.

**Mock DB:** In-memory/localStorage via `mock.js`; soft-migrates columns as needed when `USE_MOCK=true`.

---

## Next exact task

**None queued.** Start by asking Mahdi what to build next (or which bug to fix — e.g. dashboard drag-between-groups).

Optional **ops** if moving off mock: apply `setup.sql` upgrade comments on live DB; deploy edge functions; set `USE_MOCK=false`.

For new features, read **`IDEAS.md`** — “Intentionally left” items are out of scope unless Mahdi opts in.

---

## Rules & constraints for the agent

1. **Diamonds-only** pricing; rates as d/item (respect `UNIT_MULT` / stack modes).
2. **Do not resurrect** removed features/pages (see list above).
3. **Git:** commit **only when Mahdi explicitly asks**; never force-push main, skip hooks, or change git config.
4. **Head-only impersonation** — preserve UI + `manage-user` checks; mock restore via saved tokens.
5. **UI confirms:** use **`confirmModal` / `promptModal`**, not browser `confirm`/`prompt`.
6. **Schema changes:** add columns to `setup.sql` + matching commented `ALTER` for existing DBs; update `mock.js` soft-migrate if needed.
7. **Style:** extend existing patterns in `app.js` / `style.css`; minimal scope per change.
8. **Mahdi** works in code — implement, don’t only suggest patches.

**Suggested first message to user:** “Backlog in IDEAS.md is clear — what should we tackle next?”
