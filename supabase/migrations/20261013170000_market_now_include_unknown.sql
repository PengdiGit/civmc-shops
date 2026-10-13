-- Optional crowd-scanned unknown listings in market_now (default off = shop listings only).
CREATE OR REPLACE FUNCTION public.market_now(include_unknown boolean DEFAULT false)
 RETURNS TABLE(item text, side text, median numeric, low numeric, high numeric, n integer, outliers integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with live as (
    select l.*, s.id as sid from listings l
    join shops s on s.id = l.shop_id
    join profiles p on p.id = s.owner_id
    where l.in_stock and not l.timed_out and not s.timed_out and not s.archived and s.is_open and not p.timed_out
      and l.sell_item !~* '\ybundle\y'
      and l.want_item !~* '\ybundle\y'
      and (l.enchants is null or btrim(l.enchants) = '')
  ),
  unk as (
    select u.*, (-u.id) as sid from unknown_listings u
    where include_unknown
      and coalesce(u.in_stock, true)
      and u.sell_item !~* '\ybundle\y'
      and u.want_item !~* '\ybundle\y'
      and (u.enchants is null or btrim(u.enchants) = '')
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
    union all
    select u.sell_item, 'sell', u.sid,
           (u.want_amount * unit_mult(u.want_unit) * c.diamonds) / (u.sell_amount * unit_mult(u.sell_unit))
    from unk u join market_currency c on c.item = u.want_item
    where u.sell_item not in (select mc.item from market_currency mc)
    union all
    select u.want_item, 'buy', u.sid,
           (u.sell_amount * unit_mult(u.sell_unit) * c.diamonds) / (u.want_amount * unit_mult(u.want_unit))
    from unk u join market_currency c on c.item = u.sell_item
    where u.want_item not in (select mc.item from market_currency mc)
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
$function$;
