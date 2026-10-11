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
const RATE_MAX = 30;

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
  const stock = body.stock;
  const blockX = body.block_x;
  const blockZ = body.block_z;
  const inAmt = body.input_amount;
  const inItem = normItem(body.input_item);
  const inUnit = normUnit(body.input_unit);
  const outAmt = body.output_amount;
  const outItem = normItem(body.output_item);
  const outUnit = normUnit(body.output_unit);
  const scanEnchants = enchantKey(body.enchants);
  const scanNotes = normText(body.notes);

  if (!player || player.length > 32) return json({ error: "Need player name." }, 400);
  if (!nl || nl.length > 64) return json({ error: "Need nl." }, 400);
  if (stock == null || !Number.isFinite(stock) || stock < 0 || stock > 1_000_000) {
    return json({ error: "Need stock >= 0." }, 400);
  }
  if (blockX == null || blockZ == null || !Number.isFinite(blockX) || !Number.isFinite(blockZ)) {
    return json({ error: "Need block_x and block_z." }, 400);
  }
  if (!(inAmt! > 0) || !inItem) return json({ error: "Need input item/amount." }, 400);
  if (!(outAmt! > 0) || !outItem) return json({ updated: false, reason: "donation_or_no_output" });

  if (body.time) {
    const t = Date.parse(String(body.time));
    if (Number.isFinite(t) && Date.now() - t > MAX_AGE_MS) {
      return json({ updated: false, reason: "scan_too_old" });
    }
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashIp(ip);
  const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("scan_ingest_log")
    .select("id", { count: "exact", head: true })
    .eq("player", player)
    .gte("created_at", cutoff);
  if ((count || 0) >= RATE_MAX) {
    return json({ updated: false, reason: "rate_limited" }, 429);
  }
  await admin.from("scan_ingest_log").insert({ player, ip_hash: ipHash });

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
    .not("stock_nl", "is", null)
    .ilike("stock_nl", nl);

  if (sErr) return json({ error: sErr.message }, 400);
  const shopRows = (shops || []) as ShopRow[];
  if (!shopRows.length) return json({ updated: false, reason: "no_shops_for_nl", dry_run: !liveMode() });

  type Cand = { listing: ListingRow; shop: ShopRow };
  let cands: Cand[] = [];
  for (const shop of shopRows) {
    for (const l of shop.listings || []) {
      if (l.timed_out) continue;
      if (normItem(l.want_item) !== inItem) continue;
      if (l.want_amount !== inAmt) continue;
      if (normUnit(l.want_unit) !== inUnit) continue;
      if (normItem(l.sell_item) !== outItem) continue;
      if (l.sell_amount !== outAmt) continue;
      if (normUnit(l.sell_unit) !== outUnit) continue;
      cands.push({ listing: l, shop });
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

  if (cands.length > 1) {
    cands.sort((a, b) => {
      const ca = listingCoords(a.listing, a.shop);
      const cb = listingCoords(b.listing, b.shop);
      const da = ca ? dist2(ca.x, ca.z, blockX, blockZ) : Number.POSITIVE_INFINITY;
      const db = cb ? dist2(cb.x, cb.z, blockX, blockZ) : Number.POSITIVE_INFINITY;
      return da - db || a.listing.id - b.listing.id;
    });
  }

  const pick = cands[0];
  const listingId = pick.listing.id;
  const nextStock = Math.floor(Number(stock));
  const in_stock = nextStock > 0;
  const isLive = liveMode();

  if (!isLive) {
    return json({
      updated: false,
      dry_run: true,
      would_update: true,
      listing_id: listingId,
      shop_id: pick.shop.id,
      stock: nextStock,
      in_stock,
      candidates: cands.length,
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
    shop_id: pick.shop.id,
    stock: nextStock,
    in_stock,
  });
});
