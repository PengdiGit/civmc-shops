// HEAD ADMIN ONLY.
//   list   : all unknown_listings rows (newest scan first)
//   delete : remove one unknown listing by id
// Deploy: supabase functions deploy manage-unknown
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
  const { data: me } = await admin.from("profiles").select("is_head, timed_out").eq("id", caller.user.id).single();
  if (!me?.is_head || me.timed_out) return json({ error: "Head admin only." }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "list") {
    const { data, error } = await admin
      .from("unknown_listings")
      .select(
        "id, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, stock, in_stock, enchants, notes, x, y, z, nl, last_player, created_at, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json({ unknowns: data || [] });
  }

  if (action === "delete") {
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) return json({ error: "Pick an unknown listing." }, 400);
    const { data: row, error: findErr } = await admin.from("unknown_listings").select("id").eq("id", id).maybeSingle();
    if (findErr) return json({ error: findErr.message }, 400);
    if (!row) return json({ error: "That unknown listing is already gone." }, 404);
    const { error } = await admin.from("unknown_listings").delete().eq("id", id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});
