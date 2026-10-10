-- Run this in Supabase dashboard > SQL Editor (fresh project version)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  mc_username text not null,
  discord_username text,
  bio text check (char_length(bio) <= 300),          -- may use Minecraft colour codes like &6
  highlight_color text check (highlight_color is null or highlight_color ~ '^#[0-9A-Fa-f]{6}$'),  -- profile card frame colour
  avatar_path text check (avatar_path is null or avatar_path like 'avatars/%'),
  last_seen_at timestamptz,                          -- bumped on login / page use
  is_admin boolean not null default false,
  is_head boolean not null default false,
  is_mod boolean not null default false,
  timed_out boolean not null default false,
  timed_out_until timestamptz,                       -- null = until staff removes; else auto-lifts after
  verified_at timestamptz,
  must_change_password boolean not null default false,
  alerts_enabled boolean not null default true,      -- owner listing alerts on My shops
  pronouns text check (pronouns is null or char_length(pronouns) <= 40),
  timezone text check (timezone is null or char_length(timezone) <= 60),
  created_at timestamptz not null default now()
);

create table shops (
  id bigint generated always as identity primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  city text,
  nation text,
  x int,
  z int,
  description text check (char_length(description) <= 500),          -- may use Minecraft colour codes like &6
  styled_name text check (char_length(styled_name) <= 120),          -- optional fancy name with colour codes (name stays the plain, searchable one)
  hours text check (char_length(hours) <= 200),                     -- restock / open hours note
  find_note text check (char_length(find_note) <= 120),             -- short "how to find me" (floor, colour, landmark)
  transit_note text check (char_length(transit_note) <= 120),       -- near ice road / rail / portal
  icon_item text check (icon_item ~ '^[a-z0-9_ ]{1,60}$'),           -- shop icon = an item texture...
  icon_path text check (icon_path is null or icon_path like 'shops/%'), -- ...or an uploaded picture (wins if both are set)
  timed_out boolean not null default false,
  timed_out_until timestamptz,
  archived boolean not null default false,                             -- owner hide without delete
  is_open boolean not null default true,                               -- false = closed (hidden from public)
  group_icons jsonb not null default '{}'::jsonb,                      -- {"Nether":{"icon_item":"blaze rod"}, ...}
  -- Active sale on this shop (owner-run or joined from an admin sale). Prices restore via listings.sale_orig_want_amount.
  sale_name text check (sale_name is null or char_length(sale_name) <= 60),
  sale_percent numeric check (sale_percent is null or (sale_percent > 0 and sale_percent < 100)),
  sale_label text check (sale_label is null or char_length(sale_label) <= 40),
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  sale_active boolean not null default false,
  sale_admin_id bigint,                                                -- set when joined from admin_sales
  created_at timestamptz not null default now()
);
create index on shops (city);
create index on shops (nation);

create table listings (
  id bigint generated always as identity primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  sell_item text not null check (sell_item ~ '^[a-z0-9_ ]{1,60}$'),
  sell_amount int not null check (sell_amount > 0),
  sell_unit text not null default '' check (sell_unit in ('', 'ci', 'cs')),
  want_item text not null check (want_item ~ '^[a-z0-9_ ]{1,60}$'),
  want_amount int not null check (want_amount > 0),
  want_unit text not null default '' check (want_unit in ('', 'ci', 'cs')),
  stock int check (stock is null or stock >= 0),   -- null = in stock (no count), 0 = out, N = exchanges left
  in_stock boolean not null default true,          -- kept in sync: true when stock is null or > 0
  sort_order int not null default 0,               -- owner display order within shop
  group_name text check (group_name is null or char_length(group_name) <= 60),
  sale_orig_want_amount int check (sale_orig_want_amount is null or sale_orig_want_amount > 0), -- pre-sale want_amount for restore
  timed_out boolean not null default false,
  timed_out_until timestamptz,
  updated_at timestamptz not null default now(),
  stale_acked_at timestamptz,                      -- owner ignored stale alert; restarts 7-day clock
  price_alert_acked_at timestamptz                 -- owner ignored overprice/restock alert (snooze ~7 days)
);

