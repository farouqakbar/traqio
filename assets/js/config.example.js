/* TRAQIO — Runtime config template
 *
 * 1. Copy this file to config.js (same directory)
 * 2. Fill in your Supabase project values
 * 3. Never commit config.js — it is listed in .gitignore
 *
 * SECURITY: The anon key is intentionally public — it has no elevated
 * privileges. All data access is gated by Row-Level Security (RLS) policies
 * at the database level. Never put your service_role key here.
 */
window.TRAQIO_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY_HERE",

  // Must match Supabase Auth → URL Configuration → Redirect URLs
  AUTH_REDIRECT: "https://YOUR_DOMAIN/pages/dashboard.html",

  // false = use real Supabase; true = use localStorage mock data
  DEMO_MODE: false,
};
