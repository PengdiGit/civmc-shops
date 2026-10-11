// Public mod ingest for auto stock updates.
// Crowd-sourced: any client with the anon key may POST a scan.
// Only shops with auto_stock_enabled + stock_nl + coords are considered.
// AUTO_STOCK_LIVE=true (default): writes stock. Set AUTO_STOCK_LIVE=false for dry-run.
// Deploy: supabase functions deploy ingest-scan --no-verify-jwt
// Shop opt-in (auto_stock_enabled / stock_nl) is head-admin-only via DB trigger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const MAX_AGE_MS = 2 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
/** Soft cap per Minecraft player name (spoofable — IP cap is the real brake). */
const RATE_MAX_PLAYER = 40;
/** Harder cap per client IP hash. */
const RATE_MAX_IP = 80;
/** Reject closest listing if farther than this (blocks). Prevents cross-shop bleed. */
const MAX_MATCH_DIST = 48;
const LOG_PRUNE_HOURS = 24;

type ScanBody = {
  time?: string;
  player?: string;
  block_x?: number;
  block_y?: number;
  block_z?: number;
  input_amount?: number;
  input_item?: string;
  input_unit?: string | null;
  output_amount?: number;
  output_item?: string;
  output_unit?: string | null;
  stock?: number;
  nl?: string;
  enchants?: string | null;
  notes?: string | null;
};

type ShopRow = {
  id: number;
  x: number | null;
  z: number | null;
  stock_nl: string | null;
  auto_stock_enabled: boolean;
  listings: ListingRow[] | null;
};

type ListingRow = {
  id: number;
  shop_id: number;
  want_item: string;
  want_amount: number;
  want_unit: string | null;
  sell_item: string;
  sell_amount: number;
  sell_unit: string | null;
  stock: number | null;
  in_stock: boolean;
  timed_out: boolean;
  enchants: string | null;
  notes: string | null;
  bundle_contents: unknown;
  x: number | null;
  z: number | null;
};

