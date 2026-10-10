// Admin-created accounts. Only the head admin can make mod/admin accounts.
// These start VERIFIED (an admin vouches for them) and get the "pick your own password" popup.
// Deploy: supabase functions deploy create-user
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

  const { data: prof } = await admin.from("profiles").select("is_admin, is_head, timed_out").eq("id", caller.user.id).single();
  if (!prof?.is_admin || prof.timed_out) return json({ error: "Admins only." }, 403);

  const { username, mc_username, discord_username = "", password, role = "user" } = await req.json();
  if (!["user", "mod", "admin"].includes(role)) return json({ error: "Bad account type." }, 400);
  if (role !== "user" && !prof.is_head) return json({ error: "Only the head admin can create mods or admins." }, 403);
  if (!/^[a-z0-9_]{3,20}$/.test(username || "")) return json({ error: "Login username: 3-20 letters, numbers or _." }, 400);
  if (!mc_username || mc_username.length > 32) return json({ error: "Need a Minecraft name (max 32 characters)." }, 400);
  if (!password || password.length < 8) return json({ error: "Password needs 8+ characters." }, 400);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: username + "@civmc.local", password, email_confirm: true,
  });
  if (error) return json({ error: error.message }, 400);

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    mc_username,
    discord_username: String(discord_username).slice(0, 40) || null,
    is_mod: role === "mod",
    is_admin: role === "admin",
    verified_at: new Date().toISOString(),
    must_change_password: true,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back
    return json({ error: pErr.message }, 400);
  }
  return json({ ok: true });
});
