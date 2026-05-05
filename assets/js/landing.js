/* TRAQIO — Landing page interactions */
(function () {
  // ── Smooth-scroll (skip #preview agar tidak scroll, tapi buka modal) ──
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#preview") return; // biarkan modal handler yang tangani
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ── Reveal-on-scroll ──
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.style.opacity = "1";
            en.target.style.transform = "translateY(0)";
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    document.querySelectorAll(".feature-card, .template-card").forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = "opacity .5s ease, transform .5s ease";
      io.observe(el);
    });
  }

  // ── Hamburger mobile menu ──
  var btn = document.getElementById("navHamburger");
  var menu = document.getElementById("navMobileMenu");
  if (btn && menu) {
    btn.addEventListener("click", function () {
      var isOpen = menu.classList.toggle("open");
      btn.classList.toggle("open", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
        btn.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ── Video modal ──
  var modal = document.getElementById("videoModal");
  var video = document.getElementById("heroVideo");
  var backdrop = document.getElementById("videoModalBackdrop");
  var closeBtn = document.getElementById("videoModalClose");

  function openModal() {
    if (!modal || !video) return;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    video.play();
  }

  function closeModal() {
    if (!modal || !video) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    video.pause();
    video.currentTime = 0;
  }

  // Tombol "See Traqio in Action"
  document.querySelectorAll('a[href="#preview"]').forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);

  // Tutup dengan tombol Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
})();
