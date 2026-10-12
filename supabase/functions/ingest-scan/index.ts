// Public mod ingest for auto stock updates.
// Match key = trade (want/sell amounts+items+units) + punch coords.
// NL/stock_nl optional. No Citadel/NameLayer required from client.
// AUTO_STOCK_LIVE=true (default). Deploy with verify_jwt disabled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_AGE_MS = 120000, RATE_WINDOW_MS = 600000, RATE_MAX_PLAYER = 40, RATE_MAX_IP = 80, MAX_MATCH_DIST = 48, NEARBY_KNOWN_RADIUS = 50;
type L = { id: number; shop_id: number; want_item: string; want_amount: number; want_unit: string | null; sell_item: string; sell_amount: number; sell_unit: string | null; stock: number | null; in_stock: boolean; timed_out: boolean; enchants: string | null; notes: string | null; x: number | null; z: number | null };
type S = { id: number; x: number | null; z: number | null; stock_nl: string | null; auto_stock_enabled: boolean; listings: L[] | null };
const ni = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const nu = (s: unknown) => { const u = String(s ?? "").trim().toLowerCase(); return u === "ci" || u === "cs" ? u : ""; };
const nt = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const nn = (s: unknown) => String(s ?? "").trim().toLowerCase();
const ek = (s: unknown) => nt(s).split(",").map((t) => t.trim()).filter(Boolean).sort().join("|");
const live = () => { const v = String(Deno.env.get("AUTO_STOCK_LIVE") ?? "true").trim().toLowerCase(); return !(v === "0" || v === "false" || v === "no"); };
function asInt(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return Math.trunc(n);
  if (typeof n === "string" && n.trim() !== "") { const v = Number(n); if (Number.isFinite(v)) return Math.trunc(v); }
  return null;
}
async function hashIp(ip: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip || "unknown"));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
const d2 = (ax: number, az: number, bx: number, bz: number) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
const cheb = (ax: number, az: number, bx: number, bz: number) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));
const coords = (l: L, s: S) => { const x = l.x ?? s.x, z = l.z ?? s.z; return x == null || z == null ? null : { x, z }; };
const trade = (l: L, inItem: string, inAmt: number, inUnit: string, outItem: string, outAmt: number, outUnit: string) =>
  ni(l.want_item) === inItem && Number(l.want_amount) === inAmt && nu(l.want_unit) === inUnit &&
  ni(l.sell_item) === outItem && Number(l.sell_amount) === outAmt && nu(l.sell_unit) === outUnit;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON." }, 400); }
  const player = String(body.player || "").trim();
  const nl = String(body.nl || "").trim();
  const stock = asInt(body.stock), blockX = asInt(body.block_x), blockY = asInt(body.block_y), blockZ = asInt(body.block_z);
  const inAmt = asInt(body.input_amount), inItem = ni(body.input_item), inUnit = nu(body.input_unit);
  const outAmt = asInt(body.output_amount), outItem = ni(body.output_item), outUnit = nu(body.output_unit);
  const scanEnchants = ek(body.enchants), scanNotes = nt(body.notes);
  if (!player || !/^[A-Za-z0-9_]{1,32}$/.test(player)) return json({ error: "Bad player name." }, 400);
  if (stock == null || stock < 0 || blockX == null || blockZ == null) return json({ error: "Need stock/coords." }, 400);
  if (inAmt == null || !(inAmt > 0) || !inItem || outAmt == null || !(outAmt > 0) || !outItem) return json({ updated: false, reason: "bad_trade" });
  if (!body.time) return json({ updated: false, reason: "missing_time" });
  const t = Date.parse(String(body.time));
  if (!Number.isFinite(t)) return json({ updated: false, reason: "bad_time" });
  const age = Date.now() - t;
  if (age > MAX_AGE_MS || age < -30000) return json({ updated: false, reason: age > MAX_AGE_MS ? "scan_too_old" : "scan_from_future" });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashIp(ip);
  const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const [{ count: pc }, { count: ic }] = await Promise.all([
    admin.from("scan_ingest_log").select("id", { count: "exact", head: true }).eq("player", player).gte("created_at", cutoff),
    admin.from("scan_ingest_log").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", cutoff),
  ]);
  if ((pc || 0) >= RATE_MAX_PLAYER || (ic || 0) >= RATE_MAX_IP) return json({ updated: false, reason: "rate_limited" }, 429);
  await admin.from("scan_ingest_log").insert({ player, ip_hash: ipHash });

  const { data: shops, error: sErr } = await admin.from("shops").select(
    "id, x, z, stock_nl, auto_stock_enabled, listings(id, shop_id, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, stock, in_stock, timed_out, enchants, notes, x, z)",
  ).eq("auto_stock_enabled", true).eq("archived", false).eq("timed_out", false).not("x", "is", null).not("z", "is", null);
  if (sErr) return json({ error: sErr.message }, 400);
  const nlKey = nn(nl);
  let shopRows = (shops || []) as S[];
  if (nlKey) { const n = shopRows.filter((s) => nn(s.stock_nl) === nlKey); if (n.length) shopRows = n; }

  type C = { listing: L; shop: S; d2: number; dCheb: number };
  let cands: C[] = [];
  for (const shop of shopRows) {
    for (const l of shop.listings || []) {
      if (l.timed_out || !trade(l, inItem, inAmt, inUnit, outItem, outAmt, outUnit)) continue;
      const c = coords(l, shop); if (!c) continue;
      cands.push({ listing: l, shop, d2: d2(c.x, c.z, blockX, blockZ), dCheb: cheb(c.x, c.z, blockX, blockZ) });
    }
  }
  // Fallback: any nearby known listing with auto_stock (covers no_nl path)
  if (!cands.length) {
    const { data: allShops } = await admin.from("shops").select(
      "id, x, z, stock_nl, auto_stock_enabled, listings(id, shop_id, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, stock, in_stock, timed_out, enchants, notes, x, z)",
    ).eq("archived", false).eq("timed_out", false);
    for (const shop of (allShops || []) as S[]) {
      if (!shop.auto_stock_enabled) continue;
      for (const l of shop.listings || []) {
        if (l.timed_out || !trade(l, inItem, inAmt, inUnit, outItem, outAmt, outUnit)) continue;
        const c = coords(l, shop); if (!c) continue;
        const dCheb = cheb(c.x, c.z, blockX, blockZ);
        if (dCheb > NEARBY_KNOWN_RADIUS) continue;
        cands.push({ listing: l, shop, d2: d2(c.x, c.z, blockX, blockZ), dCheb });
      }
    }
  }
  if (!cands.length) return json({ updated: false, reason: "no_listing_match", unknown: false });
  if (cands.length > 1 && (scanEnchants || scanNotes)) {
    const narrowed = cands.filter(({ listing: l }) => (!scanEnchants || ek(l.enchants) === scanEnchants) && (!scanNotes || nt(l.notes) === scanNotes));
    if (narrowed.length) cands = narrowed;
  }
  cands.sort((a, b) => a.d2 - b.d2 || a.listing.id - b.listing.id);
  const best = cands[0];
  const maxD2 = MAX_MATCH_DIST * MAX_MATCH_DIST;
  if (!(best.dCheb <= NEARBY_KNOWN_RADIUS || (Number.isFinite(best.d2) && best.d2 <= maxD2))) {
    return json({ updated: false, reason: "too_far" });
  }
  if (cands.length > 1 && cands[1].d2 === best.d2) {
    return json({ updated: false, reason: "ambiguous_match", candidates: cands.filter((c) => c.d2 === best.d2).map((c) => c.listing.id) });
  }
  const listingId = best.listing.id, in_stock = stock > 0, isLive = live();
  if (best.listing.stock === stock && !!best.listing.in_stock === in_stock) {
    return json({ updated: false, reason: "same_stock", listing_id: listingId, shop_id: best.shop.id, stock, in_stock, dry_run: !isLive, match: nlKey ? "nl_trade_coords" : "trade_coords" });
  }
  if (!isLive) {
    return json({ updated: false, dry_run: true, would_update: true, listing_id: listingId, shop_id: best.shop.id, stock, in_stock, distance: Math.sqrt(best.d2), match: "trade_coords" });
  }
  const { error: uErr } = await admin.from("listings").update({ stock, in_stock, updated_at: new Date().toISOString() }).eq("id", listingId);
  if (uErr) return json({ error: uErr.message }, 400);
  return json({ updated: true, dry_run: false, listing_id: listingId, shop_id: best.shop.id, stock, in_stock, distance: Math.sqrt(best.d2), match: nlKey ? "nl_trade_coords" : "trade_coords" });
});
