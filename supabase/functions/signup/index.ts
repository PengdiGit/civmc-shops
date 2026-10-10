// PUBLIC self-signup. The new account is UNVERIFIED: it can log in and comment, but can't
// make shops until the head admin accepts it. Roles can never be picked here.
// (also deletes unverified accounts older than 24h)
// Deploy: supabase functions deploy signup
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await purgeExpired(admin);
  const body = await req.json();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const mc = String(body.mc_username || "").trim();
  const discord = String(body.discord_username || "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) return json({ error: "Login username: 3-20 letters, numbers or _." }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "Password needs 8-72 characters." }, 400);
  if (!mc || mc.length > 32) return json({ error: "Enter your Minecraft name (max 32 characters)." }, 400);
  if (discord.length < 2 || discord.length > 40) return json({ error: "Enter your Discord username." }, 400);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: username + "@civmc.local", password, email_confirm: true,
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return json({ error: taken ? "That login username is taken." : error.message }, 400);
  }

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id, mc_username: mc, discord_username: discord,
    verified_at: null, must_change_password: false,   // picked their own password, no popup
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: pErr.message }, 400);
  }
  return json({ ok: true });
});
