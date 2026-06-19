// Supabase Edge Function: slot-reminder
// Triggered by pg_cron every minute (see email-setup.sql).
// Emails each booker ~5 minutes before their slot ENDS, reminding them to move
// their car so the next person can charge. Sends via Gmail SMTP.
//
// Required secrets: GMAIL_USER, GMAIL_APP_PASSWORD
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER")!;
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;
const FROM = `IFS EV Charging <${GMAIL_USER}>`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Current date + minutes-into-day in UK local time (handles GMT/BST correctly).
function londonNow(){
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/London", year:"numeric", month:"2-digit", day:"2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/London", hour:"2-digit", minute:"2-digit", hour12:false }).format(now);
  const [h,m] = time.split(":").map(Number);
  return { date, mins: h*60 + m };
}
// End time of a slot as minutes-into-day, e.g. "07:30 – 09:30" -> 570.
function slotEndMins(slot){ const m = String(slot).match(/(\d{1,2}):(\d{2})\s*$/); return m ? (+m[1])*60 + (+m[2]) : null; }

function esc(s){ return String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

async function sendEmail(to, subject, html){
  const client = new SMTPClient({
    connection: { hostname:"smtp.gmail.com", port:465, tls:true, auth:{ username:GMAIL_USER, password:GMAIL_APP_PASSWORD } },
  });
  try { await client.send({ from:FROM, to, subject, html, content:"auto" }); }
  finally { await client.close(); }
}

Deno.serve(async () => {
  try{
    const { date, mins } = londonNow();
    const { data, error } = await supabase.from("bookings")
      .select("id,name,email,bay,slot")
      .eq("date", date).eq("status","approved").eq("reminder_sent", false);
    if(error) throw error;

    let sent = 0;
    for(const b of (data||[])){
      const end = slotEndMins(b.slot);
      if(end == null) continue;
      // Fire in the 5-minute window before the slot ends.
      if(mins >= end - 5 && mins < end){
        if(b.email){
          const html = `
            <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;color:#0f172a">
              <h2 style="color:#8427E2;margin:0 0 6px">Time to move your car 🚗</h2>
              <p style="margin:0 0 12px">Hi ${esc(b.name)}, your charging slot in <strong>Bay ${esc(b.bay)}</strong>
              (<strong>${esc(b.slot)}</strong>) is ending in about 5 minutes.</p>
              <p style="margin:0;color:#64748b">Please move your car so the next person can charge. Thanks!</p>
            </div>`;
          try { await sendEmail([b.email], "Your EV charging slot is ending soon — please move your car", html); }
          catch(e){ console.error("send failed for", b.id, e); continue; /* leave unsent so it retries next minute */ }
        }
        await supabase.from("bookings").update({ reminder_sent:true }).eq("id", b.id);
        sent++;
      }
    }
    return new Response("reminders sent: "+sent);
  }catch(e){
    console.error(e);
    return new Response(String(e), { status:500 });
  }
});
