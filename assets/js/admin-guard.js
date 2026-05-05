/* TRAQIO — Admin route guard
 * Redirects to dashboard if the authenticated user is not the admin account.
 * Runs after auth-guard.js has verified authentication.
 */
(function checkAdmin() {
  const ADMIN_EMAIL = "traqio.web@gmail.com";
  const u = window.Traqio?.user;

  if (!u) {
    // Auth hasn't resolved yet — re-check when it does
    document.addEventListener("traqio:auth-ready", checkAdmin, { once: true });
    return;
  }

  if (u.email !== ADMIN_EMAIL) {
    window.location.replace("dashboard.html");
  }
})();
