// ──────────────────────────────────────────────────────────────────────────
//  EV Charging Booking — configuration
//  Fill in the three values below, then save. See SETUP.md for how to get them.
// ──────────────────────────────────────────────────────────────────────────
window.EV_CONFIG = {
  // From Supabase: Project Settings → Data API (or API) → Project URL
  SUPABASE_URL: "https://zkmmazyybabztqvvefpe.supabase.co",

  // From Supabase: Project Settings → API Keys → "anon" / "public" key.
  // This key is SAFE to expose in a static site — that's what it's designed for.
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbW1henl5YmFienRxdnZlZnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTE0NTYsImV4cCI6MjA5NzM2NzQ1Nn0.6mf7pllca8KlAhbm7qXs-nlPbRwFvAQhlWxjgQ4-wtA",

  // Passcode the facilities team types to open the admin panel.
  // NOTE: this is light-touch protection for an internal tool only — anyone who
  // views the page source can read it. Fine for v1; do not rely on it for secrets.
  ADMIN_PASSCODE: "porsche911"
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
