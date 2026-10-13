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
  // Prefer Discord handle (username), not display name (global_name).
  let username = String(me.username || me.id);
  if (me.discriminator && me.discriminator !== "0") username += "#" + me.discriminator;
  return { discord_id: String(me.id), discord_username: username.slice(0, 40) };
}

function xerrMessage(xerr: unknown): string | null {
  const n = Number(xerr);
  if (!n) return null;
  const map: Record<number, string> = {
    2148916227: "This Microsoft account is banned from Xbox Live.",
    2148916233: "This Microsoft account has no Xbox profile yet. Sign into minecraft.net or Xbox once, then try again.",
    2148916235: "Xbox Live is not available for this account's country.",
    2148916236: "This account needs adult verification on Xbox (South Korea).",
    2148916237: "This account needs adult verification on Xbox (South Korea).",
    2148916238: "This Microsoft account is under 18 / needs to be added to a Microsoft family.",
  };
  return map[n] || `Xbox error ${n}.`;
}

function microsoftIdFromToken(tok: Record<string, unknown>, fallback?: string): string {
  if (tok.id_token) {
    try {
      const mid = JSON.parse(new TextDecoder().decode(fromB64url(String(tok.id_token).split(".")[1])));
      if (mid?.oid) return String(mid.oid);
      if (mid?.sub) return String(mid.sub);
    } catch { /* fall through */ }
  }
  return String(fallback || crypto.randomUUID());
}

async function lookupMcUuid(name: string): Promise<{ uuid: string; name: string } | null> {
  const clean = name.trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(clean)) return null;
  const urls = [
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(clean)}`,
    `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(clean)}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.status === 404) return null;
      if (!r.ok) continue;
      const j = await r.json();
      const id = String(j.id || j.uuid || "").replace(/-/g, "").toLowerCase();
      const n = String(j.name || clean);
      if (/^[a-f0-9]{32}$/.test(id)) return { uuid: id, name: n.slice(0, 32) };
    } catch { /* try next */ }
  }
  return null;
}

type McLinkResult =
  | { mode: "oauth"; microsoft_id: string; mc_uuid: string; mc_username: string }
  | { mode: "soft"; microsoft_id: string; reason: string };

