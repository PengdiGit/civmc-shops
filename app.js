// shared stuff for every page
const THEME_KEY = "civmc_theme";
function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" ? "light" : "dark";
  } catch (e) { return "dark"; }
}
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  return t;
}
applyTheme(getTheme());

/* Inline icons for row actions (edit, delete, share, …). Stroke icons, currentColor. */
const UI_ICONS = {
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m4.9 4.9 14.2 14.2"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="m10 14 11-11"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="M15.41 6.51 8.59 10.49"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  starFill: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="currentColor"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>',
  reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
  columns: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>',
  map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
};
function uiIcon(name) {
  const body = UI_ICONS[name];
  if (!body) return "";
  return `<svg class="ui-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
/** Square icon button. opts: { tag, title, attrs, cls, danger, primary, on } */
function iconBtn(icon, opts) {
  const o = opts || {};
  const tag = o.tag === "a" ? "a" : "button";
  const cls = ["icon-btn", o.danger ? "danger" : "", o.primary ? "primary" : "", o.on ? "on" : "", o.cls || ""].filter(Boolean).join(" ");
  const title = o.title ? ` title="${esc(o.title)}" aria-label="${esc(o.title)}"` : "";
  const type = tag === "button" ? ' type="button"' : "";
  const extra = o.attrs ? " " + o.attrs : "";
  return `<${tag} class="${cls}"${type}${title}${extra}>${uiIcon(icon)}</${tag}>`;
}
function hydrateIcons(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll("[data-ico]").forEach(el => {
    if (el.querySelector(".ui-ico")) return;
    const svg = uiIcon(el.getAttribute("data-ico"));
    if (!svg) return;
    el.insertAdjacentHTML("afterbegin", svg);
    const label = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (label) el.classList.add("ico-label");
    else el.classList.add("icon-btn");
    if (!el.getAttribute("aria-label")) {
      const t = el.getAttribute("title") || label;
      if (t) el.setAttribute("aria-label", t);
    }
  });
}

function stillTimedOut(row) {
  if (!row || !row.timed_out) return false;
  if (!row.timed_out_until) return true;
  const t = new Date(row.timed_out_until).getTime();
  return Number.isFinite(t) && t > Date.now();
}
function timeoutUntilIso(hours) {
  if (hours == null) return null;
  const n = Number(hours);
  if (!(n > 0)) return null;
  return new Date(Date.now() + n * 3600000).toISOString();
}
function timeoutUntilLabel(row) {
  if (!stillTimedOut(row)) return "";
  if (!row.timed_out_until) return "until removed";
  return "until " + new Date(row.timed_out_until).toLocaleString();
}

/** Duration picker for timeouts. Returns { hours: number|null } or null if cancelled. null hours = until removed. */
function pickTimeoutDuration(opts) {
  const o = opts || {};
  closeUiModal();
  return new Promise(resolve => {
    const root = document.createElement("div");
    root.id = "ui-modal-root";
    root.className = "modal-overlay ui-modal-overlay";
    root.innerHTML = `<div class="modal ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title">
      <h2 id="ui-modal-title">${esc(o.title || "Timeout duration")}</h2>
      <p class="ui-modal-body">${esc(o.body || "How long should this stay timed out?")}</p>
      <div class="timeout-presets" role="group" aria-label="Duration">
        <button type="button" class="small" data-hours="1">1 hour</button>
        <button type="button" class="small" data-hours="24">1 day</button>
        <button type="button" class="small" data-hours="168">7 days</button>
        <button type="button" class="small primary" data-hours="">Until removed</button>
      </div>
      <div class="ui-modal-actions row">
        <button type="button" class="small" data-ui-cancel>${esc(o.cancelLabel || "Cancel")}</button>
      </div>
    </div>`;
    document.body.appendChild(root);
    document.body.classList.add("ui-modal-open");
    const done = v => { closeUiModal(); resolve(v); };
    root.querySelector("[data-ui-cancel]").onclick = () => done(null);
    root.addEventListener("click", e => {
      if (e.target === root) done(null);
      const btn = e.target.closest("[data-hours]");
      if (!btn) return;
      const raw = btn.getAttribute("data-hours");
      done({ hours: raw === "" ? null : Number(raw) });
    });
    root.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); done(null); }
    });
    root.querySelector("[data-ui-cancel]").focus();
  });
}

function navPageKey() {
  const p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!p || p === "index.html") return "find";
  if (p === "market.html") return "market";
  return "";
}
function brandHtml() {
  return '<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text">CivShops</span></a>';
}
function navLeftHtml() {
  const k = navPageKey();
  return '<span class="nav-left">' +
    `<a href="index.html"${k === "find" ? ' class="nav-active" aria-current="page"' : ""}>Find shops</a>` +
    `<a href="market.html"${k === "market" ? ' class="nav-active" aria-current="page"' : ""}>Market</a>` +
    "</span>";
}
// Draw a basic nav straight away, so a page is never left without links even if something below fails.
(function () {
  const nav = document.getElementById("nav");
  if (!nav) return;
  nav.innerHTML =
    brandHtml() +
    navLeftHtml() +
    '<span class="nav-right">' +
      '<button type="button" class="nav-menu-btn" id="nav-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav-drawer">' +
        '<span class="nav-burger" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '</button>' +
    '</span>';
  ensureNavChrome();
  paintNavDrawer(`
    <a class="nav-drawer-link" href="login.html">Log in</a>
    <a class="nav-drawer-link nav-drawer-primary" href="signup.html">Sign up</a>
  `);
  wireNavMenu();
})();

function ensureNavChrome() {
  if (!document.getElementById("nav-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.id = "nav-backdrop";
    backdrop.className = "nav-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }
  if (!document.getElementById("nav-drawer")) {
    const drawer = document.createElement("aside");
    drawer.id = "nav-drawer";
    drawer.className = "nav-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-label", "Account menu");
    drawer.innerHTML =
      '<div class="nav-drawer-head">' +
        '<span class="nav-drawer-title">Menu</span>' +
        '<button type="button" class="nav-drawer-close" id="nav-drawer-close" aria-label="Close menu">&times;</button>' +
      '</div>' +
      '<div class="nav-drawer-body" id="nav-drawer-body"></div>';
    document.body.appendChild(drawer);
  }
}

function paintNavDrawer(html) {
  ensureNavChrome();
  const body = document.getElementById("nav-drawer-body");
  if (body) body.innerHTML = html;
}

function setNavMenuOpen(open) {
  const btn = document.getElementById("nav-menu-btn");
  const drawer = document.getElementById("nav-drawer");
  const backdrop = document.getElementById("nav-backdrop");
  if (!drawer || !backdrop) return;
  document.body.classList.toggle("nav-menu-open", open);
  drawer.classList.toggle("open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  backdrop.hidden = !open;
  backdrop.classList.toggle("open", open);
  if (btn) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    btn.classList.toggle("open", open);
  }
  if (open) {
    const close = document.getElementById("nav-drawer-close");
    if (close) close.focus();
  }
}

function wireNavMenu() {
  ensureNavChrome();
  const btn = document.getElementById("nav-menu-btn");
  const backdrop = document.getElementById("nav-backdrop");
  const close = document.getElementById("nav-drawer-close");
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      setNavMenuOpen(!document.body.classList.contains("nav-menu-open"));
    });
  }
  if (backdrop && !backdrop.dataset.wired) {
    backdrop.dataset.wired = "1";
    backdrop.addEventListener("click", () => setNavMenuOpen(false));
  }
  if (close && !close.dataset.wired) {
    close.dataset.wired = "1";
    close.addEventListener("click", () => setNavMenuOpen(false));
  }
  if (!document.documentElement.dataset.navEscWired) {
    document.documentElement.dataset.navEscWired = "1";
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && document.body.classList.contains("nav-menu-open")) {
        e.preventDefault();
        setNavMenuOpen(false);
        const menuBtn = document.getElementById("nav-menu-btn");
        if (menuBtn) menuBtn.focus();
      }
    });
  }
}
let sb;
try {
  sb = USE_MOCK ? mockClient() : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) { console.error(e); }
// users log in with a username, supabase wants an email, so we fake one
const FAKE_DOMAIN = "@civmc.local";
const STALE_DAYS = 30;
const MAP_BASE = "https://map.civinfo.net/";
let hadSession = false;

function esc(s) {
  // escapes quotes too, so it's safe inside attributes like src="..."
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, " "); }
function daysAgo(ts) { return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000); }
function agoText(ts) {
  const d = daysAgo(ts);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return d + " days ago";
}
// Colour-coded "updated …" for listings: fresh = green, week+ = red
function updatedHtml(ts, opts) {
  if (!ts) return "";
  const d = daysAgo(ts);
  const cls = d <= 1 ? "fresh" : d < 7 ? "aging" : "stale-age";
  const prefix = (opts && opts.prefix === false) ? "" : "updated ";
  return `<span class="updated ${cls}" title="${esc(fmtDate(ts))}">${prefix}${agoText(ts)}</span>`;
}
function fmtDate(ts) { return ts ? new Date(ts).toLocaleString() : "never"; }

function fillItemList() {
  const dl = document.getElementById("items");
  if (!dl || typeof ITEMS === "undefined") return;
  dl.innerHTML = ITEMS.map(i => `<option value="${esc(i)}">`).join("");
}

// ------------------------------------------------------------ items, units, deals
// item textures: the item "oak boat" is Minecraft_Items/oak_boat.png (folder name must match EXACTLY, GitHub Pages is case-sensitive)
const ITEM_DIR = "Minecraft_Items/";
const itemImg = name => ITEM_DIR + encodeURIComponent(name.replace(/ /g, "_")) + ".png";
function itemIcon(name, big) {
  // inventory-slot tile around the texture; missing textures just disappear
  const cls = big ? "icon-lg" : "icon";
  const slot = big ? "md" : "sm";
  return `<span class="slot ${slot}"><img class="${cls}" src="${esc(itemImg(name))}" alt="" onerror="this.parentElement.remove()"></span>`;
}

// How many raw items one unit is. Change these two numbers if your server uses other sizes.
const UNIT_MULT = { "": 1, ci: 64, cs: 4096 };
// What counts as money for the "best deal" sort / market rates. Diamonds only.
const CURRENCY = { "diamond": 1 };

const rawCount = (amount, unit) => amount * (UNIT_MULT[unit || ""] || 1);

// "[icon] 2 CS diamond"
function itemText(amount, name, unit, big) {
  return `<span class="itemline">${itemIcon(name, big)}<b>${amount}${unit ? " " + esc(unit.toUpperCase()) : ""} ${esc(name)}</b></span>`;
}

function tradeRow(l, opts) {
  const o = opts || {};
  const big = !!o.big;
  const buying = !!o.buying;
  const r = o.rate != null ? o.rate : dealRate(l, buying);
  const stale = o.stale;
  const tags = o.tags || "";
  const meta = o.meta || "";
  const btns = o.btns || "";
  const btnsEnd = o.btnsEnd || "";
  const idAttr = o.id ? ` id="${esc(o.id)}"` : "";
  const listingAttr = o.listingId != null ? ` data-listing="${esc(o.listingId)}"` : "";
  const href = o.href ? ` data-href="${esc(o.href)}"` : "";
  const cls = ["listing-row", o.cls, stale ? "stale" : "", o.hl ? "hl offer" : ""].filter(Boolean).join(" ");
  const foot = (btns || btnsEnd)
    ? `<div class="btns">${btns ? `<div class="btns-start">${btns}</div>` : "<div></div>"}${btnsEnd ? `<div class="btns-end">${btnsEnd}</div>` : ""}</div>`
    : "";
  return `<div class="${cls}"${idAttr}${listingAttr}${href}>
    <div class="top">
      <div class="trade">
        <div class="trade-side">${itemText(l.want_amount, l.want_item, l.want_unit, big)}</div>
        <span class="arrow">&rarr;</span>
        <div class="trade-side">${itemText(l.sell_amount, l.sell_item, l.sell_unit, big)}</div>
        <div class="inline-actions">
          ${r != null ? `<span class="chip" title="diamonds per item">${fmtRate(r)}</span>` : ""}
          ${tags}
        </div>
      </div>
    </div>
    ${meta ? `<div class="meta">${meta}</div>` : ""}
    ${foot}
  </div>`;
}

// diamonds per 1 raw item of the SEARCHED item, or null if the other side isn't diamonds
function dealRate(l, buying) {
  const [sa, su] = buying ? [l.want_amount, l.want_unit] : [l.sell_amount, l.sell_unit];
  const [oi, oa, ou] = buying ? [l.sell_item, l.sell_amount, l.sell_unit] : [l.want_item, l.want_amount, l.want_unit];
  const val = CURRENCY[oi];
  if (val == null) return null;
  return (rawCount(oa, ou) * val) / rawCount(sa, su);
}
function fmtRate(r) {
  return (r >= 10 ? r.toFixed(1) : +r.toFixed(3)) + " d/item";
}

// ------------------------------------------------------------ pictures, stars, help text
const PFA_DISCORD_INVITE = "https://discord.com/invite/cNHvQb567c";
const PFA_CONTACT_CHANNEL = "https://discord.com/channels/1547194944253460501/1547194946044305426";
const PFA_HELP = 'open a "CivShop" ticket in "contact PFA" on the Discord';
const HEAD_URL = "https://minotar.net/avatar/";   // default profile picture = the person's Minecraft head

const publicUrl = path => sb.storage.from("uploads").getPublicUrl(path).data.publicUrl;
function avatarUrl(p, size) {
  if (!p) return "";
  if (p.avatar_path) return publicUrl(p.avatar_path);
  const px = size || 64;
  return HEAD_URL + encodeURIComponent(p.mc_username || "steve") + "/" + px;
}
function avatarImg(p, size) {
  const px = size || 24;
  return `<img class="avatar" width="${px}" height="${px}" src="${esc(avatarUrl(p, px))}" alt="" onerror="this.style.visibility='hidden'">`;
}
/** Primary site name = login username (Minecraft name stays for heads / secondary facts). */
function userName(p) {
  if (!p) return "?";
  return p.username || p.login_username || p.mc_username || "?";
}

function mapUrl(x, z) {
  // CivInfo map: https://map.civinfo.net/#c=x,z
  return MAP_BASE + "#c=" + encodeURIComponent(x) + "," + encodeURIComponent(z);
}
function coordsHtml(x, z) {
  if (x == null || z == null) return "no coords";
  return `<a class="maplink" href="${esc(mapUrl(x, z))}" target="_blank" rel="noopener" title="Open on CivInfo map">${esc(x)}, ${esc(z)}</a>`;
}
function emptyState(text, actionHref, actionLabel) {
  const btn = actionHref
    ? `<a class="primary small" href="${esc(actionHref)}" style="padding:8px 14px;border-radius:4px;text-decoration:none;color:#12150f;background:var(--accent);border:1px solid var(--accent);font-weight:600">${esc(actionLabel || "Go")}</a>`
    : "";
  return `<div class="empty"><p>${text}</p>${btn}</div>`;
}
function ownerChip(p, ownerId) {
  if (!p || !ownerId) return '<span class="meta">owner: ?</span>';
  return `<a class="owner-chip" href="profile.html?id=${esc(ownerId)}">${avatarImg(p, 22)} ${esc(userName(p))}</a>`;
}
// "Mount Augusta \u00b7 Commonwealth" style place line for cards / meta
// Soft city/nation aliases (display + filter matching without rewriting DB rows)
const PLACE_ALIASES = {
  "mt augusta": "Mount Augusta", "mount augusta": "Mount Augusta", "ma": "Mount Augusta",
  "new jersey": "New Jersey", "nj": "New Jersey",
  "icenia city": "Icenia", "icenia": "Icenia",
  "the commonwealth": "Commonwealth", "cw": "Commonwealth",
  "lex": "Lexington", "lexington": "Lexington",
  "portland": "Portland", "spawn": "Spawn",
  "imperial federation": "Imperial Federation", "if": "Imperial Federation",
  "alenarith": "Alenarith"
};
function canonicalPlace(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  return PLACE_ALIASES[raw.toLowerCase()] || raw;
}
function placeEquals(a, b) {
  if (!a || !b) return false;
  return canonicalPlace(a).toLowerCase() === canonicalPlace(b).toLowerCase();
}
function placeHtml(s) {
  if (!s) return "";
  const city = canonicalPlace(s.city);
  const nation = canonicalPlace(s.nation);
  const bits = [];
  if (city) bits.push(esc(city));
  if (nation && nation !== city) bits.push(esc(nation));
  else if (nation && !city) bits.push(esc(nation));
  return bits.join(" \u00b7 ");
}
function placeFilterMatch(s, city, nation) {
  if (city && !placeEquals(s.city, city)) return false;
  if (nation && !placeEquals(s.nation, nation)) return false;
  return true;
}
/** Find, favourites, market, compare - not owner/staff preview. */
function shopListedPublicly(s, ownerProfile) {
  if (!s || stillTimedOut(s) || s.archived || s.is_open === false) return false;
  if (ownerProfile && stillTimedOut(ownerProfile)) return false;
  return true;
}

// ---- saved player coords (search “Closest” sort)
const HERE_KEY = "civmc_here";
function loadHereCoords() {
  try {
    const h = JSON.parse(localStorage.getItem(HERE_KEY) || "null");
    if (h && !isNaN(parseFloat(h.x)) && !isNaN(parseFloat(h.z))) return { x: parseFloat(h.x), z: parseFloat(h.z) };
  } catch (e) {}
  return null;
}
function saveHereCoords(x, z) {
  try { localStorage.setItem(HERE_KEY, JSON.stringify({ x, z })); } catch (e) {}
}
function distBlocks(a, b) {
  if (!a || !b || a.x == null || a.z == null || b.x == null || b.z == null) return null;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Guest compare hash: #cmp=12s,45w (listingId + s|w for sell/want)
function encodeCompareHash(pins) {
  if (!pins || !pins.length) return "";
  return "#cmp=" + pins.map(p => {
    const mode = p.buying ? "w" : "s";
    return String(p.listing.id) + mode;
  }).join(",");
}
function parseCompareHash(hash) {
  const m = String(hash || location.hash || "").match(/#cmp=([^&]*)/);
  if (!m || !m[1]) return [];
  return m[1].split(",").map(tok => {
    const t = tok.trim();
    const mode = /w$/i.test(t) ? "w" : "s";
    const id = parseInt(t.replace(/[sw]$/i, ""), 10);
    return isNaN(id) ? null : { id, buying: mode === "w" };
  }).filter(Boolean);
}
function writeCompareHash(pins) {
  const next = encodeCompareHash(pins);
  const base = location.pathname + location.search;
  history.replaceState(null, "", next ? base + next : base + (location.hash && !location.hash.startsWith("#cmp=") ? location.hash : ""));
}

// Cross-page compare tray (sessionStorage + optional #cmp=)
const COMPARE_STORE_KEY = "civmc_compare_pins";
const COMPARE_LISTING_SELECT = "*, shops(owner_id, name, styled_name, icon_item, icon_path, city, nation, hours, find_note, transit_note, x, z, timed_out, archived, is_open, sale_name, sale_percent, sale_label, sale_starts_at, sale_ends_at, sale_active, profiles(username, mc_username, discord_username, avatar_path, timed_out))";
function loadCompareSpecs() {
  try {
    const arr = JSON.parse(sessionStorage.getItem(COMPARE_STORE_KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(s => s && !isNaN(Number(s.id))).slice(0, 4)
      .map(s => ({ id: Number(s.id), buying: !!s.buying }));
  } catch (e) { return []; }
}
function saveCompareSpecs(specs) {
  try { sessionStorage.setItem(COMPARE_STORE_KEY, JSON.stringify((specs || []).slice(0, 4))); } catch (e) {}
}
function pinsToCompareSpecs(pins) {
  return (pins || []).map(p => ({ id: p.listing.id, buying: !!p.buying }));
}
function syncCompareStore(pins) {
  saveCompareSpecs(pinsToCompareSpecs(pins));
  writeCompareHash(pins);
}
function compareShareUrl(pins) {
  const hash = encodeCompareHash(pins);
  const dir = location.pathname.replace(/[^/]*$/, "");
  return location.origin + dir + "index.html" + (hash || "");
}
function mergeCompareSpecs(...lists) {
  const out = [], seen = new Set();
  lists.flat().forEach(s => {
    if (!s || isNaN(Number(s.id))) return;
    const id = Number(s.id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, buying: !!s.buying });
  });
  return out.slice(0, 4);
}
async function fetchComparePins(specs) {
  if (!specs || !specs.length) return [];
  const { data, error } = await sb.from("listings").select(COMPARE_LISTING_SELECT).order("id");
  if (error) return [];
  const byId = {};
  (data || []).forEach(l => { byId[l.id] = l; });
  return specs.map(sp => {
    const l = byId[sp.id];
    if (!l || !l.shops || l.timed_out || !shopListedPublicly(l.shops, l.shops.profiles)) return null;
    return { listing: l, shop: l.shops, buying: sp.buying };
  }).filter(Boolean).slice(0, 4);
}
function toggleComparePin(pins, listing, shop, buying) {
  const list = pins || [];
  const ix = list.findIndex(p => String(p.listing.id) === String(listing.id));
  if (ix >= 0) { list.splice(ix, 1); return { ok: true }; }
  if (list.length >= 4) return { ok: false, error: "Compare tray is full (4 max). Remove one first." };
  list.push({ listing, shop, buying: !!buying });
  return { ok: true };
}
function paintCompareTray(pins, opts) {
  const o = opts || {};
  const tray = document.getElementById("compare");
  const body = document.getElementById("compare-body");
  const countEl = document.getElementById("compare-count");
  if (!tray || !body) return;
  if (countEl) countEl.textContent = pins.length + " / 4";
  tray.hidden = !pins.length;
  syncCompareStore(pins);
  const here = o.here || null;
  body.innerHTML = pins.map((p, i) => {
    const l = p.listing, s = p.shop || {};
    const r = dealRate(l, p.buying);
    const place = placeHtml(s);
    const dist = here && s.x != null && s.z != null
      ? " \u00b7 ~" + Math.round(distBlocks(here, s)) + " blocks away" : "";
    return `<div class="compare-card">
      <div class="meta">${shopIcon(s, "sm")} ${shopName(s)}</div>
      <div class="trade" style="margin:6px 0">${itemText(l.want_amount, l.want_item, l.want_unit)} <span class="arrow">&rarr;</span> ${itemText(l.sell_amount, l.sell_item, l.sell_unit)}</div>
      <div class="meta">${r != null ? fmtRate(r) : "barter"} \u00b7 ${stockHtml(l)} \u00b7 ${updatedHtml(l.updated_at, { prefix: false })}</div>
      <div class="meta">${place || "-"}${dist}</div>
      <div class="action-cluster" style="margin-top:8px">
        ${iconBtn("external", { tag: "a", title: "Open shop", attrs: `href="shop.html?id=${l.shop_id}&listing=${l.id}"` })}
        ${s.x != null && s.z != null ? iconBtn("map", { tag: "a", title: "Open on map", attrs: `href="${esc(mapUrl(s.x, s.z))}" target="_blank" rel="noopener"` }) : ""}
        ${iconBtn("x", { title: "Remove from compare", attrs: `data-unpin="${i}"` })}
      </div>
    </div>`;
  }).join("");
}
function wireCompareTray(getPins, setPins, opts) {
  const o = opts || {};
  const msgEl = o.msgEl || null;
  const onChange = o.onChange || (() => {});
  const clearBtn = document.getElementById("compare-clear");
  const mdBtn = document.getElementById("compare-md");
  const shareBtn = document.getElementById("compare-share");
  const body = document.getElementById("compare-body");
  if (clearBtn && !clearBtn.dataset.wired) {
    clearBtn.dataset.wired = "1";
    clearBtn.onclick = () => { setPins([]); onChange(); };
  }
  if (mdBtn && !mdBtn.dataset.wired) {
    mdBtn.dataset.wired = "1";
    mdBtn.onclick = async () => {
      const pins = getPins();
      if (!pins.length) return;
      const ok = await copyText(compareMarkdown(pins));
      if (msgEl) setMsg(msgEl, ok ? "Compare list copied." : "Couldn't copy.", ok ? "ok" : "err");
    };
  }
  if (shareBtn && !shareBtn.dataset.wired) {
    shareBtn.dataset.wired = "1";
    shareBtn.onclick = async () => {
      const pins = getPins();
      if (!pins.length) return;
      syncCompareStore(pins);
      const ok = await copyText(compareShareUrl(pins));
      if (msgEl) setMsg(msgEl, ok ? "Compare link copied." : "Couldn't copy.", ok ? "ok" : "err");
    };
  }
  if (body && !body.dataset.wired) {
    body.dataset.wired = "1";
    body.addEventListener("click", e => {
      const b = e.target.closest("[data-unpin]");
      if (!b) return;
      const pins = getPins();
      pins.splice(Number(b.dataset.unpin), 1);
      setPins(pins);
      onChange();
    });
  }
}

// Pragmatic ChestShop / exchange paste → draft listing rows
// Optional trailing stock: "... [64]" → exchanges left
function parseSignDump(text) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const unitOf = u => (/^cs$/i.test(u) ? "cs" : /^ci$/i.test(u) ? "ci" : "");
  // "64 blaze rod for 1 diamond" / "8 blaze rod → 1 diamond"
  const reFor = /^(\d+)\s*(ci|cs)?\s+([a-z0-9_ ]+?)\s+(?:for|→|->|=)\s+(\d+)\s*(ci|cs)?\s+([a-z0-9_ ]+)$/i;
  // "B 8 blaze rod : S 1 diamond" / "B 64 Diamond S 2 Emerald"
  const reBS = /^b\s+(\d+)\s*(ci|cs)?\s+([a-z0-9_ ]+?)\s*[:|]?\s*s\s+(\d+)\s*(ci|cs)?\s+([a-z0-9_ ]+)$/i;
  const reStock = /\s*\[(\d+)\]\s*$/;
  lines.forEach(line => {
    let stock = null;
    let raw = line;
    const sm = raw.match(reStock);
    if (sm) {
      stock = parseInt(sm[1], 10);
      raw = raw.slice(0, sm.index).trim();
    }
    let m = raw.match(reBS) || raw.match(reFor);
    if (!m) return;
    // ChestShop B = what shop buys (want), S = what shop sells
    out.push({
      want_amount: parseInt(m[1], 10),
      want_unit: unitOf(m[2]),
      want_item: norm(m[3]),
      sell_amount: parseInt(m[4], 10),
      sell_unit: unitOf(m[5]),
      sell_item: norm(m[6]),
      stock
    });
  });
  return out;
}

// Stock honesty: reward fresh numeric stock; penalise quiet + still claiming in stock
function honestyInfo(listings) {
  const ls = (listings || []).filter(l => !l.timed_out && ("updated_at" in l || "stock" in l || "in_stock" in l));
  if (!ls.length) return null;
  let score = 70;
  const inStock = ls.filter(l => l.in_stock !== false && l.stock !== 0);
  const withCount = inStock.filter(l => l.stock != null && l.stock > 0);
  const quietClaim = inStock.filter(l => daysAgo(l.updated_at) >= 14);
  const fresh = inStock.filter(l => daysAgo(l.updated_at) <= 3);
  if (inStock.length) score += Math.round(20 * (withCount.length / inStock.length));
  if (inStock.length) score -= Math.round(35 * (quietClaim.length / inStock.length));
  if (inStock.length) score += Math.round(15 * (fresh.length / inStock.length));
  score = Math.max(0, Math.min(100, score));
  let label = "ok stock", cls = "ok";
  if (score >= 80) { label = "honest stock"; cls = "ok"; }
  else if (score < 45) { label = "stale stock?"; cls = "bad"; }
  else if (score < 65) { label = "mixed stock"; cls = "warn"; }
  const tip = `${withCount.length}/${Math.max(1, inStock.length)} counted \u00b7 ${quietClaim.length} quiet+in-stock \u00b7 ${fresh.length} fresh`;
  return { score, label, cls, tip };
}
function honestySparkline(scores) {
  const vals = (scores || []).map(Number).filter(n => !isNaN(n));
  if (vals.length < 2) return "";
  const w = 48, h = 14;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const pts = vals.map((s, i) => {
    const x = (i / (vals.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((s - min) / span) * (h - 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const tip = "Honesty " + vals[0] + " → " + vals[vals.length - 1] + " (" + vals.length + " nights)";
  return `<svg class="honesty-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(tip)}" title="${esc(tip)}"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${pts}"/></svg>`;
}
function honestyBadge(listings, historyScores) {
  const h = honestyInfo(listings);
  if (!h) return "";
  const spark = honestySparkline(historyScores);
  return `<span class="honesty-wrap" title="${esc(h.tip + " \u00b7 score " + h.score)}"><span class="tag ${h.cls} honesty">${esc(h.label)}</span>${spark}</span>`;
}
async function loadHonestyHistory(shopIds) {
  const ids = (shopIds || []).map(Number).filter(n => !isNaN(n));
  const out = {}; // shopId -> scores oldest→newest
  if (!ids.length) return out;
  const since = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("shop_honesty_history")
    .select("day, shop_id, score")
    .gte("day", since)
    .order("day", { ascending: true });
  (data || []).forEach(r => {
    if (!ids.some(id => String(id) === String(r.shop_id))) return;
    const k = String(r.shop_id);
    (out[k] = out[k] || []).push(r.score);
  });
  return out;
}

