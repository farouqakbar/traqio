/* TRAQIO — Runtime config
 *
 * SECURITY: The anon key is intentionally public — it has no elevated
 * privileges. All data access is gated by Row-Level Security (RLS) policies
 * at the database level. Never put your service_role key here.
 *
 * DEPLOYMENT: Add config.js to .gitignore before committing to a public repo.
 * Copy config.example.js and fill in your own values.
 */
window.TRAQIO_CONFIG = {
  SUPABASE_URL: "https://krmmubjkmrsggpqjnvrm.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_w3E8-kjDmnyD6sxs3r-cXg_gRVanPne",

  // Must match Supabase Auth → URL Configuration → Redirect URLs
  AUTH_REDIRECT: "https://farouqakbar.github.io/traqio/pages/dashboard.html",

  // false = use real Supabase; true = use localStorage mock data
  DEMO_MODE: false,
};

// Startup validation — warns in console if credentials look unset
(function () {
  const c = window.TRAQIO_CONFIG;
  if (!c.DEMO_MODE && (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY)) {
    console.warn("[Traqio] SUPABASE_URL or SUPABASE_ANON_KEY is missing. Set DEMO_MODE: true or fill in your credentials.");
  }
})();
