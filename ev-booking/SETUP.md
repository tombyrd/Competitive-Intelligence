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
  The form reads availability from a no-PII view (`public_availability`) — never the raw
  bookings table — so staff names and phone numbers are never sent to the public page.
- **Admin:** filter by status, sort by date or submission time, approve/reject. Approved
  bookings lock; rejected ones can be re-approved. The panel auto-refreshes every 30s.

---

## v2 security — magic-link admin sign-in

v2 closes the v1 exposures: the admin passcode is gone, and the database no longer lets
the public read booking rows (names/phone numbers). Facilities staff now sign in with a
one-time email link, and only **allow-listed** addresses get access.

**One-time setup (~10 min):**

1. **Run the SQL.** In Supabase → **SQL Editor**, paste and run [`v2-security.sql`](v2-security.sql).
   It drops the open v1 policies, adds an `admins` allow-list table, locks reads/updates to
   admins, and creates the `public_availability` view.

2. **Add the admin emails.** Either uncomment the `insert into admins …` block at the bottom
   of `v2-security.sql` and run it, or run it separately, e.g.:
   ```sql
   insert into admins (email) values ('jane.doe@ifs.com') on conflict do nothing;
   ```

3. **Enable email auth + allow the redirect URL.** In Supabase:
   - **Authentication → Providers → Email** — make sure it's **enabled** (it is by default).
   - **Authentication → URL Configuration** — set **Site URL** to
     `https://tombyrd.github.io/Competitive-Intelligence/ev-booking/admin.html` and add the
     same URL under **Redirect URLs**. (Add `http://localhost:8231/ev-booking/admin.html`
     too if you want to test sign-in locally.) **The link won't work until this is set.**

That's it. Open `admin.html`, enter an allow-listed email, click the link in the email, and
you're in. Anyone not on the list is signed straight back out with an "isn't authorised"
message.

**How the protection works**
- **Submit** (insert) is open to everyone, but RLS only permits `status = 'pending'` — no one
  can insert a pre-approved booking to skip review.
- **Read / approve / reject** require a signed-in session whose email is in `admins` (enforced
  in the database via Row Level Security, not just in the browser — so it can't be bypassed by
  editing the page).
- The public form only ever sees `public_availability` (bay/date/slot of approved bookings).

**Notes**
- The `anon` key is still public in the page — that's normal and safe; on its own it now grants
  only "submit a pending booking" and "read approved slot times," nothing more.
- Supabase's built-in email is rate-limited to a few sends per hour, which is plenty for a
  handful of facilities admins. If you ever need more, add custom SMTP in Authentication settings.
- To add/remove an admin later, just `insert`/`delete` rows in the `admins` table.
