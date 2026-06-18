# EV Charging Booking — Email setup (Resend)

This adds two emails, both sent to everyone in the `admins` table:

1. **New booking → facilities** — sent the moment a staff member submits a request,
   so facilities can review and approve it. (Edge Function `notify-new-booking`,
   fired by a Database Webhook on insert.)
2. **Daily 7am digest** — a list of the day's approved bookings. (Edge Function
   `daily-digest`, fired by a `pg_cron` schedule.)

Both functions live in `supabase/functions/` and send via [Resend](https://resend.com).

---

## Step 1 — Resend account + sender

1. Sign up at <https://resend.com> (free tier ≈ 3,000 emails/month).
2. **Sending address — pick one:**
   - **Verify a domain** (recommended): Resend → **Domains** → add a domain you
     control and add the DNS records it shows. Then you can send from e.g.
     `bookings@yourdomain.com`. This is the only way the emails reliably land in
     `@ifs.com` inboxes rather than spam, so it's worth doing — your IT team can
     add the DNS records if you don't manage them.
   - **Test sender** (quick start): skip domain verification and send from
     `onboarding@resend.dev`. Fine for testing, but corporate mail filters often
     quarantine it — don't rely on it for go-live.
3. **API Keys** → create a key → copy it (starts `re_…`).

## Step 2 — Edge Function secrets

Supabase → **Edge Functions** → **Secrets** (or **Project Settings → Edge Functions**),
add:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | your `re_…` key |
| `EV_FROM_EMAIL`  | `IFS EV Charging <bookings@yourdomain.com>` (or omit to use the test sender) |
| `EV_ADMIN_URL`   | `https://tombyrd.github.io/Competitive-Intelligence/ev-booking/admin.html` (optional) |

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
  within seconds. (Check Resend → **Logs** if not.)
- **Digest:** run it on demand to test without waiting for 7am —
  ```sql
  select net.http_post(
    url := 'https://zkmmazyybabztqvvefpe.functions.supabase.co/daily-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer YOUR-ANON-PUBLIC-KEY'),
    body := '{}'::jsonb);
  ```

---

### Notes
- Emails go to **all** rows in `admins`, so add/remove recipients by editing that table.
- Function logs: Supabase → Edge Functions → pick the function → **Logs**. Delivery
  logs: Resend → **Logs**.
- The free Resend tier is ample here; no card required to start.
