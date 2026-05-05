/* TRAQIO — Tiny toast helper
 * Usage: Traqio.toast("Saved", "success"), Traqio.toast("Failed", "error")
 * Click toast to dismiss early.
 */
(function () {
  function ensureContainer() {
    let c = document.querySelector(".toast-container");
    if (!c) {
      c = document.createElement("div");
      c.className = "toast-container";
      document.body.appendChild(c);
    }
    return c;
  }

  function dismiss(el) {
    el.style.transition = "opacity .2s ease, transform .2s ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 220);
  }

  function toast(message, type = "default", ms = 2800) {
    const el = document.createElement("div");
    const typeMap = { success: " success", error: " error", info: " info", warning: " warning" };
    el.className = "toast" + (typeMap[type] || "");
    el.textContent = message;
    el.title = "Click to dismiss";
    el.style.cursor = "pointer";
    el.addEventListener("click", () => dismiss(el));
    ensureContainer().appendChild(el);
    setTimeout(() => dismiss(el), ms);
  }

  /* ── Custom confirm dialog ──────────────────────────────
   * Usage: const ok = await window.Traqio.confirm("Delete?", "Delete", "danger")
   */
  function confirmDialog(message, okLabel = "Delete", variant = "danger") {
    return new Promise(resolve => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop open";
      backdrop.style.cssText = "z-index:2000";
      backdrop.innerHTML = `
        <div class="modal" style="max-width:380px" role="alertdialog" aria-modal="true">
          <div class="modal-header"><h3 style="font-size:1rem">Confirm</h3></div>
          <div class="modal-body"><p style="margin:0;color:var(--text-secondary)">${message}</p></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="__cfCancel">Cancel</button>
            <button class="btn btn-${variant}" id="__cfOk">${okLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);
      const close = (val) => { backdrop.remove(); resolve(val); };
      backdrop.querySelector("#__cfOk").onclick  = () => close(true);
      backdrop.querySelector("#__cfCancel").onclick = () => close(false);
      backdrop.addEventListener("click", e => { if (e.target === backdrop) close(false); });
      backdrop.querySelector("#__cfOk").focus();
    });
  }

  window.Traqio = window.Traqio || {};
  window.Traqio.toast    = toast;
  window.Traqio.confirm  = confirmDialog;
})();