function tipDisplayForListing(listingId, serverVotes, me) {
  const votes = (serverVotes || []).slice();
  if (!me) return { votes, myVote: null };
  const mine = votes.find(v => String(v.user_id) === String(me.id));
  return { votes, myVote: mine ? mine.vote : null };
}

function tipSummary(votes) {
  const ok = votes || [];
  const fair = ok.filter(v => v.vote === "fair").length;
  const high = ok.filter(v => v.vote === "high").length;
  const low = ok.filter(v => v.vote === "low").length;
  return { fair, high, low, total: fair + high + low };
}
function tipVotesHtml(listingId, votes, myVote) {
  const s = tipSummary(votes);
  const btn = (v, label, title) =>
    `<button type="button" class="small tip-vote${myVote === v ? " primary" : ""}" data-tip="${v}" data-listing="${esc(listingId)}" title="${esc(title)}">${label}${s[v] ? " " + s[v] : ""}</button>`;
  return `<span class="tip-jar" title="Was this diamond rate fair?">
    ${btn("fair", "Fair", "Fair price")}
    ${btn("high", "High", "Too expensive")}
    ${btn("low", "Low", "Too cheap / good deal")}
  </span>`;
}

// Tip-jar brigading heuristics (staff tools)
function tipBrigadeFlags(votes, listings) {
  const list = votes || [];
  const now = Date.now();
  const HOUR = 3600000, DAY = 86400000;
  const flags = [];
  const byUser = {};
  const byListing = {};
  list.forEach(v => {
    (byUser[v.user_id] = byUser[v.user_id] || []).push(v);
    (byListing[v.listing_id] = byListing[v.listing_id] || []).push(v);
  });
  const shopOf = {};
  (listings || []).forEach(l => { shopOf[l.id] = l.shop_id; });

  Object.keys(byUser).forEach(uid => {
    const vs = byUser[uid];
    const day = vs.filter(v => now - new Date(v.created_at).getTime() < DAY);
    const hour = vs.filter(v => now - new Date(v.created_at).getTime() < HOUR);
    if (hour.length >= 6)
      flags.push({ kind: "burst", severity: "bad", user_id: uid, listing_id: null, n: hour.length, tip: hour.length + " tip votes in 1 hour" });
    else if (day.length >= 12)
      flags.push({ kind: "spam", severity: "warn", user_id: uid, listing_id: null, n: day.length, tip: day.length + " tip votes in 24 hours" });
    // Same vote across many listings of one shop
    const byShopVote = {};
    vs.forEach(v => {
      const sid = shopOf[v.listing_id];
      if (sid == null) return;
      const k = sid + ":" + v.vote;
      byShopVote[k] = (byShopVote[k] || 0) + 1;
    });
    Object.keys(byShopVote).forEach(k => {
      if (byShopVote[k] >= 5) {
        const shopId = k.split(":")[0];
        flags.push({ kind: "shop_sweep", severity: "warn", user_id: uid, listing_id: null, shop_id: shopId, n: byShopVote[k], tip: byShopVote[k] + " identical tip votes on one shop" });
      }
    });
  });

  Object.keys(byListing).forEach(lid => {
    const vs = byListing[lid];
    const hour = vs.filter(v => now - new Date(v.created_at).getTime() < HOUR);
    if (hour.length >= 5)
      flags.push({ kind: "listing_burst", severity: "bad", user_id: null, listing_id: lid, n: hour.length, tip: hour.length + " tip votes on one listing in 1 hour" });
  });

  return flags;
}

