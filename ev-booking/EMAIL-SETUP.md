# EV Charging Booking — Email setup (Gmail)

This adds two emails, both sent to everyone in the `admins` table:

1. **New booking → facilities** — sent the moment a staff member submits a request,
   so facilities can review and approve it. (Edge Function `notify-new-booking`,
   fired by a Database Webhook on insert.)
2. **Daily 7am digest** — a list of the day's approved bookings. (Edge Function
   `daily-digest`, fired by a `pg_cron` schedule.)

Both functions live in `supabase/functions/` and send through **Gmail SMTP** — no
domain verification or IT involvement needed.

> Emails arrive from a `@gmail.com` address. For an internal tool that's usually fine;
> if you later want them to come from `@ifs.com`, that's a domain-verification job for IT.

---

## Step 1 — Pick a Gmail account + create an App Password

Use a Gmail account to send from. **Tip:** create a dedicated free account (e.g.
`ifs.ev.staines@gmail.com`) rather than a personal one, so it's clearly purpose-made.

1. On that Google account, turn on **2-Step Verification**:
   Google Account → **Security** → **2-Step Verification** → follow the steps.
   (App Passwords are only available once 2FA is on.)
2. Create an **App Password**:
   Google Account → **Security** → **2-Step Verification** → **App passwords**
   (or go to <https://myaccount.google.com/apppasswords>).
   - Name it `EV booking` and create it.
   - Google shows a **16-character password** (like `abcd efgh ijkl mnop`).
     Copy it — **remove the spaces** when you paste it as a secret.

> If the account is a **Google Workspace** account, your Workspace admin may need to
> allow App Passwords. A personal `@gmail.com` account avoids that.

## Step 2 — Edge Function secrets

Supabase → **Edge Functions** → **Secrets** (or **Project Settings → Edge Functions**),
add:

| Name | Value |
|------|-------|
| `GMAIL_USER` | the sending Gmail address, e.g. `ifs.ev.staines@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16-char App Password, **no spaces** |
| `EV_ADMIN_URL` | `https://tombyrd.github.io/Competitive-Intelligence/ev-booking/admin.html` (optional) |

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.)

## Step 3 — Deploy the functions

Easiest with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
# from the ev-booking folder, once:
supabase login
supabase link --project-ref zkmmazyybabztqvvefpe

supabase functions deploy notify-new-booking
supabase functions deploy daily-digest --no-verify-jwt
```

(`--no-verify-jwt` on the digest lets pg_cron call it; `notify-new-booking` keeps
JWT on and the webhook below passes the key.)

No CLI? You can also paste each `index.ts` into **Edge Functions → Create function**
in the dashboard.

## Step 4 — Webhook for the "new booking" email

Supabase → **Database** → **Webhooks** → **Create**:
- **Table:** `bookings`  · **Events:** `Insert`
- **Type:** Supabase Edge Function → `notify-new-booking`
- It adds the auth header for you. Save.

Now every new booking emails facilities.

## Step 5 — Schedule the daily digest

1. Open [`email-setup.sql`](email-setup.sql), replace `YOUR-ANON-PUBLIC-KEY` with your
   project's anon key (the same one in `config.js`), and run it in the SQL Editor.
2. That schedules a 07:00 UTC daily call. (DST note is in the file — tell me if you
   want a fixed 07:00 *UK local* time instead.)

## Step 6 — Test

- **New-booking email:** submit a booking on the form → facilities should get an email
  within seconds.
- **Digest:** run it on demand to test without waiting for 7am —
  ```sql
  select net.http_post(
    url := 'https://zkmmazyybabztqvvefpe.functions.supabase.co/daily-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer YOUR-ANON-PUBLIC-KEY'),
    body := '{}'::jsonb);
  ```
- If an email doesn't arrive: Supabase → Edge Functions → pick the function → **Logs**.
  A Gmail auth error there usually means 2FA isn't on or the App Password has spaces in it.

---

### Notes
- Emails go to **all** rows in `admins`, so add/remove recipients by editing that table.
- Gmail's send limit (~500/day) is far more than this tool will ever use.
- The App Password is stored only as a Supabase secret — it's never in the page source
  or the repo, and you can revoke it anytime from the Google account.
