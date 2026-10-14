/**
 * Generate static Open Graph landing pages next to the SPA routes:
 *   /shops/{name-slug}/                  → shop card then redirect to /shops/?id=
 *   /shops/{name-slug}/listing/{id}/     → listing card then redirect to /shops/?id=&listing=
 *   /profile/{username}/                 → profile card then redirect to /profile/?name=
 *
 * Discord/Slack read the static HTML (no JS). Humans get redirected to the app.
 *
 *   node scripts/generate-og-pages.mjs
 */
import { mkdir, writeFile, readdir, rm, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE = "https://civshops.pengworld.net";
const THEME = "#7fb35a";

const configSrc = readFileSync(join(ROOT, "config.js"), "utf8");
const SUPABASE_URL = (configSrc.match(/const SUPABASE_URL = "([^"]+)"/) || [])[1];
const SUPABASE_ANON_KEY = (configSrc.match(/const SUPABASE_ANON_KEY = "([^"]+)"/) || [])[1];
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Could not read Supabase config from config.js");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripMc(s) {
  return String(s || "").replace(/[&§][0-9a-fk-or]/gi, "").trim();
}

function itemImg(name) {
  const key = String(name || "chest").trim().toLowerCase().replace(/\s+/g, " ");
  const file = key === "essence" ? "ender eye" : key;
  return SITE + "/Minecraft_Items/" + encodeURIComponent(file.replace(/ /g, "_")) + ".png";
}