function stripHtml(s) { return String(s ?? "").replace(/<[^>]+>/g, ""); }
function shopPlainName(s) { return stripCodes((s && (s.name || s.styled_name)) || "?"); }
function compareMarkdown(pins) {
  const lines = ["**CivShops compare**", ""];
  (pins || []).forEach((p, i) => {
    const l = p.listing, s = p.shop || {};
    const r = dealRate(l, p.buying);
    const place = [s.city, s.nation && s.nation !== s.city ? s.nation : null].filter(Boolean).join(" \u00b7 ");
    lines.push(`${i + 1}. **${shopPlainName(s)}**${place ? ` (${place})` : ""}`);
    lines.push(`   - ${l.want_amount}${l.want_unit ? " " + l.want_unit.toUpperCase() : ""} ${l.want_item} → ${l.sell_amount}${l.sell_unit ? " " + l.sell_unit.toUpperCase() : ""} ${l.sell_item}`);
    if (r != null) lines.push(`   - ${fmtRate(r)}`);
    if (s.x != null && s.z != null) lines.push(`   - coords \`${s.x}, ${s.z}\` \u00b7 ${mapUrl(s.x, s.z)}`);
    lines.push(`   - shop: shop.html?id=${l.shop_id}&listing=${l.id}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

function shopCardHtml(s, opts) {
  const o = opts || {};
  const n = o.listingCount != null ? o.listingCount
    : (s.listings && s.listings[0] && s.listings[0].count != null ? s.listings[0].count : (s.listings || []).length);
  const actions = o.actions || "";
  const honesty = o.honestyHtml || "";
  const place = placeHtml(s);
  const where = (place || (s.x != null && s.z != null ? coordsHtml(s.x, s.z) : "no location")) + (o.distText || "");
  const owner = s.profiles && (s.owner_id || o.ownerId)
    ? ownerChip(s.profiles, s.owner_id || o.ownerId)
    : '<span class="meta">-</span>';
  const sale = saleBadgeHtml(s);
  return `<div class="card shop-card" data-href="shop.html?id=${s.id}">
    <div class="cardrow">${shopIcon(s, "card")}<div class="grow">
      <div class="title">${shopName(s)}${sale ? " " + sale : ""}</div>
      <div class="meta meta-line">${ratingHtml(s.reviews)} \u00b7 ${n} listing${n === 1 ? "" : "s"}${honesty ? " \u00b7 " + honesty : ""}</div>
      <div class="meta meta-line loc-line">${where}</div>
      <div class="meta meta-line owner-line">${owner}</div>
      ${actions ? `<div class="inline-actions shop-card-actions">${actions}</div>` : ""}
    </div></div>
  </div>`;
}

// stars: 4 -> ★★★★☆
const starsText = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
// reviews = [{rating, timed_out}], hidden (timed-out) ones don't count
function ratingSummary(reviews) {
  const ok = (reviews || []).filter(r => !r.timed_out);
  if (!ok.length) return null;
  const avg = ok.reduce((t, r) => t + r.rating, 0) / ok.length;
  return { avg, count: ok.length };
}
function ratingHtml(reviews) {
  const r = ratingSummary(reviews);
  return r ? `<span class="stars" title="${r.avg.toFixed(1)} out of 5">${starsText(r.avg)}</span> <span class="meta">${r.avg.toFixed(1)} (${r.count})</span>`
           : '<span class="meta">no reviews yet</span>';
}
// Trusted trader: enough reviews and a solid average
function isTrustedTrader(reviews) {
  const r = ratingSummary(reviews);
  return !!(r && r.count >= 3 && r.avg >= 4);
}
function tradedHereCount(reviews) {
  return (reviews || []).filter(r => !r.timed_out && r.traded).length;
}
function trustedBadge(reviews) {
  if (!isTrustedTrader(reviews)) return "";
  const n = tradedHereCount(reviews);
  const tip = "3+ reviews averaging 4★ or better" + (n ? " \u00b7 " + n + " marked traded here" : "");
  return `<span class="tag ok trusted" title="${esc(tip)}">trusted trader</span>`;
}
// Stock: null = in stock (no count), 0 = out, N = exchanges left. Keeps in_stock in sync.
function parseStockInput(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 0) return null;
  return n;
}
function inStockFromStock(stock) { return stock == null || stock > 0; }
function stockHtml(l) {
  if (!l || l.in_stock === false || l.stock === 0) return '<span class="tag bad">out of stock</span>';
  if (l.stock == null) return '<span class="tag ok">in stock</span>';
  return `<span class="tag ok">${l.stock} left</span>`;
}
function stockMeta(listings) {
  const ls = (listings || []).filter(l => !l.timed_out);
  if (!ls.length) return null;
  const newest = ls.reduce((m, l) => (!m || (l.updated_at && l.updated_at > m) ? l.updated_at : m), null);
  return newest;
}
function shopFreshnessHtml(listings) {
  const newest = stockMeta(listings);
  if (!newest) return "";
  const d = daysAgo(newest);
  if (d <= 3) return "";
  if (d < 14) return `<span class="tag warn">quiet ${d}d</span>`;
  return `<span class="tag bad">quiet ${d}d</span>`;
}
function lastSeenHtml(ts) {
  if (!ts) return '<span class="meta">last seen unknown</span>';
  const d = daysAgo(ts);
  if (d <= 0) return '<span class="updated fresh">seen today</span>';
  if (d === 1) return '<span class="updated fresh">seen yesterday</span>';
  if (d < 7) return `<span class="updated aging">seen ${d} days ago</span>`;
  return `<span class="updated stale-age">seen ${d} days ago</span>`;
}
function linkMentions(text) {
  // turn @McName into profile search links (resolved later if we have a map); plain escaped with @Name as link to search
  const escText = esc(text);
  return escText.replace(/@([A-Za-z0-9_]{2,32})/g, (m, name) =>
    `<a class="mention" href="profile.html?name=${encodeURIComponent(name)}">@${esc(name)}</a>`);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { return false; }
}

// shrink a picked image to a small JPEG (keeps uploads tiny), then upload it. folder: "comments" | "avatars"
function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Couldn't read that image.")), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That doesn't look like an image.")); };
    img.src = url;
  });
}
async function uploadImage(file, folder, uid) {
  if (!file.type.startsWith("image/")) return { ok: false, message: "Pick an image file (jpg, png or webp)." };
  let blob;
  try {
    const max = folder === "avatars" || folder === "shops" ? 256 : 900;
    blob = await resizeImage(file, max);
  } catch (e) { return { ok: false, message: e.message }; }
  const path = folder + "/" + uid + "/" + Date.now() + ".jpg";
  const { error } = await sb.storage.from("uploads").upload(path, blob, { contentType: "image/jpeg" });
  return error ? { ok: false, message: error.message } : { ok: true, path };
}

// unverified accounts are deleted 24h after signup: "5h 12m" / "under a minute" / "expired"
function timeLeft(createdAt) {
  const ms = new Date(createdAt).getTime() + 24 * 3600000 - Date.now();
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  return m < 1 ? "under a minute" : Math.floor(m / 60) + "h " + (m % 60) + "m";
}
/** True when the account can be auto-purged (unverified, not staff/head). */
function needsVerification(p) {
  return !!(p && !p.verified_at && !p.is_admin && !p.is_mod && !p.is_head);
}
function deleteCountdownText(createdAt) {
  const left = timeLeft(createdAt);
  return left === "expired"
    ? "your account is past the verification window and may be deleted soon"
    : "your account will be deleted in " + left;
}

// ------------------------------------------------------------ Minecraft-style text + shop icons
// Colour codes like in the game: &6 gold, &l bold, &o italic, &n underline, &m strikethrough, &r reset.
// The text is always escaped first, so nobody can sneak in HTML.
const MC_COLORS = { 0: "#000000", 1: "#0000AA", 2: "#00AA00", 3: "#00AAAA", 4: "#AA0000", 5: "#AA00AA", 6: "#FFAA00", 7: "#AAAAAA",
                    8: "#555555", 9: "#5555FF", a: "#55FF55", b: "#55FFFF", c: "#FF5555", d: "#FF55FF", e: "#FFFF55", f: "#FFFFFF" };
function stripCodes(s) { return String(s ?? "").replace(/[&§][0-9a-fk-or]/gi, ""); }
function mcText(raw) {
  const s = String(raw ?? "");
  let out = "", buf = "", color = null, f = {};
  const flush = () => {
    if (!buf) return;
    const cls = ["mc"];
    if (color) cls.push("c" + color);
    for (const k in f) if (f[k]) cls.push("f" + k);
    out += `<span class="${cls.join(" ")}">${esc(buf)}</span>`;
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch === "&" || ch === "§") && i + 1 < s.length && /[0-9a-fk-or]/i.test(s[i + 1])) {
      flush();
      const c = s[++i].toLowerCase();
      if (/[0-9a-f]/.test(c)) { color = c; f = {}; }            // a colour clears formatting, like in the game
      else if (c === "r") { color = null; f = {}; }
      else if ("lonm".includes(c)) f[c] = true;                 // (&k "scrambled" is ignored)
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}
// Always render shop names in Minecraft font. Fancy styled_name (with & codes) wins when set.
const shopName = s => {
  if (!s) return '<span class="shopname">?</span>';
  return `<span class="shopname">${mcText(s.styled_name || s.name || "?")}</span>`;
};

// Colour-code palette buttons (shared by shop edit + profile bio)
function paletteHtml() {
  return Object.entries(MC_COLORS).map(([k, c]) =>
    `<button type="button" data-code="&${k}" style="background:${c};color:${"0189".includes(k) ? "#fff" : "#000"}" title="&amp;${k}">${k}</button>`
  ).join("") +
  [["l", "B"], ["o", "I"], ["n", "U"], ["m", "S"], ["r", "R"]].map(([k, t]) =>
    `<button type="button" data-code="&${k}" title="&amp;${k}">${t}</button>`
  ).join("");
}
function insertMcCode(field, code) {
  if (!field) return;
  const a = field.selectionStart, b = field.selectionEnd, v = field.value;
  field.value = v.slice(0, a) + code + v.slice(b);
  field.focus();
  field.selectionStart = field.selectionEnd = a + code.length;
  field.dispatchEvent(new Event("input"));
}
// shop picture: an uploaded one, else an item texture, else a chest
// size: number (px) | "card" | "hero" | "sm"
function normalizeGroupIcons(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}
function groupIconEntry(shop, groupName) {
  const key = String(groupName || "").trim();
  const entry = normalizeGroupIcons(shop && shop.group_icons)[key];
  if (!entry || typeof entry !== "object") return null;
  const icon_item = entry.icon_item || null;
  const icon_path = entry.icon_path || null;
  if (!icon_item && !icon_path) return null;
  return { icon_item, icon_path };
}
function groupIconHtml(shop, groupName, size) {
  const meta = groupIconEntry(shop, groupName);
  return shopIcon(meta ? { icon_item: meta.icon_item, icon_path: meta.icon_path } : { icon_item: null, icon_path: null }, size);
}
function groupSectionId(groupName) {
  const k = String(groupName || "").trim();
  return "shop-group-" + (k ? encodeURIComponent(k) : "other");
}
function orderedListingGroupKeys(listings) {
  const keys = [];
  const seen = new Set();
  sortListingsOwnerOrder(listings || []).forEach(l => {
    const key = String(l.group_name || "").trim();
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  });
  return keys;
}
function groupNavLabel(key) {
  return key ? key : "Other";
}

function shopIcon(s, size) {
  const custom = !!(s && s.icon_path);
  const url = custom ? publicUrl(s.icon_path) : itemImg((s && s.icon_item) || "chest");
  let slotCls = "card", px = 88;
  if (size === "hero") { slotCls = "hero"; px = 120; }
  else if (size === "sm") { slotCls = "md"; px = 32; }
  else if (typeof size === "number") {
    px = size;
    slotCls = size >= 100 ? "hero" : size >= 48 ? "card" : "md";
  }
  return `<span class="slot ${slotCls} shopicon-wrap"><img class="shopicon${custom ? "" : " pix"}" width="${px}" height="${px}" src="${esc(url)}" alt="" onerror="this.parentElement.style.visibility='hidden'"></span>`;
}

// ------------------------------------------------------------ session + profile
const IMP_RESTORE_KEY = "civmc_imp_restore";
const IMP_LABEL_KEY = "civmc_imp_label";

function isImpersonating() {
  try { return !!sessionStorage.getItem(IMP_RESTORE_KEY); } catch (e) { return false; }
}
function clearImpersonationStorage() {
  try {
    sessionStorage.removeItem(IMP_RESTORE_KEY);
    sessionStorage.removeItem(IMP_LABEL_KEY);
  } catch (e) {}
  document.body.classList.remove("impersonating");
  const bar = document.getElementById("impersonate-bar");
  if (bar) bar.remove();
  syncTopChromeOffset();
}

/** Keep body padding / fixed nav + sticky toolbar tops in sync with chrome heights. */
function syncTopChromeOffset() {
  const root = document.documentElement;
  const imp = document.getElementById("impersonate-bar");
  const verify = document.getElementById("verify-banner");
  const nav = document.getElementById("nav");
  // offsetHeight ignores visual transforms; ceil(rect) can double-count with zoom.
  const ih = imp ? Math.ceil(imp.offsetHeight) : 0;
  const vh = verify ? Math.ceil(verify.offsetHeight) : 0;
  const nh = nav ? Math.ceil(nav.offsetHeight) : 52;
  root.style.setProperty("--impersonate-h", ih + "px");
  root.style.setProperty("--verify-h", vh + "px");
  root.style.setProperty("--nav-h", (nh || 52) + "px");
}

let topChromeRo = null;
function observeTopChrome() {
  if (typeof ResizeObserver === "undefined") return;
  if (!topChromeRo) {
    topChromeRo = new ResizeObserver(() => syncTopChromeOffset());
  }
  topChromeRo.disconnect();
  const imp = document.getElementById("impersonate-bar");
  const verify = document.getElementById("verify-banner");
  const nav = document.getElementById("nav");
  if (imp) topChromeRo.observe(imp);
  if (verify) topChromeRo.observe(verify);
  if (nav) topChromeRo.observe(nav);
}

function renderImpersonateBar() {
  if (!isImpersonating()) {
    syncTopChromeOffset();
    return;
  }
  document.body.classList.add("impersonating");
  let bar = document.getElementById("impersonate-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "impersonate-bar";
    bar.className = "impersonate-bar";
    document.body.prepend(bar);
  }
  let label = "user";
  try { label = sessionStorage.getItem(IMP_LABEL_KEY) || label; } catch (e) {}
  bar.innerHTML = `<span>Impersonating <b>${esc(label)}</b>. Exit to return to your account.</span>` +
    `<button type="button" class="small" id="impersonate-exit" title="Return to your admin account">Exit</button>` +
    `<button type="button" class="small" id="impersonate-exit-x" title="Exit impersonation" aria-label="Exit">✕</button>`;
  const exit = () => exitImpersonation();
  bar.querySelector("#impersonate-exit").onclick = exit;
  bar.querySelector("#impersonate-exit-x").onclick = exit;
  syncTopChromeOffset();
  observeTopChrome();
}

// Head admin only (enforced again in manage-user). Switches the real auth session to the target
// user so RLS / owner checks work; Exit restores the saved admin tokens.
async function startImpersonation(userId) {
  if (isImpersonating()) return { ok: false, message: "Already impersonating someone. Exit first." };
  const session = await getSession();
  if (!session) return { ok: false, message: "Not logged in." };
  const me = await getProfile(session.user.id);
  if (!me || !me.is_head || me.timed_out) return { ok: false, message: "Only the head admin can log into users." };
  if (userId === me.id) return { ok: false, message: "Pick a different account." };

  const r = await callFn("manage-user", { action: "impersonate", user_id: userId });
  if (!r.ok) return r;

  const restore = USE_MOCK
    ? { access_token: session.user.id, refresh_token: "mock" }
    : { access_token: session.access_token, refresh_token: session.refresh_token };
  try {
    sessionStorage.setItem(IMP_RESTORE_KEY, JSON.stringify(restore));
    sessionStorage.setItem(IMP_LABEL_KEY, r.data.username || r.data.mc_username || "user");
  } catch (e) {
    return { ok: false, message: "Could not save admin session for exit." };
  }

  if (USE_MOCK || r.data.mock_user_id) {
    const { error } = await sb.auth.setSession({
      access_token: r.data.mock_user_id || r.data.user_id,
      refresh_token: "mock"
    });
    if (error) {
      clearImpersonationStorage();
      return { ok: false, message: error.message };
    }
  } else {
    const { error } = await sb.auth.verifyOtp({
      token_hash: r.data.token_hash,
      type: "email"
    });
    if (error) {
      clearImpersonationStorage();
      return { ok: false, message: error.message || "Could not open that user's session." };
    }
  }
  return { ok: true, data: r.data };
}

async function exitImpersonation() {
  let restore = null;
  try { restore = JSON.parse(sessionStorage.getItem(IMP_RESTORE_KEY) || "null"); } catch (e) {}
  if (!restore || !restore.access_token) {
    clearImpersonationStorage();
    location.href = "admin.html";
    return;
  }
  const { error } = await sb.auth.setSession({
    access_token: restore.access_token,
    refresh_token: restore.refresh_token || "mock"
  });
  clearImpersonationStorage();
  if (error) {
    await sb.auth.signOut();
    location.href = "login.html";
    return;
  }
  location.href = "admin.html";
}

// Post-auth landing: honor ?next= / ?return= / ?redirect= only for safe same-origin *.html pages.
function safeAuthReturn(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.startsWith("//") || s.includes("..") || /[\\]/.test(s)) return null;
  try {
    const u = new URL(s, location.href);
    if (u.origin !== location.origin) return null;
    const file = (u.pathname.split("/").pop() || "").toLowerCase();
    if (!/^[a-z0-9._-]+\.html$/.test(file)) return null;
    if (file === "login.html" || file === "signup.html") return null;
    return file + u.search + u.hash;
  } catch (e) {
    return null;
  }
}
function postAuthDest(fallback = "index.html") {
  const q = new URLSearchParams(location.search);
  return safeAuthReturn(q.get("next") || q.get("return") || q.get("redirect")) || fallback;
}
function goPostAuth(fallback = "index.html") {
  location.href = postAuthDest(fallback);
}
function loginHref(extraParams) {
  const params = new URLSearchParams(extraParams || {});
  const here = (location.pathname.split("/").pop() || "index.html") + location.search + location.hash;
  const next = safeAuthReturn(here);
  if (next && !params.has("next")) params.set("next", next);
  const qs = params.toString();
  return qs ? "login.html?" + qs : "login.html";
}

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
async function getProfile(uid) {
  const { data } = await sb.from("profiles").select("*").eq("id", uid).single();
  return data;
}
const isStaff = p => !!(p && (p.is_admin || p.is_mod) && !stillTimedOut(p));
const isVerified = p => !!(p && p.verified_at && !stillTimedOut(p));

async function kickTimedOut() {
  // Prefer restoring the head admin over losing their session mid-impersonation.
  if (isImpersonating()) {
    await exitImpersonation();
    return;
  }
  await sb.auth.signOut();
  location.href = "login.html?timedout=1";
}

// need = "admin" | "head" | "staff" | null.  returns {session, profile} or redirects
async function requireLogin(need = null) {
  const session = await getSession();
  if (!session) { location.href = loginHref(); return null; }
  const profile = await getProfile(session.user.id);
  if (profile && stillTimedOut(profile)) { await kickTimedOut(); return null; }
  const ok =
    need === null ||
    (need === "head" && profile && profile.is_head && !stillTimedOut(profile)) ||
    ((need === "admin" || need === true) && profile && profile.is_admin && !stillTimedOut(profile)) ||
    (need === "staff" && isStaff(profile));
  if (!ok) { location.href = "index.html"; return null; }
  return { session, profile };
}

async function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const session = await getSession();
  let nagProfile = null;
  let drawer = "";
  let rightExtra = "";

  if (session) {
    const profile = await getProfile(session.user.id);
    if (profile && stillTimedOut(profile)) { await kickTimedOut(); return; }
    hadSession = true;
    nagProfile = profile;
    // bump last-seen (best effort, throttle in session) - skip while impersonating
    try {
      if (!isImpersonating() && !sessionStorage.getItem("seen_ping")) {
        sessionStorage.setItem("seen_ping", "1");
        sb.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", session.user.id);
      }
    } catch (e) {}

    const name = profile ? esc(userName(profile)) : "Account";
    drawer += `<div class="nav-drawer-user"><span class="nav-drawer-user-label">Signed in</span><strong>${name}</strong></div>`;
    drawer += `<a class="nav-drawer-link" href="dashboard.html">My shops</a>`;
    drawer += `<a class="nav-drawer-link" href="favourites.html">Favourites</a>`;
    drawer += `<a class="nav-drawer-link" href="settings.html">Settings</a>`;
    drawer += `<a class="nav-drawer-link" href="profile.html?id=${esc(session.user.id)}">My profile</a>`;
    if (needsVerification(profile)) {
      drawer += `<a class="nav-drawer-link nav-drawer-primary" href="verify.html">Verify account</a>`;
    }
    if (isStaff(profile) || (profile && (profile.is_admin || profile.is_head))) {
      drawer += `<div class="nav-drawer-sep" role="separator"></div>`;
      if (isStaff(profile)) drawer += `<a class="nav-drawer-link" href="mod.html">Moderation</a>`;
      if (profile && (profile.is_admin || profile.is_head)) drawer += `<a class="nav-drawer-link" href="admin.html">Admin</a>`;
    }
    drawer += `<div class="nav-drawer-sep" role="separator"></div>`;
    if (isImpersonating()) {
      drawer += `<button type="button" class="nav-drawer-link nav-drawer-action" id="logout">Exit impersonation</button>`;
    } else {
      drawer += `<button type="button" class="nav-drawer-link nav-drawer-action" id="logout">Log out</button>`;
    }
    try {
      const unread = await countUnreadNotifications(session.user.id);
      if (unread > 0) {
        rightExtra += `<a class="nav-note-badge" href="dashboard.html#notifications" title="${unread} unread notification${unread === 1 ? "" : "s"}">${unread > 9 ? "9+" : unread}</a>`;
        drawer = drawer.replace(
          'href="dashboard.html">My shops</a>',
          `href="dashboard.html#notifications">My shops <span class="tag warn">${unread}</span></a>`
        );
      }
    } catch (e) {}
  } else {
    drawer += `<a class="nav-drawer-link" href="login.html">Log in</a>`;
    drawer += `<a class="nav-drawer-link nav-drawer-primary" href="signup.html">Sign up</a>`;
  }

  if (USE_MOCK) {
    rightExtra += `<span class="tag warn" title="add ?resetmock to the URL to wipe test data">local test mode</span>`;
  }

  const wasOpen = document.body.classList.contains("nav-menu-open");
  nav.innerHTML =
    brandHtml() +
    navLeftHtml() +
    `<span class="nav-right">${rightExtra}` +
      `<button type="button" class="nav-menu-btn" id="nav-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav-drawer">` +
        `<span class="nav-burger" aria-hidden="true"><span></span><span></span><span></span></span>` +
      `</button>` +
    `</span>`;

  paintNavDrawer(drawer);
  wireNavMenu();
  if (wasOpen) setNavMenuOpen(true);
  renderImpersonateBar();
  renderVerifyBanner(session ? nagProfile : null);
  syncTopChromeOffset();
  observeTopChrome();

  const lo = document.getElementById("logout");
  if (lo) {
    lo.onclick = async () => {
      if (isImpersonating()) { await exitImpersonation(); return; }
      await sb.auth.signOut();
      location.href = "index.html";
    };
  }
  // Don't nag the impersonated user to change "their" password.
  if (nagProfile && !isImpersonating()) maybeNagPassword(nagProfile);
}

