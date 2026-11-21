-- Track successful owner/customer notification, allowing safe Stripe webhook retries.
alter table public.rental_bookings
  add column if not exists notification_sent_at timestamptz;