function storageUrl(path) {
  return SUPABASE_URL.replace(/\/$/, "") + "/storage/v1/object/public/uploads/" + String(path).replace(/^\//, "");
}

function placeLine(city, nation) {
  const c = (city || "").trim();
  const n = (nation || "").trim();
  if (c && n && c.toLowerCase() !== n.toLowerCase()) return c + " / " + n;
  return c || n || "";
}

function shopSlugBase(name) {
  let s = stripMc(name).toLowerCase().replace(/[''"`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s || s === "index" || /^\d+$/.test(s)) return "";
  return s.slice(0, 48);
}

/** Unique public slugs: always `{name-base}-{id}`. */
function assignShopSlugs(shops) {
  const map = new Map();
  for (const s of shops || []) {
    const base = shopSlugBase(s.name) || ("shop-" + s.id);
    map.set(s.id, base + "-" + s.id);
  }
  return map;
}

function pageHtml({ title, description, url, image, authorName, redirectUrl }) {
  const dest = redirectUrl || url;
  const oembed = SUPABASE_URL.replace(/\/$/, "") +
    "/functions/v1/embed?format=oembed&url=" + encodeURIComponent(url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · CivMC Shops</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${THEME}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CivMC Shops">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(url)}">
<link type="application/json+oembed" href="${esc(oembed)}">
<meta http-equiv="refresh" content="0;url=${esc(dest)}">
<script>
(function () {
  var base = ${JSON.stringify(dest)};
  var extra = location.search ? location.search.slice(1) : "";
  if (extra) base += (base.indexOf("?") >= 0 ? "&" : "?") + extra;
  location.replace(base);
})();
</script>
</head>
<body style="font-family:system-ui,sans-serif;background:#1a1c18;color:#e8eadf;padding:24px">
<p><a href="${esc(dest)}" style="color:${THEME}">Open ${esc(title)}${authorName ? " · " + esc(authorName) : ""}</a></p>
</body>
</html>
`;
}

async function sb(path) {
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error(path + " → " + res.status + " " + (await res.text()));
  return res.json();
}

/** Remove previously generated lander folders; keep SPA index.html. */
async function cleanLanders(dir, mode) {
  let entries = [];
  try { entries = await readdir(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    const st = await stat(full);
    if (!st.isDirectory()) continue;
    if (mode === "shops") {
      await rm(full, { recursive: true, force: true });
      continue;
    }
    if (/^[0-9a-f-]{36}$/i.test(name) || /^[a-z0-9_]{3,20}$/.test(name)) {
      await rm(full, { recursive: true, force: true });
    }
  }
}

async function main() {
  await cleanLanders(join(ROOT, "shops"), "shops");
  await cleanLanders(join(ROOT, "profile"), "profile");

  const shops = await sb(
    "shops?select=id,name,styled_name,description,city,nation,icon_item,icon_path,x,z,owner_id,archived,is_open,timed_out,profiles!shops_owner_id_fkey(username,mc_username,timed_out)&archived=eq.false&is_open=eq.true&timed_out=eq.false&order=id",
  );

  const visible = [];
  for (const s of shops || []) {
    const owner = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    if (owner && owner.timed_out) continue;
    visible.push(s);
  }
  const slugById = assignShopSlugs(visible);

  const listings = await sb(
    "listings?select=id,shop_id,want_item,want_amount,want_unit,sell_item,sell_amount,sell_unit,in_stock,timed_out,enchants,notes&timed_out=eq.false&order=id&limit=5000",
  );
  const listingsByShop = new Map();
  for (const l of listings || []) {
    if (l == null || l.shop_id == null) continue;
    const k = Number(l.shop_id);
    if (!listingsByShop.has(k)) listingsByShop.set(k, []);
    listingsByShop.get(k).push(l);
  }

  let shopN = 0;
  let listingN = 0;
  for (const s of visible) {
    const owner = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const name = stripMc(s.styled_name || s.name || "Shop") || "Shop";
    const ownerName = (owner && (owner.username || owner.mc_username)) || "";
    const place = placeLine(s.city, s.nation);
    const bits = [];
    if (ownerName) bits.push("Owner: " + ownerName);
    if (place) bits.push(place);
    if (s.x != null && s.z != null) bits.push(s.x + ", " + s.z);
    let desc = stripMc(s.description || "").replace(/\s+/g, " ").slice(0, 180);
    if (!desc) desc = bits.join(" | ") || "CivMC shop on CivMC Shops.";
    else if (bits.length) desc = desc + " | " + bits.join(" | ");
    const image = s.icon_path ? storageUrl(s.icon_path) : itemImg(s.icon_item || "chest");
    const slug = slugById.get(s.id) || ("shop-" + s.id);
    const landerUrl = SITE + "/shops/" + encodeURIComponent(slug) + "/";
    const spaUrl = SITE + "/shops/?id=" + s.id;
    const dir = join(ROOT, "shops", slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), pageHtml({
      title: name,
      description: desc.slice(0, 300),
      url: landerUrl,
      redirectUrl: spaUrl,
      image,
      authorName: ownerName,
    }));
    shopN++;

    const shopListings = listingsByShop.get(Number(s.id)) || [];
    for (const l of shopListings) {
      const want = [l.want_amount, l.want_unit, l.want_item].filter((x) => x != null && String(x).trim() !== "").join(" ");
      const sell = [l.sell_amount, l.sell_unit, l.sell_item].filter((x) => x != null && String(x).trim() !== "").join(" ");
      const trade = (want && sell) ? (want + " -> " + sell) : (sell || want || "Listing");
      const lBits = [name];
      if (ownerName) lBits.push("Owner: " + ownerName);
      if (place) lBits.push(place);
      if (l.in_stock === false) lBits.push("out of stock");
      if (l.enchants) lBits.push(String(l.enchants).replace(/\s+/g, " ").slice(0, 80));
      const lDesc = (trade + " | " + lBits.join(" | ")).slice(0, 300);
      const lImage = itemImg(l.sell_item || s.icon_item || "chest");
      const lUrl = SITE + "/shops/" + encodeURIComponent(slug) + "/listing/" + l.id + "/";
      const lSpa = SITE + "/shops/?id=" + s.id + "&listing=" + l.id;
      const lDir = join(dir, "listing", String(l.id));
      await mkdir(lDir, { recursive: true });
      await writeFile(join(lDir, "index.html"), pageHtml({
        title: trade + " · " + name,
        description: lDesc,
        url: lUrl,
        redirectUrl: lSpa,
        image: lImage,
        authorName: ownerName || name,
      }));
      listingN++;
    }
  }

  const profiles = await sb(
    "profiles?select=id,username,mc_username,discord_username,bio,avatar_path,is_business,is_nation,place_city,place_nation,verified_at,timed_out&timed_out=eq.false&order=username",
  );

  let profN = 0;
  for (const p of profiles || []) {
    const login = String(p.username || "");
    const mc = String(p.mc_username || "");
    const nationName = String(p.place_nation || "").trim();
    let primary = (mc && login && mc.toLowerCase() === login.toLowerCase())
      ? mc
      : (login ? login.charAt(0).toUpperCase() + login.slice(1) : mc) || "Trader";
    if (p.is_nation && nationName) primary = nationName;
    const bits = [];
    if (p.is_nation) bits.push("Nation");
    else if (p.is_business) bits.push("Business");
    if (mc && mc.toLowerCase() !== String(primary).toLowerCase()) bits.push("MC: " + mc);
    if (p.discord_username) bits.push("Discord: " + p.discord_username);
    if (p.is_business && !p.is_nation) {
      const place = placeLine(p.place_city, p.place_nation);
      if (place) bits.push(place);
    } else if (p.is_nation && nationName && nationName.toLowerCase() !== String(primary).toLowerCase()) {
      bits.push(nationName);
    }
    if (p.verified_at) bits.push("verified");
    let desc = stripMc(p.bio || "").replace(/\s+/g, " ").slice(0, 180);
    if (!desc) desc = bits.join(" | ") || (p.is_nation ? "Nation account on CivMC Shops." : (p.is_business ? "Business account on CivMC Shops." : "CivMC trader on CivMC Shops."));
    else if (bits.length) desc = desc + " | " + bits.slice(0, 3).join(" | ");
    const image = p.avatar_path
      ? storageUrl(p.avatar_path)
      : ((p.is_nation || p.is_business) && !mc)
        ? SITE + "/Minecraft_Items/" + (p.is_nation ? "white_banner.png" : "chest.png")
        : "https://minotar.net/avatar/" + encodeURIComponent(mc || "steve") + "/128";
    const loginKey = String(p.username || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(loginKey)) continue;
    const landerUrl = SITE + "/profile/" + loginKey + "/";
    const spaUrl = SITE + "/profile/?name=" + encodeURIComponent(loginKey);
    const dir = join(ROOT, "profile", loginKey);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), pageHtml({
      title: primary,
      description: desc.slice(0, 300),
      url: landerUrl,
      redirectUrl: spaUrl,
      image,
      authorName: primary,
    }));
    profN++;
  }

  console.log(
    "Generated OG landers: " + shopN + " shops → shops/{slug}/, " +
    listingN + " listings → shops/{slug}/listing/{id}/, " +
    profN + " profiles → profile/{username}/",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
