// Fake Supabase for testing locally. Data lives in your browser's localStorage.
// Only used when USE_MOCK = true in config.js. It copies the main rules from setup.sql
// (who can see/edit what, verification, timeouts, comments, reports) but the real rules
// are the SQL ones, so still test those on the real thing.
//
// Logins are per TAB (sessionStorage) while the data is shared, so you can have a mod in
// one tab and a normal user in another. If data looks broken after an update, add
// ?resetmock to any page URL once.
function mockClient() {
  const KEY = "civmc_mock_db";
  const SKEY = "civmc_mock_session";
  const DAY = 86400000;
  const sess = sessionStorage;

  if (location.search.includes("resetmock")) {
    localStorage.removeItem(KEY);
    sess.removeItem(SKEY);
    try {
      sess.removeItem("civmc_imp_restore");
      sess.removeItem("civmc_imp_label");
    } catch (e) {}
  }

  const isoDay = t => new Date(t).toISOString().slice(0, 10);

  // percentile like Postgres percentile_cont
  function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  // same maths as market_now() in setup.sql: one price per shop per item, far-off prices dropped
  function marketNow(db) {
    const CUR = { "diamond": 1 }, UM = { "": 1, ci: 64, cs: 4096 };
    const um = u => UM[u || ""] || 1;
    const per = {};
    const push = (item, side, shop, rate) => { (per[item + "|" + side + "|" + shop] = per[item + "|" + side + "|" + shop] || { item, side, rates: [] }).rates.push(rate); };
    for (const l of db.listings) {
      const s = db.shops.find(x => x.id === l.shop_id);
      const p = s && db.profiles.find(x => x.id === s.owner_id);
      const out = (row) => row && row.timed_out && (!row.timed_out_until || new Date(row.timed_out_until).getTime() > Date.now());
      if (!(l.in_stock && !out(l) && s && !out(s) && !s.archived && s.is_open !== false && p && !out(p))) continue;
      if (CUR[l.want_item] != null && CUR[l.sell_item] == null)
        push(l.sell_item, "sell", l.shop_id, l.want_amount * um(l.want_unit) * CUR[l.want_item] / (l.sell_amount * um(l.sell_unit)));
      if (CUR[l.sell_item] != null && CUR[l.want_item] == null)
        push(l.want_item, "buy", l.shop_id, l.sell_amount * um(l.sell_unit) * CUR[l.sell_item] / (l.want_amount * um(l.want_unit)));
    }
    const groups = {};
    Object.values(per).forEach(g => {
      const r = g.rates.slice().sort((a, b) => a - b);
      (groups[g.item + "|" + g.side] = groups[g.item + "|" + g.side] || { item: g.item, side: g.side, v: [] }).v.push(quantile(r, 0.5));
    });
    return Object.values(groups).map(g => {
      const v = g.v.slice().sort((a, b) => a - b);
      const q1 = quantile(v, 0.25), med = quantile(v, 0.5), q3 = quantile(v, 0.75);
      const spread = Math.max(1.5 * (q3 - q1), 0.3 * med);
      const kept = v.filter(x => x >= q1 - spread && x <= q3 + spread);
      return { item: g.item, side: g.side, median: quantile(kept, 0.5), low: kept[0], high: kept[kept.length - 1], n: kept.length, outliers: v.length - kept.length };
    });
  }

  // extra fake people + shops so there's something to browse, review, delete and graph
  function addDecoys(d, ago) {
    let sv = 12345;
    const rnd = () => (sv = (sv * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const NAMES = ["DiamondDave", "IronMike", "CobbleKing", "RedstoneRita", "BakerBen", "FarmerFlo", "CaptainCrate", "GlowGary", "NetherNora", "EnderEmma", "ObsidianOwen", "MinerMax"];
    const ITEMS = [["bread", 20], ["wheat", 6], ["coal", 4], ["blaze rod", 8], ["ender pearl", 40], ["obsidian", 14], ["gold ingot", 30], ["emerald", 12]];
    // CivMC-flavoured places: city + nation pairs cycled across decoys
    const PLACES = [
      { city: "Mount Augusta", nation: "Mount Augusta" },
      { city: "Icenia", nation: "Icenia" },
      { city: "Commonwealth", nation: "Commonwealth" },
      { city: "Lexington", nation: "Commonwealth" },
      { city: "Portland", nation: "Icenia" },
      { city: "Spawn", nation: null },
      { city: "New Jersey", nation: "Mount Augusta" },
      { city: "Alenarith", nation: "Imperial Federation" }
    ];
    const ICONS = ["bread", "chest", "ender pearl", "gold ingot", "obsidian", "emerald", "coal", "diamond"];
    const FANCY = ["&6&l%N&r&e's Shop", "&a%N &2Supplies", null, "&c&l%N &r&7Trading", null, "&b%N &3Market"];
    const DESC = ["&7Trading since day one. &aFair prices&7, fast restocks.", null, "&eBulk deals available. &7Message me on Discord!", null, "&fBest bread on the server."];
    let sid = 100, lid = 100;
    const P = (id, mc, extra) => ({ id, mc_username: mc, discord_username: mc.toLowerCase() + "#" + (1000 + Math.floor(rnd() * 8999)), bio: null, highlight_color: null, avatar_path: null, last_seen_at: ago(rnd() * 5),
      is_admin: false, is_head: false, is_mod: false, timed_out: false, verified_at: ago(30), must_change_password: false, alerts_enabled: true,
      pronouns: null, timezone: null, created_at: ago(40), ...extra });
    const addShop = (owner, name, i, listings) => {
      const place = PLACES[i % PLACES.length];
      const shop = { id: sid++, owner_id: owner, name, city: place.city, nation: place.nation, x: Math.round((rnd() - .5) * 4000), z: Math.round((rnd() - .5) * 4000),
        styled_name: FANCY[i % FANCY.length] ? FANCY[i % FANCY.length].replace("%N", name.replace("'s Shop", "")) : null,
        description: DESC[i % DESC.length],
        hours: ["Restocks Sat/Sun", "Open evenings EST · restocks Fri", "Restocks Mon/Wed/Fri", null, "Weekend restocks · bulk on request", "Restocks daily after 18:00 UTC", null][i % 7],
        find_note: i % 5 === 0 ? "2nd floor, blue wool marker" : (i % 5 === 2 ? "Underground entrance · look for chest sign" : null),
        transit_note: i % 4 === 1 ? "Near north ice road" : (i % 4 === 3 ? "Rail station 40 blocks west" : null),
        icon_item: i % 4 === 3 ? null : ICONS[i % ICONS.length], icon_path: null, timed_out: false, archived: false,
        sale_name: null, sale_percent: null, sale_label: null, sale_starts_at: null, sale_ends_at: null, sale_active: false, sale_admin_id: null,
        created_at: ago(25) };
      d.shops.push(shop);
      listings(shop.id);
      return shop;
    };
    const L = (shop, sell, sa, want, wa, extra) => d.listings.push({ id: lid++, shop_id: shop, sell_item: sell, sell_amount: sa, sell_unit: "", want_item: want, want_amount: wa,
      want_unit: "", stock: rnd() < 0.4 ? Math.floor(1 + rnd() * 40) : null, in_stock: true, sort_order: lid, group_name: null,
      sale_orig_want_amount: null, timed_out: false, updated_at: ago(rnd() * 6),
      stale_acked_at: null, price_alert_acked_at: null, ...extra });

    NAMES.forEach((name, i) => {
      const id = "u-decoy" + (i + 1);
      d.users.push({ id, username: "decoy" + (i + 1), password: "decoy1234", last_sign_in_at: ago(rnd() * 10) });
      d.profiles.push(P(id, name, {
        bio: i % 3 === 0 ? "&7Trading since the early days. &aFair prices&7, fast service." : null
      }));
      addShop(id, name + "'s Shop", i, shop => {
        const picks = ITEMS.slice().sort(() => rnd() - .5).slice(0, 3 + (i % 2));
        picks.forEach(([item, price]) => {
          const per64 = Math.max(1, Math.round(price * (0.88 + rnd() * 0.24)));
          // diamond prices score for market; occasional barter still exists
          L(shop, item, 64, "diamond", per64);
          if (rnd() < 0.25) L(shop, item, 64, "iron ingot", Math.max(8, Math.round(per64 * 8)));
          if (rnd() < 0.4) L(shop, "diamond", Math.max(1, Math.round(price * 0.75 * (0.9 + rnd() * 0.2))), item, 64);   // some also BUY
        });
      });
    });
    // the "one guy selling bread for 100 diamonds" (should NOT move the average)
    d.users.push({ id: "u-scam", username: "scammer", password: "scam1234", last_sign_in_at: ago(2) });
    d.profiles.push(P("u-scam", "OverpriceOllie", {}));
    addShop("u-scam", "Ollie's Overpriced Goods", 2, shop => { L(shop, "bread", 64, "diamond", 100); L(shop, "coal", 64, "diamond", 30); });
    // a few reviews between decoys
    for (let k = 0; k < 8; k++) {
      const shop = 100 + Math.floor(rnd() * 12), author = "u-decoy" + (1 + Math.floor(rnd() * 12));
      const own = d.shops.find(s => s.id === shop);
      if (own && own.owner_id !== author && !d.reviews.some(r => r.shop_id === shop && r.author_id === author))
        d.reviews.push({ id: d.reviews.length + 1, shop_id: shop, author_id: author, rating: 3 + Math.floor(rnd() * 3), body: ["Smooth trade.", "Good prices.", "", "Always in stock.", "A bit slow to reply."][k % 5], traded: rnd() < 0.6, owner_reply: null, owner_reply_at: null, timed_out: false, created_at: ago(rnd() * 20) });
    }
    // people the head admin can practise deleting / timing out
    d.users.push({ id: "u-spam1", username: "spambot1", password: "spam12345", last_sign_in_at: null }, { id: "u-spam2", username: "spambot2", password: "spam12345", last_sign_in_at: null });
    d.profiles.push(P("u-spam1", "FreeDiamondsNow", { verified_at: null, created_at: ago(0.12), discord_username: "freediamonds" }),
                    P("u-spam2", "xX_Trader_Xx", { verified_at: null, created_at: ago(0.4), discord_username: "xxtraderxx" }));
    d.users.push({ id: "u-tim", username: "tim", password: "timtim123", last_sign_in_at: ago(9) });
    d.profiles.push(P("u-tim", "TimedOutTim", { timed_out: true }));
    addShop("u-tim", "Tim's Hidden Shop", 1, shop => { L(shop, "bread", 64, "diamond", 1); });

    // 60 days of price history, ending at today's real prices (today itself gets written when the Market page opens)
    marketNow(d).forEach(m => {
      let v = m.median;
      for (let k = 1; k <= 60; k++) {
        v = v * (1 + (rnd() - .5) * 0.07 - 0.002);   // walking backwards: a little noise + prices rising over time
        const t = Date.now() - k * DAY;
        d.market_history.push({ day: isoDay(t), item: m.item, side: m.side, median: v, low: v * (0.82 + rnd() * .08), high: v * (1.1 + rnd() * .12),
          n: Math.max(1, m.n + Math.round((rnd() - .5) * 3 - k * 0.04)), updated_at: new Date(t).toISOString() });
      }
    });

    // Alias-form city for admin rewrite tool demos
    const aliasShop = d.shops.find(s => s.id === 100);
    if (aliasShop) aliasShop.city = "mt augusta";

    // Tip-jar samples + brigading patterns for mod tools
    let tipId = 1;
    const tip = (uid, lid, vote, daysAgo) => d.tip_votes.push({ id: tipId++, user_id: uid, listing_id: lid, vote, created_at: ago(daysAgo) });
    tip("u-mod", 1, "fair", 2);
    tip("u-admin", 1, "fair", 3);
    tip("u-head", 5, "high", 1);
    // one user spam-voting many listings in the last hour
    d.listings.slice(0, 8).forEach((l, i) => tip("u-decoy1", l.id, "high", 0.02 + i * 0.002));
    // burst on a single listing
    for (let i = 2; i <= 7; i++) tip("u-decoy" + i, 1, "fair", 0.01);

    // Nightly honesty scores (~14 days) for sparklines
    d.shops.forEach(s => {
      let score = 55 + Math.floor(rnd() * 35);
      for (let k = 14; k >= 0; k--) {
        score = Math.max(20, Math.min(100, score + Math.round((rnd() - .45) * 10)));
        const t = Date.now() - k * DAY;
        d.shop_honesty_history.push({ day: isoDay(t), shop_id: s.id, score, updated_at: new Date(t).toISOString() });
      }
    });
  }

  // 30 more fake accounts, 22 more shops and 60 more listings, all for items nobody else sells yet.
  // Has its own random generator, so it doesn't change anything addDecoys() makes.
  function addBots(d, ago) {
    let sv = 777;
    const rnd = () => (sv = (sv * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const NAMES = ["CarrotCarl", "PotatoPete", "MelonMia", "PumpkinPat", "CaneCutterCal", "RedstoneRex", "LapisLena", "QuartzQuinn", "GlowGrace", "GunpowderGus",
      "SlimeSally", "StringSam", "BoneBarry", "LeatherLou", "FeatherFin", "SpiderSid", "LogLiam", "SandySue", "GlassGreg", "WartWendy",
      "TorchTina", "ChestnutChad", "PistonPaul", "HopperHana", "ComparatorCy", "RailRoy", "MinecartMo", "AnvilAnna", "BeaconBo", "CompassCleo"];
    // [item, usual diamonds per 64]. None of these are sold anywhere else in the mock.
    const NEW_ITEMS = [["carrot", 5], ["potato", 5], ["melon slice", 4], ["pumpkin", 6], ["sugar cane", 4], ["redstone", 10], ["lapis lazuli", 12],
      ["quartz", 11], ["glowstone dust", 13], ["gunpowder", 15], ["slime ball", 18], ["string", 6], ["bone", 4], ["leather", 7], ["feather", 3],
      ["spider eye", 6], ["oak log", 3], ["sand", 2], ["glass", 5], ["nether wart", 16]];
    const PLACES = [
      { city: "Mount Augusta", nation: "Mount Augusta" }, { city: "Icenia", nation: "Icenia" }, { city: "Commonwealth", nation: "Commonwealth" },
      { city: "Lexington", nation: "Commonwealth" }, { city: "Portland", nation: "Icenia" }, { city: "Spawn", nation: null },
      { city: "New Jersey", nation: "Mount Augusta" }, { city: "Alenarith", nation: "Imperial Federation" }
    ];
    const FANCY = ["&a&l%N&r&2's %S", null, "&6%N &e%S", null, "&b&l%S &r&3by %N", null, "&d%N&5's %S"];
    const DESC = ["&7Fair prices, restocked often. &aMessage me on Discord!", null, "&eBulk orders welcome.", null, "&fHonest trades only.", null];
    const SUFFIX = ["Shop", "Stand", "Corner", "Depot", "Supply"];
    const BIOS = ["&7Farmer by day, trader by night.", null, "&aReliable &7since the early days.", null, null];
    const title = t => t.replace(/\b\w/g, c => c.toUpperCase());

    // 60 listings: every item gets 3 sellers (3 different shops: consecutive slots are always different shops)
    const slots = [];
    NEW_ITEMS.forEach(([item, price], k) => { for (let j = 0; j < 3; j++) slots.push({ item, price, n: k * 3 + j }); });
    const SHOPS = 22;

    // accounts: all 30 are verified; the last 8 have no shop (handy for testing account deletion)
    NAMES.forEach((name, i) => {
      const id = "u-bot" + (i + 1), num = String(i + 1).padStart(2, "0");
      d.users.push({ id, username: "bot" + num, password: "bot12345", last_sign_in_at: ago(rnd() * 12) });
      d.profiles.push({
        id, mc_username: name, discord_username: name.toLowerCase() + "#" + (1000 + Math.floor(rnd() * 8999)), bio: BIOS[i % BIOS.length], highlight_color: null,
        avatar_path: null, last_seen_at: ago(rnd() * 6), is_admin: false, is_head: false, is_mod: false, timed_out: false, verified_at: ago(20 + i),
        must_change_password: false, pronouns: null, timezone: null, created_at: ago(30 + i)
      });
    });

    // shops
    let sid = 200, lid = 500;
    const newShops = [];
    for (let i = 0; i < SHOPS; i++) {
      const mine = slots.filter(sl => sl.n % SHOPS === i);   // 2 or 3 listings each (16 shops get 3, 6 shops get 2)
      const place = PLACES[(i + 3) % PLACES.length], name = NAMES[i], suffix = SUFFIX[i % SUFFIX.length];
      const shopName = name + "'s " + title(mine[0].item) + " " + suffix;
      const fancy = FANCY[i % FANCY.length];
      const shop = {
        id: sid++, owner_id: "u-bot" + (i + 1), name: shopName, city: place.city, nation: place.nation,
        x: Math.round((rnd() - .5) * 4000), z: Math.round((rnd() - .5) * 4000),
        styled_name: fancy ? fancy.replace("%N", name).replace("%S", title(mine[0].item) + " " + suffix) : null,
        description: DESC[i % DESC.length],
        hours: ["Restocks Sat/Sun", "Open evenings EST · restocks Fri", "Restocks Mon/Wed/Fri", null, "Weekend restocks · bulk on request", "Restocks daily after 18:00 UTC", null][i % 7],
        find_note: i % 5 === 1 ? "Look for the green banner" : (i % 5 === 3 ? "Down the stairs, first chest on the left" : null),
        transit_note: i % 4 === 0 ? "Next to the main rail line" : (i % 4 === 2 ? "Boat dock 30 blocks east" : null),
        icon_item: i % 4 === 3 ? null : mine[0].item, icon_path: null, timed_out: false, archived: false,
        sale_name: null, sale_percent: null, sale_label: null, sale_starts_at: null, sale_ends_at: null, sale_active: false, sale_admin_id: null,
        created_at: ago(20 + rnd() * 10)
      };
      d.shops.push(shop);
      newShops.push(shop);
      mine.forEach(sl => {
        const per64 = Math.max(1, Math.round(sl.price * (0.88 + rnd() * 0.24)));
        // different ways of writing the same kind of price, so units get exercised
        const v = Math.floor(rnd() * 5);
        let sa = 64, su = "", wa = per64;
        if (v === 1) { sa = 32; wa = Math.max(1, Math.round(per64 / 2)); }
        else if (v === 2) { sa = 1; su = "ci"; wa = per64; }
        else if (v === 3 && sl.price <= 6) { sa = 1; su = "cs"; wa = per64 * 64; }
        else if (v === 4) { sa = 16; wa = Math.max(1, Math.round(per64 / 4)); }
        const out = sl.n === 7 || sl.n === 41, stale = sl.n === 13 || sl.n === 50;
        d.listings.push({
          id: lid++, shop_id: shop.id, sell_item: sl.item, sell_amount: sa, sell_unit: su, want_item: "diamond", want_amount: wa, want_unit: "",
          stock: out ? 0 : (rnd() < 0.4 ? Math.floor(1 + rnd() * 40) : null), in_stock: !out,
          sort_order: lid, group_name: null, sale_orig_want_amount: null, timed_out: false,
          updated_at: ago(stale ? 35 + rnd() * 15 : rnd() * 8)
        });
      });
    }

    // 60 days of price history for the new items, ending at today's prices
    const fresh = new Set(NEW_ITEMS.map(x => x[0]));
    marketNow(d).filter(m => fresh.has(m.item)).forEach(m => {
      let v = m.median;
      for (let k = 1; k <= 60; k++) {
        v = v * (1 + (rnd() - .5) * 0.07 - 0.002);
        const t = Date.now() - k * DAY;
        d.market_history.push({ day: isoDay(t), item: m.item, side: m.side, median: v, low: v * (0.82 + rnd() * .08), high: v * (1.1 + rnd() * .12),
          n: Math.max(1, m.n + Math.round((rnd() - .5) * 3 - k * 0.04)), updated_at: new Date(t).toISOString() });
      }
    });
    // honesty history for the new shops (same ~14 day sparkline the other shops have)
    newShops.forEach(s => {
      let score = 55 + Math.floor(rnd() * 35);
      for (let k = 14; k >= 0; k--) {
        score = Math.max(20, Math.min(100, score + Math.round((rnd() - .45) * 10)));
        const t = Date.now() - k * DAY;
        d.shop_honesty_history.push({ day: isoDay(t), shop_id: s.id, score, updated_at: new Date(t).toISOString() });
      }
    });
  }

  function seed() {
    const now = Date.now();
    const ago = d => new Date(now - d * DAY).toISOString();
    const P = (id, mc, extra) => ({
      id, mc_username: mc, discord_username: null, bio: null, highlight_color: null, avatar_path: null, last_seen_at: ago(2), is_admin: false, is_head: false, is_mod: false,
      timed_out: false, verified_at: ago(50), must_change_password: false, alerts_enabled: true, pronouns: null, timezone: null, created_at: ago(60), ...extra
    });
    const L = (id, shop, extra) => ({
      id, shop_id: shop, sell_unit: "", want_unit: "", stock: null, in_stock: true,
      sort_order: id, group_name: null, sale_orig_want_amount: null, timed_out: false, updated_at: ago(2),
      stale_acked_at: null, price_alert_acked_at: null, ...extra
    });
    const shopSale = () => ({
      archived: false, sale_name: null, sale_percent: null, sale_label: null,
      sale_starts_at: null, sale_ends_at: null, sale_active: false, sale_admin_id: null
    });
    const d = {
      users: [
        { id: "u-head", username: "head", password: "head1234", last_sign_in_at: ago(1) },
        { id: "u-admin", username: "admin", password: "admin1234", last_sign_in_at: ago(3) },
        { id: "u-mod", username: "mod", password: "mod12345", last_sign_in_at: ago(2) },
        { id: "u-demo", username: "demo", password: "demo1234", last_sign_in_at: ago(5) },
        { id: "u-new", username: "newbie", password: "newbie123", last_sign_in_at: null }
      ],
      profiles: [
        P("u-head", "HeadAdmin", { is_admin: true, is_head: true, discord_username: "headadmin", created_at: ago(90) }),
        P("u-admin", "AdminGuy", { is_admin: true, discord_username: "adminguy", must_change_password: true }),
        P("u-mod", "ModGal", { is_mod: true, discord_username: "modgal", highlight_color: "#c9953a" }),
        P("u-demo", "DemoTrader", { discord_username: "demotrader", bio: "&7Blaze rods in bulk. &aDM me on Discord&7!", highlight_color: "#7fb35a", pronouns: "he/him", timezone: "EST (UTC−5)" }),
        P("u-new", "NewbieSteve", { discord_username: "newbie_steve", verified_at: null, created_at: ago(0.2) })
      ],
      shops: [
        { id: 1, owner_id: "u-demo", name: "Demo Trading Post", city: "Mount Augusta", nation: "Mount Augusta", x: 100, z: -250, timed_out: false, created_at: ago(60),
          styled_name: "&b&lDemo &r&3Trading Post", description: "&aBlaze rods &7in bulk, restocked every weekend.\n&fFair prices, no haggling!", hours: "Restocks Sat/Sun", find_note: "Corner shop by the fountain", transit_note: "Near Augusta ice highway", icon_item: "diamond", icon_path: null,
          group_icons: { Nether: { icon_item: "netherrack" }, Bulk: { icon_item: "blaze rod" } }, ...shopSale() },
        { id: 2, owner_id: "u-mod", name: "Mod Mart", city: "Icenia", nation: "Icenia", x: -40, z: 30, timed_out: false, created_at: ago(30),
          styled_name: null, description: null, hours: "Restocks weekends", find_note: null, transit_note: null, icon_item: "emerald", icon_path: null, ...shopSale() }
      ],
      listings: [
        L(1, 1, { sell_item: "blaze rod", sell_amount: 8, want_item: "diamond", want_amount: 1, stock: 24, sort_order: 0, group_name: "Nether" }),
        L(2, 1, { sell_item: "ender pearl", sell_amount: 4, want_item: "iron ingot", want_amount: 32, updated_at: ago(45), stock: 3, sort_order: 1, group_name: "Nether" }),
        L(3, 1, { sell_item: "coal", sell_amount: 64, want_item: "gold ingot", want_amount: 4, stock: 0, in_stock: false, updated_at: ago(5), sort_order: 2 }),
        L(4, 1, { sell_item: "blaze rod", sell_amount: 2, sell_unit: "ci", want_item: "diamond", want_amount: 1, stock: null, sort_order: 3, group_name: "Bulk" }),
        L(5, 2, { sell_item: "blaze rod", sell_amount: 8, want_item: "diamond", want_amount: 2, updated_at: ago(1), stock: 10, sort_order: 0 }),
        L(6, 2, { sell_item: "blaze rod", sell_amount: 16, want_item: "iron ingot", want_amount: 9, updated_at: ago(3), stock: 5, sort_order: 1 }),
        L(7, 2, { sell_item: "diamond", sell_amount: 2, sell_unit: "cs", want_item: "emerald", want_amount: 5, stock: 2, sort_order: 2 }),
        L(8, 2, { sell_item: "blaze rod", sell_amount: 8, want_item: "emerald", want_amount: 4, stock: null, sort_order: 3 })
      ],
      comments: [
        { id: 1, shop_id: 1, author_id: "u-mod", parent_id: null, image_path: null, body: "Great prices, fast restocks.", timed_out: false, created_at: ago(2) },
        { id: 2, shop_id: 1, author_id: "u-demo", parent_id: 1, image_path: null, body: "Thanks @ModGal! Restocking blaze rods every weekend.", timed_out: false, created_at: ago(1) }
      ],
      reviews: [
        { id: 1, shop_id: 1, author_id: "u-mod", rating: 5, body: "Always in stock and fair prices.", traded: true, owner_reply: "Thanks! Restocking every weekend.", owner_reply_at: ago(1), timed_out: false, created_at: ago(2) },
        { id: 2, shop_id: 2, author_id: "u-head", rating: 4, body: "", traded: true, owner_reply: null, owner_reply_at: null, timed_out: false, created_at: ago(4) },
        { id: 3, shop_id: 1, author_id: "u-admin", rating: 5, body: "Solid stock.", traded: true, owner_reply: null, owner_reply_at: null, timed_out: false, created_at: ago(5) },
        { id: 4, shop_id: 1, author_id: "u-head", rating: 4, body: "", traded: false, owner_reply: null, owner_reply_at: null, timed_out: false, created_at: ago(8) }
      ],
      favorites: [],
      watches: [],
      follows: [],
      place_follows: [],
      tip_votes: [],
      shop_honesty_history: [],
      admin_sales: [],
      notifications: [],
      files: {},
      market_history: [],
      reports: []
    };
    addDecoys(d, ago);
    addBots(d, ago);
    return d;
  }

  // deleting accounts takes everything they made with them (like the cascades in setup.sql)
  function dropOrphanReplies(db) {
    let n;
    do {
      n = db.comments.length;
      db.comments = db.comments.filter(c => !c.parent_id || db.comments.some(p => p.id === c.parent_id));
    } while (db.comments.length !== n);
  }
  function removeAccounts(db, ids) {
    const shopIds = db.shops.filter(s => ids.includes(s.owner_id)).map(s => s.id);
    db.users = db.users.filter(u => !ids.includes(u.id));
    db.profiles = db.profiles.filter(p => !ids.includes(p.id));
    db.shops = db.shops.filter(s => !ids.includes(s.owner_id));
    db.listings = db.listings.filter(l => !shopIds.some(i => i === l.shop_id));
    db.comments = db.comments.filter(c => !ids.includes(c.author_id) && !shopIds.some(i => i === c.shop_id));
    db.reviews = db.reviews.filter(v => !ids.includes(v.author_id) && !shopIds.some(i => i === v.shop_id));
    db.favorites = db.favorites.filter(f => !ids.includes(f.user_id) && !shopIds.some(i => i === f.shop_id));
    if (db.watches) db.watches = db.watches.filter(w => !ids.includes(w.user_id));
    if (db.follows) db.follows = db.follows.filter(f => !ids.includes(f.follower_id) && !ids.includes(f.following_id));
    if (db.place_follows) db.place_follows = db.place_follows.filter(f => !ids.includes(f.user_id));
    if (db.tip_votes) db.tip_votes = db.tip_votes.filter(v => !ids.includes(v.user_id));
    db.reports = db.reports.filter(r => !ids.includes(r.reporter_id));
    if (db.notifications) db.notifications = db.notifications.filter(n => !ids.includes(n.user_id));
    if (db.admin_sales) db.admin_sales = db.admin_sales.filter(a => !ids.includes(a.created_by));
    dropOrphanReplies(db);
    Object.keys(db.files).forEach(path => { if (ids.includes(path.split("/")[1])) delete db.files[path]; });
  }
  // unverified accounts are deleted 24 hours after signup (never staff)
  function purgeExpired(db) {
    const dead = db.profiles
      .filter(p => !p.verified_at && !p.is_admin && !p.is_mod && !p.is_head && Date.now() - new Date(p.created_at).getTime() > DAY)
      .map(p => p.id);
    if (!dead.length) return false;
    removeAccounts(db, dead);
    return true;
  }

  const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  const load = () => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (!d.reviews || !d.files || !d.market_history || !d.watches || !d.follows || !d.profiles.every(p => "bio" in p)) { localStorage.removeItem(KEY); return load(); }
      if (!d.place_follows) d.place_follows = [];
      if (!d.tip_votes) d.tip_votes = [];
      if (!d.shop_honesty_history) d.shop_honesty_history = [];
      if (!d.admin_sales) d.admin_sales = [];
      if (!d.notifications) d.notifications = [];
      d.listings.forEach(l => {
        if (!("stock" in l)) l.stock = l.in_stock ? null : 0;
        if (!("sort_order" in l)) l.sort_order = l.id || 0;
        if (!("group_name" in l)) l.group_name = null;
        if (!("sale_orig_want_amount" in l)) l.sale_orig_want_amount = null;
        if (!("stale_acked_at" in l)) l.stale_acked_at = null;
        if (!("price_alert_acked_at" in l)) l.price_alert_acked_at = null;
      });
      if (d.reports) d.reports.forEach(r => { if (!("reason_category" in r)) r.reason_category = null; });
      d.shops.forEach(s => {
        if (!("hours" in s)) s.hours = null;
        if (!("nation" in s)) s.nation = null;
        if ("banner_path" in s) delete s.banner_path;
        if (!("find_note" in s)) s.find_note = null;
        if (!("transit_note" in s)) s.transit_note = null;
        if (!("archived" in s)) s.archived = false;
        if (!("is_open" in s)) s.is_open = true;
        if (!("group_icons" in s) || s.group_icons == null || typeof s.group_icons !== "object" || Array.isArray(s.group_icons)) s.group_icons = {};
        if (!("sale_name" in s)) s.sale_name = null;
        if (!("sale_percent" in s)) s.sale_percent = null;
        if (!("sale_label" in s)) s.sale_label = null;
        if (!("sale_starts_at" in s)) s.sale_starts_at = null;
        if (!("sale_ends_at" in s)) s.sale_ends_at = null;
        if (!("sale_active" in s)) s.sale_active = false;
        if (!("sale_admin_id" in s)) s.sale_admin_id = null;
      });
      d.reviews.forEach(r => {
        if (!("traded" in r)) r.traded = false;
        if (!("owner_reply" in r)) r.owner_reply = null;
        if (!("owner_reply_at" in r)) r.owner_reply_at = null;
        if (!("timed_out_until" in r)) r.timed_out_until = null;
      });
      d.profiles.forEach(p => {
        if (!("last_seen_at" in p)) p.last_seen_at = null;
        if (!("highlight_color" in p)) {
          p.highlight_color = p.id === "u-demo" ? "#7fb35a" : p.id === "u-mod" ? "#c9953a" : null;
        }
        if (!("alerts_enabled" in p)) p.alerts_enabled = true;
        if (!("pronouns" in p)) p.pronouns = p.id === "u-demo" ? "he/him" : null;
        if (!("timezone" in p)) p.timezone = p.id === "u-demo" ? "EST (UTC−5)" : null;
        if (!("timed_out_until" in p)) p.timed_out_until = null;
        if ("banner" in p) delete p.banner;
        if ("banner_path" in p) delete p.banner_path;
      });
      d.shops.forEach(s => { if (!("timed_out_until" in s)) s.timed_out_until = null; });
      d.listings.forEach(l => { if (!("timed_out_until" in l)) l.timed_out_until = null; });
      d.comments.forEach(c => { if (!("timed_out_until" in c)) c.timed_out_until = null; });
      // Soft-fill honesty history once so sparklines work without a full mock reset
      if (!d.shop_honesty_history.length && d.shops.length) {
        let hv = 1;
        d.shops.forEach(s => {
          let score = 60 + (hv++ % 30);
          for (let k = 14; k >= 0; k--) {
            score = Math.max(20, Math.min(100, score + ((k % 3) - 1) * 3));
            const t = Date.now() - k * DAY;
            d.shop_honesty_history.push({ day: isoDay(t), shop_id: s.id, score, updated_at: new Date(t).toISOString() });
          }
        });
        save(d);
      }
      if (purgeExpired(d)) save(d);
      return d;
    }
    const d = seed();
    save(d);
    return d;
  };
  const nextId = rows => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const same = (a, b) => String(a) === String(b);

  // ---- who am I
  const uid = () => sess.getItem(SKEY);
  const prof = (db, id) => db.profiles.find(p => p.id === id);
  const effOut = row => {
    if (!row || !row.timed_out) return false;
    if (!row.timed_out_until) return true;
    const t = new Date(row.timed_out_until).getTime();
    return Number.isFinite(t) && t > Date.now();
  };
  const roleOf = db => {
    const p = prof(db, uid());
    const live = !!p && !effOut(p);          // timed-out staff lose their powers
    return {
      admin: live && !!p.is_admin, mod: live && !!p.is_mod, head: live && !!p.is_head,
      staff: live && !!(p.is_admin || p.is_mod), out: !!(p && effOut(p)),
      verified: live && !!p.verified_at
    };
  };

  // ---- visibility (same logic as the read policies in setup.sql)
  const shopOf = (db, id) => db.shops.find(x => same(x.id, id));
  const ownerTimedOut = (db, s) => effOut(prof(db, s.owner_id) || {});
  const shopVisible = (db, s) =>
    (!effOut(s) && !s.archived && s.is_open !== false && !ownerTimedOut(db, s)) || s.owner_id === uid() || roleOf(db).staff;
  const childVisible = (db, r) => {                  // listings + comments
    const s = shopOf(db, r.shop_id);
    if (!s) return false;
    if (roleOf(db).staff || s.owner_id === uid()) return true;
    return !effOut(r) && shopVisible(db, s);
  };
  const ownerOf = (db, table, r) => {
    if (table === "shops") return r.owner_id;
    const s = shopOf(db, r.shop_id);
    return s ? s.owner_id : null;
  };
  const rlsErr = () => ({ message: "new row violates row-level security policy" });

  class Query {
    constructor(table) {
      this.table = table; this.op = "select"; this.selectStr = "*";
      this.filters = []; this.orderBy = null; this.limitN = null; this.wantOne = false; this.payload = null;
    }
    select(s) { this.selectStr = s || "*"; return this; }
    insert(p) { this.op = "insert"; this.payload = p; return this; }
    update(p) { this.op = "update"; this.payload = p; return this; }
    delete() { this.op = "delete"; return this; }
    eq(col, val) { this.filters.push(r => same(r[col], val)); return this; }
    is(col, val) {
      this.filters.push(r => (val === null ? r[col] == null : same(r[col], val)));
      return this;
    }
    gte(col, val) { this.filters.push(r => r[col] >= val); return this; }
    lte(col, val) { this.filters.push(r => r[col] <= val); return this; }
    ilike(col, pat) {
      const t = String(pat).replace(/%/g, "").toLowerCase();
      this.filters.push(r => String(r[col] ?? "").toLowerCase().includes(t));
      return this;
    }
    order(col, opts) { this.orderBy = { col, asc: !(opts && opts.ascending === false) }; return this; }
    limit(n) { this.limitN = n; return this; }
    single() { this.wantOne = true; return this; }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }

    vis(db, r) {
      const R = roleOf(db);
      if (this.table === "shops") return shopVisible(db, r);
      if (["listings", "comments", "reviews"].includes(this.table)) return childVisible(db, r);
      if (this.table === "favorites" || this.table === "watches" || this.table === "place_follows") return r.user_id === uid();
      if (this.table === "notifications") return r.user_id === uid();
      if (this.table === "admin_sales") return true;
      if (this.table === "tip_votes") return true;
      if (this.table === "follows") return true;
      if (this.table === "reports") return R.staff;
      return true;
    }

    run() {
      const db = load();
      const rows = db[this.table];
      if (!rows) return { data: null, error: { message: "unknown table " + this.table } };
      const R = roleOf(db);
      const me = uid();
      const match = r => this.filters.every(f => f(r));
      const now = new Date().toISOString();

      if (this.op === "insert") {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = [];
        for (const p of payloads) {
        let row;
        if (this.table === "profiles") return { data: null, error: rlsErr() };
        if (this.table === "shops") {
          if (!(p.owner_id === me && !R.out && R.verified)) return { data: null, error: rlsErr() };   // unverified can't make shops
          row = { description: null, styled_name: null, hours: null, find_note: null, transit_note: null, icon_item: null, icon_path: null, city: null, nation: null,
            archived: false, is_open: true, group_icons: {}, sale_name: null, sale_percent: null, sale_label: null, sale_starts_at: null, sale_ends_at: null, sale_active: false, sale_admin_id: null,
            ...p, id: nextId(rows), timed_out: false, created_at: now };
          delete row.banner_path;
        } else if (this.table === "listings") {
          const s = shopOf(db, p.shop_id);
          if (!(s && s.owner_id === me && !R.out && R.verified)) return { data: null, error: rlsErr() };
          for (const k of ["sell_unit", "want_unit"]) {
            if (p[k] != null && !["", "ci", "cs"].includes(p[k])) return { data: null, error: { message: "bad unit" } };
          }
          const stock = p.stock === undefined ? null : p.stock;
          if (stock != null && (!(stock >= 0) || stock !== Math.floor(stock))) return { data: null, error: { message: "bad stock" } };
          if (p.group_name != null && String(p.group_name).length > 60) return { data: null, error: { message: "group name is too long (60 max)" } };
          const id = nextId(rows);
          const sort_order = p.sort_order != null ? p.sort_order : id;
          row = { ...p, id, sell_unit: p.sell_unit || "", want_unit: p.want_unit || "", stock, in_stock: stock == null || stock > 0,
            sort_order, group_name: p.group_name || null, sale_orig_want_amount: p.sale_orig_want_amount == null ? null : p.sale_orig_want_amount,
            timed_out: false, updated_at: now };
        } else if (this.table === "admin_sales") {
          if (!R.head) return { data: null, error: rlsErr() };
          const name = String(p.name || "").trim();
          if (!name || name.length > 60) return { data: null, error: { message: "sale name must be 1-60 characters" } };
          if (!["server", "nation"].includes(p.scope)) return { data: null, error: { message: "scope must be server or nation" } };
          if (p.scope === "nation" && !String(p.nation || "").trim()) return { data: null, error: { message: "nation scope needs a nation" } };
          const pct = p.percent_off == null || p.percent_off === "" ? null : Number(p.percent_off);
          if (pct != null && (!(pct > 0) || !(pct < 100))) return { data: null, error: { message: "percent_off must be between 0 and 100" } };
          row = {
            name, scope: p.scope, nation: p.scope === "nation" ? String(p.nation).trim() : null,
            percent_off: pct, label: p.label ? String(p.label).trim().slice(0, 40) : null,
            active: p.active !== false, starts_at: p.starts_at || null, ends_at: p.ends_at || null,
            created_by: me, id: nextId(rows), created_at: now
          };
        } else if (this.table === "notifications") {
          if (!R.head) return { data: null, error: rlsErr() };
          row = {
            user_id: p.user_id, type: String(p.type || "info").slice(0, 40),
            payload: p.payload && typeof p.payload === "object" ? p.payload : {},
            read_at: p.read_at || null, id: nextId(rows), created_at: now
          };
        } else if (this.table === "comments") {
          if (!(p.author_id === me && !R.out && R.verified)) return { data: null, error: rlsErr() };   // unverified can NOT comment
          const body = p.body || "";
          if (body.length > 500 || (!body && !p.image_path)) return { data: null, error: { message: "a comment needs text or a picture (500 characters max)" } };
          if (p.image_path && !String(p.image_path).startsWith("comments/")) return { data: null, error: { message: "bad image path" } };
          row = { parent_id: null, image_path: null, ...p, body, id: nextId(rows), timed_out: false, created_at: now };
        } else if (this.table === "reviews") {
          const s = shopOf(db, p.shop_id);
          if (!(s && p.author_id === me && !R.out && R.verified && s.owner_id !== me)) return { data: null, error: rlsErr() };   // verified, not your own shop
          if (!(p.rating >= 1 && p.rating <= 5)) return { data: null, error: { message: "rating must be 1-5" } };
          if ((p.body || "").length > 500) return { data: null, error: { message: "review is too long (500 max)" } };
          if (rows.some(v => same(v.shop_id, p.shop_id) && v.author_id === me)) return { data: null, error: { message: "duplicate key value violates unique constraint (one review per shop)" } };
          row = { body: "", traded: !!p.traded, owner_reply: null, owner_reply_at: null, ...p, id: nextId(rows), timed_out: false, created_at: now };
          row.owner_reply = null;
          row.owner_reply_at = null;
        } else if (this.table === "favorites") {
          if (!(p.user_id === me && !R.out)) return { data: null, error: rlsErr() };
          if (rows.some(f => f.user_id === me && same(f.shop_id, p.shop_id))) return { data: null, error: { message: "duplicate key value" } };
          row = { ...p, id: nextId(rows), created_at: now };
        } else if (this.table === "watches") {
          if (!(p.user_id === me && !R.out)) return { data: null, error: rlsErr() };
          if (!["sell", "want"].includes(p.mode || "sell")) return { data: null, error: { message: "bad watch mode" } };
          if (rows.some(w => w.user_id === me && w.item === p.item && w.mode === (p.mode || "sell"))) return { data: null, error: { message: "duplicate key value" } };
          row = { mode: "sell", max_diamonds: null, ...p, id: nextId(rows), created_at: now };
        } else if (this.table === "follows") {
          if (!(p.follower_id === me && !R.out)) return { data: null, error: rlsErr() };
          if (p.follower_id === p.following_id) return { data: null, error: { message: "can't follow yourself" } };
          if (rows.some(f => f.follower_id === me && f.following_id === p.following_id)) return { data: null, error: { message: "duplicate key value" } };
          row = { ...p, id: nextId(rows), created_at: now };
        } else if (this.table === "place_follows") {
          if (!(p.user_id === me && !R.out)) return { data: null, error: rlsErr() };
          if (!["nation", "city"].includes(p.kind)) return { data: null, error: { message: "bad place kind" } };
          const name = String(p.name || "").trim();
          if (!name || name.length > 60) return { data: null, error: { message: "place name must be 1-60 characters" } };
          if (rows.some(f => f.user_id === me && f.kind === p.kind && f.name.toLowerCase() === name.toLowerCase()))
            return { data: null, error: { message: "duplicate key value" } };
          row = { ...p, name, id: nextId(rows), created_at: now };
        } else if (this.table === "tip_votes") {
          if (!(p.user_id === me && !R.out)) return { data: null, error: rlsErr() };
          if (!["fair", "high", "low"].includes(p.vote)) return { data: null, error: { message: "bad tip vote" } };
          if (!db.listings.some(l => same(l.id, p.listing_id))) return { data: null, error: { message: "listing not found" } };
          if (rows.some(v => v.user_id === me && same(v.listing_id, p.listing_id)))
            return { data: null, error: { message: "duplicate key value" } };
          row = { ...p, id: nextId(rows), created_at: now };
        } else if (this.table === "reports") {
          if (!(p.reporter_id === me && !R.out)) return { data: null, error: rlsErr() };
          if (!["listing", "shop", "user", "comment", "review"].includes(p.target_type)) return { data: null, error: { message: "bad report type" } };
          if (!p.reason || p.reason.length > 500) return { data: null, error: { message: "reason must be 1-500 characters" } };
          const cats = ["inappropriate", "duplicate", "false_advertising", "other"];
          if (p.reason_category != null && !cats.includes(p.reason_category)) return { data: null, error: { message: "bad reason category" } };
          row = { ...p, reason_category: p.reason_category || null, id: nextId(rows), status: "open", created_at: now };
        } else {
          return { data: null, error: { message: "insert not allowed on " + this.table } };
        }
        rows.push(row);
        inserted.push(row);
        }
        save(db);
        if (this.wantOne) return { data: inserted[0] || null, error: inserted[0] ? null : { message: "no row found" } };
        return { data: Array.isArray(this.payload) ? inserted : null, error: null };
      }

      if (this.op === "update") {
        if (this.table === "profiles") {
          // people can only change their own discord_username + must_change_password
          const pl = this.payload;
          if (pl.bio != null && pl.bio.length > 300) return { data: null, error: { message: "bio is too long (300 max)" } };
          if (pl.pronouns != null && String(pl.pronouns).length > 40) return { data: null, error: { message: "pronouns is too long (40 max)" } };
          if (pl.timezone != null && String(pl.timezone).length > 60) return { data: null, error: { message: "timezone is too long (60 max)" } };
          if (pl.highlight_color != null && !/^#[0-9A-Fa-f]{6}$/.test(pl.highlight_color)) return { data: null, error: { message: "bad highlight colour" } };
          if (pl.avatar_path != null && !String(pl.avatar_path).startsWith("avatars/")) return { data: null, error: { message: "bad avatar path" } };
          rows.filter(match).forEach(r => {
            if (r.id !== me || R.out) return;
            // Minecraft name + Discord name are locked (PFA Discord ticket to change)
            for (const k of ["bio", "highlight_color", "avatar_path", "must_change_password", "last_seen_at", "alerts_enabled", "pronouns", "timezone"]) if (k in pl) r[k] = pl[k];
          });
          save(db);
          return { data: null, error: null };
        }
        if (this.table === "reports") {
          if (R.staff) rows.filter(match).forEach(r => Object.assign(r, this.payload));
          save(db);
          return { data: null, error: null };
        }
        if (this.table === "notifications") {
          const pl = this.payload;
          rows.filter(match).forEach(r => {
            if (r.user_id !== me || R.out) return;
            if ("read_at" in pl) r.read_at = pl.read_at;
            if ("payload" in pl && pl.payload && typeof pl.payload === "object") r.payload = pl.payload;
          });
          save(db);
          return { data: null, error: null };
        }
        if (this.table === "admin_sales") {
          if (!R.head) return { data: null, error: rlsErr() };
          rows.filter(match).forEach(r => Object.assign(r, this.payload));
          save(db);
          return { data: null, error: null };
        }
        if (this.table === "listings") {
          for (const key of ["sell_unit", "want_unit"])
            if (this.payload[key] != null && !["", "ci", "cs"].includes(this.payload[key])) return { data: null, error: { message: "bad unit" } };
          if ("stock" in this.payload) {
            const stock = this.payload.stock;
            if (stock != null && (!(stock >= 0) || stock !== Math.floor(stock))) return { data: null, error: { message: "bad stock" } };
            this.payload.in_stock = stock == null || stock > 0;
          }
          if (this.payload.group_name != null && String(this.payload.group_name).length > 60)
            return { data: null, error: { message: "group name is too long (60 max)" } };
        }
        if (this.table === "shops") {
          const pl = this.payload, bad = m => ({ data: null, error: { message: m } });
          if (pl.description != null && pl.description.length > 500) return bad("description is too long (500 max)");
          if (pl.styled_name != null && pl.styled_name.length > 120) return bad("fancy name is too long (120 max)");
          if (pl.hours != null && pl.hours.length > 200) return bad("hours is too long (200 max)");
          if (pl.icon_item != null && !/^[a-z0-9_ ]{1,60}$/.test(pl.icon_item)) return bad("bad icon item");
          if (pl.icon_path != null && !String(pl.icon_path).startsWith("shops/")) return bad("bad icon path");
          if (pl.nation != null && String(pl.nation).length > 60) return bad("nation is too long (60 max)");
          if (pl.city != null && String(pl.city).length > 60) return bad("city is too long (60 max)");
          if (pl.find_note != null && String(pl.find_note).length > 120) return bad("find note is too long (120 max)");
          if (pl.transit_note != null && String(pl.transit_note).length > 120) return bad("transit note is too long (120 max)");
        }
        if (this.table === "tip_votes") {
          const pl = this.payload;
          if (pl.vote != null && !["fair", "high", "low"].includes(pl.vote)) return { data: null, error: { message: "bad tip vote" } };
          rows.filter(match).forEach(r => {
            if (r.user_id !== me || R.out) return;
            if ("vote" in pl) r.vote = pl.vote;
          });
          save(db);
          return { data: null, error: null };
        }
        const cand = rows.filter(r => this.vis(db, r)).filter(match);
        for (const r of cand) {
          const owner = ownerOf(db, this.table, r);
          const isOwner = owner === me && !R.out;
          const isAuthor = (this.table === "comments" || this.table === "reviews") && r.author_id === me && !R.out;
          if (!(R.admin || R.mod || isOwner || isAuthor)) continue;       // RLS: silently no rows
          if (this.table === "shops" && "owner_id" in this.payload && this.payload.owner_id !== r.owner_id && !R.head) {
            return { data: null, error: { message: "Only the head admin can transfer shops" } };
          }
          if (this.table === "reviews" && isOwner && !isAuthor && !R.admin) {
            const pl = this.payload;
            const bad = Object.keys(pl).some(k => !["owner_reply", "owner_reply_at", "timed_out"].includes(k) && pl[k] !== r[k]);
            if (bad) return { data: null, error: { message: "Shop owners can only reply to reviews" } };
            if (R.mod && owner !== me) {
              const modBad = Object.keys(pl).some(k => k !== "timed_out" && pl[k] !== r[k]);
              if (modBad) return { data: null, error: { message: "Mods can only change timeout" } };
            }
            if ("owner_reply" in pl) {
              if (pl.owner_reply != null && String(pl.owner_reply).length > 500)
                return { data: null, error: { message: "reply is too long (500 max)" } };
              r.owner_reply = pl.owner_reply;
            }
            if ("owner_reply_at" in pl) r.owner_reply_at = pl.owner_reply_at;
            if (R.mod && "timed_out" in pl) r.timed_out = pl.timed_out;
            continue;
          }
          if (R.admin) {
            Object.assign(r, this.payload);
          } else if (R.mod && owner !== me) {                              // trigger: mods only touch timed_out (+ until)
            const bad = Object.keys(this.payload).some(k => !["timed_out", "timed_out_until"].includes(k) && this.payload[k] !== r[k]);
            if (bad) return { data: null, error: { message: "Mods can only change timeout" } };
            if ("timed_out" in this.payload) r.timed_out = this.payload.timed_out;
            if ("timed_out_until" in this.payload) r.timed_out_until = this.payload.timed_out_until;
          } else {                                                         // trigger: everyone else can't touch timed_out
            const { timed_out, timed_out_until, owner_reply, owner_reply_at, ...rest } = this.payload;
            if (!(this.table === "comments" || this.table === "reviews") || isAuthor) Object.assign(r, rest);
          }
        }
        save(db);
        return { data: null, error: null };
      }

        if (this.op === "delete") {
        if (this.table === "profiles") return { data: null, error: null };
        const gone = rows.filter(r => this.vis(db, r)).filter(match).filter(r => {
          if (this.table === "reports") return false;
          if (this.table === "comments" || this.table === "reviews") return R.admin || (r.author_id === me && !R.out);
          if (this.table === "favorites" || this.table === "watches" || this.table === "place_follows") return r.user_id === me;
          if (this.table === "notifications") return r.user_id === me;
          if (this.table === "admin_sales") return R.head;
          if (this.table === "tip_votes") return r.user_id === me || R.staff;
          if (this.table === "follows") return r.follower_id === me;
          return R.admin || (ownerOf(db, this.table, r) === me && !R.out);
        });
        db[this.table] = rows.filter(r => !gone.includes(r));
        if (this.table === "shops") {
          db.listings = db.listings.filter(l => !gone.some(g => same(g.id, l.shop_id)));
          db.comments = db.comments.filter(c => !gone.some(g => same(g.id, c.shop_id)));
          db.reviews = db.reviews.filter(v => !gone.some(g => same(g.id, v.shop_id)));
          db.favorites = db.favorites.filter(f => !gone.some(g => same(g.id, f.shop_id)));
          if (db.shop_honesty_history) db.shop_honesty_history = db.shop_honesty_history.filter(h => !gone.some(g => same(g.id, h.shop_id)));
        }
        if (this.table === "admin_sales") {
          db.shops.forEach(s => {
            if (gone.some(g => same(g.id, s.sale_admin_id))) s.sale_admin_id = null;
          });
        }
        if (this.table === "listings" && db.tip_votes) {
          db.tip_votes = db.tip_votes.filter(v => !gone.some(g => same(g.id, v.listing_id)));
        }
        if (this.table === "comments") dropOrphanReplies(db);
        save(db);
        return { data: null, error: null };
      }

      // select
      let out = rows.filter(r => this.vis(db, r)).filter(match).map(r => this.embed(db, { ...r }));
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        out.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (this.limitN) out = out.slice(0, this.limitN);
      if (this.wantOne) {
        return out.length ? { data: out[0], error: null } : { data: null, error: { message: "no row found" } };
      }
      return { data: out, error: null };
    }

    embed(db, r) {
      const s = this.selectStr;
      if (this.table === "listings" && s.includes("shops(")) {
        const shop = shopOf(db, r.shop_id);
        if (shop && shopVisible(db, shop)) {
          r.shops = { ...shop, profiles: prof(db, shop.owner_id) || null };
          // Nested shops(..., reviews(...)) — used by Find item filters
          if (s.includes("reviews(")) {
            r.shops.reviews = db.reviews.filter(v => same(v.shop_id, shop.id) && childVisible(db, v))
              .map(v => ({ rating: v.rating, traded: !!v.traded, timed_out: v.timed_out }));
          }
        } else {
          r.shops = null;
        }
      }
      if (this.table === "shops") {
        const ls = db.listings.filter(l => same(l.shop_id, r.id) && childVisible(db, l)).map(l => ({ ...l }));
        if (s.includes("listings(count)")) r.listings = [{ count: ls.length }];
        else if (s.includes("listings(")) r.listings = ls;
        if (s.includes("profiles(")) r.profiles = prof(db, r.owner_id) || null;
        if (s.includes("reviews(")) r.reviews = db.reviews.filter(v => same(v.shop_id, r.id) && childVisible(db, v)).map(v => ({ rating: v.rating, traded: !!v.traded, timed_out: v.timed_out }));
      }
      if ((this.table === "comments" || this.table === "reviews") && s.includes("profiles(")) r.profiles = prof(db, r.author_id) || null;
      if (this.table === "favorites" && s.includes("shops(")) {
        const shop = shopOf(db, r.shop_id);
        r.shops = shop && shopVisible(db, shop) ? {
          ...shop, profiles: prof(db, shop.owner_id) || null,
          listings: db.listings.filter(l => same(l.shop_id, shop.id) && childVisible(db, l)).map(l => ({ id: l.id, updated_at: l.updated_at, stock: l.stock, in_stock: l.in_stock, timed_out: l.timed_out })),
          reviews: db.reviews.filter(v => same(v.shop_id, shop.id) && childVisible(db, v)).map(v => ({ rating: v.rating, traded: !!v.traded, timed_out: v.timed_out }))
        } : null;
      }
      if (this.table === "follows" && s.includes("profiles")) {
        r.profiles = prof(db, r.following_id) || null;
      }
      if (this.table === "reviews" && s.includes("shops(")) {
        const shop = shopOf(db, r.shop_id);
        r.shops = shop ? { id: shop.id, name: shop.name, styled_name: shop.styled_name } : null;
      }
      return r;
    }
  }

  // a timed-out account has no valid session (like deleting its sessions on the real thing)
  const sessionObj = () => {
    const id = uid();
    if (!id) return null;
    const p = prof(load(), id);
    if (!p || p.timed_out) { sess.removeItem(SKEY); return null; }
    return { user: { id } };
  };

  const fail = m => ({ data: { error: m }, error: { message: m } });
  const ok = () => ({ data: { ok: true }, error: null });

  return {
    from: t => new Query(t),
    async rpc(name) {
      const db = load();
      if (name === "market_now") return { data: marketNow(db), error: null };
      if (name === "take_market_snapshot") {
        const today = isoDay(Date.now());
        if (!db.market_history.some(h => h.day === today && Date.now() - new Date(h.updated_at).getTime() < 30 * 60000)) {
          marketNow(db).forEach(m => {
            db.market_history = db.market_history.filter(h => !(h.day === today && h.item === m.item && h.side === m.side));
            db.market_history.push({ day: today, item: m.item, side: m.side, median: m.median, low: m.low, high: m.high, n: m.n, updated_at: new Date().toISOString() });
          });
          if (!db.shop_honesty_history) db.shop_honesty_history = [];
          db.shops.forEach(s => {
            const ls = db.listings.filter(l => same(l.shop_id, s.id));
            const h = typeof honestyInfo === "function" ? honestyInfo(ls) : null;
            if (!h) return;
            db.shop_honesty_history = db.shop_honesty_history.filter(x => !(x.day === today && same(x.shop_id, s.id)));
            db.shop_honesty_history.push({ day: today, shop_id: s.id, score: h.score, updated_at: new Date().toISOString() });
          });
          save(db);
        }
        return { data: null, error: null };
      }
      return { data: null, error: { message: "unknown function " + name } };
    },
    storage: {
      from: () => ({
        async upload(path, blob) {
          const db = load(), R = roleOf(db), parts = path.split("/");
          if (!(R.verified && ["comments", "avatars", "shops"].includes(parts[0]) && parts[1] === uid())) return { data: null, error: { message: "new row violates row-level security policy" } };
          if (blob.size > 1048576) return { data: null, error: { message: "The object exceeded the maximum allowed size" } };
          const url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
          db.files[path] = url;
          try { save(db); } catch (e) { return { data: null, error: { message: "mock storage is full, add ?resetmock to the URL" } }; }
          return { data: { path }, error: null };
        },
        getPublicUrl(path) { return { data: { publicUrl: load().files[path] || "" } }; },
        async remove(paths) { const db = load(); paths.forEach(p => delete db.files[p]); save(db); return { data: null, error: null }; }
      })
    },
    auth: {
      async getSession() { return { data: { session: sessionObj() } }; },
      async setSession({ access_token }) {
        // mock: access_token is the user id (used to restore the head admin after impersonation)
        if (!access_token) return { data: { session: null }, error: { message: "No session" } };
        sess.setItem(SKEY, access_token);
        const s = sessionObj();
        if (!s) return { data: { session: null }, error: { message: "Session expired" } };
        return { data: { session: s }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const db = load();
        const username = email.replace(FAKE_DOMAIN, "");
        const u = db.users.find(x => x.username === username && x.password === password);
        if (!u) return { data: null, error: { message: "Invalid login credentials" } };
        if ((prof(db, u.id) || {}).timed_out) return { data: null, error: { message: "User is banned" } };
        u.last_sign_in_at = new Date().toISOString();
        save(db);
        sess.setItem(SKEY, u.id);
        return { data: { session: sessionObj() }, error: null };
      },
      async signOut() { sess.removeItem(SKEY); return { error: null }; },
      async updateUser({ password }) {
        const db = load();
        const u = db.users.find(x => x.id === uid());
        if (!u) return { data: null, error: { message: "Not logged in" } };
        u.password = password;
        save(db);
        return { data: {}, error: null };
      },
      async verifyOtp() {
        return { data: { session: null }, error: { message: "Not used in mock mode" } };
      }
    },
    functions: {
      async invoke(name, { body }) {
        const db = load();
        const R = roleOf(db);
        const me = prof(db, uid());
        const nowIso = new Date().toISOString();

        // public: anyone can sign up, but the account starts unverified
        if (name === "signup") {
          const username = String(body.username || "").trim().toLowerCase();
          const mc = String(body.mc_username || "").trim();
          const dc = String(body.discord_username || "").trim();
          if (!/^[a-z0-9_]{3,20}$/.test(username)) return fail("Login username: 3-20 letters, numbers or _.");
          if (String(body.password || "").length < 8) return fail("Password needs 8-72 characters.");
          if (!mc || mc.length > 32) return fail("Enter your Minecraft name (max 32 characters).");
          if (dc.length < 2 || dc.length > 40) return fail("Enter your Discord username.");
          if (db.users.some(u => u.username === username)) return fail("That login username is taken.");
          const id = "u-" + Math.random().toString(36).slice(2, 10);
          db.users.push({ id, username, password: body.password, last_sign_in_at: null });
          db.profiles.push({
            id, mc_username: mc, discord_username: dc, bio: null, highlight_color: null, avatar_path: null, is_admin: false, is_head: false, is_mod: false,
            timed_out: false, verified_at: null, must_change_password: false, alerts_enabled: true, last_seen_at: null, created_at: nowIso
          });
          save(db);
          return ok();
        }

        if (!me || me.timed_out) return fail("Not logged in.");

        if (name === "create-user") {
          if (!R.admin) return fail("Admins only.");
          const role = body.role || "user";
          if (!["user", "mod", "admin"].includes(role)) return fail("Bad account type.");
          if (role !== "user" && !R.head) return fail("Only the head admin can create mods or admins.");
          if (!/^[a-z0-9_]{3,20}$/.test(body.username || "")) return fail("Login username: 3-20 letters, numbers or _.");
          if (!body.mc_username) return fail("Need a Minecraft name (max 32 characters).");
          if (!body.password || body.password.length < 8) return fail("Password needs 8+ characters.");
          if (db.users.some(u => u.username === body.username)) return fail("That login username is taken.");
          const id = "u-" + Math.random().toString(36).slice(2, 10);
          db.users.push({ id, username: body.username, password: body.password, last_sign_in_at: null });
          db.profiles.push({
            id, mc_username: body.mc_username, discord_username: body.discord_username || null, bio: null, highlight_color: null, avatar_path: null,
            is_admin: role === "admin", is_mod: role === "mod", is_head: false,
            timed_out: false, verified_at: nowIso, must_change_password: true, alerts_enabled: true, last_seen_at: null, created_at: nowIso   // admin-created: verified + popup
          });
          save(db);
          return ok();
        }

        if (name === "manage-user") {
          if (!R.staff) return fail("Staff only.");
          const t = prof(db, body.user_id);
          if (!t) return fail("No such account.");
          if (t.id === me.id) return fail("Pick a different account.");
          if (body.action === "impersonate") {
            if (!R.head) return fail("Only the head admin can log into users.");
            if (t.timed_out) return fail("That account is timed out.");
            // client switches the mock session id; no OTP needed locally
            return { data: { ok: true, mock_user_id: t.id, mc_username: t.mc_username, user_id: t.id }, error: null };
          }
          if (t.is_head) return fail("The head admin can't be changed.");
          if (body.action === "timeout" || body.action === "untimeout") {
            if (t.is_admin && !R.head) return fail("Only the head admin can timeout admins.");
            if (t.is_mod && !R.admin) return fail("Only admins can timeout mods.");
            const on = body.action === "timeout";
            t.timed_out = on;
            if (!on) t.timed_out_until = null;
            else if (body.hours == null || body.hours === "") t.timed_out_until = null;
            else {
              const h = Number(body.hours);
              if (![1, 24, 168].includes(h)) return fail("Use 1 hour, 1 day, 7 days, or until removed.");
              t.timed_out_until = new Date(Date.now() + h * 3600000).toISOString();
            }
          } else {
            const roles = { make_mod: [false, true], remove_mod: [false, false], make_admin: [true, false], remove_admin: [false, false] };
            if (!roles[body.action]) return fail("Unknown action.");
            if (!R.head) return fail("Only the head admin can change roles.");
            [t.is_admin, t.is_mod] = roles[body.action];
          }
          save(db);
          return ok();
        }

        if (name === "review-signup") {
          if (!R.head) return fail("Head admin only.");
          if (body.action === "purge_unverified") {
            const before = db.profiles.length;
            purgeExpired(db);
            save(db);
            return { data: { ok: true, purged: before - db.profiles.length }, error: null };
          }
          if (body.action === "list") {
            const accounts = db.profiles.map(p => {
              const u = db.users.find(x => x.id === p.id) || {};
              return { ...p, login_username: u.username, last_sign_in_at: u.last_sign_in_at || null };
            });
            return { data: { accounts }, error: null };
          }
          if (body.action === "delete") {                       // head only: delete ANY account (not their own)
            const dt = prof(db, body.user_id);
            if (!dt) return fail("No such account.");
            if (dt.is_head || dt.id === me.id) return fail("The head admin account can't be deleted here.");
            removeAccounts(db, [dt.id]);
            save(db);
            return ok();
          }
          const t = prof(db, body.user_id);
          if (!t) return fail("No such account.");
          if (t.verified_at) return fail("That account is already verified.");
          if (t.is_admin || t.is_mod || t.is_head) return fail("Staff accounts can't be reviewed.");
          if (body.action === "accept") { t.verified_at = nowIso; save(db); return ok(); }
          if (body.action === "deny") {                       // delete the account and everything it made
            removeAccounts(db, [t.id]);
            save(db);
            return ok();
          }
          return fail("Unknown action.");
        }
        return fail("Unknown function.");
      }
    }
  };
}
