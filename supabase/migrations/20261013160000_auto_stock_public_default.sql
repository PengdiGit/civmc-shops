-- Auto stock: any shop owner may toggle; default on for new and existing shops.

drop trigger if exists trg_guard_shop_auto_stock on public.shops;
drop function if exists public.guard_shop_auto_stock();

alter table public.shops
  alter column auto_stock_enabled set default true;

update public.shops
set auto_stock_enabled = true
where auto_stock_enabled is not true;