create index on listings (sell_item);
create index on listings (want_item);

create table comments (
  id bigint generated always as identity primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id bigint references comments(id) on delete cascade,
  image_path text check (image_path is null or image_path like 'comments/%'),
  body text not null default '' check (char_length(body) <= 500),
  timed_out boolean not null default false,
  timed_out_until timestamptz,
  created_at timestamptz not null default now()
);

alter table comments add constraint comment_has_content
  check (char_length(body) > 0 or image_path is not null);

create table reviews (
  id bigint generated always as identity primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 500),
  traded boolean not null default false,             -- "I traded here"
  owner_reply text check (owner_reply is null or char_length(owner_reply) <= 500),
  owner_reply_at timestamptz,
  timed_out boolean not null default false,
  timed_out_until timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, author_id)          -- one review per person per shop
);
create index on reviews (shop_id);

create table favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  shop_id bigint not null references shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, shop_id)
);

-- Watch an item (buyer discovery). mode: sell = who is selling, want = who is buying.
create table watches (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  item text not null check (item ~ '^[a-z0-9_ ]{1,60}$'),
  mode text not null default 'sell' check (mode in ('sell', 'want')),
  max_diamonds numeric,                              -- optional: only care if deal rate <= this (sell) or >= (want)
  created_at timestamptz not null default now(),
  unique (user_id, item, mode)
);

-- Follow a trader to see their shops later
create table follows (
  id bigint generated always as identity primary key,
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

-- Follow a nation or city (buyer discovery / feed)
create table place_follows (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('nation', 'city')),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- Tip-jar style price votes on a listing (fair / too high / too low)
create table tip_votes (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  listing_id bigint not null references listings(id) on delete cascade,
  vote text not null check (vote in ('fair', 'high', 'low')),
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
create index on tip_votes (listing_id);

create table reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'shop', 'user', 'comment', 'review')),
  target_id text not null,
  reason text not null check (char_length(reason) between 1 and 500),
  reason_category text check (reason_category is null or reason_category in ('inappropriate', 'duplicate', 'false_advertising', 'other')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

-- ---------- helper functions
-- timed_out + optional timed_out_until (null = until staff removes)
create function still_timed_out(flag boolean, until_at timestamptz) returns boolean language sql stable as $$
  select coalesce(flag, false) and (until_at is null or until_at > now());
$$;
create function is_admin() returns boolean language sql security definer set search_path = public as $$
  select coalesce((select is_admin and not still_timed_out(timed_out, timed_out_until) from profiles where id = auth.uid()), false);
$$;
create function is_head() returns boolean language sql security definer set search_path = public as $$
  select coalesce((select is_head and not still_timed_out(timed_out, timed_out_until) from profiles where id = auth.uid()), false);
$$;
create function is_mod() returns boolean language sql security definer set search_path = public as $$
  select coalesce((select is_mod and not still_timed_out(timed_out, timed_out_until) from profiles where id = auth.uid()), false);
$$;
create function is_staff() returns boolean language sql security definer set search_path = public as $$
  select coalesce((select (is_admin or is_mod) and not still_timed_out(timed_out, timed_out_until) from profiles where id = auth.uid()), false);
$$;
create function is_timed_out() returns boolean language sql security definer set search_path = public as $$
  select coalesce((select still_timed_out(timed_out, timed_out_until) from profiles where id = auth.uid()), false);
$$;
create function is_verified() returns boolean language sql security definer set search_path = public as $$
  select coalesce((select verified_at is not null and not still_timed_out(timed_out, timed_out_until) from profiles where id = auth.uid()), false);
$$;
create function account_ok(uid uuid) returns boolean language sql security definer set search_path = public as $$
  select not coalesce((select still_timed_out(timed_out, timed_out_until) from profiles where id = uid), false);
$$;
create function owns_shop(sid bigint) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from shops where id = sid and owner_id = auth.uid());
$$;

