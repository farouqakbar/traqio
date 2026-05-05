/* TRAQIO — Route protection
 * Every authenticated page loads this after supabase-client.js.
 * Redirects to login if no valid session exists.
 */
(async function () {
  const cfg = window.TRAQIO_CONFIG || {};

  // Always resolve Traqio.user so page JS can read it safely
  window.Traqio = window.Traqio || {};

  if (cfg.DEMO_MODE) {
    window.Traqio.user = await window.Traqio.supabase.getUser();
    document.dispatchEvent(new CustomEvent("traqio:auth-ready", { detail: window.Traqio.user }));
    return;
  }

  const client = window.Traqio.supabase.getClient();
  if (!client) {
    window.location.replace("login.html");
    return;
  }

  // detectSessionInUrl handles the OAuth callback automatically
  const { data } = await client.auth.getSession();

  if (!data.session) {
    // Not authenticated — send to login
    window.location.replace("login.html");
    return;
  }

  window.Traqio.user = data.session.user;
  document.dispatchEvent(new CustomEvent("traqio:auth-ready", { detail: window.Traqio.user }));

  // Keep session fresh and sign out on SIGNED_OUT event
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.location.replace("login.html");
    }
    if (event === "TOKEN_REFRESHED" && session) {
      window.Traqio.user = session.user;
      document.dispatchEvent(new CustomEvent("traqio:auth-ready", { detail: session.user }));
    }
  });
})();
