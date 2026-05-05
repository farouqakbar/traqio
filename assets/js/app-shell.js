/* TRAQIO — App shell renderer v2
 * · Global profile bar in topbar (avatar pill + dropdown panel)
 * · Real-time timezone-aware clock
 * · Language toggle (cycles en ↔ id)
 * · No user-card in sidebar — profile is fully in topbar
 * · BroadcastChannel badge sync via Traqio.state
 */
(function () {
  function T(k, ...a) {
    return window.Traqio?.i18n?.t(k, ...a) || k;
  }
  function I(n) {
    return window.Traqio?.icons?.render(n) || "";
  }

  const NOTIFICATIONS = [];

  // Clock timers kept in module scope so remounts don't stack
  let _clockTimer = null;
  let _clockAlign = null; // alignment setTimeout before the interval
  let _ctrlKHandler = null; // single keydown handler, replaced on each mount

  /* ── NAV items ─────────────────────────────────────────── */
  function NAV() {
    return [
      {
        key: "dashboard",
        icon: "dashboard",
        href: "dashboard.html",
        label: T("nav_dashboard"),
      },
      {
        key: "applications",
        icon: "briefcase",
        href: "applications.html",
        label: T("nav_applications"),
      },
      {
        key: "skills",
        icon: "target",
        href: "skills.html",
        label: T("nav_skills"),
      },
      { key: "cv", icon: "file", href: "cv.html", label: T("nav_cv") },
    ];
  }

  function appCount() {
    try {
      const apps = window.Traqio?.store?.applications?.list() || [];
      return (
        apps.filter((a) => a.status === "interview" || a.status === "applied")
          .length || ""
      );
    } catch {
      return "";
    }
  }

  function newJobsCount() {
    try {
      const total = parseInt(
        localStorage.getItem("traqio:jobs-total:v1") || "0",
      );
      const seen = parseInt(localStorage.getItem("traqio:jobs-seen:v1") || "0");
      return Math.max(0, total - seen) || "";
    } catch {
      return "";
    }
  }

  /* ── Sidebar ───────────────────────────────────────────── */
  function renderSidebar(active) {
    const items = NAV()
      .map((n) => {
        const badge = n.key === "applications" ? appCount() : "";
        return `
        <a href="${n.href}" class="nav-item ${n.key === active ? "active" : ""}">
          ${I(n.icon)}<span>${n.label}</span>
          ${badge ? `<span class="badge">${badge}</span>` : ""}
        </a>`;
      })
      .join("");

    return `
      <aside class="sidebar" id="sidebar">
        <a href="dashboard.html" class="sidebar-brand">
          <img src="../assets/logo/logokanan.png" class="sidebar-logo sidebar-logo-light" alt="Traqio" />
          <img src="../assets/logo/logodarkmode.png" class="sidebar-logo sidebar-logo-dark" alt="Traqio" />
        </a>
        <nav class="nav-section">
          <div class="section-label">${T("nav_workspace")}</div>
          ${items}
        </nav>
      </aside>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>`;
  }

  /* ── Notification dropdown ─────────────────────────────── */
  function renderNotifDropdown() {
    const unread = NOTIFICATIONS.filter((n) => n.unread).length;
    const items = NOTIFICATIONS.map(
      (n) => `
      <div class="notif-item ${n.unread ? "unread" : ""}">
        <div class="n-ico ${n.color}" style="background:var(--${n.color}-bg);color:var(--${n.color})">${I(n.icon)}</div>
        <div class="n-body">
          <div class="text">${n.text}</div>
          <div class="time">${n.time}</div>
        </div>
      </div>`,
    ).join("");

    const empty = `
      <div style="padding:32px 16px;text-align:center;color:var(--text-muted)">
        <div style="font-size:1.5rem;margin-bottom:8px">🔔</div>
        <div style="font-size:.84rem;font-weight:600;color:var(--text-secondary);margin-bottom:4px">${T("no_notifs")}</div>
        <div style="font-size:.76rem">${T("no_notifs_desc")}</div>
      </div>`;

    return `
      <div class="notif-dropdown" id="notifDropdown">
        <div class="notif-head">
          <h4>${T("notifications")} ${unread > 0 ? `<span class="badge" style="background:var(--danger)">${unread}</span>` : ""}</h4>
          ${unread > 0 ? `<button id="markAllRead">${T("mark_all_read")}</button>` : `<span></span>`}
        </div>
        <div class="notif-list">${items || empty}</div>
        ${NOTIFICATIONS.length > 0 ? `<div class="notif-footer"><a href="dashboard.html">${T("view_all_activity")}</a></div>` : ""}
      </div>`;
  }

  /* ── Profile panel ─────────────────────────────────────── */
  function renderProfilePanel() {
    return `
      <div class="profile-panel" id="profilePanel">
        <div class="profile-panel-head">
          <div class="avatar avatar-lg" id="ppAvatar">?</div>
          <div>
            <div class="profile-panel-name"  id="ppName">—</div>
            <div class="profile-panel-email" id="ppEmail">—</div>
          </div>
        </div>
        <div class="profile-panel-links">
          <a href="profile.html" class="pp-link">${I("user")} ${T("edit_profile")}</a>
          <a href="admin.html" class="pp-link" id="ppAdminLink" style="display:none">${I("settings")} Admin Panel</a>
        </div>
        <div class="profile-panel-footer">
          <button class="btn btn-danger btn-sm" id="ppSignOut" style="width:100%;justify-content:center">
            ${I("logout")} ${T("sign_out")}
          </button>
        </div>
      </div>`;
  }

  /* ── Topbar ────────────────────────────────────────────── */
  function renderTopbar(opts = {}) {
    const ph = opts.searchPlaceholder || T("search_ph");

    return `
      <header class="topbar">
        <a href="dashboard.html" class="topbar-logo">
          <img src="../assets/logo/logokanan.png" class="topbar-logo-light" alt="Traqio" />
          <img src="../assets/logo/logodarkmode.png" class="topbar-logo-dark" alt="Traqio" />
        </a>

        <div class="search">
          ${I("search")}
          <input type="text" id="globalSearch" placeholder="${ph}" autocomplete="off" />
        </div>

        <div class="topbar-right">
          <!-- Clock -->
          <div class="shell-clock" id="shellClock" title="${T("clock_label")}">
            <div class="clock-time">--:--</div>
            <div class="clock-tz">—</div>
          </div>

          <!-- Theme -->
          <button class="theme-toggle topbar-btn" data-theme-toggle title="Toggle theme">
            <span class="icon-sun">${I("sun")}</span>
            <span class="icon-moon">${I("moon")}</span>
          </button>

          <!-- Notifications -->
          <div style="position:relative">
            <button class="topbar-btn" id="notifBtn" title="${T("notifications")}">
              ${I("bell")}
              ${NOTIFICATIONS.some((n) => n.unread) ? `<span class="notif-dot"></span>` : ""}
            </button>
            ${renderNotifDropdown()}
          </div>

          <!-- Profile trigger + panel -->
          <div class="profile-wrap">
            <button class="profile-trigger" id="profileTrigger" aria-expanded="false" aria-haspopup="true">
              <div class="avatar" id="shellAvatar">?</div>
              <span class="profile-trigger-name" id="shellName">—</span>
              <span class="profile-chevron">${I("chevronDown")}</span>
            </button>
            ${renderProfilePanel()}
          </div>
        </div>
      </header>`;
  }

  /* ── Mount ─────────────────────────────────────────────── */
  function mount(active, mainHtml, topbarOpts) {
    const root = document.getElementById("app");
    if (!root) return;

    // Stop any running clock before replacing DOM
    if (_clockAlign) {
      clearTimeout(_clockAlign);
      _clockAlign = null;
    }
    if (_clockTimer) {
      clearInterval(_clockTimer);
      _clockTimer = null;
    }

    root.innerHTML = `
      ${renderSidebar(active)}
      <div class="main">
        ${renderTopbar(topbarOpts)}
        ${mainHtml}
      </div>`;

    // Post-render icon pass
    root.querySelectorAll("[data-icon]").forEach((el) => {
      const svg = window.Traqio?.icons?.render(el.getAttribute("data-icon"));
      if (svg) el.innerHTML = svg;
    });

    populateUser();
    wireNotifications();
    wireProfilePanel();
    wireGlobalSearch(active);
    wireThemeToggle();
    startClock();
    injectBottomNav(active);

    // Badge updates on cross-tab data change
    window.Traqio?.state?.on("store:change", updateBadge);

    // Refresh topbar when profile is saved (same-tab — named ref deduplicates across remounts)
    document.addEventListener("traqio:profile-change", populateUser);

    // Nav label refresh on language switch
    document.addEventListener("traqio:lang-change", updateNavLabels, {
      once: false,
    });
  }

  /* ── User population ───────────────────────────────────── */
  function populateUser() {
    const u = window.Traqio?.user;
    if (!u) {
      // Auth hasn't resolved yet — re-run when it does
      document.addEventListener("traqio:auth-ready", populateUser, {
        once: true,
      });
      return;
    }

    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem("traqio:profile:v1") || "{}");
      } catch {
        return {};
      }
    })();

    // Stored name/avatar take priority over Google OAuth values
    const name =
      stored.name ||
      u.user_metadata?.full_name ||
      u.email?.split("@")[0] ||
      "User";
    const initial = name.charAt(0).toUpperCase();
    const avatarSrc =
      stored.avatarDataUrl || u.user_metadata?.avatar_url || null;
    const avatarHtml = avatarSrc
      ? `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${initial}'">`
      : initial;

    ["shellAvatar", "ppAvatar"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = avatarHtml;
    });

    const shellName = document.getElementById("shellName");
    if (shellName) shellName.textContent = name.split(" ")[0];

    const ppName = document.getElementById("ppName");
    if (ppName) ppName.textContent = name;

    const ppEmail = document.getElementById("ppEmail");
    if (ppEmail) ppEmail.textContent = u.email || "";

    const ppAdminLink = document.getElementById("ppAdminLink");
    if (ppAdminLink)
      ppAdminLink.style.display =
        u.email === "traqio.web@gmail.com" ? "" : "none";
  }

  /* ── Real-time clock ───────────────────────────────────── */
  function startClock() {
    const el = document.getElementById("shellClock");
    if (!el) return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzShort = (() => {
      try {
        const parts = new Intl.DateTimeFormat("en", {
          timeZoneName: "short",
        }).formatToParts(new Date());
        return parts.find((p) => p.type === "timeZoneName")?.value || tz;
      } catch {
        return tz;
      }
    })();

    function tick() {
      const now = new Date();
      const lang = window.Traqio?.i18n?.lang === "id" ? "id-ID" : "en-US";
      const timeStr = now.toLocaleTimeString(lang, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const timeEl = el.querySelector(".clock-time");
      const tzEl = el.querySelector(".clock-tz");
      if (timeEl) timeEl.textContent = timeStr;
      if (tzEl) tzEl.textContent = tzShort;
    }

    tick();
    // Align to the next whole-second boundary to avoid drift
    const msToNextSec = 1000 - (Date.now() % 1000);
    _clockAlign = setTimeout(() => {
      _clockAlign = null;
      tick();
      _clockTimer = setInterval(tick, 1000);
    }, msToNextSec);
  }
  function injectBottomNav(active) {
    const links = [
      {
        key: "applications",
        href: "applications.html",
        icon: "briefcase",
        label: "Apps",
      },
      {
        key: "dashboard",
        href: "dashboard.html",
        icon: "home",
        label: "Home",
      },
      { key: "skills", href: "skills.html", icon: "target", label: "Skills" },
    ];

    // If already injected, re-render icons (they may have been empty on first call)
    // and refresh the active state
    const existing = document.getElementById("traqio-bottom-nav");
    if (existing) {
      existing.innerHTML = links
        .map(({ key, href, icon, label }) => {
          const cls = key === active ? "active" : "";
          return `<a href="${href}" class="${cls}">
        ${I(icon)}
        <span>${label}</span>
        <span class="bn-active-dot"></span>
      </a>`;
        })
        .join("");
      return;
    }

    const nav = document.createElement("nav");
    nav.id = "traqio-bottom-nav";
    nav.className = "bottom-nav";

    nav.innerHTML = links
      .map(({ key, href, icon, label }) => {
        const cls = key === active ? "active" : "";
        return `<a href="${href}" class="${cls}">
        ${I(icon)}
        <span>${label}</span>
        <span class="bn-active-dot"></span>
      </a>`;
      })
      .join("");

    document.body.appendChild(nav);
  }
  /* ── Badge update ──────────────────────────────────────── */
  function updateBadge() {
    const n = appCount();
    document.querySelectorAll(".nav-item .badge").forEach((b) => {
      b.textContent = n || "";
      b.style.display = n ? "" : "none";
    });
  }

  /* ── Nav label refresh (on lang change) ────────────────── */
  function updateNavLabels() {
    const nav = NAV();
    document.querySelectorAll(".nav-item").forEach((a, i) => {
      const span = a.querySelector("span:not(.badge)");
      if (span && nav[i]) span.textContent = nav[i].label;
    });
    const gs = document.getElementById("globalSearch");
    if (gs) gs.placeholder = T("search_ph");
    // Update profile panel — only the edit-profile link (not admin link)
    const ppProfileLink = document.querySelector(
      '.pp-link[href="profile.html"]',
    );
    if (ppProfileLink) {
      const svg = ppProfileLink.querySelector("svg");
      ppProfileLink.innerHTML = "";
      if (svg) ppProfileLink.appendChild(svg);
      ppProfileLink.append(` ${T("edit_profile")}`);
    }
    const signOut = document.getElementById("ppSignOut");
    if (signOut) signOut.innerHTML = `${I("logout")} ${T("sign_out")}`;
  }

  function wireProfilePanel() {
    const trigger = document.getElementById("profileTrigger");
    const panel = document.getElementById("profilePanel");
    if (!trigger || !panel) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = !panel.classList.contains("open");
      closeAllDropdowns();
      if (opening) {
        panel.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
    document.addEventListener("click", () => {
      panel.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    });
    panel.addEventListener("click", (e) => e.stopPropagation());

    document
      .getElementById("ppSignOut")
      ?.addEventListener("click", () => window.Traqio?.supabase?.signOut());
  }

  function wireNotifications() {
    const btn = document.getElementById("notifBtn");
    const dropdown = document.getElementById("notifDropdown");
    if (!btn || !dropdown) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = !dropdown.classList.contains("open");
      closeAllDropdowns();
      if (opening) dropdown.classList.add("open");
      btn.querySelector(".notif-dot")?.remove();
    });
    document.addEventListener("click", () => dropdown.classList.remove("open"));
    dropdown.addEventListener("click", (e) => e.stopPropagation());

    document.getElementById("markAllRead")?.addEventListener("click", () => {
      dropdown
        .querySelectorAll(".notif-item.unread")
        .forEach((el) => el.classList.remove("unread"));
      window.Traqio?.toast?.("All notifications marked read", "success");
    });
  }

  function wireGlobalSearch(active) {
    const gs = document.getElementById("globalSearch");
    if (!gs) return;
    // Remove previous handler before adding new one to prevent accumulation across mounts
    if (_ctrlKHandler) document.removeEventListener("keydown", _ctrlKHandler);
    _ctrlKHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        gs.focus();
        gs.select();
      }
    };
    document.addEventListener("keydown", _ctrlKHandler);
    gs.addEventListener("keydown", (e) => {
      if (e.key === "Escape") gs.blur();
      if (e.key === "Enter" && gs.value.trim()) {
        const q = encodeURIComponent(gs.value.trim());
        if (active === "jobs") window.location.href = `jobs.html?q=${q}`;
        else if (active === "skills")
          window.location.href = `skills.html?q=${q}`;
        else window.location.href = `applications.html?q=${q}`;
      }
    });
  }

  function wireThemeToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => window.Traqio?.theme?.toggle());
    });
  }

  function closeAllDropdowns() {
    document.getElementById("profilePanel")?.classList.remove("open");
    document
      .getElementById("profileTrigger")
      ?.setAttribute("aria-expanded", "false");
    document.getElementById("notifDropdown")?.classList.remove("open");
  }

  // Global: click on .modal-backdrop closes the modal
  document.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("modal-backdrop") &&
      e.target.classList.contains("open")
    ) {
      e.target.classList.remove("open");
    }
  });

  window.Traqio = window.Traqio || {};
  window.Traqio.shell = { mount, populateUser };
})();
