// Account-level moderation and roles.
//   timeout / untimeout : mods, admins, head. Mods: users only. Admins: users + mods. Head: everyone but themselves.
//   make_mod / remove_mod / make_admin / remove_admin : HEAD ADMIN ONLY
//   impersonate : HEAD ADMIN ONLY — one-time token so the client can open a session as that user
// Timeouts: optional hours (1 / 24 / 168). Omit or null = until staff lifts.
// Auth ban_duration matches so login unlocks when the window ends; profile flag uses timed_out_until.
// Deploy: supabase functions deploy manage-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: "Not logged in." }, 401);

  const { data: me } = await admin.from("profiles").select("*").eq("id", caller.user.id).single();
  if (!me || me.timed_out || !(me.is_admin || me.is_mod)) return json({ error: "Staff only." }, 403);

  const body = await req.json();
  const { action, user_id } = body;
  if (!user_id || user_id === me.id) return json({ error: "Pick a different account." }, 400);

  const { data: target } = await admin.from("profiles").select("*").eq("id", user_id).single();
  if (!target) return json({ error: "No such account." }, 404);

  // Head-only: mint a magic-link hash so the client can switch session to this user.
  // The head admin's own tokens are saved client-side and restored via Exit.
  if (action === "impersonate") {
    if (!me.is_head) return json({ error: "Only the head admin can log into users." }, 403);
    if (target.timed_out) return json({ error: "That account is timed out." }, 400);
    const { data: authUser, error: uErr } = await admin.auth.admin.getUserById(user_id);
    if (uErr || !authUser?.user?.email) return json({ error: uErr?.message || "No such account." }, 404);
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    });
    if (lErr || !link?.properties?.hashed_token) {
      return json({ error: lErr?.message || "Could not start impersonation." }, 400);
    }
    return json({
      ok: true,
      token_hash: link.properties.hashed_token,
      username: target.username,
      mc_username: target.mc_username,
      user_id: target.id,
    });
  }

  if (target.is_head) return json({ error: "The head admin can't be changed." }, 403);

  if (action === "timeout" || action === "untimeout") {
    if (target.is_admin && !me.is_head) return json({ error: "Only the head admin can timeout admins." }, 403);
    if (target.is_mod && !me.is_admin) return json({ error: "Only admins can timeout mods." }, 403);
    const on = action === "timeout";
    let hours: number | null = null;
    if (on && body.hours != null && body.hours !== "") {
      hours = Number(body.hours);
      if (![1, 24, 168].includes(hours)) return json({ error: "Use 1 hour, 1 day, 7 days, or until removed." }, 400);
    }
    const timed_out_until = on && hours != null
      ? new Date(Date.now() + hours * 3600 * 1000).toISOString()
      : null;

    const { error } = await admin.from("profiles").update({ timed_out: on, timed_out_until }).eq("id", user_id);
    if (error) return json({ error: error.message }, 400);

    // ban = can't log in. "none" lifts it. Match duration when set.
    const ban_duration = on ? (hours != null ? `${hours}h` : "876000h") : "none";
    const { error: bErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration });
    if (bErr) return json({ error: bErr.message }, 400);

    if (on) await admin.rpc("kill_sessions", { uid: user_id });   // log them out everywhere
    return json({ ok: true });
  }

  const roles: Record<string, { is_admin: boolean; is_mod: boolean }> = {
    make_mod: { is_admin: false, is_mod: true },
    remove_mod: { is_admin: false, is_mod: false },
    make_admin: { is_admin: true, is_mod: false },
    remove_admin: { is_admin: false, is_mod: false },
  };
  if (roles[action]) {
    if (!me.is_head) return json({ error: "Only the head admin can change roles." }, 403);
    const { error } = await admin.from("profiles").update(roles[action]).eq("id", user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
});
