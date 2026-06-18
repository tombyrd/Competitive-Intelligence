# EV Charging Booking — Setup

An internal tool for IFS Staines staff to book one of two EV charging bays in 2-hour
slots. Bookings start as **Pending**; facilities **Approve** or **Reject** them. Approved
slots are blocked for everyone else.

- **`index.html`** — staff booking form (mobile-first)
- **`admin.html`** — facilities panel (passcode-gated)
- **`config.js`** — your Supabase keys, admin passcode, and the slot list
- All data lives in a free **Supabase** database, so bookings sync across every device.

---

## One-time setup (~5 minutes)

### 1. Create a free Supabase project
1. Go to <https://supabase.com> → sign in → **New project**.
2. Name it (e.g. `ev-charging-staines`), set a database password, pick the closest region
   (e.g. London / `eu-west-2`), and create it. Wait ~1 min for it to provision.

### 2. Create the bookings table
In the project, open **SQL Editor** → **New query**, paste the block below, and click **Run**:

```sql
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

-- Safety net: only ONE approved booking per bay + date + slot (prevents double-booking).
create unique index if not exists uniq_approved_slot
  on bookings (bay, date, slot)
  where status = 'approved';

-- Row Level Security: open access for this internal v1 tool (see security note below).
alter table bookings enable row level security;

create policy "read"   on bookings for select using (true);
create policy "insert" on bookings for insert with check (true);
create policy "update" on bookings for update using (true) with check (true);
```

### 3. Copy your two keys into `config.js`
In Supabase: **Project Settings** → **API**.
- **Project URL** → paste into `SUPABASE_URL`
- **`anon` `public`** key → paste into `SUPABASE_ANON_KEY`

Then set `ADMIN_PASSCODE` to whatever you want facilities to type. Save `config.js`.

That's it — open `index.html` and submit a test booking, then open `admin.html`,
enter the passcode, and approve it.

---

## Running it

**Locally:** because the browser blocks `fetch` from `file://`, serve the folder over HTTP:
```bash
# from inside the ev-booking folder
python -m http.server 8000
# then open http://localhost:8000
```

**Deploy (recommended — GitHub Pages):** this folder is already in your
`Competitive-Intelligence` repo. After you push, it will be live at:
```
https://tombyrd.github.io/Competitive-Intelligence/ev-booking/
```
Send staff that link to book; send facilities `…/ev-booking/admin.html`.
Works on phones and in the Claude desktop app browser alike — it's just a website.

---

## How it works

- **Slots:** six 2-hour blocks (07:00–19:00), editable in `config.js` (`EV_SLOTS`).
- **Availability:** the form greys out slots already **approved** for that bay+date, plus
  slots that have already passed today. A final check on submit avoids race conditions.
- **Admin:** filter by status, sort by date or submission time, approve/reject. Approved
  bookings lock; rejected ones can be re-approved. The panel auto-refreshes every 30s.

---

## Security note (please read)

This is a **v1 internal tool** with deliberately light security, matching the spec:

- The `anon` key is **meant** to be public in the page — that's normal for Supabase.
- The admin passcode is checked **in the browser**, so a determined person viewing the
  page source could read it and the RLS policies allow anyone to write. That's acceptable
  for a low-stakes internal booking tool, **but do not store anything sensitive here.**
- If you later want real protection, the upgrade path is Supabase Auth (magic-link email
  restricted to `@ifs.com`) + RLS policies that only let authenticated facilities staff
  update rows. Happy to add that as v2.
