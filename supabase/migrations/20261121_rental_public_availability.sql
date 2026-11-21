-- Returns only booked vehicle IDs, never guest identity or pricing.
-- Intentional narrow, read-only public availability API.
create or replace function public.rental_busy_vehicle_ids(
  p_date_from date, p_date_to date
) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct b.vehicle_id
  from public.rental_bookings b
  where p_date_from is not null and p_date_to is not null
    and p_date_to > p_date_from
    and p_date_to <= p_date_from + 90
    and b.date_from < p_date_to and b.date_to > p_date_from
    and (b.status = 'confirmed' or
         (b.status = 'pending_payment' and b.expires_at > now()));
$$;
revoke all on function public.rental_busy_vehicle_ids(date,date) from public;
grant execute on function public.rental_busy_vehicle_ids(date,date) to anon,authenticated,service_role;
