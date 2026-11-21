-- Public rental photos: only published vehicles with eligible active provider subscription.
-- Keep owner access for managing their own images.
drop policy if exists rental_vehicle_photos_secure_read on public.rental_vehicle_photos;
create policy rental_vehicle_photos_secure_read
on public.rental_vehicle_photos
for select to anon, authenticated
using (
  provider_id = (select auth.uid())
  or exists (
    select 1 from public.rental_vehicles v
    where v.id = rental_vehicle_photos.vehicle_id
      and v.is_active = true
      and rental_private.has_active_listing_subscription(v.provider_id)
  )
);
