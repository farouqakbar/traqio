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

// ── Auto-scroll sections + progress dots (anime.js) ──────────────────────────
(function () {
  var SECTIONS = [
    { selector: "#top",       label: "Home"      },
    { selector: "#features",  label: "Features"  },
    { selector: "#templates", label: "Showcase"  },
  ];
  var DWELL        = 5000;
  var RESUME_DELAY = 6000;
  var idx      = 0;
  var timer    = null;
  var resumeTimer = null;
  var paused   = false;
  var scrolling = false;

  // ── Build progress dots ──────────────────────────────────────────────────
  var dotsWrap = document.createElement("div");
  dotsWrap.id = "scrollDots";
  dotsWrap.setAttribute("aria-label", "Page sections");
  dotsWrap.setAttribute("role", "navigation");
  SECTIONS.forEach(function (sec, i) {
    var dot = document.createElement("button");
    dot.className = "scroll-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", sec.label);
    dot.setAttribute("title", sec.label);
    dot.dataset.idx = i;
    dotsWrap.appendChild(dot);
  });
  document.body.appendChild(dotsWrap);

  function setActiveDot(i) {
    dotsWrap.querySelectorAll(".scroll-dot").forEach(function (d, j) {
      d.classList.toggle("active", j === i);
    });
  }

  // Dot click → scroll + pause auto-scroll briefly
  dotsWrap.addEventListener("click", function (e) {
    var dot = e.target.closest(".scroll-dot");
    if (!dot) return;
    var i = parseInt(dot.dataset.idx);
    idx = i;
    setActiveDot(i);
    var targetY = getScrollY(SECTIONS[i].selector);
    if (targetY !== null) animateScroll(targetY);
    paused = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () { paused = false; }, RESUME_DELAY);
  });

  // ── Scroll position → active dot sync ───────────────────────────────────
  function syncDotFromScroll() {
    if (scrolling) return;
    var scrollY = window.scrollY;
    var active  = 0;
    SECTIONS.forEach(function (sec, i) {
      if (sec.selector === "#top") return;
      var el = document.querySelector(sec.selector);
      if (el && el.getBoundingClientRect().top + window.scrollY - 100 <= scrollY) {
        active = i;
      }
    });
    idx = active;
    setActiveDot(active);
  }
  window.addEventListener("scroll", syncDotFromScroll, { passive: true });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getScrollY(selector) {
    if (selector === "#top") return 0;
    var el = document.querySelector(selector);
    if (!el) return null;
    return Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64);
  }

  function animateScroll(targetY) {
    if (typeof anime === "undefined") {
      window.scrollTo({ top: targetY, behavior: "smooth" });
      return;
    }
    scrolling = true;
    anime({
      targets: [document.documentElement, document.body],
      scrollTop: targetY,
      duration: 900,
      easing: "easeInOutQuad",
      complete: function () { scrolling = false; }
    });
  }

  function advance() {
    if (paused) return;
    idx = (idx + 1) % SECTIONS.length;
    var targetY = getScrollY(SECTIONS[idx].selector);
    if (targetY === null) return;
    setActiveDot(idx);
    animateScroll(targetY);
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(function () { if (!paused) advance(); }, DWELL);
  }

  function handleManualScroll() {
    if (scrolling) return;
    paused = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () { paused = false; }, RESUME_DELAY);
  }

  // Start after hero is visible
  setTimeout(function () {
    startTimer();
    window.addEventListener("wheel",     handleManualScroll, { passive: true });
    window.addEventListener("touchmove", handleManualScroll, { passive: true });
    window.addEventListener("keydown", function (e) {
      if (["ArrowDown","ArrowUp","PageDown","PageUp","Home","End"," "].includes(e.key)) {
        handleManualScroll();
      }
    });
  }, 2500);
})();
