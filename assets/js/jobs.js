/* TRAQIO — Job Search page (Supabase-backed) */
(function () {
  const I = (n) => window.Traqio.icons.render(n);
  const APPLIED_KEY = "traqio:applied-jobs:v1";
  const PROFILE_KEY = "traqio:profile:v1";
  let _addJobModalWired = false; // guard: static modal wired only once

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

  function loadApplied() {
    try {
      return new Set(JSON.parse(localStorage.getItem(APPLIED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }
  function persistApplied(s) {
    localStorage.setItem(APPLIED_KEY, JSON.stringify([...s]));
  }
  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  // Saved jobs live in the applications store (status="saved") so they appear
  // in applications.html "Saved" kanban column. jobId links the store record to the Supabase job UUID.
  function getSavedApps() {
    try {
      return window.Traqio.store.applications
        .list()
        .filter((a) => a.status === "saved" && a.jobId);
    } catch {
      return [];
    }
  }
  function isJobSaved(jobId) {
    return getSavedApps().some((a) => a.jobId === jobId);
  }

  let applied = loadApplied();
  let q = new URLSearchParams(window.location.search).get("q") || "";
  let filterLocation = "all";
  let filterIndustry = "all";
  let sortBy = "match"; // "match" | "recent"
  let allJobs = [];
  let appliedOpen = false;
  let savedOpen = false;

  /* ── Match Score ──────────────────────────────────────────────
   *  Skills (weighted by user level vs job tags)  → 55%
   *  Goals  (goal titles vs job keywords)         →  5%
   *  Job Preferences (profile vs job)             → 30%
   *  Preferred Industry (profile vs job)          → 10%
   * ─────────────────────────────────────────────────────────── */
  function calcMatchScore(job) {
    const profile = loadProfile();
    const jobTags = (job.tags || []).map((t) => t.toLowerCase().trim());

    // Skills weighted by level — 55 pts
    const userSkills = (window.Traqio.store?.skills?.list() || [])
      .map((s) => ({
        name: (s.name || "").toLowerCase().trim(),
        level: s.level || 1,
        target: s.target || 5,
      }))
      .filter((s) => s.name);

    // Determine which components are "scorable" (user has data for them)
    const userPrefs = profile.jobPreferences || [];
    const userInds = profile.preferredIndustries || [];
    const userGoals = (window.Traqio.store?.goals?.list() || [])
      .map((g) => (g.title || g.name || "").toLowerCase())
      .filter(Boolean);

    const hasSkillData = userSkills.length > 0;
    const hasPrefData = userPrefs.length > 0;
    const hasIndData = userInds.length > 0;

    // If the user has NO profile data at all → score = 0, not meaningful to compute
    if (!hasSkillData && !hasPrefData && !hasIndData) return 0;

    // Skills — only contribute if user has skills AND job has tags
    let skillScore = 0;
    let skillWeight = 0;
    if (hasSkillData && jobTags.length > 0) {
      skillWeight = 55;
      let weightedHits = 0;
      jobTags.forEach((t) => {
        const match = userSkills.find(
          (s) => s.name.includes(t) || t.includes(s.name),
        );
        if (match)
          weightedHits += Math.min(match.level / Math.max(match.target, 1), 1);
      });
      skillScore = (weightedHits / jobTags.length) * skillWeight;
    } else if (hasSkillData && jobTags.length === 0) {
      // User has skills but job has no tags — skip this component (weight 0)
      skillWeight = 0;
    }

    // Goals alignment — bonus up to +5 on top, only when skillWeight is active
    if (
      hasSkillData &&
      skillWeight > 0 &&
      userGoals.length > 0 &&
      jobTags.length > 0
    ) {
      const jobKeywords = [
        ...jobTags,
        ...(job.position || "").toLowerCase().split(/\s+/),
        (job.industry || "").toLowerCase(),
      ].filter((k) => k.length > 2);
      const goalAligned = userGoals.some((g) =>
        jobKeywords.some((k) => g.includes(k) || k.includes(g)),
      );
      if (goalAligned) skillScore = Math.min(skillWeight, skillScore + 4);
    }

    // Job Preferences — only contribute if user has prefs AND job has pref tags
    const jobPrefs = job.preferences || [];
    let prefScore = 0;
    let prefWeight = 0;
    if (hasPrefData && jobPrefs.length > 0) {
      prefWeight = 30;
      const hits = jobPrefs.filter((p) => userPrefs.includes(p)).length;
      prefScore = (hits / jobPrefs.length) * prefWeight;
    }

    // Industry — only contribute if user has industry preferences
    let indScore = 0;
    let indWeight = 0;
    if (hasIndData) {
      indWeight = 10;
      indScore = userInds.includes(job.industry) ? indWeight : 0;
    }

    // Normalise: scale to 100 based on active weights only (so partial profiles still score meaningfully)
    const totalWeight =
      (skillWeight || 0) + (prefWeight || 0) + (indWeight || 0);
    if (totalWeight === 0) return 0;

    const rawScore = skillScore + prefScore + indScore;
    return Math.min(100, Math.round((rawScore / totalWeight) * 100));
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function timeAgo(iso) {
    if (!iso) return "";
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  // Main list excludes applied and saved jobs; search/filter applied on top of that
  function filtered() {
    const list = allJobs.filter((j) => {
      if (applied.has(j.id)) return false;
      if (isJobSaved(j.id)) return false;
      if (q) {
        const hay =
          `${j.company} ${j.position} ${(j.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (
        filterLocation === "remote" &&
        !(j.location || "").toLowerCase().includes("remote")
      )
        return false;
      if (filterIndustry !== "all" && j.industry !== filterIndustry)
        return false;
      return true;
    });
    if (sortBy === "recent") {
      list.sort(
        (a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0),
      );
    } else {
      list.sort((a, b) => calcMatchScore(b) - calcMatchScore(a));
    }
    return list;
  }

  function matchClass(n) {
    return n >= 80 ? "high" : n >= 65 ? "med" : "low";
  }

  /* ── Job Card ────────────────────────────────────────────── */
  function jobCard(j, isApplied = false, isSavedSection = false) {
    const isSaved = isJobSaved(j.id);
    const score = calcMatchScore(j);
    const tags = (j.tags || [])
      .map((t) => `<span class="tag">${t}</span>`)
      .join("");
    const logoInner = j.logo_url
      ? `<img src="${j.logo_url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px" onerror="this.style.display='none'">`
      : j.logo || (j.company || "?").charAt(0).toUpperCase();
    const logoBg = j.logo_url
      ? "var(--bg-surface-2)"
      : j.logo_color || j.color || "#3b82f6";
    const posted = j.posted_at ? timeAgo(j.posted_at) : j.posted || "";
    const hasUrl = !!(j.apply_url && j.apply_url.trim());

    // Apply button: open URL + mark applied | disabled if no URL | badge if already applied
    const applyBtn = isApplied
      ? `<span class="pill pill-success" style="font-size:.75rem;padding:4px 10px;font-weight:700">✓ Applied</span>`
      : hasUrl
        ? `<button class="btn btn-primary btn-sm apply-btn" data-jid="${j.id}" data-url="${encodeURIComponent(j.apply_url)}">Apply →</button>`
        : `<button class="btn btn-secondary btn-sm" disabled title="No apply link available" style="opacity:.4;cursor:not-allowed">Apply →</button>`;

    return `
      <div class="job-card ${isSaved ? "saved" : ""} ${isApplied ? "job-applied" : ""}" data-jid="${j.id}">
        <div class="logo" style="background:${logoBg}">${logoInner}</div>
        <div class="body-wrap">
          <div class="body">
            <div class="top">
              <div>
                <div class="company">${j.company}</div>
                <div class="title">${j.position}</div>
              </div>
            </div>
            <div class="meta">
              ${j.location ? `<span>${I("map")} ${j.location}</span>` : ""}
              ${j.salary ? `<span>${I("sparkles")} ${j.salary}</span>` : ""}
              ${posted ? `<span>${I("calendar")} ${posted}</span>` : ""}
              ${j.type ? `<span class="pill pill-neutral" style="font-size:.72rem;padding:2px 8px">${j.type}</span>` : ""}
              ${j.industry ? `<span class="pill pill-neutral" style="font-size:.72rem;padding:2px 8px">${j.industry}</span>` : ""}
            </div>
            <div class="tags">${tags}</div>
          </div>
          <!-- Mobile action row (hidden on desktop via .actions column) -->
          <div class="job-card-mobile-actions">
            <span class="match-badge ${matchClass(score)}">${score}% match</span>
            <div class="mobile-btns">
              <button class="btn btn-icon ${isSaved ? "btn-primary" : "btn-secondary"} save-btn" data-jid="${j.id}" title="${isSaved ? "Unsave" : "Save job"}" style="border-radius:var(--radius)">${I("bookmark")}</button>
              ${applyBtn}
            </div>
          </div>
        </div>
        <!-- Desktop action column -->
        <div class="actions">
          <span class="match-badge ${matchClass(score)}">${score}% match</span>
          <button class="btn btn-icon ${isSaved ? "btn-primary" : "btn-secondary"} save-btn" data-jid="${j.id}" title="${isSaved ? "Unsave" : "Save job"}" style="border-radius:var(--radius)">${I("bookmark")}</button>
          ${applyBtn}
        </div>
      </div>`;
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render() {
    const jobs = filtered();
    const appliedJobs = allJobs.filter((j) => applied.has(j.id));
    const savedJobsInList = allJobs.filter(
      (j) => !applied.has(j.id) && isJobSaved(j.id),
    );

    const counts = {};
    allJobs.forEach((j) => {
      if (j.industry) counts[j.industry] = (counts[j.industry] || 0) + 1;
    });

    const industryOptions = INDUSTRIES.filter((ind) => counts[ind])
      .map(
        (ind) =>
          `<option value="${ind}" ${filterIndustry === ind ? "selected" : ""}>${ind} (${counts[ind]})</option>`,
      )
      .join("");

    const html = `
      <!-- Mobile filter drawer overlay -->
      <div class="filter-drawer-overlay" id="filterDrawerOverlay"></div>
      <!-- Mobile filter drawer -->
      <div class="filter-drawer" id="filterDrawer">
        <div class="filter-drawer-handle"></div>
        <div class="filter-drawer-header">
          <h4>${I("settings")} Filters</h4>
          <button class="filter-drawer-close" id="filterDrawerClose">✕</button>
        </div>
        <div class="filter-drawer-body">
          <div class="filter-group">
            <div class="label">Industry</div>
            <select id="filterIndustryDrawer" class="filter-industry-select">
              <option value="all">All industries</option>
              ${industryOptions}
            </select>
          </div>
          <div class="filter-group">
            <div class="label">Location</div>
            <div class="filter-opt"><input type="radio" name="locDrawer" value="all" ${filterLocation === "all" ? "checked" : ""}> All locations</div>
            <div class="filter-opt"><input type="radio" name="locDrawer" value="remote" ${filterLocation === "remote" ? "checked" : ""}> Remote only</div>
          </div>
        </div>
        <div class="filter-drawer-footer">
          <button class="btn btn-primary" id="filterDrawerApply">Show ${jobs.length} result${jobs.length !== 1 ? "s" : ""}</button>
        </div>
      </div>

      <!-- FAB for mobile Add Job -->
      <button class="mobile-fab" id="mobileFab" title="Add Job">＋</button>

      <main class="page">
        <div class="page-header">
          <div class="titles"><h1>Job Search</h1><p>Curated opportunities matched to your skills and career targets.</p></div>
          <button class="btn btn-primary" id="addJobBtn">${I("plus")} Add Job</button>
        </div>
        <div class="jobs-layout">

          <!-- Filter sidebar (desktop only) -->
          <div>
            <div class="filter-panel">
              <h4 style="display:flex;align-items:center;gap:8px">${I("settings")} Filters</h4>

              <div class="filter-group">
                <div class="label">Industry</div>
                <select id="filterIndustry" class="filter-industry-select">
                  <option value="all">All industries</option>
                  ${industryOptions}
                </select>
              </div>

              <div class="filter-group">
                <div class="label">Location</div>
                <div class="filter-opt"><input type="radio" name="loc" value="all" ${filterLocation === "all" ? "checked" : ""}> All locations</div>
                <div class="filter-opt"><input type="radio" name="loc" value="remote" ${filterLocation === "remote" ? "checked" : ""}> Remote only</div>
              </div>
            </div>
          </div>

          <!-- Main results -->
          <div>
            <!-- Mobile: search + filter button in one row -->
            <div class="search-filter-row">
              <div class="jobs-search" style="flex:1;margin-bottom:0">
                ${I("search")}
                <input id="jobQ" placeholder="Search jobs, companies, or skills…" value="${q}" />
              </div>
              <button class="mobile-filter-btn" id="mobileFilterBtn">
                ${I("settings")}
                ${filterIndustry !== "all" || filterLocation !== "all" ? `<span class="mobile-filter-badge">${[filterIndustry !== "all", filterLocation !== "all"].filter(Boolean).length}</span>` : ""}
              </button>
            </div>

            <!-- Desktop: standalone search (hidden on mobile via CSS) -->
            <div class="jobs-search standalone" style="display:none">
              ${I("search")}
              <input id="jobQDesktop" placeholder="Search jobs, companies, or skills…" value="${q}" />
            </div>

            <div class="results-bar">
              <div class="count">${jobs.length} ${jobs.length === 1 ? "opportunity" : "opportunities"} found</div>
              <div class="sort">Sort by:
                <select id="sortBy">
                  <option value="match" ${sortBy === "match" ? "selected" : ""}>Best match</option>
                  <option value="recent" ${sortBy === "recent" ? "selected" : ""}>Most recent</option>
                </select>
              </div>
            </div>

            <div id="jobList">
              ${
                jobs.length
                  ? jobs.map((j) => jobCard(j)).join("")
                  : allJobs.length === 0
                    ? `<div class="empty-state card card-pad" style="padding:40px 24px">
                      <div class="icon" style="font-size:2.5rem;margin-bottom:12px">🎯</div>
                      <h3 style="font-size:1.1rem;margin-bottom:6px">No jobs added yet</h3>
                      <p style="max-width:320px;margin:0 auto 20px">Start building your job list. Add positions you're interested in and track them all in one place.</p>
                      <button class="btn btn-primary" id="addJobBtnEmpty" style="gap:6px">${I("plus")} Add Your First Job</button>
                    </div>`
                    : `<div class="empty-state card card-pad" style="padding:36px 24px">
                      <div class="icon" style="font-size:2rem;margin-bottom:10px">🔍</div>
                      <h3 style="margin-bottom:6px">No results found</h3>
                      <p style="margin-bottom:16px">Try different keywords, or clear your filters to see all jobs.</p>
                      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                        <button class="btn btn-secondary btn-sm" id="clearJobSearch">Clear search</button>
                        <button class="btn btn-secondary btn-sm" id="clearJobFilters">Reset filters</button>
                      </div>
                    </div>`
              }
            </div>

            ${
              savedJobsInList.length
                ? `
              <div class="section-divider saved-toggle" id="savedToggle" style="cursor:pointer;user-select:none">
                <span class="line"></span>
                <span class="text" style="display:flex;align-items:center;gap:7px;white-space:nowrap">
                  🔖 Saved
                  <span class="pill" style="font-size:.68rem;padding:2px 8px;font-weight:700;background:var(--brand-500);color:#fff">${savedJobsInList.length}</span>
                  <span class="saved-caret" style="font-size:.7rem;color:var(--text-muted)">${savedOpen ? "▲ hide" : "▼ show"}</span>
                </span>
                <span class="line"></span>
              </div>
              <div id="savedList" style="${savedOpen ? "" : "display:none"}">
                ${savedJobsInList.map((j) => jobCard(j, false, true)).join("")}
              </div>`
                : ""
            }

            ${
              appliedJobs.length
                ? `
              <div class="section-divider applied-toggle" id="appliedToggle" style="cursor:pointer;user-select:none">
                <span class="line"></span>
                <span class="text" style="display:flex;align-items:center;gap:7px;white-space:nowrap">
                  ✓ Applied
                  <span class="pill pill-success" style="font-size:.68rem;padding:2px 8px;font-weight:700">${appliedJobs.length}</span>
                  <span class="applied-caret" style="font-size:.7rem;color:var(--text-muted)">${appliedOpen ? "▲ hide" : "▼ show"}</span>
                </span>
                <span class="line"></span>
              </div>
              <div id="appliedList" style="${appliedOpen ? "" : "display:none"}">
                ${appliedJobs.map((j) => jobCard(j, true)).join("")}
              </div>`
                : ""
            }
          </div>

        </div>

        <!-- Apply confirmation modal -->
        <div id="applyConfirmModal" class="modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:none;align-items:center;justify-content:center">
          <div class="modal-box" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.25)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <div style="width:40px;height:40px;border-radius:50%;background:var(--brand-grad-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem">🚀</div>
              <div>
                <div style="font-weight:700;font-size:1rem">Application link opened!</div>
                <div id="applyConfirmSub" style="font-size:.82rem;color:var(--text-secondary);margin-top:2px"></div>
              </div>
            </div>
            <p style="font-size:.88rem;color:var(--text-secondary);margin:14px 0 20px;line-height:1.55">Have you completed the application on their website?</p>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button id="applyConfirmNo" class="btn btn-secondary">Not yet</button>
              <button id="applyConfirmYes" class="btn btn-primary">Yes, I applied ✓</button>
            </div>
          </div>
        </div>
      </main>`;

    window.Traqio.shell.mount("jobs", html);
    wireEvents();
  }

  /* ── Wire Events ─────────────────────────────────────────── */
  function openAddJobModal() {
    document.getElementById("addJobModal")?.classList.add("open");
  }

  function wireAddJobModal() {
    if (_addJobModalWired) {
      // Re-wire the in-page button only (it's inside #app, recreated on each render)
      document
        .getElementById("addJobBtn")
        ?.addEventListener("click", openAddJobModal);
      document
        .getElementById("addJobBtnEmpty")
        ?.addEventListener("click", openAddJobModal);
      return;
    }
    _addJobModalWired = true;
    document
      .getElementById("addJobBtn")
      ?.addEventListener("click", openAddJobModal);
    document
      .getElementById("addJobBtnEmpty")
      ?.addEventListener("click", openAddJobModal);
    document
      .getElementById("closeAddJob")
      ?.addEventListener("click", () =>
        document.getElementById("addJobModal")?.classList.remove("open"),
      );
    document
      .getElementById("cancelAddJob")
      ?.addEventListener("click", () =>
        document.getElementById("addJobModal")?.classList.remove("open"),
      );

    document
      .getElementById("saveAddJob")
      ?.addEventListener("click", async () => {
        const company = document.getElementById("aj-company")?.value.trim();
        const position = document.getElementById("aj-position")?.value.trim();
        if (!company || !position) {
          window.Traqio?.toast?.("Company and position are required", "error");
          return;
        }
        const tags = (document.getElementById("aj-tags")?.value || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const newJob = {
          id: "usr_" + Date.now(),
          company,
          position,
          location: document.getElementById("aj-location")?.value.trim() || "",
          salary: document.getElementById("aj-salary")?.value.trim() || "",
          apply_url: document.getElementById("aj-url")?.value.trim() || "",
          type: document.getElementById("aj-type")?.value || "",
          industry: document.getElementById("aj-industry")?.value || "Other",
          tags,
          posted_at: new Date().toISOString(),
          logo: company.charAt(0).toUpperCase(),
          logo_color: ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"][
            Math.floor(Math.random() * 5)
          ],
        };
        allJobs.unshift(newJob);

        const cfg = window.TRAQIO_CONFIG || {};
        if (!cfg.DEMO_MODE) {
          window.Traqio?.supabase?.jobs?.add?.(newJob).catch(() => {});
        }
        document.getElementById("addJobModal")?.classList.remove("open");
        [
          "aj-company",
          "aj-position",
          "aj-location",
          "aj-salary",
          "aj-url",
          "aj-tags",
        ].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
        window.Traqio?.toast?.("Job added!", "success");
        render();
      });
  }

  function wireEvents() {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML =
        window.Traqio.icons.render(el.getAttribute("data-icon")) || "";
    });

    wireAddJobModal();

    document.getElementById("jobQ")?.addEventListener("input", (e) => {
      q = e.target.value;
      reloadList();
    });

    // Empty state action buttons
    document.getElementById("clearJobSearch")?.addEventListener("click", () => {
      q = "";
      const inp = document.getElementById("jobQ");
      if (inp) inp.value = "";
      reloadList();
    });
    document.getElementById("clearJobFilters")?.addEventListener("click", () => {
      filterIndustry = "all";
      filterLocation = "all";
      q = "";
      const inp = document.getElementById("jobQ");
      if (inp) inp.value = "";
      reloadList();
    });
    document.getElementById("sortBy")?.addEventListener("change", (e) => {
      sortBy = e.target.value;
      reloadList();
    });

    document
      .getElementById("filterIndustry")
      ?.addEventListener("change", (e) => {
        filterIndustry = e.target.value;
        reloadList();
      });

    document.querySelectorAll("input[name='loc']").forEach((r) => {
      r.addEventListener("change", () => {
        filterLocation = r.value;
        reloadList();
      });
    });

    // ── Mobile filter drawer ──────────────────────────────────
    function openDrawer() {
      document.getElementById("filterDrawer")?.classList.add("open");
      document.getElementById("filterDrawerOverlay")?.classList.add("open");
      document.getElementById("filterDrawerOverlay").style.display = "block";
    }
    function closeDrawer() {
      document.getElementById("filterDrawer")?.classList.remove("open");
      document.getElementById("filterDrawerOverlay")?.classList.remove("open");
      setTimeout(() => {
        const ov = document.getElementById("filterDrawerOverlay");
        if (ov && !ov.classList.contains("open")) ov.style.display = "";
      }, 300);
    }
    document
      .getElementById("mobileFilterBtn")
      ?.addEventListener("click", openDrawer);
    document
      .getElementById("filterDrawerClose")
      ?.addEventListener("click", closeDrawer);
    document
      .getElementById("filterDrawerOverlay")
      ?.addEventListener("click", closeDrawer);
    document
      .getElementById("filterDrawerApply")
      ?.addEventListener("click", closeDrawer);

    // Sync drawer selects with state
    document
      .getElementById("filterIndustryDrawer")
      ?.addEventListener("change", (e) => {
        filterIndustry = e.target.value;
        // Sync desktop select too
        const desk = document.getElementById("filterIndustry");
        if (desk) desk.value = filterIndustry;
        reloadList();
      });
    document.querySelectorAll("input[name='locDrawer']").forEach((r) => {
      r.addEventListener("change", () => {
        filterLocation = r.value;
        // Sync desktop radios
        document.querySelectorAll("input[name='loc']").forEach((dr) => {
          dr.checked = dr.value === filterLocation;
        });
        reloadList();
      });
    });

    // ── FAB (mobile Add Job) ──────────────────────────────────
    document
      .getElementById("mobileFab")
      ?.addEventListener("click", openAddJobModal);

    document.getElementById("appliedToggle")?.addEventListener("click", () => {
      appliedOpen = !appliedOpen;
      const list = document.getElementById("appliedList");
      const caret = document.querySelector(".applied-caret");
      if (list) list.style.display = appliedOpen ? "" : "none";
      if (caret) caret.textContent = appliedOpen ? "▲ hide" : "▼ show";
    });

    document.getElementById("savedToggle")?.addEventListener("click", () => {
      savedOpen = !savedOpen;
      const list = document.getElementById("savedList");
      const caret = document.querySelector(".saved-caret");
      if (list) list.style.display = savedOpen ? "" : "none";
      if (caret) caret.textContent = savedOpen ? "▲ hide" : "▼ show";
    });

    wireSaveAndApply();
  }

  function reloadList() {
    const jobs = filtered();
    const el = document.getElementById("jobList");
    if (el) {
      el.innerHTML = jobs.length
        ? jobs.map((j) => jobCard(j)).join("")
        : `<div class="empty-state card card-pad" style="padding:36px 24px">
            <div class="icon" style="font-size:2rem;margin-bottom:10px">🔍</div>
            <h3 style="margin-bottom:6px">No results found</h3>
            <p style="margin-bottom:16px">Try different keywords, or clear your filters to see all jobs.</p>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" id="clearJobSearch">Clear search</button>
              <button class="btn btn-secondary btn-sm" id="clearJobFilters">Reset filters</button>
            </div>
          </div>`;
      wireSaveAndApply();
      document.getElementById("addJobBtnEmpty")?.addEventListener("click", openAddJobModal);
      document.getElementById("clearJobSearch")?.addEventListener("click", () => {
        q = ""; const inp = document.getElementById("jobQ"); if (inp) inp.value = ""; reloadList();
      });
      document.getElementById("clearJobFilters")?.addEventListener("click", () => {
        filterIndustry = "all"; filterLocation = "all"; q = "";
        const inp = document.getElementById("jobQ"); if (inp) inp.value = ""; reloadList();
      });
    }
  }

  async function doMarkApplied(id) {
    applied.add(id);
    persistApplied(applied);
    const job = allJobs.find((j) => j.id === id);
    const cfg = window.TRAQIO_CONFIG || {};
    if (job) {
      window.Traqio?.store?.activities?.log({
        type: "apply",
        icon: "briefcase",
        color: "info",
        text: `Applied to ${job.position} at ${job.company}`,
      });
    }
    if (job) {
      const palette = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];
      const today = new Date().toISOString().slice(0, 10);
      const newStage = {
        id: "s" + Date.now(),
        name: "Application Submitted",
        state: "done",
        date: today,
        note: "",
      };
      const savedApp = getSavedApps().find((a) => a.jobId === id);
      if (savedApp) {
        const patch = {
          status: "applied",
          appliedAt: today,
          stages: [...(savedApp.stages || []), newStage],
        };
        if (!cfg.DEMO_MODE) {
          await window.Traqio.supabase.applications
            .update(savedApp.id, patch)
            .catch((e) => console.warn(e));
        }
        window.Traqio.store.applications.updateInCache?.(savedApp.id, patch);
      } else {
        const alreadyApplied = window.Traqio.store.applications
          .list()
          .some(
            (a) =>
              a.jobId === id ||
              (a.company === job.company && a.position === job.position),
          );
        if (!alreadyApplied) {
          const appData = {
            jobId: id,
            company: job.company,
            position: job.position,
            location: job.location || "",
            salary: job.salary || "",
            status: "applied",
            source: "Traqio Job Search",
            link: job.apply_url || "",
            appliedAt: today,
            logo: job.logo || (job.company || "?").charAt(0).toUpperCase(),
            logo_url: job.logo_url || "",
            color:
              job.logo_color ||
              palette[Math.floor(Math.random() * palette.length)],
            stages: [newStage],
            notes: [],
          };
          if (!cfg.DEMO_MODE) {
            try {
              const saved =
                await window.Traqio.supabase.applications.add(appData);
              window.Traqio.store.applications.addToCache?.(saved);
            } catch (err) {
              console.warn("Supabase apply failed:", err);
              window.Traqio.store.applications.add(appData);
            }
          } else {
            window.Traqio.store.applications.add(appData);
          }
        }
      }
    }
    render();
  }

  function wireSaveAndApply() {
    document.querySelectorAll(".save-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.jid;
        const job = allJobs.find((j) => j.id === id);
        const cfg = window.TRAQIO_CONFIG || {};
        if (isJobSaved(id)) {
          const app = getSavedApps().find((a) => a.jobId === id);
          if (app) {
            if (!cfg.DEMO_MODE) {
              await window.Traqio.supabase.applications
                .remove(app.id)
                .catch((e) => console.warn(e));
            }
            window.Traqio.store.applications.removeFromCache?.(app.id);
          }
          window.Traqio?.toast?.("Job removed from saved");
          document.dispatchEvent(
            new CustomEvent("traqio:job-saved", {
              detail: { jobId: id, action: "unsaved" },
            }),
          );
        } else if (job) {
          const palette = [
            "#3b82f6",
            "#8b5cf6",
            "#ec4899",
            "#10b981",
            "#f59e0b",
          ];
          const appData = {
            jobId: id,
            company: job.company,
            position: job.position,
            location: job.location || "",
            salary: job.salary || "",
            status: "saved",
            source: "Traqio Job Search",
            link: job.apply_url || "",
            appliedAt: "",
            logo: (job.company || "?").charAt(0).toUpperCase(),
            logo_url: job.logo_url || "",
            color:
              job.logo_color ||
              palette[Math.floor(Math.random() * palette.length)],
            stages: [],
            notes: [],
          };
          if (!cfg.DEMO_MODE) {
            try {
              const saved =
                await window.Traqio.supabase.applications.add(appData);
              window.Traqio.store.applications.addToCache?.(saved);
            } catch (err) {
              console.warn("Save to Supabase failed:", err);
              window.Traqio.store.applications.add(appData);
            }
          } else {
            window.Traqio.store.applications.add(appData);
          }
          window.Traqio.toast("Job saved to Applications", "success");
          // Notify applications page that a job was saved
          document.dispatchEvent(
            new CustomEvent("traqio:job-saved", {
              detail: { jobId: id, action: "saved" },
            }),
          );
        }
        render();
      });
    });

    // Apply button: open apply_url in new tab, then show confirm modal
    document.querySelectorAll(".apply-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = decodeURIComponent(btn.dataset.url || "");
        const jid = btn.dataset.jid;
        const job = allJobs.find((j) => j.id === jid);
        if (url) window.open(url, "_blank", "noopener,noreferrer");

        // Show confirm modal
        const modal = document.getElementById("applyConfirmModal");
        const sub = document.getElementById("applyConfirmSub");
        if (modal) {
          if (sub && job) sub.textContent = `${job.position} at ${job.company}`;
          modal.style.display = "flex";

          const yesBtn = document.getElementById("applyConfirmYes");
          const noBtn = document.getElementById("applyConfirmNo");
          if (!yesBtn || !noBtn) { modal.style.display = "none"; return; }

          // Clone to remove stale listeners
          const yes = yesBtn.cloneNode(true);
          const no = noBtn.cloneNode(true);
          yesBtn.replaceWith(yes);
          noBtn.replaceWith(no);

          yes.addEventListener("click", () => {
            modal.style.display = "none";
            doMarkApplied(jid);
            window.Traqio.toast(
              "Application recorded — moved to Applied ✓",
              "success",
            );
          });
          no.addEventListener("click", () => {
            modal.style.display = "none";
            window.Traqio.toast(
              "No problem — come back when you're ready!",
              "info",
            );
          });

          // Close on backdrop click
          modal.addEventListener("click", function onBackdrop(ev) {
            if (ev.target === modal) {
              modal.style.display = "none";
              modal.removeEventListener("click", onBackdrop);
            }
          });
        }
      });
    });

  }

  /* ── Init ────────────────────────────────────────────────── */
  setTimeout(async function init() {
    // Show loading skeleton immediately
    window.Traqio.shell.mount(
      "jobs",
      `
      <main class="page">
        <div class="page-header">
          <div class="titles"><h1>Job Search</h1><p>Loading opportunities…</p></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:24px">
          ${Array.from({ length: 5 })
            .map(
              () => `
            <div class="skeleton-card" style="height:110px;border-radius:var(--radius);background:var(--bg-surface);border:1px solid var(--border);animation:skelPulse 1.4s ease-in-out infinite">
            </div>`,
            )
            .join("")}
        </div>
      </main>`,
    );
    try {
      const [jobs, apps] = await Promise.all([
        window.Traqio.supabase.jobs.list(),
        window.Traqio.supabase.applications.list().catch(() => []),
      ]);
      allJobs = jobs;
      window.Traqio.store.applications.seed?.(apps || []);
      // Seed skills/goals if store is empty — needed for accurate match scores.
      // Collect into Promise.all then re-render so the FIRST visible render already
      // has real skill/goal data (fixes race condition where scores showed as neutral).
      const seedPromises = [];
      if (!window.Traqio.store.skills?.list()?.length) {
        seedPromises.push(
          window.Traqio.supabase?.skills
            ?.list?.()
            .then((s) => {
              window.Traqio.store.skills?.seed?.(s || []);
            })
            .catch(() => {}),
        );
      }
      if (!window.Traqio.store.goals?.list()?.length) {
        seedPromises.push(
          window.Traqio.supabase?.goals
            ?.list?.()
            .then((g) => {
              window.Traqio.store.goals?.seed?.(g || []);
            })
            .catch(() => {}),
        );
      }
      if (seedPromises.length) {
        Promise.all(seedPromises)
          .then(() => render())
          .catch(() => {});
      }
      localStorage.setItem("traqio:jobs-total:v1", String(allJobs.length));
      localStorage.setItem("traqio:jobs-seen:v1", String(allJobs.length));
    } catch (e) {
      console.warn("Failed to load:", e);
      allJobs = [];
    }
    render();
  }, 0);

  // Recalculate scores + re-render when profile or skills change (no re-fetch)
  document.addEventListener("traqio:profile-change", render);
  window.Traqio?.state?.on("store:change", render);
  document.addEventListener("traqio:lang-change", render);

  // When applications page removes a saved-job link, re-render so job reappears in list
  document.addEventListener("traqio:job-unsaved", () => render());
})();
