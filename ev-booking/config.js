// ──────────────────────────────────────────────────────────────────────────
//  EV Charging Booking — configuration
//  See SETUP.md for how to get these values.
//  v2: admin access is now controlled by the Supabase `admins` allowlist +
//  magic-link sign-in — there is no longer a passcode here to leak.
// ──────────────────────────────────────────────────────────────────────────
window.EV_CONFIG = {
  // From Supabase: Project Settings → Data API (or API) → Project URL
  SUPABASE_URL: "https://zkmmazyybabztqvvefpe.supabase.co",

  // From Supabase: Project Settings → API Keys → "anon" / "public" key.
  // This key is SAFE to expose in a static site — that's what it's designed for.
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbW1henl5YmFienRxdnZlZnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTE0NTYsImV4cCI6MjA5NzM2NzQ1Nn0.6mf7pllca8KlAhbm7qXs-nlPbRwFvAQhlWxjgQ4-wtA"
};

// The six bookable 2-hour slots. Edit here if working hours change.
window.EV_SLOTS = [
  "07:00 – 09:00",
  "09:00 – 11:00",
  "11:00 – 13:00",
  "13:00 – 15:00",
  "15:00 – 17:00",
  "17:00 – 19:00"
];
