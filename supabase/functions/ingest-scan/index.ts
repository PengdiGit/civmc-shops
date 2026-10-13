// Public mod ingest for auto stock updates + unknown listings.
// Crowd-sourced: any client with the anon key may POST a scan.
// Real updates: shops with auto_stock_enabled + stock_nl + coords.
// Unknowns: when no real listing matches, upsert short-lived discoveries.
// Coords in the scan body are PLAYER feet position (block_x/y/z), not chest BlockPos.
// Known stock match: trade + within KNOWN_MATCH_DIST (5) of player.
// Unknown dedupe: nearest unknown within UNKNOWN_DEDUPE_DIST (25); UPDATE else INSERT.
// AUTO_STOCK_LIVE=true (default): writes. Set AUTO_STOCK_LIVE=false for dry-run.
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
const RATE_MAX_PLAYER = 40;
const RATE_MAX_IP = 80;
/** Known listing stock match: Euclidean XZ within this many blocks of player. */
const KNOWN_MATCH_DIST = 5;
/** Skip creating an unknown when a public known listing (same trade) is this close (Chebyshev XZ; 15 ⇒ ~31×31). */
const NEARBY_KNOWN_RADIUS = 15;
/** Unknown replace/merge: nearest row within this Euclidean XZ radius. */
const UNKNOWN_DEDUPE_DIST = 25;
const LOG_PRUNE_HOURS = 24;
const UNKNOWN_PRUNE_DAYS = 7;

