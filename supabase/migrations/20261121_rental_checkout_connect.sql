-- MeinAuftrag24 rental marketplace. Existing subscription tables and Stripe subscription handlers stay untouched.
create extension if not exists btree_gist with schema extensions;

create table if not exists public.rental_payout_accounts (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rental_payout_accounts enable row level security;
revoke all on public.rental_payout_accounts from anon, authenticated;

create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.rental_vehicles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  customer_name text not null check (length(customer_name) between 2 and 120),
  customer_email text not null check (length(customer_email) between 5 and 254),
  customer_phone text,
  date_from date not null,
  date_to date not null,
  days integer not null check(days between 1 and 90),
  daily_rate_cents bigint not null check(daily_rate_cents > 0),
  total_cents bigint not null check(total_cents > 0),
  commission_cents bigint not null check(commission_cents >= 0),
  owner_cents bigint not null check(owner_cents >= 0),
  currency text not null default 'chf' check (currency = 'chf'),
  status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','expired','failed','canceled','refunded')),
  expires_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_booking_dates check (date_to > date_from),
  constraint rental_booking_split check (commission_cents + owner_cents = total_cents),
  constraint rental_booking_commission_10pct check (commission_cents = (total_cents + 5) / 10)
);

-- A database-enforced constraint, not a frontend-only overlap check.
alter table public.rental_bookings
  add constraint rental_no_overlapping_active_bookings
  exclude using gist (
    vehicle_id with =,
    daterange(date_from, date_to, '[)') with &&
  ) where (status in ('pending_payment','confirmed'));

create index if not exists rental_bookings_provider_created_idx
  on public.rental_bookings(provider_id,created_at desc);
create index if not exists rental_bookings_expiry_idx
  on public.rental_bookings(expires_at)
  where status = 'pending_payment';

alter table public.rental_bookings enable row level security;
revoke all on public.rental_bookings from anon, authenticated;
grant select on public.rental_bookings to authenticated;
create policy rental_bookings_provider_read
  on public.rental_bookings for select to authenticated
  using (provider_id = (select auth.uid()));

-- Only service-role Edge Functions may create bookings or change their financial status.
create or replace function public.rental_reserve_booking(
  p_vehicle_id uuid,
  p_date_from date,
  p_date_to date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default null
)
returns table(booking_id uuid, provider_id uuid, vehicle_title text,
              total_cents bigint, commission_cents bigint, owner_cents bigint)
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  v public.rental_vehicles%rowtype;
  v_daily_cents bigint;
  v_days integer;
  v_total bigint;
  v_fee bigint;
  v_id uuid;
begin
  if p_date_from is null or p_date_to is null or p_date_from < current_date
     or p_date_to <= p_date_from or p_date_to > p_date_from + 90 then
    raise exception 'Ungültiger Mietzeitraum' using errcode='22023';
  end if;
  if length(trim(coalesce(p_customer_name,''))) not between 2 and 120
     or length(trim(coalesce(p_customer_email,''))) not between 5 and 254
     or position('@' in p_customer_email) < 2
     or length(coalesce(p_customer_phone,'')) > 50 then
    raise exception 'Ungültige Kontaktdaten' using errcode='22023';
  end if;

  -- Expiration is longer than the 30-minute Stripe Checkout session.
  update public.rental_bookings
     set status='expired',updated_at=now()
   where status='pending_payment' and expires_at < now();

  select * into v from public.rental_vehicles
    where id=p_vehicle_id and is_active=true for share;
  if not found then raise exception 'Fahrzeug nicht verfügbar' using errcode='22023'; end if;
  if (v.available_from is not null and p_date_from < v.available_from)
     or (v.available_to is not null and p_date_to > v.available_to) then
    raise exception 'Ausgewählte Daten ausserhalb der Verfügbarkeit' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.subscriptions s where s.provider_id=v.provider_id
       and s.status::text='active' and s.plan::text in ('basic','pro')
       and (s.current_period_end is null or s.current_period_end > now())
  ) then raise exception 'Vermieter hat kein aktives Abo' using errcode='22023'; end if;
  if not exists (
    select 1 from public.rental_payout_accounts a where a.provider_id=v.provider_id
      and a.payouts_enabled=true and a.stripe_account_id is not null
  ) then raise exception 'Vermieter muss sein Auszahlungskonto einrichten' using errcode='22023'; end if;
  v_days := p_date_to - p_date_from;
  v_daily_cents := round(v.daily_rate * 100)::bigint;
  if v_daily_cents < 50 then raise exception 'Ungültiger Mietpreis' using errcode='22023'; end if;
  v_total := v_days::bigint * v_daily_cents;
  v_fee := (v_total + 5) / 10;

  insert into public.rental_bookings (
    vehicle_id,provider_id,customer_name,customer_email,customer_phone,
    date_from,date_to,days,daily_rate_cents,total_cents,commission_cents,
    owner_cents,status,expires_at
  ) values (
    v.id,v.provider_id,trim(p_customer_name),lower(trim(p_customer_email)),
    nullif(trim(coalesce(p_customer_phone,'')),''),
    p_date_from,p_date_to,v_days,v_daily_cents,v_total,v_fee,
    v_total-v_fee,'pending_payment', now()+interval '35 minutes'
  ) returning id into v_id;

  return query select v_id,v.provider_id,v.title,v_total,v_fee,v_total-v_fee;
exception
  when exclusion_violation then
    raise exception 'Dieses Fahrzeug ist im gewählten Zeitraum schon reserviert'
      using errcode='22023';
end $$;

revoke all on function public.rental_reserve_booking(uuid,date,date,text,text,text)
  from public, anon, authenticated;
grant execute on function public.rental_reserve_booking(uuid,date,date,text,text,text)
  to service_role;
