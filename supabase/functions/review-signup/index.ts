// HEAD ADMIN ONLY.
//   list   : every account + split queues (awaiting_links / ready_for_review)
//   accept : set public verified badge (verified_at) - only when Discord+MC linked
//   deny   : delete account and everything it made
//   delete : delete ANY account except the head's own
// Deploy: supabase functions deploy review-signup
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

function isStaffish(p: { is_admin?: boolean; is_mod?: boolean; is_head?: boolean; is_business?: boolean; is_nation?: boolean }) {
  return !!(p.is_admin || p.is_mod || p.is_head || p.is_business || p.is_nation);
}

function isLinked(p: { discord_id?: string | null; mc_uuid?: string | null }) {
  return !!(p.discord_id && p.mc_uuid);
}

async function removeFiles(admin: Admin, uid: string) {
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

  if (action === "list") {
    const { data: profiles, error } = await admin.from("profiles").select("*");
    if (error) return json({ error: error.message }, 400);
    const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lErr) return json({ error: lErr.message }, 400);
    const byId = new Map(list.users.map((u) => [u.id, u]));
    const accounts = profiles.map((p) => {
      const u = byId.get(p.id);
      return {
        ...p,
        login_username: p.username || (u?.email || "").replace("@civmc.local", ""),
        last_sign_in_at: u?.last_sign_in_at ?? null,
      };
    });

    const queue = accounts
      .filter((a) => !isStaffish(a) && !a.verified_at)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const awaiting_links = queue.filter((a) => !isLinked(a));
    const ready_for_review = queue.filter((a) => isLinked(a));

    return json({ accounts, awaiting_links, ready_for_review });
  }

  if (action === "delete") {
    if (!user_id || user_id === caller.user.id) return json({ error: "Pick a different account." }, 400);
    const { data: target } = await admin.from("profiles").select("is_head").eq("id", user_id).single();
    if (!target) return json({ error: "No such account." }, 404);
    if (target.is_head) return json({ error: "The head admin account can't be deleted here." }, 403);
    await removeFiles(admin, user_id);
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "accept" || action === "deny") {
    const { data: target } = await admin.from("profiles").select("*").eq("id", user_id).single();
    if (!target) return json({ error: "No such account." }, 404);
    if (target.verified_at) return json({ error: "That account already has the verified badge." }, 400);
    if (isStaffish(target)) return json({ error: "Staff / shared accounts can't be reviewed here." }, 403);

    if (action === "accept") {
      if (!isLinked(target)) {
        return json({ error: "They still need to connect Discord and Minecraft before you can Accept." }, 400);
      }
      const { error } = await admin.from("profiles").update({ verified_at: new Date().toISOString() }).eq("id", user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    await removeFiles(admin, user_id);
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
});