alter table profiles enable row level security;
alter table shops enable row level security;
alter table listings enable row level security;
alter table comments enable row level security;
alter table reports enable row level security;
alter table reviews enable row level security;
alter table favorites enable row level security;
alter table watches enable row level security;
alter table follows enable row level security;
alter table place_follows enable row level security;
alter table tip_votes enable row level security;

create policy "read profiles" on profiles for select using (true);

create policy "update own profile" on profiles for update
  using (id = auth.uid() and not is_timed_out())
  with check (id = auth.uid());

create policy "read shops" on shops for select using (
  (not still_timed_out(timed_out, timed_out_until) and not archived and is_open and account_ok(owner_id))
  or owner_id = auth.uid() or is_staff()
);

create policy "read listings" on listings for select using (
  is_staff()
  or owns_shop(shop_id)
  or (not still_timed_out(timed_out, timed_out_until) and exists (select 1 from shops s where s.id = listings.shop_id))
);

create policy "read comments" on comments for select using (
  is_staff()
  or owns_shop(shop_id)
  or (not still_timed_out(timed_out, timed_out_until) and exists (select 1 from shops s where s.id = comments.shop_id))
);

create policy "read reports" on reports for select using (is_staff());

-- shops
create policy "insert own shop" on shops for insert
  with check (owner_id = auth.uid() and not is_timed_out() and is_verified());
create policy "update shop" on shops for update
  using ((owner_id = auth.uid() and not is_timed_out()) or is_admin() or is_mod());
create policy "delete shop" on shops for delete
  using ((owner_id = auth.uid() and not is_timed_out()) or is_admin());

-- listings
create policy "insert own listing" on listings for insert
  with check (owns_shop(shop_id) and not is_timed_out() and is_verified());
create policy "update listing" on listings for update
  using ((owns_shop(shop_id) and not is_timed_out()) or is_admin() or is_mod());
create policy "delete listing" on listings for delete
  using ((owns_shop(shop_id) and not is_timed_out()) or is_admin());

-- comments: verified users only (unverified accounts can read, favourite and report, nothing more)
create policy "insert comment" on comments for insert
  with check (author_id = auth.uid() and not is_timed_out() and is_verified());
create policy "update comment" on comments for update
  using (is_admin() or is_mod() or (author_id = auth.uid() and not is_timed_out()));
create policy "delete comment" on comments for delete
  using (is_admin() or (author_id = auth.uid() and not is_timed_out()));

-- reports: any logged-in user
create policy "insert report" on reports for insert
  with check (reporter_id = auth.uid() and not is_timed_out());
create policy "update report" on reports for update
  using (is_staff());

-- reviews: verified, can't review your own shop, one per shop
create policy "read reviews" on reviews for select using (
  is_staff()
  or owns_shop(shop_id)
  or (not still_timed_out(timed_out, timed_out_until) and exists (select 1 from shops s where s.id = reviews.shop_id))
);
create policy "insert review" on reviews for insert
  with check (author_id = auth.uid() and not is_timed_out() and is_verified() and not owns_shop(shop_id));
create policy "update review" on reviews for update
  using (
    is_admin() or is_mod()
    or (author_id = auth.uid() and not is_timed_out())
    or (owns_shop(shop_id) and not is_timed_out())
  );
create policy "delete review" on reviews for delete
  using (is_admin() or (author_id = auth.uid() and not is_timed_out()));

-- favourites: private, you only ever see and change your own
create policy "read own favorites" on favorites for select using (user_id = auth.uid());
create policy "add favorite" on favorites for insert
  with check (user_id = auth.uid() and not is_timed_out());
create policy "remove favorite" on favorites for delete using (user_id = auth.uid());

create policy "read own watches" on watches for select using (user_id = auth.uid());
create policy "add watch" on watches for insert
  with check (user_id = auth.uid() and not is_timed_out());
create policy "update watch" on watches for update using (user_id = auth.uid() and not is_timed_out());
create policy "remove watch" on watches for delete using (user_id = auth.uid());

create policy "read follows" on follows for select using (true);
create policy "add follow" on follows for insert
  with check (follower_id = auth.uid() and not is_timed_out());