/** Fixed top banner for logged-in unverified accounts subject to 24h purge. */
function renderVerifyBanner(profile) {
  const existing = document.getElementById("verify-banner");
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const onVerifyPage = page === "verify.html";
  if (!needsVerification(profile) || onVerifyPage) {
    if (existing) existing.remove();
    document.body.classList.remove("has-verify-banner");
    syncTopChromeOffset();
    observeTopChrome();
    return;
  }
  let bar = existing;
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "verify-banner";
    bar.className = "verify-banner";
    bar.setAttribute("role", "status");
    const imp = document.getElementById("impersonate-bar");
    const navEl = document.getElementById("nav");
    if (imp) document.body.insertBefore(bar, imp.nextSibling);
    else if (navEl) document.body.insertBefore(bar, navEl);
    else document.body.insertBefore(bar, document.body.firstChild);
  }
  document.body.classList.add("has-verify-banner");
  const countdown = deleteCountdownText(profile.created_at);
  bar.innerHTML =
    `<span class="verify-banner-text">Not verified - <b>${esc(countdown)}</b>.</span>` +
    `<a class="primary small verify-banner-cta" href="verify.html">verify here</a>`;
  syncTopChromeOffset();
  observeTopChrome();
  requestAnimationFrame(() => {
    syncTopChromeOffset();
    requestAnimationFrame(syncTopChromeOffset);
  });
}

