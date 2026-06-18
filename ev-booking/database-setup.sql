-- ════════════════════════════════════════════════════════════════════════
--  EV Charging Booking — COMPLETE database setup (v1 schema + v2 security)
--  Run this whole file in the Supabase SQL Editor. It is safe to run more
--  than once: it never drops the bookings table or deletes data, and every
--  statement is guarded (if exists / if not exists / or replace).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Bookings table ─────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

create table if not exists bookings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  bay         smallint not null check (bay in (1, 2)),
  date        date not null,
  slot        text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

-- Safety net: only ONE approved booking per bay + date + slot (no double-booking).
create unique index if not exists uniq_approved_slot
  on bookings (bay, date, slot)
  where status = 'approved';

alter table bookings enable row level security;

-- 2. Clean slate on policies (so this file is re-runnable) ───────────────────
-- Old wide-open v1 policies:
drop policy if exists "read"   on bookings;
drop policy if exists "insert" on bookings;
drop policy if exists "update" on bookings;
-- v2 policies (in case this is a re-run):
drop policy if exists "public can submit pending" on bookings;
drop policy if exists "admins read all"           on bookings;
drop policy if exists "admins update"             on bookings;

-- 3. Admin allow-list ───────────────────────────────────────────────────────
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

-- 4. Booking access rules (Row Level Security) ──────────────────────────────
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

-- 5. No-PII availability view for the public booking form ────────────────────
-- Exposes ONLY bay/date/slot of approved bookings — never names or phones.
create or replace view public_availability as
  select bay, date, slot from bookings where status = 'approved';

grant select on public_availability to anon, authenticated;

-- 6. Add your facilities admins ──────────────────────────────────────────────
-- One row per person; emails are matched case-insensitively at sign-in.
-- Uncomment and edit, or run separately once Claude gives you the line.
--
-- insert into admins (email) values
--   ('facilities.one@ifs.com'),
--   ('facilities.two@ifs.com')
-- on conflict (email) do nothing;

-- 7. Tell PostgREST to pick up the new view/policies immediately ─────────────
notify pgrst, 'reload schema';