create policy "remove follow" on follows for delete using (follower_id = auth.uid());

create policy "read own place follows" on place_follows for select using (user_id = auth.uid());
create policy "add place follow" on place_follows for insert
  with check (user_id = auth.uid() and not is_timed_out());
create policy "remove place follow" on place_follows for delete using (user_id = auth.uid());

create policy "read tip votes" on tip_votes for select using (true);
create policy "add tip vote" on tip_votes for insert
  with check (user_id = auth.uid() and not is_timed_out());
create policy "update tip vote" on tip_votes for update
  using (user_id = auth.uid() and not is_timed_out());
create policy "remove tip vote" on tip_votes for delete using (user_id = auth.uid());
create policy "staff clear tip votes" on tip_votes for delete using (is_admin() or is_mod());

create function guard_timeout() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if auth.uid() is null or is_admin() then return new; end if;

  if tg_table_name = 'shops' then
    owner := old.owner_id;
  elsif tg_table_name = 'listings' then
    select owner_id into owner from shops where id = old.shop_id;
  elsif tg_table_name in ('comments', 'reviews') then
    select owner_id into owner from shops where id = old.shop_id;
  else
    return new;
  end if;

  if is_mod() and owner is distinct from auth.uid() then
    if (to_jsonb(new) - 'timed_out' - 'timed_out_until') is distinct from (to_jsonb(old) - 'timed_out' - 'timed_out_until') then
      raise exception 'Mods can only change timeout';
    end if;
    return new;
  end if;

  new.timed_out := old.timed_out;
  new.timed_out_until := old.timed_out_until;
  return new;
end $$;

create trigger shops_guard before update on shops for each row execute function guard_timeout();
create trigger listings_guard before update on listings for each row execute function guard_timeout();
create trigger comments_guard before update on comments for each row execute function guard_timeout();
create trigger reviews_guard before update on reviews for each row execute function guard_timeout();

-- Only head admin may reassign shop ownership (admin page transfer tool).
create function guard_shop_owner_transfer() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not distinct from old.owner_id then return new; end if;
  if not is_head() then
    raise exception 'Only the head admin can transfer shops';
  end if;
  return new;
end $$;
create trigger shops_owner_transfer before update on shops for each row execute function guard_shop_owner_transfer();

-- Shop owners may only set owner_reply / owner_reply_at; authors/staff keep their usual fields.
create function guard_review_reply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if is_admin() then return new; end if;

  if owns_shop(old.shop_id) and old.author_id is distinct from auth.uid() then
    if (to_jsonb(new) - 'owner_reply' - 'owner_reply_at' - 'timed_out')
       is distinct from (to_jsonb(old) - 'owner_reply' - 'owner_reply_at' - 'timed_out') then
      raise exception 'Shop owners can only reply to reviews';
    end if;
    if not is_mod() then new.timed_out := old.timed_out; end if;
    return new;
  end if;

  -- authors (and anyone else reaching here): cannot overwrite owner reply
  new.owner_reply := old.owner_reply;
  new.owner_reply_at := old.owner_reply_at;
  return new;
end $$;
create trigger reviews_reply_guard before update on reviews for each row execute function guard_review_reply();

-- people can only change bio, highlight_color, avatar_path, pronouns, timezone and must_change_password on their own profile.
-- Minecraft name and Discord name are locked (changes go through a ticket on the PFA Discord).
-- Everything else (roles, timeout, verified) only changes through the edge functions (service key).
create function guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if old.id is distinct from auth.uid() then
    raise exception 'Cannot edit another profile';
  end if;
  new.is_admin := old.is_admin;
  new.is_head := old.is_head;
  new.is_mod := old.is_mod;
  new.timed_out := old.timed_out;
  new.verified_at := old.verified_at;
  new.mc_username := old.mc_username;
  new.discord_username := old.discord_username;
  new.created_at := old.created_at;
  return new;
end $$;

create trigger profiles_guard before update on profiles for each row execute function guard_profile();

create function kill_sessions(uid uuid) returns void language sql security definer set search_path = public as $$
  delete from auth.sessions where user_id = uid;
