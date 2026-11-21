-- Fix publicly invisible rental listings caused by subscriptions row-level security.
-- Without this helper, an anonymous viewer cannot inspect subscriptions,
-- so the EXISTS clause in rental_vehicles_public_read always evaluates false.
create schema if not exists rental_private;
revoke all on schema rental_private from public;
grant usage on schema rental_private to anon, authenticated;

create or replace function rental_private.has_active_listing_subscription(p_provider_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.provider_id = p_provider_id
      and s.status::text = 'active'
      and s.plan::text in ('basic', 'pro')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;
revoke all on function rental_private.has_active_listing_subscription(uuid) from public;
grant execute on function rental_private.has_active_listing_subscription(uuid)
  to anon, authenticated, service_role;

drop policy if exists rental_vehicles_public_read on public.rental_vehicles;
drop policy if exists rental_vehicles_secure_read on public.rental_vehicles;
create policy rental_vehicles_secure_read on public.rental_vehicles
for select to anon, authenticated
using (
  provider_id = (select auth.uid())
  or (is_active = true and rental_private.has_active_listing_subscription(provider_id))
);
