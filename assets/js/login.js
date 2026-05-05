/* TRAQIO — Login page logic */
(function () {
  const cfg = window.TRAQIO_CONFIG || {};

  // ── Session check ──────────────────────────────────────
  async function checkExistingSession() {
    if (cfg.DEMO_MODE) return;
    const session = await window.Traqio.supabase.getSession();
    if (session) window.location.replace("dashboard.html");
  }
  checkExistingSession();

  // ── Google sign-in ─────────────────────────────────────
  const btn = document.getElementById("googleBtn");
  const spinner = document.getElementById("googleSpinner");
  const errBox = document.getElementById("loginError");

  function showError(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.style.display = "block";
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    if (spinner) spinner.style.display = "inline-block";
    if (errBox) errBox.style.display = "none";

    try {
      await window.Traqio.supabase.signInWithGoogle();
    } catch (err) {
      console.error("Sign-in error:", err);
      showError("Gagal masuk. Pastikan koneksi internet aktif dan coba lagi.");
      btn.disabled = false;
      if (spinner) spinner.style.display = "none";
    }
  });

  // ── Legal Modals ───────────────────────────────────────
  const tosModal = document.getElementById("tosModal");
  const ppModal = document.getElementById("ppModal");
  const tosLink = document.getElementById("tosLink");
  const ppLink = document.getElementById("ppLink");

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    // Focus trap: focus first focusable element
    const focusable = modal.querySelector("button, a");
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  // Open modals
  tosLink &&
    tosLink.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(tosModal);
    });

  ppLink &&
    ppLink.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(ppModal);
    });

  // Close via [data-close] buttons (X button + "I Understand")
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      closeModal(document.getElementById(id));
    });
  });

  // Close on backdrop click
  [tosModal, ppModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(tosModal);
      closeModal(ppModal);
    }
  });
})();
