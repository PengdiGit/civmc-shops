// HEAD ADMIN ONLY.
//   list   : every account with its private details (login name, signed up, last login)
//   accept : verify an unverified account (can create shops from now on)
//   deny   : delete an UNVERIFIED account and everything it made (comments cascade away)
//   delete : delete ANY account except the head's own (verified users, mods, admins) with everything it made
//   purge_unverified : delete all unverified non-staff accounts older than 24h (same rules as cron)
// Deploy: supabase functions deploy review-signup
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });


// Unverified accounts are deleted 24 hours after signup (staff accounts are never touched).
async function purgeExpired(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: old } = await admin.from("profiles").select("id")
    .is("verified_at", null).eq("is_admin", false).eq("is_mod", false).eq("is_head", false).lt("created_at", cutoff);
  for (const o of old || []) await admin.auth.admin.deleteUser(o.id);   // cascades to their profile + comments
}

// remove the pictures an account uploaded (comment pictures, profile picture, shop icons)
async function removeFiles(admin: ReturnType<typeof createClient>, uid: string) {
  for (const folder of ["comments", "avatars", "shops"]) {
    const { data } = await admin.storage.from("uploads").list(`${folder}/${uid}`, { limit: 1000 });
    if (data && data.length) await admin.storage.from("uploads").remove(data.map((o) => `${folder}/${uid}/${o.name}`));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: "Not logged in." }, 401);
  const { data: me } = await admin.from("profiles").select("is_head, timed_out").eq("id", caller.user.id).single();
  if (!me?.is_head || me.timed_out) return json({ error: "Head admin only." }, 403);

  const { action, user_id } = await req.json();

  if (action === "purge_unverified") {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: old } = await admin.from("profiles").select("id, mc_username")
      .is("verified_at", null).eq("is_admin", false).eq("is_mod", false).eq("is_head", false).lt("created_at", cutoff);
    const ids = old || [];
    for (const o of ids) {
      await removeFiles(admin, o.id);
      await admin.auth.admin.deleteUser(o.id);
    }
    return json({ ok: true, purged: ids.length });
  }

  if (action === "list") {
    await purgeExpired(admin);
    const { data: profiles, error } = await admin.from("profiles").select("*");
    if (error) return json({ error: error.message }, 400);
    const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lErr) return json({ error: lErr.message }, 400);
    const byId = new Map(list.users.map((u) => [u.id, u]));
    const accounts = profiles.map((p) => {
      const u = byId.get(p.id);
      return {
        ...p,
        login_username: (u?.email || "").replace("@civmc.local", ""),
        last_sign_in_at: u?.last_sign_in_at ?? null,
      };
    });
    return json({ accounts });
  }

  if (action === "delete") {
    if (!user_id || user_id === caller.user.id) return json({ error: "Pick a different account." }, 400);
    const { data: target } = await admin.from("profiles").select("is_head").eq("id", user_id).single();
    if (!target) return json({ error: "No such account." }, 404);
    if (target.is_head) return json({ error: "The head admin account can't be deleted here." }, 403);
    await removeFiles(admin, user_id);
    const { error } = await admin.auth.admin.deleteUser(user_id);   // cascades: profile, shops, listings, comments, reviews, favourites
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "accept" || action === "deny") {
    const { data: target } = await admin.from("profiles").select("*").eq("id", user_id).single();
    if (!target) return json({ error: "No such account." }, 404);
    if (target.verified_at) return json({ error: "That account is already verified." }, 400);
    if (target.is_admin || target.is_mod || target.is_head) return json({ error: "Staff accounts can't be reviewed." }, 403);

    if (action === "accept") {
      const { error } = await admin.from("profiles").update({ verified_at: new Date().toISOString() }).eq("id", user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    // deny: deleting the login deletes the profile and (cascade) their comments, reports, shops
    await removeFiles(admin, user_id);
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
});
