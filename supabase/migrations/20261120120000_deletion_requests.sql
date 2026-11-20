-- Account / data deletion requests (Settings → Admin accept/deny).
-- Accept deletes the auth user (same cascade path as review-signup deny/delete).
-- Edge function account-deletion uses the service role; clients only read via that function.

create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  username text,
  mc_username text,
  status text not null default 'pending'
    check (status in ('pending', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  constraint deletion_requests_user_unique unique (user_id)
);

create index if not exists deletion_requests_pending_idx
on deletion_requests (created_at)
where status = 'pending';

alter table deletion_requests enable row level security;

-- No direct client writes. Service role (edge functions) bypasses RLS.
drop policy if exists "own read deletion requests" on deletion_requests;
create policy "own read deletion requests"
on deletion_requests for select
to authenticated
using (user_id = auth.uid() or (select is_head()));
