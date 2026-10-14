import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://civshops.pengworld.net";
const THEME = "#7fb35a";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stripMc = (s: string) => String(s || "").replace(/[&§][0-9a-fk-or]/gi, "").trim();
const itemImg = (name: string) => {
  const key = String(name || "chest").trim().toLowerCase().replace(/\s+/g, " ");
  const file = key === "essence" ? "ender eye" : key;
  return SITE + "/Minecraft_Items/" + encodeURIComponent(file.replace(/ /g, "_")) + ".png";
};
const storageUrl = (path: string) =>
  Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "") + "/storage/v1/object/public/uploads/" + String(path).replace(/^\//, "");
const placeLine = (city?: string | null, nation?: string | null) => {
  const c = (city || "").trim(), n = (nation || "").trim();
  if (c && n && c.toLowerCase() !== n.toLowerCase()) return c + " · " + n;
  return c || n || "";
};
const stillOut = (row: { timed_out?: boolean | null; timed_out_until?: string | null } | null | undefined) => {
  if (!row || !row.timed_out) return false;
  if (!row.timed_out_until) return true;
  const t = new Date(row.timed_out_until).getTime();
  return Number.isFinite(t) && t > Date.now();
};
type Embed = { title: string; description: string; url: string; image: string; authorName?: string; authorUrl?: string };

function pageHtml(e: Embed) {
  const title = e.title || "CivShops";
  const desc = e.description || "Find shops on CivMC, compare diamond prices, and browse the live market on CivShops.";
  const url = e.url || SITE + "/home/";
  const image = e.image || itemImg("chest");
  const oembed = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "") + "/functions/v1/embed?format=oembed&url=" + encodeURIComponent(url);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><meta name="theme-color" content="${THEME}">
<meta property="og:type" content="website"><meta property="og:site_name" content="CivShops">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(url)}"><link type="application/json+oembed" href="${esc(oembed)}"></head>
<body style="font-family:system-ui,sans-serif;background:#1a1c18;color:#e8eadf;padding:24px">
<p><a href="${esc(url)}" style="color:${THEME}">Open ${esc(title)}</a></p></body></html>`;
}

function parseTarget(url: URL) {
  if (url.searchParams.get("url")) {
    try {
      const u = new URL(String(url.searchParams.get("url")));
      const path = u.pathname.replace(/\/+$/, "") || "/";
      const listingPath = path.match(/\/shops\/([^/]+)\/listing\/(\d+)$/i);
      if (listingPath) {
        const slug = decodeURIComponent(listingPath[1]);
        const listing = listingPath[2];
        if (/^\d+$/.test(slug)) return { kind: "shop" as const, id: slug, slug: null as string | null, listing };
        return { kind: "shop" as const, id: null as string | null, slug, listing };
      }
      const shopPath = path.match(/\/shops\/([^/]+)$/);
      if (shopPath) {
        const slug = decodeURIComponent(shopPath[1]);
        if (/^\d+$/.test(slug)) return { kind: "shop" as const, id: slug, slug: null as string | null, listing: u.searchParams.get("listing") };
        return { kind: "shop" as const, id: null as string | null, slug, listing: u.searchParams.get("listing") };
      }
      if (path.endsWith("/shops") || /\/shops\/?$/.test(path)) {
        return { kind: "shop" as const, id: u.searchParams.get("id") || u.searchParams.get("shop"), slug: null as string | null, listing: u.searchParams.get("listing") };
      }
    } catch (_) { /* ignore */ }
  }
  const q = url.searchParams;
  if (q.get("shop")) {
    const raw = q.get("shop") || "";
    const listing = q.get("listing");
    if (/^\d+$/.test(raw)) return { kind: "shop" as const, id: raw, slug: null as string | null, listing };
    return { kind: "shop" as const, id: null as string | null, slug: raw.toLowerCase(), listing };
  }
  return { kind: "site" as const };
}

const defaultEmbed = (): Embed => ({
  title: "CivShops",
  description: "Find shops on CivMC, compare diamond prices, and browse the live market on CivShops.",
  url: SITE + "/home/",
  image: itemImg("chest"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: cors });
  const url = new URL(req.url);
  const wantOembed = url.searchParams.get("format") === "json" || url.searchParams.get("format") === "oembed" || url.pathname.includes("oembed");
  const target = parseTarget(url);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const respond = (e: Embed, status = 200) => {
    if (wantOembed) {
      const body: Record<string, unknown> = {
        version: "1.0", type: "link", title: e.title, provider_name: "CivShops",
        provider_url: SITE + "/", thumbnail_url: e.image, thumbnail_width: 128, thumbnail_height: 128,
      };
      if (e.authorName) body.author_name = e.authorName;
      if (e.authorUrl) body.author_url = e.authorUrl;
      return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=120" } });
    }
    return new Response(pageHtml(e), { status, headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=120" } });
  };

  if (target.kind !== "shop") return respond(defaultEmbed());

  let id = Number(target.id);
  if (!Number.isFinite(id) && target.slug) {
    const slug = String(target.slug).toLowerCase();
    const strip = (n: string) =>
      String(n || "").replace(/[&§][0-9a-fk-or]/gi, "").toLowerCase().replace(/[''"`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    const m = slug.match(/-(\d+)$/);
    if (m) {
      const { data: row } = await admin.from("shops").select("id").eq("id", m[1]).eq("archived", false).maybeSingle();
      if (row) id = Number(row.id);
    }
    if (!Number.isFinite(id)) {
      const list: { id: number; name: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: rows } = await admin.from("shops").select("id, name").eq("archived", false).order("id").range(from, from + 999);
        const batch = rows || [];
        list.push(...batch);
        if (batch.length < 1000) break;
      }
      let hit = list.find((s) => (strip(s.name) || ("shop-" + s.id)) + "-" + s.id === slug);
      if (!hit) {
        const baseHits = list.filter((s) => (strip(s.name) || ("shop-" + s.id)) === slug);
        if (baseHits.length === 1) hit = baseHits[0];
      }
      if (hit) id = Number(hit.id);
    }
  }
  if (!Number.isFinite(id)) return respond({ ...defaultEmbed(), title: "Shop not found · CivShops" }, 404);

  const { data: s } = await admin
    .from("shops")
    .select("id, name, styled_name, description, city, nation, icon_item, icon_path, x, z, archived, is_open, timed_out, timed_out_until, owner_id, listings(id), profiles!shops_owner_id_fkey(username, mc_username, timed_out, timed_out_until)")
    .eq("id", id)
    .maybeSingle();

  const owner = (Array.isArray(s?.profiles) ? s.profiles[0] : s?.profiles) as
    | { username?: string; mc_username?: string; timed_out?: boolean; timed_out_until?: string | null }
    | null
    | undefined;
  if (!s || s.archived || s.is_open === false || stillOut(s) || stillOut(owner || null)) {
    return respond({ ...defaultEmbed(), title: "Shop not found · CivShops", description: "That shop doesn't exist or isn't available.", url: SITE + "/home/" }, 404);
  }

  const name = stripMc(s.styled_name || s.name || "Shop") || "Shop";
  const ownerName = (owner && (owner.username || owner.mc_username)) || "";
  const place = placeLine(s.city, s.nation);
  const nList = Array.isArray(s.listings) ? s.listings.length : 0;
  const bits: string[] = [];
  if (ownerName) bits.push("Owner: " + ownerName);
  if (place) bits.push(place);
  if (s.x != null && s.z != null) bits.push(s.x + ", " + s.z);
  if (nList) bits.push(nList + " listing" + (nList === 1 ? "" : "s"));

  let desc = stripMc(s.description || "").replace(/\s+/g, " ").slice(0, 180);
  if (!desc) desc = bits.join(" · ") || "Shop listing on CivShops.";
  else if (bits.length) desc = desc + " · " + bits.join(" · ");

  let title = name;
  let image = s.icon_path ? storageUrl(s.icon_path) : itemImg(s.icon_item || "chest");
  let dest = SITE + "/shops/?id=" + id;

  if (target.listing) {
    const { data: l } = await admin
      .from("listings")
      .select("id, sell_item, sell_amount, sell_unit, want_item, want_amount, want_unit, in_stock, enchants")
      .eq("id", Number(target.listing))
      .eq("shop_id", id)
      .maybeSingle();
    if (l) {
      const want = [l.want_amount, l.want_unit, l.want_item].filter((x) => x != null && String(x).trim() !== "").join(" ");
      const sell = [l.sell_amount, l.sell_unit, l.sell_item].filter((x) => x != null && String(x).trim() !== "").join(" ");
      const trade = want && sell ? want + " -> " + sell : sell || want || "Listing";
      title = trade + " · " + name;
      const lBits = [name];
      if (ownerName) lBits.push("Owner: " + ownerName);
      if (place) lBits.push(place);
      if (l.in_stock === false) lBits.push("out of stock");
      if (l.enchants) lBits.push(String(l.enchants).replace(/\s+/g, " ").slice(0, 80));
      desc = (trade + " · " + lBits.join(" · ")).slice(0, 300);
      image = itemImg(l.sell_item || s.icon_item || "chest");
      const slugBase = String(name || "").toLowerCase().replace(/[''"`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
      dest = SITE + "/shops/" + encodeURIComponent((slugBase || ("shop-" + id)) + "-" + id) + "/listing/" + l.id + "/";
    } else {
      dest = SITE + "/shops/?id=" + id + "&listing=" + encodeURIComponent(String(target.listing));
    }
  }

  return respond({
    title,
    description: desc.slice(0, 300),
    url: dest,
    image,
    authorName: ownerName || undefined,
    authorUrl: ownerName ? SITE + "/profile/?id=" + s.owner_id : undefined,
  });
});
