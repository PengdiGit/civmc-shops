// Account / data deletion requests.
//   request : logged-in user asks to delete their account and data
//   mine    : logged-in user — current request status (if any)
//   list    : head admin — pending requests
//   accept  : head admin — delete account + uploads (same as review-signup delete)
//   deny    : head admin — leave account, mark request denied (user may request again)
// Deploy: supabase functions deploy account-deletion
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

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

  const { data: me } = await admin.from("profiles").select("*").eq("id", caller.user.id).single();
  if (!me || me.timed_out) return json({ error: "Not logged in." }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "mine") {
    const { data, error } = await admin
      .from("deletion_requests")
      .select("id, status, created_at, reviewed_at")
      .eq("user_id", me.id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    return json({ request: data || null });
  }

  if (action === "request") {
    if (me.is_head) {
      return json({ error: "The head admin account can't request deletion here." }, 403);
    }
    const { data: existing } = await admin
      .from("deletion_requests")
      .select("id, status")
      .eq("user_id", me.id)
      .maybeSingle();
    if (existing?.status === "pending") {
      return json({ error: "You already have a pending deletion request." }, 400);
    }

    const row = {
      user_id: me.id,
      username: me.username || null,
      mc_username: me.mc_username || null,
      status: "pending",
      created_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    };

    if (existing) {
      const { data, error } = await admin
        .from("deletion_requests")
        .update(row)
        .eq("id", existing.id)
        .select("id, status, created_at")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, request: data });
    }

    const { data, error } = await admin
      .from("deletion_requests")
      .insert(row)
      .select("id, status, created_at")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, request: data });
  }

  // ---- head admin ----
  if (!me.is_head) return json({ error: "Head admin only." }, 403);

  if (action === "list") {
    const { data, error } = await admin
      .from("deletion_requests")
      .select("id, user_id, username, mc_username, status, created_at, profiles!deletion_requests_user_id_fkey(username, mc_username, discord_username, verified_at, is_admin, is_mod, is_business, is_nation)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    return json({ requests: data || [] });
  }

  if (action === "accept" || action === "deny") {
    const request_id = body?.request_id;
    if (!request_id) return json({ error: "Pick a request." }, 400);

    const { data: reqRow } = await admin
      .from("deletion_requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();
    if (!reqRow) return json({ error: "No such request." }, 404);
    if (reqRow.status !== "pending") return json({ error: "That request is no longer pending." }, 400);
    if (reqRow.user_id === me.id) return json({ error: "You can't process your own deletion request." }, 403);

    const { data: target } = await admin.from("profiles").select("id, is_head, username, mc_username").eq("id", reqRow.user_id).single();
    if (!target) return json({ error: "No such account." }, 404);
    if (target.is_head) return json({ error: "The head admin account can't be deleted here." }, 403);

    if (action === "deny") {
      const { error } = await admin.from("deletion_requests").update({
        status: "denied",
        reviewed_at: new Date().toISOString(),
        reviewed_by: me.id,
      }).eq("id", request_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // accept → wipe uploads then delete auth user (cascades profile + owned data)
    await removeFiles(admin, reqRow.user_id);
    const { error } = await admin.auth.admin.deleteUser(reqRow.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});