type ScanBody = {
  time?: string;
  player?: string;
  block_x?: number;
  block_y?: number;
  block_z?: number;
  /** Aliases accepted from older / alternate payloads. */
  x?: number;
  y?: number;
  z?: number;
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

type UnknownRow = {
  id: number;
  want_item: string;
  want_amount: number;
  want_unit: string | null;
  sell_item: string;
  sell_amount: number;
  sell_unit: string | null;
  stock: number | null;
  in_stock: boolean;
  enchants: string | null;
  notes: string | null;
  x: number;
  y: number | null;
  z: number;
  nl: string | null;
  fingerprint: string;
};

type Admin = ReturnType<typeof createClient>;

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

function unknownsEnabled(): boolean {
  const v = String(Deno.env.get("UNKNOWN_LISTINGS_LIVE") ?? "true").trim().toLowerCase();
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

/** Prefer block_*; fall back to x/y/z aliases. */
function scanCoord(body: ScanBody, blockKey: "block_x" | "block_y" | "block_z", alias: "x" | "y" | "z"): number | null {
  const primary = asInt(body[blockKey]);
  if (primary != null) return primary;
  return asInt(body[alias]);
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

/** Chebyshev distance on XZ (square radius). */
function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

/**
 * If a public known listing already has the same trade within NEARBY_KNOWN_RADIUS
 * (Chebyshev blocks on XZ, 30×30-style area) of the scan player coords, skip creating an unknown listing.
 * Does not require auto_stock_enabled - any live site listing counts.
 */
async function findNearbyKnownListing(
  admin: Admin,
  inItem: string,
  inAmt: number,
  inUnit: string,
  outItem: string,
  outAmt: number,
  outUnit: string,
  playerX: number,
  playerZ: number,
): Promise<{ listing_id: number; shop_id: number } | null> {
  const { data: shops, error } = await admin
    .from("shops")
    .select(
      "id, x, z, stock_nl, auto_stock_enabled, listings(id, shop_id, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, stock, in_stock, timed_out, enchants, notes, bundle_contents, x, z)",
    )
    .eq("archived", false)
    .eq("timed_out", false);

  if (error || !shops?.length) return null;

  let best: { listing_id: number; shop_id: number; d: number } | null = null;
  for (const shop of shops as ShopRow[]) {
    for (const l of shop.listings || []) {
      if (l.timed_out) continue;
      if (
        !tradeMatch(
          l.want_item,
          l.want_amount,
          l.want_unit,
          l.sell_item,
          l.sell_amount,
          l.sell_unit,
          inItem,
          inAmt,
          inUnit,
          outItem,
          outAmt,
          outUnit,
        )
      ) {
        continue;
      }
      const c = listingCoords(l, shop);
      if (!c) continue;
      const d = chebyshev(c.x, c.z, playerX, playerZ);
      if (d > NEARBY_KNOWN_RADIUS) continue;
      if (!best || d < best.d || (d === best.d && l.id < best.listing_id)) {
        best = { listing_id: l.id, shop_id: shop.id, d };
      }
    }
  }
  return best ? { listing_id: best.listing_id, shop_id: best.shop_id } : null;
}

function makeFingerprint(
  nl: string,
  inAmt: number,
  inItem: string,
  inUnit: string,
  outAmt: number,
  outItem: string,
  outUnit: string,
  x: number,
  z: number,
  ench: string,
): string {
  return [
    normNl(nl),
    inItem,
    String(inAmt),
    inUnit,
    outItem,
    String(outAmt),
    outUnit,
    String(x),
    String(z),
    ench || "",
  ].join("|");
}

function tradeMatch(
  wantItem: string,
  wantAmount: number,
  wantUnit: string | null,
  sellItem: string,
  sellAmount: number,
  sellUnit: string | null,
  inItem: string,
  inAmt: number,
  inUnit: string,
  outItem: string,
  outAmt: number,
  outUnit: string,
): boolean {
  return normItem(wantItem) === inItem &&
    Number(wantAmount) === inAmt &&
    normUnit(wantUnit) === inUnit &&
    normItem(sellItem) === outItem &&
    Number(sellAmount) === outAmt &&
    normUnit(sellUnit) === outUnit;
}

async function pruneUnknowns(admin: Admin) {
  const before = new Date(Date.now() - UNKNOWN_PRUNE_DAYS * 86400_000).toISOString();
  await admin.from("unknown_listings").delete().lt("updated_at", before);
}

async function deleteMatchingUnknowns(
  admin: Admin,
  nl: string,
  inAmt: number,
  inItem: string,
  inUnit: string,
  outAmt: number,
  outItem: string,
  outUnit: string,
  nearX: number,
  nearZ: number,
  scanEnchants: string,
  scanNotes: string,
) {
  const { data: rows } = await admin
    .from("unknown_listings")
    .select("id, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, enchants, notes, x, z, nl")
    .eq("sell_item", outItem)
    .eq("want_item", inItem);

  const nlKey = normNl(nl);
  const maxD2 = KNOWN_MATCH_DIST * KNOWN_MATCH_DIST;
  const ids: number[] = [];
  for (const u of (rows || []) as UnknownRow[]) {
    if (nlKey && normNl(u.nl) !== nlKey) continue;
    if (!tradeMatch(u.want_item, u.want_amount, u.want_unit, u.sell_item, u.sell_amount, u.sell_unit, inItem, inAmt, inUnit, outItem, outAmt, outUnit)) {
      continue;
    }
    if (scanEnchants && enchantKey(u.enchants) !== scanEnchants) continue;
    if (scanNotes && normText(u.notes) !== scanNotes) continue;
    if (dist2(u.x, u.z, nearX, nearZ) > maxD2) continue;
    ids.push(u.id);
  }
  if (ids.length) await admin.from("unknown_listings").delete().in("id", ids);
}

async function handleUnknown(
  admin: Admin,
  opts: {
    player: string;
    nl: string;
    stock: number;
    blockX: number;
    blockY: number | null;
    blockZ: number;
    inAmt: number;
    inItem: string;
    inUnit: string;
    outAmt: number;
    outItem: string;
    outUnit: string;
    scanEnchants: string;
    scanNotes: string;
    enchantsRaw: string | null;
    notesRaw: string | null;
    missReason: string;
  },
) {
  if (!unknownsEnabled() || !liveMode()) {
    return json({
      updated: false,
      reason: opts.missReason,
      dry_run: !liveMode(),
      unknown: false,
    });
  }

  // Gate: same trade already listed nearby on the site → do not create/update unknown.
  const nearbyKnown = await findNearbyKnownListing(
    admin,
    opts.inItem,
    opts.inAmt,
    opts.inUnit,
    opts.outItem,
    opts.outAmt,
    opts.outUnit,
    opts.blockX,
    opts.blockZ,
  );
  if (nearbyKnown) {
    return json({
      updated: false,
      unknown: false,
      reason: "nearby_known_listing",
      listing_id: nearbyKnown.listing_id,
      shop_id: nearbyKnown.shop_id,
      prior_miss: opts.missReason,
    });
  }

  void pruneUnknowns(admin);

  const in_stock = opts.stock > 0;
  const now = new Date().toISOString();
  const fp = makeFingerprint(
    opts.nl,
    opts.inAmt,
    opts.inItem,
    opts.inUnit,
    opts.outAmt,
    opts.outItem,
    opts.outUnit,
    opts.blockX,
    opts.blockZ,
    opts.scanEnchants,
  );

  // Radius dedupe: nearest unknown within UNKNOWN_DEDUPE_DIST of player coords → UPDATE.
  // Replaces the old exact-xyz unique approach (player coords are approximate).
  const { data: nearRows, error: nearErr } = await admin
    .from("unknown_listings")
    .select("id, stock, in_stock, x, y, z, want_item, want_amount, want_unit, sell_item, sell_amount, sell_unit, enchants, notes, nl, fingerprint");

  if (nearErr) return json({ error: nearErr.message }, 400);

  const maxD2 = UNKNOWN_DEDUPE_DIST * UNKNOWN_DEDUPE_DIST;
  type NearCand = { row: UnknownRow; d2: number };
  const nearCands: NearCand[] = [];
  for (const u of (nearRows || []) as UnknownRow[]) {
    const d2 = dist2(u.x, u.z, opts.blockX, opts.blockZ);
    if (d2 > maxD2) continue;
    nearCands.push({ row: u, d2 });
  }
  nearCands.sort((a, b) => a.d2 - b.d2 || a.row.id - b.row.id);

  if (nearCands.length) {
    const best = nearCands[0].row;
    const sameStock = best.stock === opts.stock && !!best.in_stock === in_stock;
    const sameTrade = tradeMatch(
      best.want_item,
      best.want_amount,
      best.want_unit,
      best.sell_item,
      best.sell_amount,
      best.sell_unit,
      opts.inItem,
      opts.inAmt,
      opts.inUnit,
      opts.outItem,
      opts.outAmt,
      opts.outUnit,
    );
    if (sameStock && sameTrade && best.x === opts.blockX && best.z === opts.blockZ &&
      (opts.blockY == null ? best.y == null : best.y === opts.blockY)) {
      return json({
        updated: false,
        reason: "same_stock_unknown",
        unknown: true,
        unknown_id: best.id,
        stock: opts.stock,
        in_stock,
        distance: Math.sqrt(nearCands[0].d2),
      });
    }
    const { error: uErr } = await admin.from("unknown_listings").update({
      want_item: opts.inItem,
      want_amount: opts.inAmt,
      want_unit: opts.inUnit || null,
      sell_item: opts.outItem,
      sell_amount: opts.outAmt,
      sell_unit: opts.outUnit || null,
      stock: opts.stock,
      in_stock,
      x: opts.blockX,
      y: opts.blockY,
      z: opts.blockZ,
      enchants: opts.enchantsRaw,
      notes: opts.notesRaw,
      nl: opts.nl || null,
      last_player: opts.player,
      fingerprint: fp,
      updated_at: now,
    }).eq("id", best.id);
    if (uErr) return json({ error: uErr.message }, 400);
    return json({
      updated: true,
      unknown: true,
      unknown_id: best.id,
      reason: "unknown_replaced_nearby",
      stock: opts.stock,
      in_stock,
      distance: Math.sqrt(nearCands[0].d2),
      prior_miss: opts.missReason,
    });
  }

  const insertRow = {
    want_item: opts.inItem,
    want_amount: opts.inAmt,
    want_unit: opts.inUnit || null,
    sell_item: opts.outItem,
    sell_amount: opts.outAmt,
    sell_unit: opts.outUnit || null,
    stock: opts.stock,
    in_stock,
    enchants: opts.enchantsRaw,
    notes: opts.notesRaw,
    x: opts.blockX,
    y: opts.blockY,
    z: opts.blockZ,
    nl: opts.nl || null,
    last_player: opts.player,
    fingerprint: fp,
    updated_at: now,
    created_at: now,
  };

  const { data: created, error: cErr } = await admin
    .from("unknown_listings")
    .upsert(insertRow, { onConflict: "fingerprint" })
    .select("id")
    .single();

  if (cErr) return json({ error: cErr.message }, 400);

  return json({
    updated: true,
    unknown: true,
    unknown_id: created?.id,
    reason: "unknown_created",
    stock: opts.stock,
    in_stock,
    prior_miss: opts.missReason,
  });
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
  // NL optional: missing → skip real shop match, unknown listing only.
  const nl = String(body.nl || "").trim();
  const stock = asInt(body.stock);
  const blockX = scanCoord(body, "block_x", "x");
  const blockY = scanCoord(body, "block_y", "y");
  const blockZ = scanCoord(body, "block_z", "z");
  const inAmt = asInt(body.input_amount);
  const inItem = normItem(body.input_item);
  const inUnit = normUnit(body.input_unit);
  const outAmt = asInt(body.output_amount);
  const outItem = normItem(body.output_item);
  const outUnit = normUnit(body.output_unit);
  const scanEnchants = enchantKey(body.enchants);
  const scanNotes = normText(body.notes);
  const enchantsRaw = body.enchants != null && String(body.enchants).trim()
    ? String(body.enchants).trim()
    : null;
  const notesRaw = body.notes != null && String(body.notes).trim()
    ? String(body.notes).trim().slice(0, 400)
    : null;

  if (!player || player.length > 32) return json({ error: "Need player name." }, 400);
  if (!/^[A-Za-z0-9_]{1,32}$/.test(player)) return json({ error: "Bad player name." }, 400);
  if (nl.length > 64) return json({ error: "nl too long." }, 400);
  if (stock == null || stock < 0 || stock > 1_000_000) {
    return json({ error: "Need stock >= 0." }, 400);
  }
  if (blockX == null || blockZ == null) {
    return json({ error: "Need block_x and block_z (player coords)." }, 400);
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
  const pruneBefore = new Date(Date.now() - LOG_PRUNE_HOURS * 3600_000).toISOString();
  void admin.from("scan_ingest_log").delete().lt("created_at", pruneBefore);

  const unknownOpts = {
    player,
    nl,
    stock,
    blockX,
    blockY,
    blockZ,
    inAmt,
    inItem,
    inUnit,
    outAmt,
    outItem,
    outUnit,
    scanEnchants,
    scanNotes,
    enchantsRaw,
    notesRaw,
    missReason: "no_shops_for_nl",
  };

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
  if (!nlKey) {
    return handleUnknown(admin, { ...unknownOpts, missReason: "no_nl" });
  }
  const shopRows = ((shops || []) as ShopRow[]).filter((s) => normNl(s.stock_nl) === nlKey);

  if (!shopRows.length) {
    return handleUnknown(admin, { ...unknownOpts, missReason: "no_shops_for_nl" });
  }

  type Cand = { listing: ListingRow; shop: ShopRow; d2: number };
  let cands: Cand[] = [];
  for (const shop of shopRows) {
    for (const l of shop.listings || []) {
      if (l.timed_out) continue;
      if (!tradeMatch(l.want_item, l.want_amount, l.want_unit, l.sell_item, l.sell_amount, l.sell_unit, inItem, inAmt, inUnit, outItem, outAmt, outUnit)) {
        continue;
      }
      const c = listingCoords(l, shop);
      const d2 = c ? dist2(c.x, c.z, blockX, blockZ) : Number.POSITIVE_INFINITY;
      cands.push({ listing: l, shop, d2 });
    }
  }

  if (!cands.length) {
    return handleUnknown(admin, { ...unknownOpts, missReason: "no_listing_match" });
  }

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
  const maxD2 = KNOWN_MATCH_DIST * KNOWN_MATCH_DIST;
  if (!Number.isFinite(best.d2) || best.d2 > maxD2) {
    return handleUnknown(admin, { ...unknownOpts, missReason: "too_far" });
  }

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
  const near = listingCoords(best.listing, best.shop) || { x: blockX, z: blockZ };

  if (best.listing.stock === nextStock && !!best.listing.in_stock === in_stock) {
    if (isLive && unknownsEnabled()) {
      await deleteMatchingUnknowns(
        admin, nl, inAmt, inItem, inUnit, outAmt, outItem, outUnit,
        near.x, near.z, scanEnchants, scanNotes,
      );
    }
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

  if (unknownsEnabled()) {
    await deleteMatchingUnknowns(
      admin, nl, inAmt, inItem, inUnit, outAmt, outItem, outUnit,
      near.x, near.z, scanEnchants, scanNotes,
    );
  }

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
