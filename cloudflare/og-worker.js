/**
 * CivShops - Discord/Slack Open Graph proxy
 *
 * Humans: pass through to GitHub Pages.
 * Crawlers: call the Supabase embed function so previews show shop name, icon, description, owner.
 *
 * Setup (Cloudflare, ~5 min):
 * 1. Add pengworld.net to Cloudflare (free) - or only proxy the civshops CNAME (orange cloud).
 * 2. Workers → Create → paste this file.
 * 3. Settings → Triggers → Add route: civshops.pengworld.net/*
 * 4. Keep DNS: civshops CNAME → pengdigit.github.io (proxied / orange cloud).
 *
 * After this, sharing https://civshops.pengworld.net/shops/?id=1 shows a per-shop Discord card.
 */

const EMBED = "https://isxjyehkrpyyupltbbna.supabase.co/functions/v1/embed";
const PAGES = "https://pengdigit.github.io/civmc-shops";

const BOT_RE = /Discordbot|Slackbot|Slack-ImgProxy|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|TelegramBot|WhatsApp|Discordbot|Embedly|Quora Link Preview|Pinterest|Iframely|redditbot|Applebot|SkypeUriPreview|vkShare|W3C_Validator/i;

function isBot(ua) {
  return BOT_RE.test(ua || "");
}

function embedUrlFor(requestUrl) {
  const url = new URL(requestUrl);
  const embed = new URL(EMBED);
  // Prefer full page URL so the function can parse path + query.
  embed.searchParams.set("url", url.href);

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.endsWith("/shops") || path.includes("/shops/")) {
    const listingPath = path.match(/\/shops\/([^/]+)\/listing\/(\d+)$/i);
    if (listingPath) {
      const slug = listingPath[1];
      if (/^\d+$/.test(slug)) embed.searchParams.set("shop", slug);
      embed.searchParams.set("listing", listingPath[2]);
    } else {
      const slug = (path.match(/\/shops\/([^/]+)$/) || [])[1];
      if (slug && /^\d+$/.test(slug)) embed.searchParams.set("shop", slug);
      // Name slugs are resolved via the full page URL on the embed function
      const id = url.searchParams.get("id");
      if (id) embed.searchParams.set("shop", id);
      const listing = url.searchParams.get("listing");
      if (listing) embed.searchParams.set("listing", listing);
    }
  } else if (path.endsWith("/profile") || path.includes("/profile/")) {
    const slug = (path.match(/\/profile\/([^/]+)$/) || [])[1];
    if (slug && /^[0-9a-f-]{36}$/i.test(slug)) embed.searchParams.set("profile", slug);
    else if (slug) embed.searchParams.set("name", decodeURIComponent(slug));
    const id = url.searchParams.get("id");
    if (id) embed.searchParams.set("profile", id);
    const name = url.searchParams.get("name");
    if (name) embed.searchParams.set("name", name);
  } else if (path.endsWith("/market") || path.includes("/market/")) {
    const item = url.searchParams.get("item");
    if (item) embed.searchParams.set("item", item);
    const enchant = url.searchParams.get("enchant");
    if (enchant) embed.searchParams.set("enchant", enchant);
  } else if (path.endsWith("/home") || path.includes("/home/") || path === "/") {
    const q = url.searchParams.get("q");
    if (q) embed.searchParams.set("q", q);
    const mode = url.searchParams.get("mode");
    if (mode) embed.searchParams.set("mode", mode);
  }

  if (url.pathname.includes("oembed") || url.searchParams.get("format") === "json") {
    embed.searchParams.set("format", "oembed");
  }
  return embed.href;
}

function pagesUrlFor(requestUrl) {
  const url = new URL(requestUrl);
  let path = url.pathname || "/";
  if (path === "/") path = "/home/";
  return PAGES + path + url.search;
}

export default {
  async fetch(request) {
    const ua = request.headers.get("user-agent") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (isBot(ua) && (request.method === "GET" || request.method === "HEAD")) {
      const res = await fetch(embedUrlFor(request.url), {
        headers: { "User-Agent": ua, Accept: "text/html,application/json" },
        cf: { cacheTtl: 120, cacheEverything: true },
      });
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "public, max-age=120");
      return new Response(res.body, { status: res.status, headers });
    }

    const upstream = pagesUrlFor(request.url);
    const res = await fetch(upstream, {
      method: request.method,
      headers: request.headers,
      redirect: "follow",
    });
    return res;
  },
};
