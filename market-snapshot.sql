-- OPTIONAL: record market prices + shop honesty scores every day even if nobody opens the Market page.
-- Run on its own after setup.sql, once pg_cron is enabled (Database > Extensions > pg_cron).
-- take_market_snapshot() writes market_history and shop_honesty_history.
select cron.schedule('market-snapshot', '5 0 * * *', $$ select public.take_market_snapshot() $$);