// every 20s: if the account got timed out while the page is open, log out
setInterval(async () => {
  const s = await getSession();
  if (!s) {
    if (isImpersonating()) { exitImpersonation(); return; }
    if (hadSession) location.href = "login.html?timedout=1";
    return;
  }
  const p = await getProfile(s.user.id);
  if (p && stillTimedOut(p)) kickTimedOut();
}, 20000);

// Admin-created accounts get a popup suggesting their own password. "Later" hides it for this visit.
function maybeNagPassword(profile) {
  if (!profile || !profile.must_change_password) return;
  try { if (sessionStorage.getItem("pwnag")) return; } catch (e) {}
  const o = document.createElement("div");
  o.className = "modal-overlay";
  o.innerHTML = `
    <div class="modal" role="dialog">
      <h2>Pick your own password?</h2>
      <p class="meta">An admin chose your first password. It's a good idea to change it so only you know it.</p>
      <input type="password" id="nag-pw" placeholder="New password (8+ characters)" autocomplete="new-password" style="width:100%;margin-bottom:6px">
      <input type="password" id="nag-pw2" placeholder="Repeat it" autocomplete="new-password" style="width:100%">
      <div class="msg" id="nag-msg"></div>
      <div class="row">
        <button class="primary" type="button" id="nag-save">Change password</button>
        <button type="button" id="nag-later">Later</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  const m = o.querySelector("#nag-msg");
  o.querySelector("#nag-later").onclick = () => {
    try { sessionStorage.setItem("pwnag", "1"); } catch (e) {}
    o.remove();
  };
  o.querySelector("#nag-save").onclick = async () => {
    const a = o.querySelector("#nag-pw").value, b = o.querySelector("#nag-pw2").value;
    if (a.length < 8) { setMsg(m, "Use at least 8 characters.", "err"); return; }
    if (a !== b) { setMsg(m, "Those don't match.", "err"); return; }
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { setMsg(m, error.message, "err"); return; }
    await sb.from("profiles").update({ must_change_password: false }).eq("id", profile.id);
    o.remove();
  };
}

// ------------------------------------------------------------ helpers shared by pages
// call an edge function. returns {ok, data} or {ok:false, message}
async function callFn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (!error && !(data && data.error)) return { ok: true, data };
  let m = data && data.error;
  if (!m && error && error.context && error.context.json) {
    try { m = (await error.context.json()).error; } catch (e) {}
  }
  return { ok: false, message: m || (error && error.message) || "Something went wrong." };
}

function setMsg(el, text, kind) {
  el.textContent = text;
  el.className = "msg" + (kind ? " " + kind : "");
}

// "Owner: <profile link> \u00b7 Discord: name" (plain meta line)
function ownerHtml(p, ownerId) {
  if (!p) return "owner: ?";
  const link = ownerId ? `<a href="profile.html?id=${esc(ownerId)}">${esc(userName(p))}</a>` : esc(userName(p));
  return "owner: " + link + (p.discord_username ? " \u00b7 Discord: " + esc(p.discord_username) : "");
}

// timeout / untimeout a shop, listing, comment or review (mods + admins). returns error text or null
// hours: number of hours, or null/undefined for until removed (only used when on=true)
async function setTimeoutFlag(table, id, on, hours) {
  const patch = on
    ? { timed_out: true, timed_out_until: timeoutUntilIso(hours == null ? null : hours) }
    : { timed_out: false, timed_out_until: null };
  const { error } = await sb.from(table).update(patch).eq("id", id);
  return error ? error.message : null;
}

/** Ask for duration then apply content timeout. Returns error text, "" if cancelled, or null on success. */
async function applyContentTimeout(table, id, on) {
  if (!on) return setTimeoutFlag(table, id, false);
  const pick = await pickTimeoutDuration({ title: "Timeout duration" });
  if (!pick) return "";
  return setTimeoutFlag(table, id, true, pick.hours);
}

/** Ask for duration then timeout a user via manage-user. Returns { ok, message }. Cancelled → { ok: true, cancelled: true }. */
async function applyUserTimeout(userId, on) {
  if (!on) return callFn("manage-user", { action: "untimeout", user_id: userId });
  const pick = await pickTimeoutDuration({ title: "Timeout account", body: "How long should this account stay timed out?" });
  if (!pick) return { ok: true, cancelled: true };
  return callFn("manage-user", { action: "timeout", user_id: userId, hours: pick.hours });
}

// ---- shared modal confirm / report UI
const REPORT_REASONS = [
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "duplicate", label: "Duplicate" },
  { id: "false_advertising", label: "False advertising" },
  { id: "other", label: "Other" }
];
function reportReasonLabel(id) {
  const r = REPORT_REASONS.find(x => x.id === id);
  return r ? r.label : (id || "Other");
}
function formatReportReason(category, details) {
  const label = reportReasonLabel(category || "other");
  const d = String(details || "").trim();
  return d ? (label + ": " + d).slice(0, 500) : label.slice(0, 500);
}
function parseReportReason(r) {
  const cat = r && r.reason_category;
  if (cat && REPORT_REASONS.some(x => x.id === cat)) {
    return { category: cat, label: reportReasonLabel(cat), details: String(r.reason || "").trim() };
  }
  const raw = String((r && r.reason) || "").trim();
  for (const opt of REPORT_REASONS) {
    if (raw === opt.label) return { category: opt.id, label: opt.label, details: "" };
    const pref = opt.label + ": ";
    if (raw.startsWith(pref)) return { category: opt.id, label: opt.label, details: raw.slice(pref.length) };
  }
  return { category: "other", label: "Other", details: raw };
}

function closeUiModal() {
  const el = document.getElementById("ui-modal-root");
  if (el) el.remove();
  document.body.classList.remove("ui-modal-open");
}

/** Centered confirm. Returns Promise<boolean>. */
function confirmModal(opts) {
  const o = opts || {};
  closeUiModal();
  return new Promise(resolve => {
    const root = document.createElement("div");
    root.id = "ui-modal-root";
    root.className = "modal-overlay ui-modal-overlay";
    root.innerHTML = `<div class="modal ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title">
      <h2 id="ui-modal-title">${esc(o.title || "Confirm")}</h2>
      <p class="ui-modal-body">${o.html ? (o.body || "") : esc(o.body || "Are you sure?")}</p>
      <div class="ui-modal-actions row">
        <button type="button" class="small" data-ui-cancel>${esc(o.cancelLabel || "Cancel")}</button>
        <button type="button" class="${o.danger ? "small danger" : "primary small"}" data-ui-ok>${esc(o.confirmLabel || "Confirm")}</button>
      </div>
    </div>`;
    document.body.appendChild(root);
    document.body.classList.add("ui-modal-open");
    const done = v => { closeUiModal(); resolve(v); };
    root.querySelector("[data-ui-cancel]").onclick = () => done(false);
    root.querySelector("[data-ui-ok]").onclick = () => done(true);
    root.addEventListener("click", e => { if (e.target === root) done(false); });
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
    };
    root.addEventListener("keydown", onKey);
    root.querySelector("[data-ui-ok]").focus();
  });
}

/** Text input dialog. Returns string (maybe empty) or null if cancelled. */
function promptModal(opts) {
  const o = opts || {};
  closeUiModal();
  return new Promise(resolve => {
    const root = document.createElement("div");
    root.id = "ui-modal-root";
    root.className = "modal-overlay ui-modal-overlay";
    const inputId = "ui-prompt-input";
    const bodyHtml = o.html ? (o.body || "") : esc(o.body || "");
    const labelHtml = o.label
      ? `<label class="ui-prompt-label" for="${inputId}">${esc(o.label)}</label>`
      : "";
    root.innerHTML = `<div class="modal ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title">
      <h2 id="ui-modal-title">${esc(o.title || "Input")}</h2>
      ${bodyHtml ? `<p class="ui-modal-body">${bodyHtml}</p>` : ""}
      ${labelHtml}
      <input type="${esc(o.inputType || "text")}" id="${inputId}" class="ui-prompt-input" maxlength="${Number(o.maxLength) || 120}" value="${esc(o.defaultValue || "")}" placeholder="${esc(o.placeholder || "")}" style="width:100%;margin-top:8px">
      <div class="ui-modal-actions row">
        <button type="button" class="small" data-ui-cancel>${esc(o.cancelLabel || "Cancel")}</button>
        <button type="button" class="primary small" data-ui-ok>${esc(o.confirmLabel || "OK")}</button>
      </div>
    </div>`;
    document.body.appendChild(root);
    document.body.classList.add("ui-modal-open");
    const input = root.querySelector("#" + inputId);
    const done = v => { closeUiModal(); resolve(v); };
    root.querySelector("[data-ui-cancel]").onclick = () => done(null);
    root.querySelector("[data-ui-ok]").onclick = () => done(input.value);
    root.addEventListener("click", e => { if (e.target === root) done(null); });
    root.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); done(null); }
      if (e.key === "Enter" && e.target === input) { e.preventDefault(); done(input.value); }
    });
    input.focus();
    input.select();
  });
}

/** Report dialog with reason chips + details. Returns {text, kind} or null if cancelled. */
async function sendReport(type, id) {
  const session = await getSession();
  if (!session) { location.href = loginHref(); return null; }
  closeUiModal();
  const picked = await new Promise(resolve => {
    const root = document.createElement("div");
    root.id = "ui-modal-root";
    root.className = "modal-overlay ui-modal-overlay";
    root.innerHTML = `<div class="modal ui-modal ui-modal-report" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title">
      <h2 id="ui-modal-title">Report ${esc(type)}</h2>
      <p class="meta" style="margin:0 0 8px">Pick a reason. A mod or admin will look at it.</p>
      <div class="report-reason-chips" id="report-chips">
        ${REPORT_REASONS.map((r, i) => `<button type="button" class="small report-chip${i === 0 ? " on" : ""}" data-reason="${r.id}">${esc(r.label)}</button>`).join("")}
      </div>
      <label class="meta" for="report-details">Details (optional, required for Other)</label>
      <textarea id="report-details" maxlength="500" rows="3" placeholder="Anything mods should know…"></textarea>
      <div class="ui-modal-actions row">
        <button type="button" class="small" data-ui-cancel>Cancel</button>
        <button type="button" class="primary small" data-ui-ok>Send report</button>
      </div>
      <p class="msg" id="report-modal-msg"></p>
    </div>`;
    document.body.appendChild(root);
    document.body.classList.add("ui-modal-open");
    let category = "inappropriate";
    const chips = root.querySelector("#report-chips");
    const details = root.querySelector("#report-details");
    const errEl = root.querySelector("#report-modal-msg");
    chips.addEventListener("click", e => {
      const b = e.target.closest("[data-reason]");
      if (!b) return;
      category = b.dataset.reason;
      chips.querySelectorAll(".report-chip").forEach(x => x.classList.toggle("on", x === b));
    });
    const done = v => { closeUiModal(); resolve(v); };
    root.querySelector("[data-ui-cancel]").onclick = () => done(null);
    root.addEventListener("click", e => { if (e.target === root) done(null); });
    root.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); }
    });
    root.querySelector("[data-ui-ok]").onclick = () => {
      const d = details.value.trim();
      if (category === "other" && !d) {
        setMsg(errEl, "Add a short detail for Other.", "err");
        return;
      }
      done({ category, details: d });
    };
    details.focus();
  });
  if (!picked) return null;
  const reason = formatReportReason(picked.category, picked.details);
  const row = {
    reporter_id: session.user.id,
    target_type: type,
    target_id: String(id),
    reason,
    reason_category: picked.category
  };
  const { error } = await sb.from("reports").insert(row);
  return error ? { text: error.message, kind: "err" } : { text: "Report sent. Thanks!", kind: "ok" };
}

// ---- find: recent searches (localStorage)
const RECENT_SEARCHES_KEY = "civmc_recent_searches";
function loadRecentSearches() {
  try {
    const a = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(a) ? a.filter(x => x && typeof x.q === "string").slice(0, 8) : [];
  } catch (e) { return []; }
}
function pushRecentSearch(mode, q) {
  const term = String(q || "").trim();
  if (!term) return;
  const m = ["sell", "want", "shop"].includes(mode) ? mode : "sell";
  const next = [{ mode: m, q: term }, ...loadRecentSearches().filter(x => !(x.mode === m && x.q.toLowerCase() === term.toLowerCase()))].slice(0, 8);
  try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)); } catch (e) {}
}

// ---- listings: owner order + groups
function listingIsOut(l) {
  return !!(l && (l.in_stock === false || l.stock === 0));
}
function sortListingsOwnerOrder(list) {
  return (list || []).slice().sort((a, b) => {
    const ga = String(a.group_name || "").toLowerCase();
    const gb = String(b.group_name || "").toLowerCase();
    if (ga !== gb) {
      if (!ga) return 1;
      if (!gb) return -1;
      return ga.localeCompare(gb);
    }
    const sa = a.sort_order != null ? a.sort_order : a.id;
    const sb = b.sort_order != null ? b.sort_order : b.id;
    if (sa !== sb) return sa - sb;
    return (a.id || 0) - (b.id || 0);
  });
}
function nextListingSortOrder(listings) {
  const n = (listings || []).reduce((m, l) => Math.max(m, l.sort_order != null ? l.sort_order : 0), 0);
  return n + 1;
}

// ---- market helpers (client-side recompute for nation filter; matches market_now maths)
function marketQuantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function computeMarketNow(listings, shops, profiles, placeFilter) {
  let city = "";
  let nation = "";
  if (placeFilter && typeof placeFilter === "object") {
    city = placeFilter.city || "";
    nation = placeFilter.nation || "";
  } else if (typeof placeFilter === "string") {
    nation = placeFilter;
  }
  const shopOk = {};
  (shops || []).forEach(s => {
    const p = (profiles || []).find(x => String(x.id) === String(s.owner_id));
    if (!s || !shopListedPublicly(s, p)) return;
    if (!placeFilterMatch(s, city, nation)) return;
    shopOk[String(s.id)] = true;
  });
  const per = {};
  const push = (item, side, shop, rate) => {
    const k = item + "|" + side + "|" + shop;
    (per[k] = per[k] || { item, side, rates: [] }).rates.push(rate);
  };
  for (const l of listings || []) {
    if (!(l.in_stock && !l.timed_out && shopOk[String(l.shop_id)])) continue;
    if (CURRENCY[l.want_item] != null && CURRENCY[l.sell_item] == null)
      push(l.sell_item, "sell", l.shop_id, rawCount(l.want_amount, l.want_unit) * CURRENCY[l.want_item] / rawCount(l.sell_amount, l.sell_unit));
    if (CURRENCY[l.sell_item] != null && CURRENCY[l.want_item] == null)
      push(l.want_item, "buy", l.shop_id, rawCount(l.sell_amount, l.sell_unit) * CURRENCY[l.sell_item] / rawCount(l.want_amount, l.want_unit));
  }
  const groups = {};
  Object.values(per).forEach(g => {
    const r = g.rates.slice().sort((a, b) => a - b);
    const key = g.item + "|" + g.side;
    (groups[key] = groups[key] || { item: g.item, side: g.side, v: [] }).v.push(marketQuantile(r, 0.5));
  });
  return Object.values(groups).map(g => {
    const v = g.v.slice().sort((a, b) => a - b);
    const q1 = marketQuantile(v, 0.25), med = marketQuantile(v, 0.5), q3 = marketQuantile(v, 0.75);
    const spread = Math.max(1.5 * (q3 - q1), 0.3 * med);
    const kept = v.filter(x => x >= q1 - spread && x <= q3 + spread);
    return {
      item: g.item, side: g.side,
      median: marketQuantile(kept, 0.5), low: kept[0], high: kept[kept.length - 1],
      n: kept.length, outliers: v.length - kept.length
    };
  });
}
function marketSparkline(values, color) {
  const vals = (values || []).map(Number).filter(n => !isNaN(n));
  if (vals.length < 2) return '<span class="m-spark empty" title="Not enough history"></span>';
  const w = 56, h = 16;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(1e-9, max - min);
  const pts = vals.map((s, i) => {
    const x = (i / (vals.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((s - min) / span) * (h - 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const col = color || "#7fb35a";
  const tip = vals[0].toPrecision(3) + " → " + vals[vals.length - 1].toPrecision(3);
  return `<svg class="m-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(tip)}" title="${esc(tip)}"><polyline fill="none" stroke="${esc(col)}" stroke-width="1.4" stroke-linejoin="round" points="${pts}"/></svg>`;
}
function marketSpread(sell, buy) {
  if (!sell || !buy || sell.median == null || buy.median == null) return null;
  return sell.median - buy.median;
}

// ---- owner alerts (stale 7d + overprice / restock)
const ALERT_STALE_DAYS = 7;
const PRICE_ALERT_MULT = 1.75;
function listingAlertClock(l) {
  const u = l && l.updated_at ? Date.parse(l.updated_at) : 0;
  const a = l && l.stale_acked_at ? Date.parse(l.stale_acked_at) : 0;
  return Math.max(u, a) || 0;
}
function listingStaleAlert(l) {
  if (!l || l.timed_out || listingIsOut(l)) return false;
  const t = listingAlertClock(l);
  if (!t) return false;
  return (Date.now() - t) / 86400000 >= ALERT_STALE_DAYS;
}
function listingPriceAlertAcked(l) {
  if (!l || !l.price_alert_acked_at) return false;
  const acked = Date.parse(l.price_alert_acked_at);
  const updated = Date.parse(l.updated_at || 0);
  if (acked < updated) return false;
  return (Date.now() - acked) / 86400000 < ALERT_STALE_DAYS;
}
function listingOverpriceAlert(l, sellMedian) {
  if (!l || l.timed_out || listingIsOut(l) || listingPriceAlertAcked(l)) return false;
  if (!sellMedian || CURRENCY[l.want_item] == null || CURRENCY[l.sell_item] != null) return false;
  const rate = dealRate(l, false);
  if (rate == null) return false;
  return rate >= sellMedian * PRICE_ALERT_MULT;
}
function listingRestockAlert(l) {
  if (!l || l.timed_out || listingPriceAlertAcked(l)) return false;
  if (listingIsOut(l)) return true;
  return l.stock != null && l.stock > 0 && l.stock <= 2;
}
function collectOwnerAlerts(shops, marketByItem) {
  const alerts = [];
  (shops || []).forEach(s => {
    (s.listings || []).forEach(l => {
      if (listingStaleAlert(l)) {
        alerts.push({
          kind: "stale", listing: l, shop: s,
          text: `${l.sell_item}: not updated in ${ALERT_STALE_DAYS}+ days`,
          key: "stale:" + l.id
        });
      }
      const med = marketByItem && marketByItem[l.sell_item] && marketByItem[l.sell_item].sell
        ? marketByItem[l.sell_item].sell.median : null;
      if (listingOverpriceAlert(l, med)) {
        const rate = dealRate(l, false);
        alerts.push({
          kind: "overprice", listing: l, shop: s,
          text: `${l.sell_item}: sell price ~${fmtRate(rate)} vs market ~${fmtRate(med)}`,
          key: "overprice:" + l.id
        });
      } else if (listingRestockAlert(l)) {
        alerts.push({
          kind: "restock", listing: l, shop: s,
          text: `${l.sell_item}: ${listingIsOut(l) ? "out of stock (needs restock)" : "stock nearly gone (" + l.stock + ")"}`,
          key: "restock:" + l.id
        });
      }
    });
  });
  return alerts;
}
async function ignoreOwnerAlert(alert) {
  if (!alert || !alert.listing) return { error: "no listing" };
  const now = new Date().toISOString();
  const patch = alert.kind === "stale"
    ? { stale_acked_at: now }
    : { price_alert_acked_at: now };
  const { error } = await sb.from("listings").update(patch).eq("id", alert.listing.id);
  return { error: error ? error.message : null };
}
function alertsEnabled(profile) {
  return !(profile && profile.alerts_enabled === false);
}

// ---- sales + notifications
function shopSaleActive(s) {
  if (!s || !s.sale_active) return false;
  const now = Date.now();
  if (s.sale_starts_at && Date.parse(s.sale_starts_at) > now) return false;
  if (s.sale_ends_at && Date.parse(s.sale_ends_at) < now) return false;
  return true;
}
function shopSaleLabel(s) {
  return (s && (s.sale_name || s.sale_label)) || "Sale";
}
function saleBadgeHtml(s) {
  if (!shopSaleActive(s)) return "";
  const name = shopSaleLabel(s);
  const tip = s.sale_percent != null ? (s.sale_percent + "% off") : (s.sale_label || "On sale");
  return `<span class="tag sale" title="${esc(tip)}">(${esc(name)}) sale!</span>`;
}
function saleAdjustedWant(origWant, percentOff) {
  const o = Math.max(1, Math.floor(Number(origWant) || 1));
  const pct = Number(percentOff);
  if (!(pct > 0) || !(pct < 100)) return o;
  return Math.max(1, Math.round(o * (100 - pct) / 100));
}
/** Warn if diamond sell price is wildly above market median. Returns true to proceed. */
async function marketPriceWarnOk(f) {
  if (!f || CURRENCY[f.wi] == null || CURRENCY[f.si] != null) return true;
  let med = null;
  try {
    const { data } = await sb.rpc("market_now");
    const row = (data || []).find(m => m.item === f.si && m.side === "sell");
    if (row && row.median != null) med = Number(row.median);
  } catch (e) { return true; }
  if (!(med > 0)) return true;
  const rate = rawCount(f.wa, f.wu) * CURRENCY[f.wi] / rawCount(f.sa, f.su);
  if (!(rate >= med * PRICE_ALERT_MULT)) return true;
  const pct = ((rate - med) / med) * 100;
  return confirmModal({
    title: "Price above market",
    body: `This sell price (~${fmtRate(rate)}) is about ${pct.toFixed(0)}% above the market median (~${fmtRate(med)}).\n\nSave anyway?`,
    confirmLabel: "Save anyway"
  });
}
async function applySalePricesToShop(shopId, percentOff) {
  const { data: listings, error } = await sb.from("listings").select("id, want_item, want_amount, sale_orig_want_amount").eq("shop_id", shopId);
  if (error) return error.message;
  if (!(percentOff > 0)) return null;
  for (const l of listings || []) {
    if (CURRENCY[l.want_item] == null) continue; // diamonds-only sale pricing
    const orig = l.sale_orig_want_amount != null ? l.sale_orig_want_amount : l.want_amount;
    const next = saleAdjustedWant(orig, percentOff);
    const r = await sb.from("listings").update({
      sale_orig_want_amount: orig,
      want_amount: next,
      updated_at: new Date().toISOString()
    }).eq("id", l.id);
    if (r.error) return r.error.message;
  }
  return null;
}
async function restoreSalePricesOnShop(shopId) {
  const { data: listings, error } = await sb.from("listings").select("id, sale_orig_want_amount").eq("shop_id", shopId);
  if (error) return error.message;
  for (const l of listings || []) {
    if (l.sale_orig_want_amount == null) continue;
    const r = await sb.from("listings").update({
      want_amount: l.sale_orig_want_amount,
      sale_orig_want_amount: null,
      updated_at: new Date().toISOString()
    }).eq("id", l.id);
    if (r.error) return r.error.message;
  }
  return null;
}
async function startShopSale(shopId, opts) {
  const o = opts || {};
  const name = String(o.name || "").trim();
  if (!name) return { error: "Sale needs a name." };
  const percent = o.percent == null || o.percent === "" ? null : Number(o.percent);
  if (percent != null && (!(percent > 0) || !(percent < 100))) return { error: "Percent off must be between 0 and 100." };
  const errRestore = await restoreSalePricesOnShop(shopId);
  if (errRestore) return { error: errRestore };
  if (percent != null) {
    const errApply = await applySalePricesToShop(shopId, percent);
    if (errApply) return { error: errApply };
  }
  const patch = {
    sale_name: name.slice(0, 60),
    sale_percent: percent,
    sale_label: o.label ? String(o.label).trim().slice(0, 40) : null,
    sale_starts_at: o.starts_at || null,
    sale_ends_at: o.ends_at || null,
    sale_active: true,
    sale_admin_id: o.admin_id != null ? o.admin_id : null
  };
  const { error } = await sb.from("shops").update(patch).eq("id", shopId);
  return { error: error ? error.message : null };
}
async function endShopSale(shopId) {
  const err = await restoreSalePricesOnShop(shopId);
  if (err) return { error: err };
  const { error } = await sb.from("shops").update({
    sale_name: null, sale_percent: null, sale_label: null,
    sale_starts_at: null, sale_ends_at: null, sale_active: false, sale_admin_id: null
  }).eq("id", shopId);
  return { error: error ? error.message : null };
}
async function countUnreadNotifications(userId) {
  if (!userId) return 0;
  const { data, error } = await sb.from("notifications").select("id").eq("user_id", userId).is("read_at", null);
  if (error) return 0;
  return (data || []).length;
}
async function loadMyNotifications(userId, limit) {
  const { data, error } = await sb.from("notifications").select("*").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(limit || 20);
  return { data: data || [], error: error ? error.message : null };
}
async function markNotificationRead(id, extraPayload) {
  const patch = { read_at: new Date().toISOString() };
  if (extraPayload) patch.payload = extraPayload;
  const { error } = await sb.from("notifications").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}
/** Head-admin: create admin sale + notify eligible shop owners. */
async function createAdminSaleAndNotify(opts) {
  const o = opts || {};
  const name = String(o.name || "").trim();
  if (!name) return { error: "Sale needs a name." };
  if (!["server", "nation"].includes(o.scope)) return { error: "Scope must be server or nation." };
  if (o.scope === "nation" && !String(o.nation || "").trim()) return { error: "Nation-wide sale needs a nation." };
  const percent = o.percent_off == null || o.percent_off === "" ? null : Number(o.percent_off);
  if (percent != null && (!(percent > 0) || !(percent < 100))) return { error: "Percent off must be between 0 and 100." };
  const session = await getSession();
  if (!session) return { error: "Not logged in." };
  const row = {
    name: name.slice(0, 60), scope: o.scope,
    nation: o.scope === "nation" ? String(o.nation).trim() : null,
    percent_off: percent,
    label: o.label ? String(o.label).trim().slice(0, 40) : null,
    active: o.active !== false,
    starts_at: o.starts_at || null,
    ends_at: o.ends_at || null,
    created_by: session.user.id
  };
  const { data: sale, error } = await sb.from("admin_sales").insert(row).select("*").single();
  if (error) return { error: error.message };
  if (!sale.active) return { data: sale, error: null, notified: 0 };

  const { data: shops } = await sb.from("shops").select("id, owner_id, nation, archived, timed_out");
  const owners = new Set();
  (shops || []).forEach(s => {
    if (s.archived || s.timed_out) return;
    if (sale.scope === "nation" && norm(s.nation || "") !== norm(sale.nation || "")) return;
    if (s.owner_id) owners.add(s.owner_id);
  });
  const notes = [...owners].map(uid => ({
    user_id: uid,
    type: "sale_invite",
    payload: {
      admin_sale_id: sale.id,
      name: sale.name,
      scope: sale.scope,
      nation: sale.nation,
      percent_off: sale.percent_off,
      label: sale.label,
      starts_at: sale.starts_at,
      ends_at: sale.ends_at
    }
  }));
  if (notes.length) {
    const { error: nerr } = await sb.from("notifications").insert(notes);
    if (nerr) return { data: sale, error: "Sale created but notifications failed: " + nerr.message, notified: 0 };
  }
  return { data: sale, error: null, notified: notes.length };
}
async function acceptSaleInvite(notification, myShops) {
  const p = (notification && notification.payload) || {};
  const saleId = p.admin_sale_id;
  if (!saleId) return { error: "Invalid invite." };
  const eligible = (myShops || []).filter(s => {
    if (s.archived || s.timed_out) return false;
    if (p.scope === "nation" && norm(s.nation || "") !== norm(p.nation || "")) return false;
    return true;
  });
  if (!eligible.length) return { error: "No eligible shops to join this sale." };
  for (const s of eligible) {
    const r = await startShopSale(s.id, {
      name: p.name,
      percent: p.percent_off,
      label: p.label,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      admin_id: saleId
    });
    if (r.error) return r;
  }
  await markNotificationRead(notification.id, { ...p, response: "accepted" });
  return { error: null, joined: eligible.length };
}
async function declineSaleInvite(notification) {
  const p = (notification && notification.payload) || {};
  return markNotificationRead(notification.id, { ...p, response: "declined" });
}

// ---- find autocomplete (all modes); Tab accepts highlighted suggestion
function wireSearchAutocomplete(input, getSuggestions, opts) {
  const o = opts || {};
  let box = document.getElementById("ac-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "ac-box";
    box.className = "ac-box";
    box.hidden = true;
    document.body.appendChild(box);
  }
  let items = [];
  let hi = 0;
  const reposition = () => {
    if (box.hidden) return;
    const r = input.getBoundingClientRect();
    box.style.left = Math.round(r.left) + "px";
    box.style.top = Math.round(r.bottom + 4) + "px";
    box.style.width = Math.round(r.width) + "px";
  };
  const hide = () => { box.hidden = true; items = []; };
  const paint = () => {
    if (!items.length) { hide(); return; }
    box.hidden = false;
    box.innerHTML = items.map((t, i) =>
      `<button type="button" class="ac-item${i === hi ? " on" : ""}" data-i="${i}">${esc(t)}</button>`).join("");
    reposition();
  };
  const refresh = () => {
    const q = input.value.trim();
    items = (getSuggestions(q) || []).slice(0, 8);
    hi = 0;
    paint();
  };
  const accept = i => {
    if (!items.length) return false;
    const t = items[Math.max(0, Math.min(items.length - 1, i == null ? hi : i))];
    if (!t) return false;
    input.value = t;
    hide();
    if (o.onAccept) o.onAccept(t);
    return true;
  };
  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("blur", () => setTimeout(hide, 150));
  input.addEventListener("keydown", e => {
    if (e.key === "Tab" && !e.shiftKey) {
      if (!items.length) refresh();
      if (accept(hi)) e.preventDefault();
      return;
    }
    if (box.hidden || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); hi = (hi + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); hi = (hi - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Escape") { hide(); }
  });
  box.addEventListener("mousedown", e => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    e.preventDefault();
    accept(Number(b.dataset.i));
  });
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);
  return { refresh, hide, accept };
}

// Shop traction score for default All shops sort (heuristic - not a live feed)
function shopTractionScore(s, tipByShop) {
  const ls = (s.listings || []).filter(l => !l.timed_out);
  let score = 0;
  const week = 7;
  ls.forEach(l => {
    const d = daysAgo(l.updated_at);
    if (d <= 2) score += 5;
    else if (d <= week) score += 3;
    else if (d <= 14) score += 1;
    if (l.in_stock !== false && l.stock !== 0) score += 0.5;
  });
  const tips = (tipByShop && tipByShop[String(s.id)]) || 0;
  score += Math.min(8, tips);
  const revs = (s.reviews || []).filter(r => !r.timed_out);
  revs.forEach(r => {
    const d = daysAgo(r.created_at);
    if (d <= week) score += 2 + (r.traded ? 1 : 0);
    else if (d <= 30) score += 0.5;
  });
  return score;
}

function collapseStorageKey() {
  if (document.body.classList.contains("admin-page")) return "civmc_admin_collapse";
  if (document.body.classList.contains("mod-page")) return "civmc_mod_collapse";
  if (document.body.classList.contains("dash-page")) return "civmc_dash_shop_collapse";
  return null;
}

function readCollapseState() {
  const key = collapseStorageKey();
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeCollapseState(state) {
  const key = collapseStorageKey();
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
}

function setCollapseOpen(section, open) {
  const btn = section.querySelector(".collapse-toggle");
  const body = section.querySelector(".collapse-body");
  section.classList.toggle("is-collapsed", !open);
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (body) body.hidden = !open;
}

function applyCollapseState(root) {
  const host = root || document;
  if (!host) return;
  const state = readCollapseState();
  host.querySelectorAll("[data-collapse]").forEach(section => {
    const id = section.getAttribute("data-collapse");
    const isOpen = state[id] == null ? true : !!state[id];
    setCollapseOpen(section, isOpen);
  });
}

function wireCollapsibleSections(root) {
  const host = root || document;
  if (!host) return;
  if (!host.dataset.collapseWired) {
    host.dataset.collapseWired = "1";
    host.addEventListener("click", e => {
      const btn = e.target.closest(".collapse-toggle");
      if (!btn || !host.contains(btn)) return;
      const section = btn.closest("[data-collapse]");
      if (!section) return;
      e.preventDefault();
      const id = section.getAttribute("data-collapse");
      const open = btn.getAttribute("aria-expanded") !== "true";
      setCollapseOpen(section, open);
      const next = readCollapseState();
      next[id] = open;
      writeCollapseState(next);
    });
  }
  applyCollapseState(host);
}

if (document.body.classList.contains("admin-page") || document.body.classList.contains("mod-page") || document.body.classList.contains("dash-page")) {
  wireCollapsibleSections(document.querySelector("main"));
}

// cards with data-href act like links, but can hold real links inside (like the owner name)
document.addEventListener("click", e => {
  const card = e.target.closest("[data-href]");
  if (!card || e.target.closest("a, button, input, select, textarea")) return;
  location.href = card.dataset.href;
});

window.addEventListener("resize", syncTopChromeOffset);

hydrateIcons();

renderNav().catch(e => {
  console.error(e);
  const n = document.getElementById("nav");
  if (n) n.insertAdjacentHTML("beforeend", '<span class="tag bad">can\'t reach the database: ' + esc(e.message) + ' (check config.js)</span>');
});
fillItemList();

// "/" focuses the main search box; Esc blurs it. Skip when typing in a field.
document.addEventListener("keydown", e => {
  if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    const q = document.getElementById("q");
    if (!q) return;
    e.preventDefault();
    q.focus();
    q.select();
  }
});