async function finishMinecraft(code: string, redirectUri: string): Promise<McLinkResult> {
  const id = Deno.env.get("MICROSOFT_CLIENT_ID");
  const secret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Microsoft OAuth is not configured yet.");

  // Only Xbox scopes - mixing User.Read / openid here can break XboxLive.signin.
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

  const soft = (reason: string, fallbackId?: string): McLinkResult => ({
    mode: "soft",
    microsoft_id: microsoftIdFromToken(tok, fallbackId),
    reason,
  });

  const xboxHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-xbl-contract-version": "1",
  };
  const xboxRes = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: xboxHeaders,
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
  const xboxText = await xboxRes.text();
  let xbox: Record<string, unknown> = {};
  try { xbox = JSON.parse(xboxText); } catch { /* ignore */ }
  if (!xboxRes.ok || !xbox.Token) {
    const hint = xerrMessage(xbox.XErr) || xboxText.slice(0, 120) || xboxRes.statusText;
    return soft("Xbox Live step failed (" + hint + "). Confirm your Java username below for now.");
  }
  const xui = (xbox as { DisplayClaims?: { xui?: Array<{ uhs?: string; xid?: string }> } })?.DisplayClaims?.xui?.[0];
  const uhs = xui?.uhs;
  if (!uhs) return soft("Xbox Live user hash missing. Confirm your Java username below for now.");

  const xstsRes = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: xboxHeaders,
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xbox.Token] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });
  const xstsText = await xstsRes.text();
  let xsts: Record<string, unknown> = {};
  try { xsts = JSON.parse(xstsText); } catch { /* ignore */ }
  if (!xstsRes.ok || !xsts.Token) {
    const hint = xerrMessage(xsts.XErr) || xstsText.slice(0, 120) || xstsRes.statusText;
    return soft("Minecraft XSTS failed (" + hint + "). Confirm your Java username below for now.", xui?.xid);
  }

  const mcLogin = await fetch("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xsts.Token}` }),
  });
  const mcTokText = await mcLogin.text();
  let mcTok: Record<string, unknown> = {};
  try { mcTok = JSON.parse(mcTokText); } catch { /* ignore */ }
  if (!mcLogin.ok || !mcTok.access_token) {
    if (mcLogin.status === 403) {
      return soft(
        "Mojang has not allowlisted this Azure app yet. Confirm your Java username below (temporary until approval).",
        xui?.xid,
      );
    }
    return soft(
      "Minecraft login failed (" + mcLogin.status + "). Confirm your Java username below for now.",
      xui?.xid,
    );
  }

  const profRes = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${mcTok.access_token}` },
  });
  const prof = await profRes.json();
  if (!profRes.ok || !prof.id || !prof.name) {
    return soft("No Java profile on this Microsoft account yet. Confirm your username below, or open the Minecraft launcher once.", xui?.xid);
  }

  return {
    mode: "oauth",
    microsoft_id: microsoftIdFromToken(tok, xui?.xid || prof.id),
    mc_uuid: String(prof.id).replace(/-/g, "").toLowerCase(),
    mc_username: String(prof.name).slice(0, 32),
  };
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
        const { data: takenMs } = await admin.from("profiles").select("id").eq("microsoft_id", m.microsoft_id).neq("id", user.id).maybeSingle();
        if (takenMs) return json({ error: "That Microsoft account is already linked to another CivMC Shops account." }, 400);

        if (m.mode === "soft") {
          const { error } = await admin.from("profiles").update({
            microsoft_id: m.microsoft_id,
            mc_link_method: "soft_pending",
          }).eq("id", user.id);
          if (error) return json({ error: error.message }, 400);
          return json({
            ok: true,
            provider: "minecraft",
            needs_mc_name: true,
            reason: m.reason,
          });
        }

        const { data: takenMc } = await admin.from("profiles").select("id").eq("mc_uuid", m.mc_uuid).neq("id", user.id).maybeSingle();
        if (takenMc) return json({ error: "That Minecraft account is already linked to another CivMC Shops account." }, 400);

        let civinfo_known: boolean | null = null;
        try {
          civinfo_known = await probeCivinfo(m.mc_username);
        } catch { civinfo_known = null; }

        const { error } = await admin.from("profiles").update({
          microsoft_id: m.microsoft_id,
          mc_uuid: m.mc_uuid,
          mc_username: m.mc_username,
          mc_linked_at: now,
          mc_link_method: "oauth",
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

  // Interim until Mojang allowlists the Azure app: Microsoft already linked, user confirms Java name.
  if (action === "confirm_mc_name") {
    const user = await bearerUser(admin, req);
    if (!user) return json({ error: "Not logged in." }, 401);
    const { data: me } = await admin.from("profiles").select("microsoft_id, mc_uuid").eq("id", user.id).single();
    if (!me?.microsoft_id) {
      return json({ error: "Connect Microsoft first (Connect Minecraft button), then confirm your Java username." }, 400);
    }
    if (me.mc_uuid) return json({ error: "Minecraft is already linked on this account." }, 400);

    const name = String(body.mc_username || "").trim();
    const looked = await lookupMcUuid(name);
    if (!looked) return json({ error: "That Minecraft Java username was not found. Check spelling." }, 400);

    const { data: takenMc } = await admin.from("profiles").select("id").eq("mc_uuid", looked.uuid).neq("id", user.id).maybeSingle();
    if (takenMc) return json({ error: "That Minecraft account is already linked to another CivMC Shops account." }, 400);

    let civinfo_known: boolean | null = null;
    try {
      civinfo_known = await probeCivinfo(looked.name);
    } catch { civinfo_known = null; }

    const { error } = await admin.from("profiles").update({
      mc_uuid: looked.uuid,
      mc_username: looked.name,
      mc_linked_at: new Date().toISOString(),
      mc_link_method: "soft",
      civinfo_known,
    }).eq("id", user.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, mc_username: looked.name, civinfo_known, soft: true });
  }

  return json({ error: "Unknown action." }, 400);
});
