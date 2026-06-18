// Supabase Edge Function: daily-digest
// Triggered by pg_cron at 07:00 UTC daily (see email-setup.sql).
// Emails every facilities admin the list of bookings for today. Sends via Gmail SMTP.
//
// Required secrets (same as notify-new-booking):
//   GMAIL_USER, GMAIL_APP_PASSWORD, EV_ADMIN_URL (optional)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER")!;
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;
const FROM = `IFS EV Charging <${GMAIL_USER}>`;
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
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });
  try {
    await client.send({ from: FROM, to, subject, html, content: "auto" });
  } finally {
    await client.close();
  }
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

Deno.serve(async () => {
  try {
    // Cron runs at 07:00 UTC, so "today" in UTC is the UK working day.
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", today)
      .eq("status", "approved")
      .order("bay", { ascending: true })
      .order("slot", { ascending: true });
    if (error) throw error;

    const to = await adminEmails();
    if (!to.length) {
      console.warn("No admins to email");
      return new Response("no admins", { status: 200 });
    }

    const rows = (data ?? []).map((b) => `
      <tr>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0">Bay ${esc(b.bay)}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0">${esc(b.slot)}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0">${esc(b.name)}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0">${esc(b.reg)}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0">${esc(b.phone)}</td>
      </tr>`).join("");

    const body = (data && data.length)
      ? `<table style="border-collapse:collapse;width:100%;font-size:14px">
           <thead><tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase">
             <th style="padding:6px 10px">Bay</th><th style="padding:6px 10px">Time</th>
             <th style="padding:6px 10px">Name</th><th style="padding:6px 10px">Vehicle</th>
             <th style="padding:6px 10px">Phone</th>
           </tr></thead><tbody>${rows}</tbody>
         </table>`
      : `<p style="color:#64748b">No approved charging bookings for today.</p>`;

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:620px;color:#0f172a">
        <h2 style="color:#8427E2;margin:0 0 4px">EV charging — today's bookings</h2>
        <p style="color:#64748b;margin:0 0 16px">${esc(today)} · Staines office</p>
        ${body}
        <p style="margin:20px 0 0">
          <a href="${esc(ADMIN_URL)}" style="color:#8427E2;font-weight:600">Open the admin panel →</a>
        </p>
      </div>`;

    await sendEmail(to, `EV charging — bookings for ${today}`, html);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
