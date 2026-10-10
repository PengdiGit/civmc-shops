-- OPTIONAL but recommended: delete unverified accounts 24 hours after signup, automatically.
-- Run this on its own, AFTER setup.sql. It needs the pg_cron extension
-- (Supabase dashboard > Database > Extensions > turn on "pg_cron" first).
-- The signup + review-signup functions also clean up expired accounts whenever they run,
-- so this is a safety net that makes it exact.
select cron.schedule(
  'purge-unverified-accounts',
  '*/15 * * * *',
  $$
    delete from auth.users u
    using public.profiles p
    where p.id = u.id
      and p.verified_at is null
      and not p.is_admin and not p.is_mod and not p.is_head
      and p.created_at < now() - interval '24 hours'
  $$
);
