// Link Discord or Microsoft/Minecraft to the signed-in account.
// start  → authorize URL + signed state
// finish → exchange code, write identity onto profiles
// Deploy: supabase functions deploy link-oauth --no-verify-jwt
// Secrets: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, MICROSOFT_CLIENT_ID,
//          MICROSOFT_CLIENT_SECRET, OAUTH_STATE_SECRET (optional; falls back to service role)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED_REDIRECTS = [
  "https://pengdigit.github.io/civmc-shops/verify/",
  "https://pengdigit.github.io/civmc-shops/verify",
  "https://civshops.pengworld.net/verify/",
  "https://civshops.pengworld.net/verify",
  "http://localhost:5500/verify/",
  "http://127.0.0.1:5500/verify/",
  "http://localhost:5500/civmc-shops/verify/",
  "http://127.0.0.1:5500/civmc-shops/verify/",
];

type Admin = ReturnType<typeof createClient>;

function stateSecret(): string {
  return Deno.env.get("OAUTH_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "civshops-oauth";
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(stateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

async function makeState(userId: string, provider: string): Promise<string> {
  const body = b64urlJson({
    u: userId,
    p: provider,
    e: Date.now() + 15 * 60 * 1000,
    n: crypto.randomUUID(),
  });
  const sig = await hmacSign(body);
  return `${body}.${sig}`;
}

async function readState(state: string): Promise<{ u: string; p: string } | null> {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const expect = await hmacSign(body);
  if (expect !== sig) return null;
  try {
    const raw = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!raw?.u || !raw?.p || typeof raw.e !== "number" || raw.e < Date.now()) return null;
    return { u: String(raw.u), p: String(raw.p) };
  } catch {
    return null;
  }
}

function normalizeRedirect(url: string): string | null {
  const s = String(url || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const base = u.origin + u.pathname.replace(/\/?$/, "/");
    const bare = u.origin + u.pathname.replace(/\/$/, "");
    if (ALLOWED_REDIRECTS.includes(base) || ALLOWED_REDIRECTS.includes(bare) || ALLOWED_REDIRECTS.includes(s)) {
      return base.endsWith("/") ? base : base + "/";
    }
  } catch { /* ignore */ }
  return null;
}

async function bearerUser(admin: Admin, req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user ?? null;
}

async function probeCivinfo(mcName: string): Promise<boolean | null> {
  const name = encodeURIComponent(mcName);
  const urls = [
    `https://civinfo.net/api/players/${name}`,
    `https://civinfo.net/api/player/${name}`,
    `https://playtime.civinfo.net/api/players/${name}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.status === 404) return false;
      if (!r.ok) continue;
      const t = await r.text();
      if (!t || t === "null") return false;
      return true;
    } catch { /* try next */ }
  }
  return null;
}

async function finishDiscord(code: string, redirectUri: string) {
  const id = Deno.env.get("DISCORD_CLIENT_ID");
  const secret = Deno.env.get("DISCORD_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Discord OAuth is not configured yet.");

  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const tokRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await tokRes.json();
  if (!tokRes.ok || !tok.access_token) {
    throw new Error(tok.error_description || tok.error || "Discord token exchange failed.");
  }
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const me = await meRes.json();
  if (!meRes.ok || !me.id) throw new Error("Could not read Discord profile.");
  const username = me.global_name || me.username || String(me.id);
  return { discord_id: String(me.id), discord_username: String(username).slice(0, 40) };
}

async function finishMinecraft(code: string, redirectUri: string) {
  const id = Deno.env.get("MICROSOFT_CLIENT_ID");
  const secret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Microsoft OAuth is not configured yet.");

  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: "XboxLive.signin offline_access",
  });
  const tokRes = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await tokRes.json();
  if (!tokRes.ok || !tok.access_token) {
    throw new Error(tok.error_description || tok.error || "Microsoft token exchange failed.");
  }

  const xboxRes = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${tok.access_token}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });
  const xbox = await xboxRes.json();
  if (!xboxRes.ok || !xbox.Token) throw new Error("Xbox Live login failed. Use a personal Microsoft account that owns Minecraft Java.");
  const uhs = xbox?.DisplayClaims?.xui?.[0]?.uhs;
  if (!uhs) throw new Error("Xbox Live user hash missing.");

  const xstsRes = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xbox.Token] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });
  const xsts = await xstsRes.json();
  if (!xstsRes.ok || !xsts.Token) {
    throw new Error("Minecraft XSTS failed. This Microsoft account may not own Minecraft Java.");
  }

  const mcLogin = await fetch("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xsts.Token}` }),
  });
  const mcTok = await mcLogin.json();
  if (!mcLogin.ok || !mcTok.access_token) {
    throw new Error("Minecraft login failed. Make sure this account owns Java Edition.");
  }

  const profRes = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${mcTok.access_token}` },
  });
  const prof = await profRes.json();
  if (!profRes.ok || !prof.id || !prof.name) {
    throw new Error("No Minecraft Java profile on this account (Game Pass users: open the launcher once first).");
  }

  // Microsoft oid from id_token if present; else xbox xui xid
  let microsoft_id = String(xbox?.DisplayClaims?.xui?.[0]?.xid || prof.id);
  if (tok.id_token) {
    try {
      const mid = JSON.parse(new TextDecoder().decode(fromB64url(String(tok.id_token).split(".")[1])));
      if (mid?.oid) microsoft_id = String(mid.oid);
      else if (mid?.sub) microsoft_id = String(mid.sub);
    } catch { /* keep xbox id */ }
  }

  const mc_uuid = String(prof.id).replace(/-/g, "").toLowerCase();
  const mc_username = String(prof.name).slice(0, 32);
  return { microsoft_id, mc_uuid, mc_username };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad JSON." }, 400);
  }
  const action = String(body.action || "");

  if (action === "start") {
    const user = await bearerUser(admin, req);
    if (!user) return json({ error: "Not logged in." }, 401);
    const provider = String(body.provider || "");
    if (provider !== "discord" && provider !== "minecraft") {
      return json({ error: "provider must be discord or minecraft." }, 400);
    }
    const redirectUri = normalizeRedirect(String(body.redirect_uri || ""));
    if (!redirectUri) return json({ error: "That redirect URL is not allowed." }, 400);

    const state = await makeState(user.id, provider);
    if (provider === "discord") {
      const id = Deno.env.get("DISCORD_CLIENT_ID");
      if (!id) return json({ error: "Discord OAuth is not configured yet. Ask the head admin to add the Discord app secrets." }, 503);
      const url = new URL("https://discord.com/api/oauth2/authorize");
      url.searchParams.set("client_id", id);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "identify");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", `discord.${state}`);
      url.searchParams.set("prompt", "consent");
      return json({ ok: true, url: url.toString() });
    }

    const mid = Deno.env.get("MICROSOFT_CLIENT_ID");
    if (!mid) return json({ error: "Microsoft OAuth is not configured yet. Ask the head admin to add the Microsoft app secrets." }, 503);
    const url = new URL("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");
    url.searchParams.set("client_id", mid);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "XboxLive.signin offline_access");
    url.searchParams.set("state", `minecraft.${state}`);
    url.searchParams.set("prompt", "select_account");
    return json({ ok: true, url: url.toString() });
  }

  if (action === "finish") {
    const user = await bearerUser(admin, req);
    if (!user) return json({ error: "Not logged in." }, 401);
    const code = String(body.code || "");
    const stateRaw = String(body.state || "");
    const redirectUri = normalizeRedirect(String(body.redirect_uri || ""));
    if (!code || !stateRaw || !redirectUri) return json({ error: "Missing code, state, or redirect." }, 400);

    const dot = stateRaw.indexOf(".");
    if (dot < 0) return json({ error: "Bad state." }, 400);
    const provider = stateRaw.slice(0, dot);
    const state = stateRaw.slice(dot + 1);
    const parsed = await readState(state);
    if (!parsed || parsed.u !== user.id || parsed.p !== provider) {
      return json({ error: "OAuth state expired or mismatched. Try again." }, 400);
    }

    const now = new Date().toISOString();
    try {
      if (provider === "discord") {
        const d = await finishDiscord(code, redirectUri);
        const { data: taken } = await admin.from("profiles").select("id").eq("discord_id", d.discord_id).neq("id", user.id).maybeSingle();
        if (taken) return json({ error: "That Discord account is already linked to another CivMC Shops account." }, 400);
        const { error } = await admin.from("profiles").update({
          discord_id: d.discord_id,
          discord_username: d.discord_username,
          discord_linked_at: now,
        }).eq("id", user.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, provider: "discord", discord_username: d.discord_username });
      }

      if (provider === "minecraft") {
        const m = await finishMinecraft(code, redirectUri);
        const { data: takenMc } = await admin.from("profiles").select("id").eq("mc_uuid", m.mc_uuid).neq("id", user.id).maybeSingle();
        if (takenMc) return json({ error: "That Minecraft account is already linked to another CivMC Shops account." }, 400);
        const { data: takenMs } = await admin.from("profiles").select("id").eq("microsoft_id", m.microsoft_id).neq("id", user.id).maybeSingle();
        if (takenMs) return json({ error: "That Microsoft account is already linked to another CivMC Shops account." }, 400);

        let civinfo_known: boolean | null = null;
        try {
          civinfo_known = await probeCivinfo(m.mc_username);
        } catch { civinfo_known = null; }

        const { error } = await admin.from("profiles").update({
          microsoft_id: m.microsoft_id,
          mc_uuid: m.mc_uuid,
          mc_username: m.mc_username,
          mc_linked_at: now,
          civinfo_known,
        }).eq("id", user.id);
        if (error) return json({ error: error.message }, 400);
        return json({
          ok: true,
          provider: "minecraft",
          mc_username: m.mc_username,
          civinfo_known,
        });
      }
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "OAuth failed." }, 400);
    }
    return json({ error: "Unknown provider." }, 400);
  }

  return json({ error: "Unknown action." }, 400);
});