function normItem(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normUnit(s: unknown): string {
  const u = String(s ?? "").trim().toLowerCase();
  return u === "ci" || u === "cs" ? u : "";
}

function normText(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normNl(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function enchantKey(s: unknown): string {
  return normText(s)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

function liveMode(): boolean {
  const v = String(Deno.env.get("AUTO_STOCK_LIVE") ?? "true").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

function asInt(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return Math.trunc(n);
  if (typeof n === "string" && n.trim() !== "") {
    const v = Number(n);
    if (Number.isFinite(v)) return Math.trunc(v);
  }
  return null;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip || "unknown");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function listingCoords(l: ListingRow, shop: ShopRow): { x: number; z: number } | null {
  const x = l.x != null ? l.x : shop.x;
  const z = l.z != null ? l.z : shop.z;
  if (x == null || z == null) return null;
  return { x, z };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: ScanBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad JSON." }, 400);
  }

  const player = String(body.player || "").trim();
  const nl = String(body.nl || "").trim();
  const stock = asInt(body.stock);
  const blockX = asInt(body.block_x);
  const blockZ = asInt(body.block_z);
  const inAmt = asInt(body.input_amount);
  const inItem = normItem(body.input_item);
  const inUnit = normUnit(body.input_unit);
  const outAmt = asInt(body.output_amount);
  const outItem = normItem(body.output_item);
  const outUnit = normUnit(body.output_unit);
  const scanEnchants = enchantKey(body.enchants);
  const scanNotes = normText(body.notes);

  if (!player || player.length > 32) return json({ error: "Need player name." }, 400);
  if (!/^[A-Za-z0-9_]{1,32}$/.test(player)) return json({ error: "Bad player name." }, 400);
  if (!nl || nl.length > 64) return json({ error: "Need nl." }, 400);
  if (stock == null || stock < 0 || stock > 1_000_000) {
    return json({ error: "Need stock >= 0." }, 400);
  }
  if (blockX == null || blockZ == null) {
    return json({ error: "Need block_x and block_z." }, 400);
  }
  if (inAmt == null || !(inAmt > 0) || !inItem) return json({ error: "Need input item/amount." }, 400);
  if (outAmt == null || !(outAmt > 0) || !outItem) {
    return json({ updated: false, reason: "donation_or_no_output" });
  }

  if (!body.time) return json({ updated: false, reason: "missing_time" });
  const t = Date.parse(String(body.time));
  if (!Number.isFinite(t)) return json({ updated: false, reason: "bad_time" });
  const age = Date.now() - t;
  if (age > MAX_AGE_MS) return json({ updated: false, reason: "scan_too_old" });
  if (age < -30_000) return json({ updated: false, reason: "scan_from_future" });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashIp(ip);
  const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const [{ count: playerCount }, { count: ipCount }] = await Promise.all([
    admin.from("scan_ingest_log").select("id", { count: "exact", head: true })
      .eq("player", player).gte("created_at", cutoff),
    admin.from("scan_ingest_log").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", cutoff),
  ]);
  if ((playerCount || 0) >= RATE_MAX_PLAYER || (ipCount || 0) >= RATE_MAX_IP) {
    return json({ updated: false, reason: "rate_limited" }, 429);
  }
  await admin.from("scan_ingest_log").insert({ player, ip_hash: ipHash });
  // Best-effort prune so the log cannot grow forever.
  const pruneBefore = new Date(Date.now() - LOG_PRUNE_HOURS * 3600_000).toISOString();
  void admin.from("scan_ingest_log").delete().lt("created_at", pruneBefore);

  // Do NOT use PostgREST ilike(nl): `_` and `%` are LIKE wildcards (Civ NL often ends in `_`).
  // Load opted-in shops and match NL exactly (case-insensitive) in JS.
  const { data: shops, error: sErr } = await admin
    .from("shops")
    .select(
      "id, x, z, stock_nl, auto_stock_enabled, listings(id, shop_id, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, stock, in_stock, timed_out, enchants, notes, bundle_contents, x, z)",
    )
    .eq("auto_stock_enabled", true)
    .eq("archived", false)
    .eq("timed_out", false)
    .not("x", "is", null)
    .not("z", "is", null)
    .not("stock_nl", "is", null);

  if (sErr) return json({ error: sErr.message }, 400);
  const nlKey = normNl(nl);
  const shopRows = ((shops || []) as ShopRow[]).filter((s) => normNl(s.stock_nl) === nlKey);
  if (!shopRows.length) return json({ updated: false, reason: "no_shops_for_nl", dry_run: !liveMode() });

  type Cand = { listing: ListingRow; shop: ShopRow; d2: number };
  let cands: Cand[] = [];
  for (const shop of shopRows) {
    for (const l of shop.listings || []) {
      if (l.timed_out) continue;
      if (normItem(l.want_item) !== inItem) continue;
      if (Number(l.want_amount) !== inAmt) continue;
      if (normUnit(l.want_unit) !== inUnit) continue;
      if (normItem(l.sell_item) !== outItem) continue;
      if (Number(l.sell_amount) !== outAmt) continue;
      if (normUnit(l.sell_unit) !== outUnit) continue;
      const c = listingCoords(l, shop);
      const d2 = c ? dist2(c.x, c.z, blockX, blockZ) : Number.POSITIVE_INFINITY;
      cands.push({ listing: l, shop, d2 });
    }
  }

  if (!cands.length) return json({ updated: false, reason: "no_listing_match", dry_run: !liveMode() });

  if (cands.length > 1 && (scanEnchants || scanNotes)) {
    const narrowed = cands.filter(({ listing: l }) => {
      const eOk = !scanEnchants || enchantKey(l.enchants) === scanEnchants;
      const nOk = !scanNotes || normText(l.notes) === scanNotes;
      return eOk && nOk;
    });
    if (narrowed.length > 0) cands = narrowed;
  }

  cands.sort((a, b) => a.d2 - b.d2 || a.listing.id - b.listing.id);

  const best = cands[0];
  const maxD2 = MAX_MATCH_DIST * MAX_MATCH_DIST;
  if (!Number.isFinite(best.d2) || best.d2 > maxD2) {
    return json({
      updated: false,
      reason: "too_far",
      distance: Number.isFinite(best.d2) ? Math.sqrt(best.d2) : null,
      max_distance: MAX_MATCH_DIST,
      dry_run: !liveMode(),
    });
  }

  // Same distance to two listings → refuse rather than guess (prevents mixed stock).
  if (cands.length > 1 && cands[1].d2 === best.d2) {
    return json({
      updated: false,
      reason: "ambiguous_match",
      candidates: cands.filter((c) => c.d2 === best.d2).map((c) => c.listing.id),
      dry_run: !liveMode(),
    });
  }

  const listingId = best.listing.id;
  const nextStock = stock;
  const in_stock = nextStock > 0;
  const isLive = liveMode();

  if (best.listing.stock === nextStock && !!best.listing.in_stock === in_stock) {
    return json({
      updated: false,
      reason: "same_stock",
      listing_id: listingId,
      shop_id: best.shop.id,
      stock: nextStock,
      in_stock,
      dry_run: !isLive,
    });
  }

  if (!isLive) {
    return json({
      updated: false,
      dry_run: true,
      would_update: true,
      listing_id: listingId,
      shop_id: best.shop.id,
      stock: nextStock,
      in_stock,
      candidates: cands.length,
      distance: Math.sqrt(best.d2),
    });
  }

  const { error: uErr } = await admin
    .from("listings")
    .update({
      stock: nextStock,
      in_stock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId);

  if (uErr) return json({ error: uErr.message }, 400);

  return json({
    updated: true,
    dry_run: false,
    listing_id: listingId,
    shop_id: best.shop.id,
    stock: nextStock,
    in_stock,
    distance: Math.sqrt(best.d2),
  });
});