$$;
revoke all on function kill_sessions(uuid) from public, anon, authenticated;
grant execute on function kill_sessions(uuid) to service_role;

-- ---------- image uploads (comment pictures + profile pictures)
-- Verified accounts only, 1 MB max, images only, each person can only write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "verified upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_verified()
    and (storage.foldername(name))[1] in ('comments', 'avatars', 'shops')
    and (storage.foldername(name))[2] = auth.uid()::text);
create policy "replace own images" on storage.objects for update to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[2] = auth.uid()::text and public.is_verified())
  with check (bucket_id = 'uploads' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------- market: prices that ignore outliers, and their history
-- What counts as money, in diamonds per 1 item (keep in sync with CURRENCY in app.js).
create table market_currency (item text primary key, diamonds numeric not null check (diamonds > 0));
insert into market_currency values ('diamond', 1);
-- Existing DBs that still have iron: delete from market_currency where item = 'iron ingot';
alter table market_currency enable row level security;
create policy "read currency" on market_currency for select using (true);

create function unit_mult(u text) returns numeric language sql immutable as $$
  select case u when 'ci' then 64 when 'cs' then 4096 else 1 end::numeric;   -- keep in sync with UNIT_MULT in app.js
$$;

-- Right now: for every item and side (sell = what shops charge, buy = what shops pay),
-- the typical price in diamonds per item.
--  * every shop counts ONCE per item (its own median), so nobody can skew it by listing 20 times
--  * prices far outside the crowd are dropped, so one 100-diamond bread can't move a 20-diamond market
create function market_now()
returns table (item text, side text, median numeric, low numeric, high numeric, n int, outliers int)
language sql stable security definer set search_path = public as $$
  with live as (
    select l.*, s.id as sid from listings l
    join shops s on s.id = l.shop_id
    join profiles p on p.id = s.owner_id
    where l.in_stock and not l.timed_out and not s.timed_out and not s.archived and s.is_open and not p.timed_out
  ),
  raw as (
    select l.sell_item as item, 'sell'::text as side, l.sid,
           (l.want_amount * unit_mult(l.want_unit) * c.diamonds) / (l.sell_amount * unit_mult(l.sell_unit)) as rate
    from live l join market_currency c on c.item = l.want_item
    where l.sell_item not in (select mc.item from market_currency mc)
    union all
    select l.want_item, 'buy', l.sid,
           (l.sell_amount * unit_mult(l.sell_unit) * c.diamonds) / (l.want_amount * unit_mult(l.want_unit))
    from live l join market_currency c on c.item = l.sell_item
    where l.want_item not in (select mc.item from market_currency mc)
  ),
  per_shop as (
    select item, side, sid, percentile_cont(0.5) within group (order by rate) as rate
    from raw group by item, side, sid
  ),
  q as (
    select item, side,
           percentile_cont(0.25) within group (order by rate) as q1,
           percentile_cont(0.5)  within group (order by rate) as med,
           percentile_cont(0.75) within group (order by rate) as q3,
           count(*) as total
    from per_shop group by item, side
  ),
  kept as (
    select p.item, p.side, p.rate, q.total from per_shop p join q using (item, side)
    where p.rate between q.q1 - greatest(1.5 * (q.q3 - q.q1), 0.3 * q.med)
                     and q.q3 + greatest(1.5 * (q.q3 - q.q1), 0.3 * q.med)
  )
  select item, side,
         (percentile_cont(0.5) within group (order by rate))::numeric,
         min(rate)::numeric, max(rate)::numeric,
         count(*)::int, (max(total) - count(*))::int
  from kept group by item, side;
$$;

create table market_history (
  day date not null,
  item text not null,
  side text not null check (side in ('sell', 'buy')),
  median numeric not null,
  low numeric not null,
  high numeric not null,
  n int not null,
  updated_at timestamptz not null default now(),
  primary key (day, item, side)
);
create index on market_history (item, day);
alter table market_history enable row level security;
create policy "read market history" on market_history for select using (true);   -- nobody can write directly

-- Nightly stock-honesty scores per shop (same formula as honestyInfo in app.js)
create table shop_honesty_history (
  day date not null,
  shop_id bigint not null references shops(id) on delete cascade,
  score int not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (day, shop_id)
);
create index on shop_honesty_history (shop_id, day);
alter table shop_honesty_history enable row level security;
create policy "read shop honesty history" on shop_honesty_history for select using (true);

-- Saves today's prices + honesty scores. Safe to call by anyone: it takes no input, only writes today's rows,
-- and does nothing if it already ran in the last 30 minutes. The market page calls it when opened;
-- pg_cron can also call it daily (see market-snapshot.sql).
create function take_market_snapshot() returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from market_history where day = current_date and updated_at > now() - interval '30 minutes') then
    return;
  end if;
  insert into market_history (day, item, side, median, low, high, n)
  select current_date, m.item, m.side, m.median, m.low, m.high, m.n from market_now() m
  on conflict (day, item, side) do update
    set median = excluded.median, low = excluded.low, high = excluded.high, n = excluded.n, updated_at = now();

  insert into shop_honesty_history (day, shop_id, score)
  select current_date, s.id,
    least(100, greatest(0,
      70
      + coalesce(round(20.0 * counted_n / nullif(in_stock_n, 0)), 0)
      - coalesce(round(35.0 * quiet_n / nullif(in_stock_n, 0)), 0)
      + coalesce(round(15.0 * fresh_n / nullif(in_stock_n, 0)), 0)
    ))::int
  from shops s
  join lateral (
    select
      count(*) filter (where not l.timed_out and l.in_stock and (l.stock is distinct from 0)) as in_stock_n,
      count(*) filter (where not l.timed_out and l.in_stock and (l.stock is distinct from 0) and l.stock is not null and l.stock > 0) as counted_n,
      count(*) filter (where not l.timed_out and l.in_stock and (l.stock is distinct from 0) and l.updated_at <= now() - interval '14 days') as quiet_n,
      count(*) filter (where not l.timed_out and l.in_stock and (l.stock is distinct from 0) and l.updated_at >= now() - interval '3 days') as fresh_n
    from listings l where l.shop_id = s.id
  ) stats on true
  where stats.in_stock_n > 0
  on conflict (day, shop_id) do update
    set score = excluded.score, updated_at = now();
