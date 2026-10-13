-- Permanent registry of Minecraft players who triggered an accepted scan ingest.
create table if not exists scan_players (
  player text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  scan_count bigint not null default 1,
  constraint scan_players_player_name check (player ~ '^[A-Za-z0-9_]{1,32}$')
);

alter table scan_players enable row level security;

drop policy if exists "staff read scan players" on scan_players;
create policy "staff read scan players"
on scan_players for select
to authenticated
using ((select is_staff()));

create index if not exists scan_players_last_seen_idx
  on scan_players (last_seen_at desc);

create or replace function upsert_scan_player(p_player text, p_at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player is null or p_player !~ '^[A-Za-z0-9_]{1,32}$' then
    return;
  end if;
  insert into scan_players (player, first_seen_at, last_seen_at, scan_count)
  values (p_player, p_at, p_at, 1)
  on conflict (player) do update set
    last_seen_at = excluded.last_seen_at,
    scan_count = scan_players.scan_count + 1;
end;
$$;

revoke all on function upsert_scan_player(text, timestamptz) from public;
grant execute on function upsert_scan_player(text, timestamptz) to service_role;

insert into scan_players (player, first_seen_at, last_seen_at, scan_count)
select
  player,
  min(created_at),
  max(created_at),
  count(*)::bigint
from scan_ingest_log
where player ~ '^[A-Za-z0-9_]{1,32}$'
group by player
on conflict (player) do update set
  first_seen_at = least(scan_players.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(scan_players.last_seen_at, excluded.last_seen_at),
  scan_count = greatest(scan_players.scan_count, excluded.scan_count);

insert into scan_players (player, first_seen_at, last_seen_at, scan_count)
select
  last_player,
  min(coalesce(updated_at, created_at)),
  max(coalesce(updated_at, created_at)),
  1::bigint
from unknown_listings
where last_player is not null
  and last_player ~ '^[A-Za-z0-9_]{1,32}$'
group by last_player
on conflict (player) do update set
  first_seen_at = least(scan_players.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(scan_players.last_seen_at, excluded.last_seen_at);
