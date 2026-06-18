// Supabase Edge Function: notify-new-booking
// Triggered by a Database Webhook on INSERT into `bookings`.
// Emails every facilities admin (the `admins` table) that a new booking is
// pending approval, with a link to the admin panel.
//
// Required secrets (set in Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   – from resend.com
//   EV_FROM_EMAIL    – e.g. "IFS EV Charging <bookings@yourdomain.com>"
//   EV_ADMIN_URL     – (optional) admin panel URL for the button link
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("EV_FROM_EMAIL") ?? "IFS EV Charging <onboarding@resend.dev>";
const ADMIN_URL = Deno.env.get("EV_ADMIN_URL")
  ?? "https://tombyrd.github.io/Competitive-Intelligence/ev-booking/admin.html";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function adminEmails(): Promise<string[]> {
  const { data, error } = await supabase.from("admins").select("email");
  if (error) throw error;
  return (data ?? []).map((r) => r.email).filter(Boolean);
}

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // DB webhooks send { type, table, record, old_record }
    const b = payload.record ?? payload;
    if (!b || !b.name) return new Response("no booking record", { status: 200 });

    const to = await adminEmails();
    if (!to.length) {
      console.warn("No admins to notify");
      return new Response("no admins", { status: 200 });
    }

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;color:#0f172a">
        <h2 style="color:#8427E2;margin:0 0 4px">New charging booking — pending approval</h2>
        <p style="color:#64748b;margin:0 0 16px">A staff member has requested an EV charging bay.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:6px 0;color:#64748b">Name</td><td style="padding:6px 0;font-weight:600">${esc(b.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Phone</td><td style="padding:6px 0;font-weight:600">${esc(b.phone)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Vehicle</td><td style="padding:6px 0;font-weight:600">${esc(b.reg)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Bay</td><td style="padding:6px 0;font-weight:600">Bay ${esc(b.bay)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Date</td><td style="padding:6px 0;font-weight:600">${esc(b.date)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Time</td><td style="padding:6px 0;font-weight:600">${esc(b.slot)}</td></tr>
        </table>
        <p style="margin:20px 0">
          <a href="${esc(ADMIN_URL)}" style="background:#8427E2;color:#fff;text-decoration:none;
             padding:11px 18px;border-radius:8px;font-weight:600;display:inline-block">Review in admin panel</a>
        </p>
      </div>`;

    await sendEmail(to, `New EV charging booking — ${b.name} (Bay ${b.bay}, ${b.date})`, html);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
