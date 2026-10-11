// Admin-created accounts. Only the head admin can make mod, admin, or business accounts.
// Player / mod / admin accounts start VERIFIED and get the "pick your own password" popup.
// Business accounts are a shared login: username, password, and a city and/or nation label.
// They start verified with no password-change nag, so the password the head sets is the one people share.
// Deploy: supabase functions deploy create-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function cleanPlace(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (s.length > 60) return s; // caller rejects over-long values
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: "Not logged in." }, 401);

  const { data: prof } = await admin.from("profiles").select("is_admin, is_head, timed_out").eq("id", caller.user.id).single();
  if (!prof?.is_admin || prof.timed_out) return json({ error: "Admins only." }, 403);

  const body = await req.json();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "user");
  const mc_username = String(body.mc_username || "").trim();
  const discord_username = String(body.discord_username || "").trim();

  if (!["user", "mod", "admin", "business"].includes(role)) return json({ error: "Bad account type." }, 400);
  if (role !== "user" && !prof.is_head) {
    return json({
      error: role === "business"
        ? "Only the head admin can create business accounts."
        : "Only the head admin can create mods or admins.",
    }, 403);
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return json({ error: "Login username: 3-20 letters, numbers or _." }, 400);
  if (!password || password.length < 8 || password.length > 72) return json({ error: "Password needs 8-72 characters." }, 400);

  const business = role === "business";
  let place_city: string | null = null;
  let place_nation: string | null = null;
  if (business) {
    const cityRaw = String(body.place_city ?? "").trim();
    const nationRaw = String(body.place_nation ?? "").trim();
    if (cityRaw.length > 60 || nationRaw.length > 60) return json({ error: "City and nation can be at most 60 characters." }, 400);
    place_city = cleanPlace(cityRaw);
    place_nation = cleanPlace(nationRaw);
    if (!place_city && !place_nation) return json({ error: "Need a city, a nation, or both." }, 400);
  } else if (!mc_username || mc_username.length > 32) {
    return json({ error: "Need a Minecraft name (max 32 characters)." }, 400);
  }
  if (!business && discord_username.length > 40) return json({ error: "Discord username is too long (max 40)." }, 400);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: username + "@civmc.local", password, email_confirm: true,
  });
  if (error) return json({ error: error.message }, 400);

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    mc_username: business ? null : mc_username,
    discord_username: business ? null : (discord_username.slice(0, 40) || null),
    is_mod: role === "mod",
    is_admin: role === "admin",
    is_business: business,
    place_city,
    place_nation,
    verified_at: new Date().toISOString(),
    must_change_password: !business,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back
    return json({ error: pErr.message }, 400);
  }
  return json({ ok: true });
});