end $$;

grant execute on function market_now() to anon, authenticated;
grant execute on function take_market_snapshot() to anon, authenticated;

-- ---------- sales (owner + head-admin) and notifications
create table admin_sales (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  scope text not null check (scope in ('server', 'nation')),
  nation text check (nation is null or char_length(nation) between 1 and 60),
  percent_off numeric check (percent_off is null or (percent_off > 0 and percent_off < 100)),
  label text check (label is null or char_length(label) <= 40),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (scope <> 'nation' or nation is not null)
);
alter table admin_sales enable row level security;
create policy "read admin sales" on admin_sales for select using (true);
create policy "head insert admin sales" on admin_sales for insert with check (is_head());
create policy "head update admin sales" on admin_sales for update using (is_head());
create policy "head delete admin sales" on admin_sales for delete using (is_head());

alter table shops
  add constraint shops_sale_admin_id_fkey
  foreign key (sale_admin_id) references admin_sales(id) on delete set null;

create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 40),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "read own notifications" on notifications for select using (user_id = auth.uid());
create policy "update own notifications" on notifications for update
  using (user_id = auth.uid() and not is_timed_out());
-- Head (and mock) can broadcast; on Supabase prefer service role / edge for mass insert.
create policy "head insert notifications" on notifications for insert with check (is_head());
create policy "delete own notifications" on notifications for delete using (user_id = auth.uid());

