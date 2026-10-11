// Per-shop / per-profile Open Graph HTML for Discord/Slack (and oEmbed JSON).
// Called by the civshops bot proxy (Cloudflare Worker or nginx) — crawlers never need this URL in chat.
// Deploy: supabase functions deploy embed --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://civshops.pengworld.net";
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
  authorName?: string;
  authorUrl?: string;
};

function pageHtml(e: Embed) {
  const title = e.title || "CivMC Shops";
  const desc = e.description || "CivMC shop directory — find shops, compare prices, browse the diamond market.";
  const url = e.url || SITE + "/home/";
  const image = e.image || itemImg("chest");
  const site = e.siteName || "CivMC Shops";
  const embBase = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "") + "/functions/v1/embed";
  const oembed = embBase + "?format=oembed&url=" + encodeURIComponent(url);
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
<link type="application/json+oembed" href="${esc(oembed)}">
</head>
<body style="font-family:system-ui,sans-serif;background:#1a1c18;color:#e8eadf;padding:24px">
<p><a href="${esc(url)}" style="color:${THEME}">Open ${esc(title)}</a></p>
</body>
</html>`;
}

function oembedJson(e: Embed) {
  const body: Record<string, unknown> = {
    version: "1.0",
    type: "link",
    title: e.title,
    provider_name: e.siteName || "CivMC Shops",
    provider_url: SITE + "/",
    thumbnail_url: e.image,
    thumbnail_width: 128,
    thumbnail_height: 128,
  };
  if (e.authorName) body.author_name = e.authorName;
  if (e.authorUrl) body.author_url = e.authorUrl;
  return body;
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
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

function parseFromPageUrl(page: string) {
  try {
    const u = new URL(page);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const shopPath = path.match(/\/shops\/([^/]+)$/);
    if (shopPath) {
      const slug = decodeURIComponent(shopPath[1]);
      if (/^\d+$/.test(slug)) {
        return {
          kind: "shop" as const,
          id: slug,
          slug: null as string | null,
          listing: u.searchParams.get("listing"),
        };
      }
      return {
        kind: "shop" as const,
        id: null as string | null,
        slug,
        listing: u.searchParams.get("listing"),
      };
    }
    if (path.endsWith("/shops") || /\/shops\/?$/.test(path)) {
      return {
        kind: "shop" as const,
        id: u.searchParams.get("id") || u.searchParams.get("shop"),
        slug: null as string | null,
        listing: u.searchParams.get("listing"),
      };
    }
    const profPath = path.match(/\/profile\/([^/]+)$/i);
    if (profPath) {
      const slug = decodeURIComponent(profPath[1]);
      if (/^[0-9a-f-]{36}$/i.test(slug)) {
        return { kind: "profile" as const, id: slug, name: u.searchParams.get("name") };
      }
      return { kind: "profile" as const, id: null as string | null, name: slug };
    }
    if (path.endsWith("/profile") || /\/profile\/?$/.test(path)) {
      return {
        kind: "profile" as const,
        id: u.searchParams.get("id") || u.searchParams.get("profile"),
        name: u.searchParams.get("name"),
      };
    }
    if (path.endsWith("/market") || path.includes("/market/")) {
      return {
        kind: "market" as const,
        item: u.searchParams.get("item"),
        enchant: u.searchParams.get("enchant"),
      };
    }
    if (path.endsWith("/home") || path.includes("/home/") || path === "" || path === "/") {
      return {
        kind: "find" as const,
        q: u.searchParams.get("q") || u.searchParams.get("find") || "",
        mode: u.searchParams.get("mode") || "sell",
      };
    }
  } catch (_) { /* ignore */ }
  return null;
}

function parseTarget(url: URL) {
  if (url.searchParams.get("url")) {
    const fromPage = parseFromPageUrl(String(url.searchParams.get("url")));
    if (fromPage) return fromPage;
  }

  const path = url.pathname.replace(/^\/functions\/v1\/embed\/?/, "").replace(/^\/embed\/?/, "");
  const parts = path.split("/").filter(Boolean);
  const q = url.searchParams;

  if (q.get("shop") || (parts[0] === "shop" && parts[1])) {
    const raw = q.get("shop") || parts[1] || "";
    const listing = q.get("listing") || (parts[2] === "listing" ? parts[3] : null);
    if (/^\d+$/.test(raw)) {
      return { kind: "shop" as const, id: raw, slug: null as string | null, listing };
    }
    return { kind: "shop" as const, id: null as string | null, slug: raw.toLowerCase(), listing };
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
  const wantOembed = url.searchParams.get("format") === "json" ||
    url.searchParams.get("format") === "oembed" ||
    url.pathname.includes("oembed");
  const target = parseTarget(url);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const respond = (e: Embed, status = 200) =>
    wantOembed ? jsonResponse(oembedJson(e), status) : htmlResponse(e, status);

  if (target.kind === "shop") {
    let id = Number(target.id);
    if (!Number.isFinite(id) && target.slug) {
      const slug = String(target.slug).toLowerCase();
      const { data: rows } = await admin
        .from("shops")
        .select("id, name")
        .eq("archived", false)
        .limit(500);
      const strip = (n: string) =>
        String(n || "").replace(/[&§][0-9a-fk-or]/gi, "").toLowerCase()
          .replace(/[''"`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
      const list = rows || [];
      const bases = list.map((s) => ({ s, base: strip(s.name) || ("shop-" + s.id) }));
      const counts: Record<string, number> = {};
      for (const { base } of bases) counts[base] = (counts[base] || 0) + 1;
      let hit = bases.find(({ s, base }) =>
        (counts[base] > 1 ? base + "-" + s.id : base) === slug
      );
      if (!hit) {
        const m = slug.match(/-(\d+)$/);
        if (m) hit = bases.find(({ s }) => String(s.id) === m[1]);
      }
      if (hit) id = Number(hit.s.id);
    }
    if (!Number.isFinite(id)) return respond({ ...defaultEmbed(), title: "Shop not found · CivMC Shops" }, 404);

    const { data: s } = await admin
      .from("shops")
      .select("id, name, styled_name, description, city, nation, icon_item, icon_path, x, z, archived, is_open, timed_out, timed_out_until, owner_id, listings(id), profiles!shops_owner_id_fkey(username, mc_username, timed_out, timed_out_until)")
      .eq("id", id)
      .maybeSingle();

    const owner = (Array.isArray(s?.profiles) ? s.profiles[0] : s?.profiles) as
      | { username?: string; mc_username?: string; timed_out?: boolean; timed_out_until?: string | null }
      | null
      | undefined;
    const hidden = !s || s.archived || s.is_open === false || stillOut(s) || stillOut(owner || null);
    if (hidden) {
      return respond({
        ...defaultEmbed(),
        title: "Shop not found · CivMC Shops",
        description: "That shop doesn't exist or isn't available.",
        url: SITE + "/home/",
      }, 404);
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
    if (!desc) desc = bits.join(" · ") || "CivMC shop on CivMC Shops.";
    else if (bits.length) desc = desc + " · " + bits.join(" · ");

    if (target.listing) {
      const { data: l } = await admin
        .from("listings")
        .select("id, sell_item, sell_amount, want_item, want_amount, in_stock")
        .eq("id", Number(target.listing))
        .eq("shop_id", id)
        .maybeSingle();
      if (l) {
        desc += ` · ${l.sell_amount} ${l.sell_item} for ${l.want_amount} ${l.want_item}`;
        if (l.in_stock === false) desc += " (out of stock)";
      }
    }

    const image = s.icon_path ? storageUrl(s.icon_path) : itemImg(s.icon_item || "chest");
    const dest = SITE + "/shops/?id=" + id + (target.listing ? "&listing=" + encodeURIComponent(String(target.listing)) : "");
    return respond({
      title: name,
      description: desc.slice(0, 300),
      url: dest,
      image,
      authorName: ownerName || undefined,
      authorUrl: ownerName ? SITE + "/profile/?id=" + s.owner_id : undefined,
    });
  }

  if (target.kind === "profile") {
    let p = null as Record<string, unknown> | null;
    if (target.id) {
      const { data } = await admin
        .from("profiles")
        .select("id, username, mc_username, discord_username, bio, avatar_path, is_business, place_city, place_nation, verified_at, timed_out, timed_out_until")
        .eq("id", target.id)
        .maybeSingle();
      p = data;
    } else if (target.name) {
      const needle = String(target.name).trim();
      const { data: byUser } = await admin
        .from("profiles")
        .select("id, username, mc_username, discord_username, bio, avatar_path, is_business, place_city, place_nation, verified_at, timed_out, timed_out_until")
        .ilike("username", needle)
        .limit(10);
      p = (byUser || []).find((x) => String(x.username || "").toLowerCase() === needle.toLowerCase()) || (byUser && byUser[0]) || null;
      if (!p) {
        const { data: byMc } = await admin
          .from("profiles")
          .select("id, username, mc_username, discord_username, bio, avatar_path, is_business, place_city, place_nation, verified_at, timed_out, timed_out_until")
          .ilike("mc_username", needle)
          .limit(10);
        p = (byMc || []).find((x) => String(x.mc_username || "").toLowerCase() === needle.toLowerCase()) || (byMc && byMc[0]) || null;
      }
    }

    if (!p || stillOut(p as { timed_out?: boolean; timed_out_until?: string | null })) {
      return respond({
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
    const bits: string[] = [];
    if (mc && mc.toLowerCase() !== String(primary).toLowerCase()) bits.push("MC: " + mc);
    if (p.discord_username) bits.push("Discord: " + p.discord_username);
    if (p.is_business) {
      const place = placeLine(p.place_city as string, p.place_nation as string);
      if (place) bits.push(place);
      bits.push("business");
    }
    if (p.verified_at) bits.push("verified");
    let desc = stripMc(String(p.bio || "")).replace(/\s+/g, " ").slice(0, 180);
    if (!desc) desc = bits.join(" · ") || "CivMC trader on CivMC Shops.";
    else if (bits.length) desc = desc + " · " + bits.slice(0, 3).join(" · ");

    const image = p.avatar_path
      ? storageUrl(String(p.avatar_path))
      : HEAD_URL + encodeURIComponent(mc || "steve") + "/128";

    return respond({
      title: primary,
      description: desc.slice(0, 300),
      url: SITE + "/profile/" + encodeURIComponent(login || String(p.id)) + "/",
      image,
      authorName: primary,
      authorUrl: SITE + "/profile/" + encodeURIComponent(login || String(p.id)) + "/",
    });
  }

  if (target.kind === "market") {
    const item = String(target.item || "").trim();
    if (!item) return respond(defaultEmbed());
    const enchant = target.enchant && target.enchant !== "plain" ? String(target.enchant) : "";
    const title = enchant ? item + " (" + enchant + ")" : item;
    const dest = SITE + "/market/?item=" + encodeURIComponent(item) + (enchant ? "&enchant=" + encodeURIComponent(enchant) : "");
    return respond({
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
    return respond({
      title: label,
      description: term
        ? "Search results for " + term + " on CivMC Shops."
        : "Search CivMC shops by item, enchant, or name.",
      url: dest,
      image: term && mode !== "shop" && mode !== "enchant" ? itemImg(term) : itemImg(mode === "enchant" ? "enchanted book" : "chest"),
    });
  }

  return respond(defaultEmbed());
});
