-- Head admin only: scan contributor registry (see Admin panel).
drop policy if exists "staff read scan players" on scan_players;
drop policy if exists "head read scan players" on scan_players;
create policy "head read scan players"
on scan_players for select
to authenticated
using ((select is_head()));
