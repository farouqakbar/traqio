/* TRAQIO — Theme manager
 * Light is default. Persists choice in localStorage.
 * Apply theme as early as possible (inline <script> in <head>) to avoid FOUC.
 */
(function () {
  const KEY = "traqio:theme";

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function get() {
    try { return localStorage.getItem(KEY) || "light"; } catch { return "light"; }
  }

  function set(theme) {
    try { localStorage.setItem(KEY, theme); } catch {}
    apply(theme);
  }

  function toggle() {
    set(get() === "dark" ? "light" : "dark");
  }

  // Apply immediately
  apply(get());

  // Wire up any [data-theme-toggle] buttons after DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.addEventListener("click", toggle);
    });
  });

  window.Traqio = window.Traqio || {};
  window.Traqio.theme = { get, set, toggle };
})();
