// PUBLIC self-signup. Username + password only.
// Account stays guest-level until Discord + Minecraft are linked via link-oauth.
// Public verified badge still requires head admin Accept.
// Deploy: supabase functions deploy signup
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
  const body = await req.json();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!/^[a-z0-9_]{3,20}$/.test(username)) return json({ error: "Login username: 3-20 letters, numbers or _." }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "Password needs 8-72 characters." }, 400);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: username + "@civmc.local", password, email_confirm: true,
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return json({ error: taken ? "That login username is taken." : error.message }, 400);
  }

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    mc_username: null,
    discord_username: null,
    verified_at: null,
    must_change_password: false,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: pErr.message }, 400);
  }
  return json({ ok: true });
});
