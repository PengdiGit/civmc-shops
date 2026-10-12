// Public Open Graph / Discord / Slack link previews for shops, profiles, and market items.
// Crawlers get HTML with og:* tags; humans are redirected to the live GitHub Pages site.
// Deploy: supabase functions deploy embed --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://pengdigit.github.io/civmc-shops";
const THEME = "#7fb35a";
const HEAD_URL = "https://minotar.net/avatar/";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripMc(s: string) {
  return String(s || "").replace(/[&§][0-9a-fk-or]/gi, "").trim();
}

function itemImg(name: string) {
  const key = String(name || "chest").trim().toLowerCase().replace(/\s+/g, " ");
  const file = key === "essence" ? "ender eye" : key;
  return SITE + "/Minecraft_Items/" + encodeURIComponent(file.replace(/ /g, "_")) + ".png";
}

function storageUrl(path: string) {
  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  return base + "/storage/v1/object/public/uploads/" + String(path).replace(/^\//, "");
}

function placeLine(city?: string | null, nation?: string | null) {
  const c = (city || "").trim();
  const n = (nation || "").trim();
  if (c && n && c.toLowerCase() !== n.toLowerCase()) return c + " · " + n;
  return c || n || "";
}

function stillOut(row: { timed_out?: boolean | null; timed_out_until?: string | null } | null | undefined) {
  if (!row || !row.timed_out) return false;
  if (!row.timed_out_until) return true;
  const t = new Date(row.timed_out_until).getTime();
  return Number.isFinite(t) && t > Date.now();
}

type Embed = {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName?: string;
};

function pageHtml(e: Embed) {
  const title = e.title || "CivMC Shops";
  const desc = e.description || "CivMC shop directory — find shops, compare prices, browse the diamond market.";
  const url = e.url || SITE + "/home/";
  const image = e.image || itemImg("chest");
  const site = e.siteName || "CivMC Shops";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${THEME}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(url)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
<script>location.replace(${JSON.stringify(url)})</script>
</head>
<body style="font-family:system-ui,sans-serif;background:#1a1c18;color:#e8eadf;padding:24px">
<p><a href="${esc(url)}" style="color:${THEME}">Continue to ${esc(site)}</a></p>
</body>
</html>`;
}

function htmlResponse(e: Embed, status = 200) {
  return new Response(pageHtml(e), {
    status,
    headers: {
      ...cors,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}

function defaultEmbed(): Embed {
  return {
    title: "CivMC Shops",
    description: "Find CivMC shops, compare diamond prices, and browse the live market.",
    url: SITE + "/home/",
    image: itemImg("chest"),
  };
}

function parseTarget(url: URL) {
  const path = url.pathname.replace(/^\/functions\/v1\/embed\/?/, "").replace(/^\/embed\/?/, "");
  const parts = path.split("/").filter(Boolean);
  const q = url.searchParams;

  if (q.get("shop") || (parts[0] === "shop" && parts[1])) {
    return {
      kind: "shop" as const,
      id: q.get("shop") || parts[1],
      listing: q.get("listing") || (parts[2] === "listing" ? parts[3] : null),
    };
  }
  if (q.get("profile") || q.get("user") || (parts[0] === "profile" && parts[1])) {
    return { kind: "profile" as const, id: q.get("profile") || q.get("user") || parts[1], name: q.get("name") };
  }
  if (q.get("name") && !q.get("shop") && !q.get("item")) {
    return { kind: "profile" as const, id: null as string | null, name: q.get("name") };
  }
  if (q.get("item") || (parts[0] === "market" && parts[1])) {
    return {
      kind: "market" as const,
      item: q.get("item") || decodeURIComponent(parts[1] || ""),
      enchant: q.get("enchant") || null,
    };
  }
  if (q.get("find") || q.get("q") || parts[0] === "find") {
    return {
      kind: "find" as const,
      q: q.get("find") || q.get("q") || (parts[1] ? decodeURIComponent(parts[1]) : ""),
      mode: q.get("mode") || "sell",
    };
  }
  return { kind: "site" as const };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const target = parseTarget(url);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (target.kind === "shop") {
    const id = Number(target.id);
    if (!Number.isFinite(id)) return htmlResponse({ ...defaultEmbed(), title: "Shop not found · CivMC Shops" }, 404);

    const { data: s } = await admin
      .from("shops")
      .select("id, name, styled_name, description, city, nation, icon_item, icon_path, x, z, archived, is_open, timed_out, timed_out_until, owner_id, profiles!shops_owner_id_fkey(username, mc_username, timed_out, timed_out_until)")
      .eq("id", id)
      .maybeSingle();

    const owner = (Array.isArray(s?.profiles) ? s.profiles[0] : s?.profiles) as
      | { username?: string; mc_username?: string; timed_out?: boolean; timed_out_until?: string | null }
      | null
      | undefined;
    const hidden = !s || s.archived || s.is_open === false || stillOut(s) || stillOut(owner || null);
    if (hidden) {
      return htmlResponse({
        ...defaultEmbed(),
        title: "Shop not found · CivMC Shops",
        description: "That shop doesn't exist or isn't available.",
        url: SITE + "/home/",
      }, 404);
    }

    const name = stripMc(s.styled_name || s.name || "Shop") || "Shop";
    const ownerName = (owner && (owner.username || owner.mc_username)) || "";
    const place = placeLine(s.city, s.nation);
    const bits = [];
    if (ownerName) bits.push("by " + ownerName);
    if (place) bits.push(place);
    if (s.x != null && s.z != null) bits.push(s.x + ", " + s.z);
    let desc = stripMc(s.description || "").replace(/\s+/g, " ").slice(0, 180);
    if (!desc) desc = bits.join(" · ") || "CivMC shop on CivMC Shops.";
    else if (bits.length) desc = desc + " · " + bits.join(" · ");

    let listingBit = "";
    if (target.listing) {
      const { data: l } = await admin
        .from("listings")
        .select("id, sell_item, sell_amount, want_item, want_amount, in_stock")
        .eq("id", Number(target.listing))
        .eq("shop_id", id)
        .maybeSingle();
      if (l) {
        listingBit = ` · ${l.sell_amount} ${l.sell_item} for ${l.want_amount} ${l.want_item}`;
        if (l.in_stock === false) listingBit += " (out of stock)";
      }
    }

    const image = s.icon_path ? storageUrl(s.icon_path) : itemImg(s.icon_item || "chest");
    const dest = SITE + "/shops/?id=" + id + (target.listing ? "&listing=" + encodeURIComponent(String(target.listing)) : "");
    return htmlResponse({
      title: name + " · CivMC Shops",
      description: (desc + listingBit).slice(0, 220),
      url: dest,
      image,
    });
  }

  if (target.kind === "profile") {
    let p = null as Record<string, unknown> | null;
    if (target.id) {
      const { data } = await admin
        .from("profiles")
        .select("id, username, mc_username, discord_username, bio, avatar_path, is_business, is_nation, place_city, place_nation, verified_at, timed_out, timed_out_until")
        .eq("id", target.id)
        .maybeSingle();
      p = data;
    } else if (target.name) {
      const needle = String(target.name).trim();
      const { data: byUser } = await admin
        .from("profiles")
        .select("id, username, mc_username, discord_username, bio, avatar_path, is_business, is_nation, place_city, place_nation, verified_at, timed_out, timed_out_until")
        .ilike("username", needle)
        .limit(10);
      p = (byUser || []).find((x) => String(x.username || "").toLowerCase() === needle.toLowerCase()) || (byUser && byUser[0]) || null;
      if (!p) {
        const { data: byMc } = await admin
          .from("profiles")
          .select("id, username, mc_username, discord_username, bio, avatar_path, is_business, is_nation, place_city, place_nation, verified_at, timed_out, timed_out_until")
          .ilike("mc_username", needle)
          .limit(10);
        p = (byMc || []).find((x) => String(x.mc_username || "").toLowerCase() === needle.toLowerCase()) || (byMc && byMc[0]) || null;
      }
    }

    if (!p || stillOut(p as { timed_out?: boolean; timed_out_until?: string | null })) {
      return htmlResponse({
        ...defaultEmbed(),
        title: "Profile not found · CivMC Shops",
        description: "That profile doesn't exist or isn't available.",
      }, 404);
    }

    const login = String(p.username || "");
    const mc = String(p.mc_username || "");
    const primary = (mc && login && mc.toLowerCase() === login.toLowerCase())
      ? mc
      : (login ? login.charAt(0).toUpperCase() + login.slice(1) : mc) || "Trader";
    const bits = [];
    if (mc && mc.toLowerCase() !== String(primary).toLowerCase()) bits.push("MC: " + mc);
    if (p.discord_username) bits.push("Discord: " + p.discord_username);
    if (p.is_nation) {
      const nationName = String(p.place_nation || "").trim();
      if (nationName) bits.push(nationName);
      bits.push("nation");
    } else if (p.is_business) {
      bits.push("business");
    }
    if (p.verified_at) bits.push("verified");
    let desc = stripMc(String(p.bio || "")).replace(/\s+/g, " ").slice(0, 180);
    if (!desc) desc = bits.join(" · ") || "CivMC trader on CivMC Shops.";
    else if (bits.length) desc = desc + " · " + bits.slice(0, 3).join(" · ");

    const image = p.avatar_path
      ? storageUrl(String(p.avatar_path))
      : HEAD_URL + encodeURIComponent(mc || "steve") + "/128";

    return htmlResponse({
      title: primary + " · CivMC Shops",
      description: desc.slice(0, 220),
      url: SITE + "/profile/?id=" + p.id,
      image,
    });
  }

  if (target.kind === "market") {
    const item = String(target.item || "").trim();
    if (!item) return htmlResponse(defaultEmbed());
    const enchant = target.enchant && target.enchant !== "plain" ? String(target.enchant) : "";
    const title = (enchant ? item + " (" + enchant + ")" : item) + " · Market · CivMC Shops";
    const dest = SITE + "/market/?item=" + encodeURIComponent(item) + (enchant ? "&enchant=" + encodeURIComponent(enchant) : "");
    return htmlResponse({
      title,
      description: "Live diamond market rates for " + item + " on CivMC Shops.",
      url: dest,
      image: itemImg(item),
    });
  }

  if (target.kind === "find") {
    const term = String(target.q || "").trim();
    const mode = target.mode === "want" || target.mode === "buy" ? "buy"
      : (target.mode === "shop" ? "shop" : (target.mode === "enchant" ? "enchant" : "sell"));
    const ps = new URLSearchParams();
    if (term) ps.set("q", term);
    if (mode && mode !== "sell") ps.set("mode", mode === "buy" ? "want" : mode);
    const dest = SITE + "/home/" + (ps.toString() ? "?" + ps.toString() : "");
    const label = term
      ? (mode === "shop" ? term + " shops"
        : (mode === "enchant" ? term + " enchants"
          : (mode === "buy" ? "Buying " : "Selling ") + term))
      : "Find a shop";
    return htmlResponse({
      title: label + " · CivMC Shops",
      description: term
        ? "Search results for " + term + " on CivMC Shops."
        : "Search CivMC shops by item, enchant, or name.",
      url: dest,
      image: term && mode !== "shop" && mode !== "enchant" ? itemImg(term) : itemImg(mode === "enchant" ? "enchanted book" : "chest"),
    });
  }

  return htmlResponse(defaultEmbed());
});
