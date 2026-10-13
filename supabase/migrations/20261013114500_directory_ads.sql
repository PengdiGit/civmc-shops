create table if not exists directory_ads (
  id bigserial primary key,
  title text not null check (char_length(title) between 1 and 80),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  enabled boolean not null default true,
  priority int not null default 0,
  layout_web jsonb not null default '{"w":420,"h":110,"bg":"#1E211C","elements":[]}'::jsonb,
  layout_mod jsonb not null default '{"w":280,"h":70,"bg":"#1E211C","elements":[]}'::jsonb,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint directory_ads_dates check (ends_at > starts_at),
  constraint directory_ads_web_doc check (jsonb_typeof(layout_web) = 'object'),
  constraint directory_ads_mod_doc check (jsonb_typeof(layout_mod) = 'object')
);

alter table directory_ads enable row level security;

drop policy if exists "read active directory ads" on directory_ads;
create policy "read active directory ads"
on directory_ads for select
to anon, authenticated
using (
  (enabled and starts_at <= now() and ends_at > now())
  or (select is_head())
);

drop policy if exists "head insert directory ads" on directory_ads;
create policy "head insert directory ads"
on directory_ads for insert
to authenticated
with check ((select is_head()));

drop policy if exists "head update directory ads" on directory_ads;
create policy "head update directory ads"
on directory_ads for update
to authenticated
using ((select is_head()))
with check ((select is_head()));

drop policy if exists "head delete directory ads" on directory_ads;
create policy "head delete directory ads"
on directory_ads for delete
to authenticated
using ((select is_head()));

create index if not exists directory_ads_active_idx
on directory_ads (enabled, starts_at, ends_at, priority desc, created_at desc);

create index if not exists directory_ads_created_by_idx
on directory_ads (created_by);

create or replace function set_directory_ads_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists directory_ads_updated_at on directory_ads;
create trigger directory_ads_updated_at
before update on directory_ads
for each row execute function set_directory_ads_updated_at();