-- If you already ran an older setup.sql, run these upgrades:
-- alter table profiles add column if not exists last_seen_at timestamptz;
-- alter table profiles add column if not exists highlight_color text check (highlight_color is null or highlight_color ~ '^#[0-9A-Fa-f]{6}$');
-- alter table profiles add column if not exists alerts_enabled boolean not null default true;
-- alter table profiles add column if not exists pronouns text check (pronouns is null or char_length(pronouns) <= 40);
-- alter table profiles add column if not exists timezone text check (timezone is null or char_length(timezone) <= 60);
-- alter table profiles add column if not exists timed_out_until timestamptz;
-- alter table shops add column if not exists timed_out_until timestamptz;
-- alter table listings add column if not exists timed_out_until timestamptz;
-- alter table comments add column if not exists timed_out_until timestamptz;
-- alter table reviews add column if not exists timed_out_until timestamptz;
-- alter table reviews add column if not exists owner_reply text check (owner_reply is null or char_length(owner_reply) <= 500);
-- alter table reviews add column if not exists owner_reply_at timestamptz;
-- recreate still_timed_out() + is_admin/is_head/is_mod/is_staff/is_timed_out/is_verified/account_ok from above;
-- drop/recreate read shops/listings/comments/reviews policies to use still_timed_out;
-- drop policy if exists "update review" on reviews;
-- create policy "update review" on reviews for update using (
--   is_admin() or is_mod() or (author_id = auth.uid() and not is_timed_out()) or (owns_shop(shop_id) and not is_timed_out())
-- );
-- recreate guard_shop_owner_transfer / guard_review_reply triggers from above if missing.
-- alter table profiles drop column if exists banner;
-- alter table profiles drop column if exists banner_path;
-- alter table shops add column if not exists hours text check (char_length(hours) <= 200);
-- alter table shops add column if not exists find_note text check (char_length(find_note) <= 120);
-- alter table shops add column if not exists transit_note text check (char_length(transit_note) <= 120);
-- alter table shops add column if not exists nation text;
-- alter table shops drop column if exists banner_path;
-- alter table shops add column if not exists archived boolean not null default false;
-- alter table shops add column if not exists is_open boolean not null default true;
-- alter table shops add column if not exists group_icons jsonb not null default '{}'::jsonb;
-- alter table shops add column if not exists sale_name text;
-- alter table shops add column if not exists sale_percent numeric;
-- alter table shops add column if not exists sale_label text;
-- alter table shops add column if not exists sale_starts_at timestamptz;
-- alter table shops add column if not exists sale_ends_at timestamptz;
-- alter table shops add column if not exists sale_active boolean not null default false;
-- alter table shops add column if not exists sale_admin_id bigint;
-- alter table listings add column if not exists stock int check (stock is null or stock >= 0);
-- alter table listings add column if not exists sort_order int not null default 0;
-- alter table listings add column if not exists group_name text check (group_name is null or char_length(group_name) <= 60);
-- alter table listings add column if not exists sale_orig_want_amount int;
-- alter table listings add column if not exists stale_acked_at timestamptz;
-- alter table listings add column if not exists price_alert_acked_at timestamptz;
-- Batch 2 only (alerts + settings):
--   alter table profiles add column if not exists alerts_enabled boolean not null default true;
--   alter table listings add column if not exists stale_acked_at timestamptz;
--   alter table listings add column if not exists price_alert_acked_at timestamptz;
-- alter table reports add column if not exists reason_category text check (reason_category is null or reason_category in ('inappropriate', 'duplicate', 'false_advertising', 'other'));
-- alter table reviews add column if not exists traded boolean not null default false;
-- then create watches + follows + place_follows + admin_sales + notifications tables from above if missing.
-- create tip_votes / shop_honesty_history from above if missing;
-- create policy "staff clear tip votes" on tip_votes for delete using (is_admin() or is_mod());
-- drop policy if exists "read shops" on shops;
-- create policy "read shops" on shops for select using (
--   (not timed_out and not archived and is_open and account_ok(owner_id)) or owner_id = auth.uid() or is_staff()
-- );
-- recreate market_now() / take_market_snapshot() to ignore archived shops and write shop_honesty_history.

-- AFTER you create your own account in Authentication > Users, run this once
-- (swap in your user id and name):
-- insert into profiles (id, mc_username, is_admin, is_head, verified_at)
-- values ('YOUR-USER-UUID', 'YourMCName', true, true, now());
