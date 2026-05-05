/* TRAQIO — Profile page  |  Mobile-first redesign */
(function () {
  const I = (n) => window.Traqio.icons.render(n);

  const PROFILE_KEY = "traqio:profile:v1";

  const INDUSTRIES = [
    "Technology",
    "Finance & Banking",
    "Healthcare & Medical",
    "Education",
    "E-Commerce & Retail",
    "Startup",
    "Manufacturing & Industry",
    "Media & Entertainment",
    "Government & Public Sector",
    "Consulting",
    "Transportation & Logistics",
    "Real Estate",
    "Other",
  ];

  const JOB_PREFERENCES = [
    "Remote",
    "Hybrid",
    "On-site",
    "Flexible Hours",
    "International Team",
    "Startup Culture",
    "Corporate Environment",
    "Fast-paced",
    "Work-Life Balance",
    "Career Growth",
    "Mentorship",
    "Travel Required",
  ];

  function loadProfile() {
    const u = window.Traqio?.user;
    const defaults = {
      name: u?.user_metadata?.full_name || u?.email?.split("@")[0] || "",
      title: "",
      location: "",
      bio: "",
      email: u?.email || "",
      phone: "",
      website: "",
      linkedin: "",
      github: "",
      targetRole: "",
      targetSalary: "",
      targetLocation: "",
      openToWork: false,
      preferredIndustries: [],
      jobPreferences: [],
      notifications: true,
      weeklyDigest: true,
    };
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  }

  function saveProfile(patch) {
    const current = loadProfile();
    const updated = { ...current, ...patch };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    document.dispatchEvent(new CustomEvent("traqio:profile-change"));
    return updated;
  }

  function stats() {
    const apps = window.Traqio.store.applications.list();
    return {
      applied: apps.filter(
        (a) =>
          a.status === "applied" ||
          a.status === "interview" ||
          a.status === "offer",
      ).length,
      interviews: apps.filter((a) => a.status === "interview").length,
      skills: window.Traqio.store.skills.list().length,
    };
  }

  /* ── Searchable Multi-Select Dropdown ──────────────────────────────── */
  function buildMultiSelect(id, options, selected, placeholder) {
    const sel = selected || [];
    const tags = sel
      .map(
        (v) =>
          `<span class="ms-tag" data-val="${v}">${v} <button type="button" class="ms-remove" data-val="${v}">×</button></span>`,
      )
      .join("");
    const opts = options
      .map(
        (o) =>
          `<div class="ms-option${sel.includes(o) ? " ms-selected" : ""}" data-val="${o}">${o}${sel.includes(o) ? ' <span class="ms-check">✓</span>' : ""}</div>`,
      )
      .join("");
    return `
      <div class="ms-wrap" id="${id}" data-selected='${JSON.stringify(sel)}' data-placeholder="${placeholder}">
        <div class="ms-control" tabindex="0">
          <div class="ms-tags" id="${id}-tags">${tags || `<span class="ms-placeholder">${placeholder}</span>`}</div>
          <span class="ms-arrow">▾</span>
        </div>
        <div class="ms-dropdown" id="${id}-dropdown" style="display:none">
          <div class="ms-search-wrap"><input class="ms-search" id="${id}-search" placeholder="Search…" autocomplete="off" /></div>
          <div class="ms-list" id="${id}-list">${opts}</div>
        </div>
      </div>`;
  }

  function wireMultiSelect(id, sourceOptions) {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const control = wrap.querySelector(".ms-control");
    const dropdown = wrap.querySelector(".ms-dropdown");
    const searchInput = wrap.querySelector(".ms-search");
    const list = wrap.querySelector(".ms-list");
    const tagsEl = wrap.querySelector(".ms-tags");
    const placeholder = wrap.dataset.placeholder || "Select…";

    function getSelected() {
      try {
        return JSON.parse(wrap.dataset.selected || "[]");
      } catch {
        return [];
      }
    }
    function setSelected(arr) {
      wrap.dataset.selected = JSON.stringify(arr);
    }
    function renderTags() {
      const sel = getSelected();
      tagsEl.innerHTML = sel.length
        ? sel
            .map(
              (v) =>
                `<span class="ms-tag" data-val="${v}">${v} <button type="button" class="ms-remove" data-val="${v}">×</button></span>`,
            )
            .join("")
        : `<span class="ms-placeholder">${placeholder}</span>`;
      tagsEl.querySelectorAll(".ms-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleOption(btn.dataset.val);
        });
      });
    }
    function renderOptions(filter) {
      const sel = getSelected();
      const visible = filter
        ? sourceOptions.filter((o) =>
            o.toLowerCase().includes(filter.toLowerCase()),
          )
        : sourceOptions;
      list.innerHTML = visible
        .map(
          (o) =>
            `<div class="ms-option${sel.includes(o) ? " ms-selected" : ""}" data-val="${o}">${o}${sel.includes(o) ? ' <span class="ms-check">✓</span>' : ""}</div>`,
        )
        .join("");
      list.querySelectorAll(".ms-option").forEach((opt) => {
        opt.addEventListener("click", () => toggleOption(opt.dataset.val));
      });
    }
    function toggleOption(val) {
      const sel = getSelected();
      const idx = sel.indexOf(val);
      if (idx >= 0) sel.splice(idx, 1);
      else sel.push(val);
      setSelected(sel);
      renderTags();
      renderOptions(searchInput?.value || "");
    }
    function openDropdown() {
      dropdown.style.display = "";
      wrap.classList.add("open");
      searchInput?.focus();
    }
    function closeDropdown() {
      dropdown.style.display = "none";
      wrap.classList.remove("open");
      if (searchInput) searchInput.value = "";
      renderOptions("");
    }

    list.querySelectorAll(".ms-option").forEach((opt) => {
      opt.addEventListener("click", () => toggleOption(opt.dataset.val));
    });
    tagsEl.querySelectorAll(".ms-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleOption(btn.dataset.val);
      });
    });
    control.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("ms-remove") ||
        e.target.closest(".ms-remove")
      )
        return;
      dropdown.style.display === "none" ? openDropdown() : closeDropdown();
    });
    searchInput?.addEventListener("input", (e) =>
      renderOptions(e.target.value),
    );
    document.addEventListener(
      "click",
      (e) => {
        if (!wrap.contains(e.target)) closeDropdown();
      },
      true,
    );
  }

  /* ── Toggle helper ──────────────────────────────────────────────────── */
  function toggle(id, label, desc, checked) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div>
          <div style="font-weight:600;font-size:.92rem">${label}</div>
          <div style="font-size:.8rem;color:var(--text-secondary);margin-top:2px">${desc}</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer">
          <input type="checkbox" id="${id}" ${checked ? "checked" : ""} style="opacity:0;position:absolute;width:0;height:0" />
          <span class="tgl-track"></span>
          <span class="tgl-thumb"></span>
        </label>
      </div>`;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  function render() {
    const p = loadProfile();
    const s = stats();
    const u = window.Traqio?.user;
    const displayName =
      p.name || u?.user_metadata?.full_name || u?.email?.split("@")[0] || "";
    const displayEmail = p.email || u?.email || "";
    const initial = (displayName || displayEmail || "?")
      .charAt(0)
      .toUpperCase();
    const googleAvatar = u?.user_metadata?.avatar_url || null;
    const avatarInner = p.avatarDataUrl
      ? `<img src="${p.avatarDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : googleAvatar
        ? `<img src="${googleAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : initial;

    /* Tab icons */
    const tabDefs = [
      { id: "tab-personal", icon: "user", label: "Personal" },
      { id: "tab-career", icon: "target", label: "Career" },
      { id: "tab-notifications", icon: "bell", label: "Alerts" },
      { id: "tab-danger", icon: "warning", label: "Account" },
    ];

    const tabButtons = tabDefs
      .map(
        (t, i) =>
          `<button class="profile-tab${i === 0 ? " active" : ""}" data-tab="${t.id}" type="button">
            ${I(t.icon)}
            <span>${t.label}</span>
          </button>`,
      )
      .join("");

    const html = `
      <main class="page">
        <div class="page-header">
          <div class="titles"><h1>My Profile</h1><p>Career profile & account settings.</p></div>
        </div>
        <input type="file" id="photoInput" accept="image/*" style="display:none" />

        <div class="profile-layout">

          <!-- ── HERO / SIDEBAR CARD ── -->
          <div>
            <div class="profile-hero">
              <div class="profile-hero-banner"></div>
              <div class="profile-hero-body">
                <div class="avatar-wrap">
                  <div class="avatar" id="profileAvatar">${avatarInner}</div>
                  <button class="edit-btn" id="changePhotoBtn" title="Change photo">${I("edit")}</button>
                </div>
                <h2 id="pc-name">${displayName || "—"}</h2>
                <div class="hero-title" id="pc-title">${p.title || ""}</div>
                ${p.location ? `<div class="hero-location">${I("map")} <span id="pc-loc">${p.location}</span></div>` : `<div class="hero-location" id="pc-loc"></div>`}
                ${p.openToWork ? `<div class="otw-badge" id="pc-otw">${I("check")} Open to Work</div>` : `<div id="pc-otw"></div>`}

                <div class="hero-stats">
                  <div class="hero-stat"><div class="num">${s.applied}</div><div class="lab">Applied</div></div>
                  <div class="hero-stat"><div class="num">${s.interviews}</div><div class="lab">Interviews</div></div>
                  <div class="hero-stat"><div class="num">${s.skills}</div><div class="lab">Skills</div></div>
                </div>

                ${p.bio ? `<div class="hero-bio" id="pc-bio">${p.bio}</div>` : `<div class="hero-bio" id="pc-bio"></div>`}

                ${
                  p.linkedin || p.github || p.website
                    ? `
                <div class="hero-links">
                  ${p.linkedin ? `<a href="https://${p.linkedin}" target="_blank">${I("link")} LinkedIn</a>` : ""}
                  ${p.github ? `<a href="https://${p.github}"   target="_blank">${I("link")} GitHub</a>` : ""}
                  ${p.website ? `<a href="${p.website}"           target="_blank">${I("link")} Portfolio</a>` : ""}
                </div>`
                    : ""
                }
              </div>
            </div>
          </div>

          <!-- ── SETTINGS PANEL ── -->
          <div>
            <!-- Mobile tab nav -->
            <nav class="profile-tabs" role="tablist">${tabButtons}</nav>

            <div class="settings-panel">

              <!-- ① Personal Info -->
              <div class="tab-pane active" id="tab-personal">
                <div class="settings-section">
                  <h3>${I("user")} Personal Information</h3>
                  <div class="form-grid">
                    <div class="field">
                      <label class="label">Full Name</label>
                      <input class="input" id="s-name" value="${displayName}" />
                    </div>
                    <div class="field">
                      <label class="label">Professional Title</label>
                      <input class="input" id="s-title" value="${p.title}" placeholder="e.g. Aspiring Data Analyst" />
                    </div>
                    <div class="field">
                      <label class="label">Email</label>
                      <input class="input" id="s-email" value="${displayEmail}" type="email" />
                    </div>
                    <div class="field">
                      <label class="label">Phone</label>
                      <input class="input" id="s-phone" value="${p.phone}" type="tel" />
                    </div>
                    <div class="field">
                      <label class="label">Location</label>
                      <input class="input" id="s-location" value="${p.location}" />
                    </div>
                    <div class="field">
                      <label class="label">Website / Portfolio</label>
                      <input class="input" id="s-website" value="${p.website}" placeholder="https://…" type="url" inputmode="url" />
                    </div>
                  </div>
                  <div class="field" style="margin-top:12px">
                    <label class="label">Bio</label>
                    <textarea class="textarea" id="s-bio" rows="3">${p.bio}</textarea>
                  </div>
                  <div class="form-grid" style="margin-top:12px">
                    <div class="field">
                      <label class="label">LinkedIn</label>
                      <input class="input" id="s-linkedin" value="${p.linkedin}" placeholder="linkedin.com/in/…" inputmode="url" />
                    </div>
                    <div class="field">
                      <label class="label">GitHub</label>
                      <input class="input" id="s-github" value="${p.github}" placeholder="github.com/…" inputmode="url" />
                    </div>
                  </div>
                  <div class="save-sticky" style="margin-top:16px">
                    <button class="btn btn-primary" id="savePersonal">${I("check")} Save Changes</button>
                  </div>
                </div>
              </div>

              <!-- ② Career Targets -->
              <div class="tab-pane" id="tab-career">
                <div class="settings-section">
                  <h3>${I("target")} Career Targets</h3>
                  <div class="form-grid">
                    <div class="field">
                      <label class="label">Target Role</label>
                      <input class="input" id="s-role" value="${p.targetRole}" />
                    </div>
                    <div class="field">
                      <label class="label">Expected Salary</label>
                      <input class="input" id="s-salary" value="${p.targetSalary}" inputmode="numeric" />
                    </div>
                    <div class="field">
                      <label class="label">Preferred Location</label>
                      <input class="input" id="s-tloc" value="${p.targetLocation}" />
                    </div>
                    <div class="field" style="display:flex;align-items:center;gap:12px;padding-top:6px">
                      <input type="checkbox" id="s-otw" ${p.openToWork ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--brand-500);flex-shrink:0" />
                      <label for="s-otw" style="font-weight:600;cursor:pointer;font-size:.92rem">Open to Work</label>
                    </div>
                  </div>

                  <div class="field" style="margin-top:14px">
                    <label class="label">Preferred Industries <span style="font-weight:400;color:var(--text-muted);font-size:.75rem">— match score (10%)</span></label>
                    ${buildMultiSelect("s-industries", INDUSTRIES, p.preferredIndustries || [], "Search industries…")}
                  </div>

                  <div class="field" style="margin-top:12px">
                    <label class="label">Job Preferences <span style="font-weight:400;color:var(--text-muted);font-size:.75rem">— match score (30%)</span></label>
                    ${buildMultiSelect("s-prefs", JOB_PREFERENCES, p.jobPreferences || [], "Search preferences…")}
                  </div>

                  <div class="save-sticky" style="margin-top:16px">
                    <button class="btn btn-primary" id="saveTargets">${I("check")} Save Targets</button>
                  </div>
                </div>
              </div>

              <!-- ③ Notifications -->
              <div class="tab-pane" id="tab-notifications">
                <div class="settings-section">
                  <h3>${I("bell")} Notifications</h3>
                  <div style="display:flex;flex-direction:column;gap:16px">
                    ${toggle("s-notif", "App notifications", "Alerts for interview reminders and goal deadlines", p.notifications)}
                    ${toggle("s-digest", "Weekly digest", "A summary of your job search progress every Monday", p.weeklyDigest)}
                  </div>
                  <div class="save-sticky" style="margin-top:16px">
                    <button class="btn btn-secondary" id="saveNotif">${I("check")} Save Preferences</button>
                  </div>
                </div>
              </div>

              <!-- ④ Danger Zone -->
              <div class="tab-pane" id="tab-danger">
                <div class="settings-section danger-zone">
                  <h3>Danger Zone</h3>
                  <div class="danger-row">
                    <div class="info">
                      <div class="title">Reset all data</div>
                      <div class="desc">Clears all applications, skills, and goals. Cannot be undone.</div>
                    </div>
                    <button class="btn btn-danger btn-sm" id="resetDataBtn">Reset</button>
                  </div>
                  <div class="danger-row">
                    <div class="info">
                      <div class="title">Sign out</div>
                      <div class="desc">Sign out from this device.</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="signOutBtn2">Sign out</button>
                  </div>
                </div>
              </div>

            </div><!-- /.settings-panel -->
          </div>

        </div><!-- /.profile-layout -->
      </main>`;

    window.Traqio.shell.mount("profile", html);
    wireEvents();
  }

  /* ── Event wiring ───────────────────────────────────────────────────── */
  function wireEvents() {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML =
        window.Traqio.icons.render(el.getAttribute("data-icon")) || "";
    });

    /* Tab switching (mobile) */
    document.querySelectorAll(".profile-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".profile-tab")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".tab-pane")
          .forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const pane = document.getElementById(btn.dataset.tab);
        if (pane) pane.classList.add("active");
        /* Scroll pane into view on mobile */
        pane?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    /* Photo upload */
    const photoInput = document.getElementById("photoInput");
    document
      .getElementById("changePhotoBtn")
      ?.addEventListener("click", () => photoInput?.click());
    photoInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        window.Traqio.toast("Pilih file gambar", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        saveProfile({ avatarDataUrl: dataUrl });
        const av = document.getElementById("profileAvatar");
        if (av)
          av.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        window.Traqio.shell?.populateUser?.();
        window.Traqio.toast("Foto profil diperbarui", "success");
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });

    /* Save personal info */
    document.getElementById("savePersonal")?.addEventListener("click", () => {
      const p = saveProfile({
        name: document.getElementById("s-name").value.trim(),
        title: document.getElementById("s-title").value.trim(),
        email: document.getElementById("s-email").value.trim(),
        phone: document.getElementById("s-phone").value.trim(),
        location: document.getElementById("s-location").value.trim(),
        website: document.getElementById("s-website").value.trim(),
        bio: document.getElementById("s-bio").value.trim(),
        linkedin: document.getElementById("s-linkedin").value.trim(),
        github: document.getElementById("s-github").value.trim(),
      });
      /* Live-update hero card */
      document.getElementById("pc-name").textContent = p.name;
      document.getElementById("pc-title").textContent = p.title;
      document.getElementById("pc-loc").textContent = p.location;
      document.getElementById("pc-bio").textContent = p.bio;
      window.Traqio.shell?.populateUser?.();
      window.Traqio.toast("Profile updated", "success");
    });

    /* Wire multi-selects */
    wireMultiSelect("s-industries", INDUSTRIES);
    wireMultiSelect("s-prefs", JOB_PREFERENCES);

    /* Save career targets */
    document.getElementById("saveTargets")?.addEventListener("click", () => {
      const industriesWrap = document.getElementById("s-industries");
      const prefsWrap = document.getElementById("s-prefs");
      const preferredIndustries = industriesWrap
        ? JSON.parse(industriesWrap.dataset.selected || "[]")
        : [];
      const jobPreferences = prefsWrap
        ? JSON.parse(prefsWrap.dataset.selected || "[]")
        : [];
      const openToWork = document.getElementById("s-otw").checked;

      saveProfile({
        targetRole: document.getElementById("s-role").value.trim(),
        targetSalary: document.getElementById("s-salary").value.trim(),
        targetLocation: document.getElementById("s-tloc").value.trim(),
        openToWork,
        preferredIndustries,
        jobPreferences,
      });

      /* Live-update OTW badge */
      const otwEl = document.getElementById("pc-otw");
      if (otwEl) {
        otwEl.className = openToWork ? "otw-badge" : "";
        otwEl.innerHTML = openToWork ? `${I("check")} Open to Work` : "";
      }

      window.Traqio.toast("Career targets saved", "success");
    });

    /* Save notifications */
    document.getElementById("saveNotif")?.addEventListener("click", () => {
      saveProfile({
        notifications: document.getElementById("s-notif").checked,
        weeklyDigest: document.getElementById("s-digest").checked,
      });
      window.Traqio.toast("Preferences saved", "success");
    });

    /* Reset data */
    document.getElementById("resetDataBtn")?.addEventListener("click", () => {
      if (!confirm("This will permanently delete all your data. Are you sure?"))
        return;
      window.Traqio.store.reset();
      window.Traqio.toast("All data reset", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 800);
    });

    /* Sign out */
    document
      .getElementById("signOutBtn2")
      ?.addEventListener("click", () => window.Traqio.supabase.signOut());
  }

  /* ── Stats-only update (no form re-mount) ───────────────────────────── */
  function updateStats() {
    if (!document.querySelector(".hero-stat")) return;
    const s = stats();
    const els = document.querySelectorAll(".hero-stat .num");
    if (els[0]) els[0].textContent = s.applied;
    if (els[1]) els[1].textContent = s.interviews;
    if (els[2]) els[2].textContent = s.skills;
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  if (!window.Traqio?.user) {
    document.addEventListener("traqio:auth-ready", render, { once: true });
  }
  setTimeout(render, 0);

  window.Traqio?.state?.on("store:change", updateStats);
  document.addEventListener("traqio:lang-change", render);
})();
