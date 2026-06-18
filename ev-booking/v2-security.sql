-- ════════════════════════════════════════════════════════════════════════
--  EV Charging Booking — v2 security
--  Run this in the Supabase SQL Editor AFTER the original v1 setup SQL.
--  It locks down the database so that:
--    • anyone can still SUBMIT a booking, but only as 'pending'
--    • only allow-listed facilities staff can READ bookings (names/phones)
--      and APPROVE / REJECT them
--    • the public booking form reads availability from a no-PII view
-- ════════════════════════════════════════════════════════════════════════

-- 1. Remove the wide-open v1 policies ───────────────────────────────────────
drop policy if exists "read"   on bookings;
drop policy if exists "insert" on bookings;
drop policy if exists "update" on bookings;

-- 2. Admin allow-list ───────────────────────────────────────────────────────
create table if not exists admins (
  email text primary key
);

alter table admins enable row level security;

-- A signed-in user may read ONLY their own row (so the app can confirm
-- "am I an admin?" without exposing the whole list).
drop policy if exists "see self" on admins;
create policy "see self" on admins
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Helper: is the current signed-in user an allow-listed admin?
-- SECURITY DEFINER lets it read `admins` past that row-level restriction.
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from admins
      where lower(email) = lower(auth.jwt() ->> 'email')
    );
  $$;

-- 3. New booking policies ────────────────────────────────────────────────────
-- Anyone (anon or signed-in) may submit, but only a 'pending' booking —
-- they cannot insert an already-approved row to skip review.
create policy "public can submit pending" on bookings
  for insert to anon, authenticated
  with check (status = 'pending');

-- Only admins can read full booking rows (these contain names + phone numbers).
create policy "admins read all" on bookings
  for select using (is_admin());

-- Only admins can approve / reject.
create policy "admins update" on bookings
  for update using (is_admin()) with check (is_admin());

-- 4. No-PII availability view for the public booking form ────────────────────
-- Exposes ONLY bay/date/slot of approved bookings — never names or phones.
create or replace view public_availability as
  select bay, date, slot from bookings where status = 'approved';

grant select on public_availability to anon, authenticated;

-- 5. Add your facilities admins ──────────────────────────────────────────────
-- One row per person. Emails are matched case-insensitively at sign-in.
-- (Claude will fill these in once you provide them, or add your own here.)
--
-- insert into admins (email) values
--   ('facilities.one@ifs.com'),
--   ('facilities.two@ifs.com')
-- on conflict (email) do nothing;

-- 6. Tell PostgREST to pick up the new view/policies immediately ─────────────
notify pgrst, 'reload schema';
