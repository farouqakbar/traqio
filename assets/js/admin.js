/* TRAQIO — Admin job management */
(function () {
  const I = (n) => window.Traqio?.icons?.render(n) || "";
  const ADMIN_EMAIL = "traqio.web@gmail.com";

  /* ── Master list keys & defaults ────────────────────────── */
  const SKILLS_KEY    = "traqio:admin:skills:v1";
  const PREFS_KEY     = "traqio:admin:prefs:v1";
  const IND_KEY       = "traqio:admin:industries:v1";
  const COMPANIES_KEY = "traqio:companies:v1";

  function loadCompanies() {
    try { const r = localStorage.getItem(COMPANIES_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  }
  function saveCompanies(list) {
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(list));
    window.Traqio.companies = { list: loadCompanies };
  }

  // Expose globally so applications.js can look up company logos
  window.Traqio = window.Traqio || {};
  window.Traqio.companies = { list: loadCompanies };

  const DEFAULT_INDUSTRIES = [
    "Technology", "Finance & Banking", "Healthcare & Medical",
    "Education", "E-Commerce & Retail", "Startup",
    "Manufacturing & Industry", "Media & Entertainment",
    "Government & Public Sector", "Consulting",
    "Transportation & Logistics", "Real Estate", "Other",
  ];

  const DEFAULT_PREFERENCES = [
    "Remote", "Hybrid", "On-site", "Flexible Hours",
    "International Team", "Startup Culture", "Corporate Environment",
    "Fast-paced", "Work-Life Balance", "Career Growth",
    "Mentorship", "Travel Required",
  ];

  const DEFAULT_SKILLS = [
    "JavaScript", "TypeScript", "Python", "Java", "Go", "C++", "PHP", "Ruby",
    "React", "Vue", "Angular", "Next.js", "Node.js", "Laravel",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis",
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Linux",
    "Machine Learning", "Data Analysis", "TensorFlow", "PyTorch",
    "UI/UX Design", "Figma", "Photoshop", "Illustrator",
    "Project Management", "Agile", "Scrum",
    "Git", "REST API", "GraphQL",
    "Digital Marketing", "SEO", "Content Writing", "Excel", "Power BI",
  ];

  const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"];

  function loadList(key, defaults) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [...defaults];
    } catch { return [...defaults]; }
  }

  function saveList(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function listMeta(listId) {
    if (listId === "industries")    return { key: IND_KEY,    defaults: DEFAULT_INDUSTRIES };
    if (listId === "preferences")   return { key: PREFS_KEY,  defaults: DEFAULT_PREFERENCES };
    if (listId === "skills-master") return { key: SKILLS_KEY, defaults: DEFAULT_SKILLS };
    return { key: null, defaults: [] };
  }

  let allJobs  = [];
  let editing  = null;
  let _logoFile = null;

  /* ── Data ──────────────────────────────────────────────── */
  async function loadJobs() {
    return window.Traqio.supabase.jobs.list(true);
  }

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    const active     = allJobs.filter(j => j.active).length;
    const inactive   = allJobs.length - active;
    const industries = new Set(allJobs.map(j => j.industry).filter(Boolean)).size;
    const withPrefs  = allJobs.filter(j => j.preferences?.length).length;
    const withApply  = allJobs.filter(j => j.apply_url).length;

    const html = `
      <main class="page">
        <div class="page-header">
          <div class="titles">
            <h1>${I("settings")} Job Management</h1>
            <p>Manage job listings visible to all Traqio users. Signed in as <strong>${ADMIN_EMAIL}</strong>.</p>
          </div>
          <button class="btn btn-primary" id="addJobBtn">${I("plus")} New Job</button>
        </div>

        <div class="admin-stats">
          <div class="admin-stat"><div class="num">${allJobs.length}</div><div class="lab">Total Jobs</div></div>
          <div class="admin-stat"><div class="num" style="color:var(--success)">${active}</div><div class="lab">Active</div></div>
          <div class="admin-stat"><div class="num" style="color:var(--text-muted)">${inactive}</div><div class="lab">Hidden</div></div>
          <div class="admin-stat"><div class="num" style="color:var(--brand-500)">${industries}</div><div class="lab">Industries</div></div>
          <div class="admin-stat"><div class="num" style="color:#f59e0b">${withPrefs}</div><div class="lab">With Preferences</div></div>
          <div class="admin-stat"><div class="num" style="color:#10b981">${withApply}</div><div class="lab">With Apply Link</div></div>
        </div>

        ${allJobs.length ? renderTable() : renderEmpty()}

        ${renderCompanies()}

        ${renderMasterLists()}

        ${renderModal()}
      </main>`;

    window.Traqio.shell.mount("admin", html);
    wireEvents();
  }

  /* ── Jobs Table ──────────────────────────────────────────── */
  function renderTable() {
    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Company / Position</th>
              <th>Industry</th>
              <th>Location</th>
              <th>Salary</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${allJobs.map(jobRow).join("")}</tbody>
        </table>
      </div>`;
  }

  function jobRow(j) {
    const logo = j.logo_url
      ? `<img src="${j.logo_url}" style="width:36px;height:36px;object-fit:contain;border-radius:8px" onerror="this.style.display='none'">`
      : `<div style="width:36px;height:36px;border-radius:8px;background:${j.logo_color || "#3b82f6"};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.95rem">${(j.company || "?").charAt(0).toUpperCase()}</div>`;
    return `
      <tr>
        <td>${logo}</td>
        <td><div class="fw-bold">${j.position}</div><div class="text-muted">${j.company}</div></td>
        <td>${j.industry || "—"}</td>
        <td>${j.location}</td>
        <td>${j.salary || "—"}</td>
        <td><span class="pill ${j.active ? "pill-success" : "pill-neutral"}">${j.active ? "Active" : "Hidden"}</span></td>
        <td class="cell-actions">
          <button class="btn btn-ghost btn-sm edit-job-btn" data-id="${j.id}">${I("edit")} Edit</button>
          <button class="btn btn-danger btn-sm del-job-btn" data-id="${j.id}">${I("trash")}</button>
        </td>
      </tr>`;
  }

  function renderEmpty() {
    return `
      <div class="admin-table-wrap">
        <div class="admin-empty">
          <div class="icon">${I("briefcase")}</div>
          <h3>No jobs yet</h3>
          <p>Click "New Job" to add the first listing.</p>
        </div>
      </div>`;
  }

  /* ── Master Lists Section ────────────────────────────────── */
  function renderMasterLists() {
    const inds   = loadList(IND_KEY, DEFAULT_INDUSTRIES);
    const prefs  = loadList(PREFS_KEY, DEFAULT_PREFERENCES);
    const skills = loadList(SKILLS_KEY, DEFAULT_SKILLS);

    function box(id, icon, title, items) {
      const chips = items.length
        ? items.map(item => `
            <span class="config-chip">
              ${esc(item)}
              <button class="config-chip-remove" data-list="${id}" data-val="${esc(item)}" type="button">×</button>
            </span>`).join("")
        : `<span style="font-size:.8rem;color:var(--text-muted);font-style:italic">Belum ada item</span>`;
      return `
        <div class="config-box">
          <div class="config-box-head">${icon} ${title} <span class="config-count">${items.length}</span></div>
          <div class="config-chips-wrap">${chips}</div>
          <div class="config-add-row">
            <input class="input config-new-input" id="${id}-input" placeholder="Tambah ${title.toLowerCase()}…" />
            <button class="btn btn-secondary btn-sm config-add-btn" data-list="${id}" type="button">+ Tambah</button>
          </div>
        </div>`;
    }

    return `
      <div class="admin-lists-section">
        <div class="admin-lists-head">
          <div class="admin-lists-title">📋 Master Lists</div>
          <div class="admin-lists-desc">Kelola daftar pilihan yang tersedia saat menambah job baru. Perubahan langsung berlaku.</div>
        </div>
        <div class="admin-lists-grid">
          ${box("industries",    "🏢", "Industries",      inds)}
          ${box("preferences",   "✅", "Job Preferences", prefs)}
          ${box("skills-master", "🔧", "Skills",          skills)}
        </div>
      </div>`;
  }

  /* ── Companies Section ───────────────────────────────────── */
  function renderCompanies() {
    const companies = loadCompanies();
    // Also collect unique companies from jobs table
    const fromJobs = allJobs
      .filter(j => j.company && j.logo_url)
      .reduce((acc, j) => {
        if (!acc.find(c => c.name.toLowerCase() === j.company.toLowerCase())) {
          acc.push({ name: j.company, logo_url: j.logo_url, fromJob: true });
        }
        return acc;
      }, []);

    const all = [
      ...companies,
      ...fromJobs.filter(fj => !companies.find(c => c.name.toLowerCase() === fj.name.toLowerCase())),
    ];

    const rows = all.map(c => `
      <div class="company-row" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--bg-surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${c.logo_url
            ? `<img src="${esc(c.logo_url)}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">`
            : `<span style="font-weight:700;font-size:.95rem">${esc(c.name.charAt(0).toUpperCase())}</span>`}
        </div>
        <div style="flex:1;font-weight:600">${esc(c.name)} ${c.fromJob ? `<span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(from jobs)</span>` : ""}</div>
        ${c.logo_url ? `<span style="font-size:.72rem;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.logo_url)}">${esc(c.logo_url.replace(/^https?:\/\//, "").slice(0, 40))}…</span>` : ""}
        ${!c.fromJob
          ? `<button class="btn btn-ghost btn-sm del-company-btn" data-name="${esc(c.name)}" title="Remove">${I("trash")}</button>`
          : ""}
      </div>`).join("");

    return `
      <div class="admin-lists-section" id="companiesSection">
        <div class="admin-lists-head">
          <div class="admin-lists-title">🏢 Companies</div>
          <div class="admin-lists-desc">Daftar perusahaan dengan logo — digunakan otomatis saat menambah lamaran manual.</div>
        </div>
        <div style="background:var(--bg-surface);border-radius:var(--radius);border:1px solid var(--border);padding:0 16px;margin-bottom:12px">
          ${all.length ? rows : `<div style="padding:16px 0;color:var(--text-muted);font-size:.84rem">Belum ada perusahaan. Tambahkan di bawah atau tambahkan job dengan logo terlebih dahulu.</div>`}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="companyAddRow">
          <input class="input" id="new-company-name" placeholder="Nama perusahaan…" style="flex:1;min-width:150px" />
          <input class="input" id="new-company-logo" placeholder="URL logo (opsional)…" style="flex:2;min-width:200px" />
          <button class="btn btn-primary btn-sm" id="addCompanyBtn">${I("plus")} Tambah</button>
        </div>
      </div>`;
  }

  /* ── Job Modal ───────────────────────────────────────────── */
  function renderModal() {
    const j    = editing || {};
    const title = editing ? "Edit Job" : "Add New Job";
    const logoColor = j.logo_color || "#3b82f6";
    const logoPreviewInner = j.logo_url
      ? `<img src="${j.logo_url}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">`
      : (j.company || "A").charAt(0).toUpperCase();
    const logoPreviewBg = j.logo_url ? "var(--bg-surface-2)" : logoColor;

    const inds  = loadList(IND_KEY, DEFAULT_INDUSTRIES);
    const prefs = loadList(PREFS_KEY, DEFAULT_PREFERENCES);

    const industryOptions = inds.map(ind =>
      `<option value="${ind}" ${j.industry === ind ? "selected" : ""}>${ind}</option>`
    ).join("");

    const typeOptions = JOB_TYPES.map(t =>
      `<option value="${t}" ${(j.type || "Full-time") === t ? "selected" : ""}>${t}</option>`
    ).join("");

    const currentPrefs = j.preferences || [];
    const prefCheckboxes = prefs.map(p =>
      `<label class="pref-chip ${currentPrefs.includes(p) ? "checked" : ""}">
        <input type="checkbox" value="${p}" ${currentPrefs.includes(p) ? "checked" : ""} style="display:none" />${p}
      </label>`
    ).join("");

    const currentSkills = j.tags || [];
    const skillChips = currentSkills.map(s =>
      `<span class="skill-selected-chip" data-skill="${esc(s)}">${esc(s)}<button class="skill-chip-remove" type="button">×</button></span>`
    ).join("");

    const salaryMin = j.salary_min || "";
    const salaryMax = j.salary_max || "";

    return `
      <div class="admin-modal-overlay" id="jobModalOverlay">
        <div class="admin-modal-box">
          <div class="admin-modal-head">
            <h3 id="modalTitle">${title}</h3>
            <button class="admin-modal-close" id="closeJobModal">×</button>
          </div>
          <div class="admin-modal-body">

            <div class="form-grid-2">
              <div class="field">
                <label>Company Name *</label>
                <input class="input" id="f-company" placeholder="e.g. Tokopedia" value="${esc(j.company || "")}" />
              </div>
              <div class="field">
                <label>Position / Title *</label>
                <input class="input" id="f-position" placeholder="e.g. Software Engineer" value="${esc(j.position || "")}" />
              </div>
              <div class="field">
                <label>Industry</label>
                <select class="select" id="f-industry">
                  <option value="">— Pilih Industry —</option>
                  ${industryOptions}
                </select>
              </div>
              <div class="field">
                <label>Job Type</label>
                <select class="select" id="f-type">${typeOptions}</select>
              </div>
              <div class="field">
                <label>Location *</label>
                <input class="input" id="f-location" placeholder="e.g. Jakarta / Remote" value="${esc(j.location || "")}" />
              </div>
              <div class="field">
                <label>Salary Range <span style="font-weight:400;color:var(--text-muted)">(Rp / bulan)</span></label>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="salary-input-wrap">
                    <span class="salary-prefix">Rp</span>
                    <input class="input salary-num-input" id="f-salary-min" type="text" inputmode="numeric" placeholder="10.000.000" value="${salaryMin ? formatRp(salaryMin) : ""}" />
                  </div>
                  <span style="color:var(--text-muted);font-size:.9rem;flex-shrink:0">—</span>
                  <div class="salary-input-wrap">
                    <span class="salary-prefix">Rp</span>
                    <input class="input salary-num-input" id="f-salary-max" type="text" inputmode="numeric" placeholder="15.000.000" value="${salaryMax ? formatRp(salaryMax) : ""}" />
                  </div>
                </div>
                <div class="hint">Angka saja — titik sebagai pemisah ribuan ditambah otomatis</div>
              </div>
            </div>

            <div class="field">
              <label>Job Description</label>
              <textarea class="textarea" id="f-desc" rows="3" placeholder="Describe the role…">${esc(j.description || "")}</textarea>
            </div>

            <div class="field">
              <label>Requirements</label>
              <textarea class="textarea" id="f-req" rows="3" placeholder="List key requirements…">${esc(j.requirements || "")}</textarea>
            </div>

            <div class="field">
              <label>Link Pendaftaran</label>
              <div class="apply-url-wrap">
                <span class="apply-url-prefix">🔗</span>
                <input class="input apply-url-input" id="f-apply-url" type="url" placeholder="https://careers.company.com/apply/..." value="${esc(j.apply_url || "")}" />
              </div>
              <div class="hint">URL langsung ke halaman apply — ditampilkan sebagai tombol "Apply Now" ke user</div>
            </div>

            <!-- Match Criteria -->
            <div class="admin-section-divider">
              <span>📊 Match Criteria</span>
              <span class="hint" style="margin:0;font-size:.75rem">Digunakan untuk menghitung match score per-user</span>
            </div>

            <div class="field">
              <label>Skills <span style="font-weight:400;color:var(--text-muted)">— bobot 60%</span></label>
              <div class="skills-selector" id="skillsSelector">
                <div class="skills-selector-search-wrap">
                  <input class="input" id="skillSearch" placeholder="Ketik untuk mencari dan memilih skill…" autocomplete="off" />
                </div>
                <div class="skills-dropdown" id="skillsDropdown" style="display:none"></div>
                <div class="skills-selected-chips" id="skillsSelected">
                  ${skillChips || `<span class="skills-empty-hint">Belum ada skill dipilih</span>`}
                </div>
              </div>
            </div>

            <div class="field">
              <label>Job Preferences <span style="font-weight:400;color:var(--text-muted)">(pilih semua yang sesuai) — bobot 30%</span></label>
              <div class="pref-chips-grid" id="prefChipsGrid">
                ${prefCheckboxes}
              </div>
            </div>

            <!-- Logo -->
            <div class="field">
              <label>Company Logo</label>
              <div class="logo-editor">
                <div class="logo-preview-box" id="logoPreview" style="background:${logoPreviewBg}">${logoPreviewInner}</div>
                <div class="logo-editor-fields">
                  <div>
                    <label>Upload image file</label>
                    <input type="file" class="input" id="f-logo-file" accept="image/*" style="padding:4px;font-size:.82rem" />
                    <div class="hint">PNG, JPG, SVG — replaces URL if selected</div>
                  </div>
                  <div>
                    <label>Or paste logo URL</label>
                    <input class="input" id="f-logo-url" placeholder="https://…" value="${esc(j.logo_url || "")}" />
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;margin-top:2px">
                    <label style="margin:0">Fallback color</label>
                    <input type="color" id="f-color" value="${logoColor}" style="height:30px;width:48px;border:none;cursor:pointer;border-radius:6px;background:none" />
                  </div>
                </div>
              </div>
            </div>

            <div class="field" style="display:flex;align-items:center;gap:10px;padding-top:4px">
              <input type="checkbox" id="f-active" ${j.active !== false ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--brand-500);cursor:pointer" />
              <label for="f-active" style="cursor:pointer;margin:0">Active — visible to all users</label>
            </div>

          </div>
          <div class="admin-modal-foot">
            <button class="btn btn-secondary" id="cancelJobModal">Cancel</button>
            <button class="btn btn-primary" id="saveJobModal">${I("check")} Save Job</button>
          </div>
        </div>
      </div>`;
  }

  /* ── Wire Events ─────────────────────────────────────────── */
  function wireEvents() {
    document.querySelectorAll("[data-icon]").forEach(el => {
      el.innerHTML = window.Traqio.icons.render(el.getAttribute("data-icon")) || "";
    });

    document.getElementById("addJobBtn")?.addEventListener("click", () => openModal(null));
    document.getElementById("closeJobModal")?.addEventListener("click", closeModal);
    document.getElementById("cancelJobModal")?.addEventListener("click", closeModal);
    document.getElementById("saveJobModal")?.addEventListener("click", saveJob);

    document.getElementById("jobModalOverlay")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.querySelectorAll(".edit-job-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const job = allJobs.find(j => j.id === btn.dataset.id);
        if (job) openModal(job);
      });
    });

    document.querySelectorAll(".del-job-btn").forEach(btn => {
      btn.addEventListener("click", () => deleteJob(btn.dataset.id));
    });

    wireLogoPreview();
    wireSkillSelector();
    wireListManagement();
    wireCompanies();

    ["f-salary-min", "f-salary-max"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        const raw = el.value.replace(/\./g, "").replace(/\D/g, "");
        el.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      });
      el.addEventListener("keypress", e => { if (!/[0-9]/.test(e.key)) e.preventDefault(); });
    });

    document.getElementById("prefChipsGrid")?.addEventListener("click", e => {
      const chip = e.target.closest(".pref-chip");
      if (!chip) return;
      const cb = chip.querySelector("input[type=checkbox]");
      if (!cb) return;
      cb.checked = !cb.checked;
      chip.classList.toggle("checked", cb.checked);
    });
  }

  /* ── Skills Chip Selector ────────────────────────────────── */
  function wireSkillSelector() {
    const search   = document.getElementById("skillSearch");
    const dropdown = document.getElementById("skillsDropdown");
    const selected = document.getElementById("skillsSelected");
    if (!search || !dropdown || !selected) return;

    const allSkills = loadList(SKILLS_KEY, DEFAULT_SKILLS);

    function getSelected() {
      return Array.from(selected.querySelectorAll(".skill-selected-chip"))
        .map(el => el.dataset.skill).filter(Boolean);
    }

    function addSkill(skill) {
      if (getSelected().includes(skill)) return;
      selected.querySelector(".skills-empty-hint")?.remove();
      const chip = document.createElement("span");
      chip.className = "skill-selected-chip";
      chip.dataset.skill = skill;
      chip.innerHTML = `${esc(skill)}<button class="skill-chip-remove" type="button">×</button>`;
      chip.querySelector(".skill-chip-remove").addEventListener("click", e => {
        e.stopPropagation();
        chip.remove();
        if (!getSelected().length) {
          selected.innerHTML = `<span class="skills-empty-hint">Belum ada skill dipilih</span>`;
        }
      });
      selected.appendChild(chip);
    }

    function showDropdown(q) {
      const current  = getSelected();
      const filtered = allSkills.filter(s =>
        s.toLowerCase().includes(q.toLowerCase()) && !current.includes(s)
      );
      dropdown.innerHTML = filtered.length
        ? filtered.map(s => `<div class="skill-option" data-skill="${esc(s)}">${esc(s)}</div>`).join("")
        : `<div class="skill-option-empty">Tidak ada skill yang cocok</div>`;
      dropdown.querySelectorAll(".skill-option").forEach(el => {
        el.addEventListener("mousedown", e => {
          e.preventDefault();
          addSkill(el.dataset.skill);
          search.value = "";
          dropdown.style.display = "none";
        });
      });
      dropdown.style.display = "";
    }

    search.addEventListener("input",  () => search.value.trim() ? showDropdown(search.value) : (dropdown.style.display = "none"));
    search.addEventListener("focus",  () => search.value.trim() && showDropdown(search.value));
    search.addEventListener("blur",   () => setTimeout(() => { dropdown.style.display = "none"; }, 150));

    // Wire existing chips (pre-filled when editing)
    selected.querySelectorAll(".skill-chip-remove").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".skill-selected-chip")?.remove();
        if (!getSelected().length) {
          selected.innerHTML = `<span class="skills-empty-hint">Belum ada skill dipilih</span>`;
        }
      });
    });
  }

  /* ── Master List Management ──────────────────────────────── */
  function wireListManagement() {
    document.querySelectorAll(".config-chip-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const { key, defaults } = listMeta(btn.dataset.list);
        if (!key) return;
        const items = loadList(key, defaults).filter(i => i !== btn.dataset.val);
        saveList(key, items);
        refreshMasterLists();
      });
    });

    document.querySelectorAll(".config-add-btn").forEach(btn => {
      const listId = btn.dataset.list;
      const input  = document.getElementById(`${listId}-input`);

      function doAdd() {
        const val = input?.value.trim();
        if (!val) return;
        const { key, defaults } = listMeta(listId);
        if (!key) return;
        const items = loadList(key, defaults);
        if (!items.includes(val)) { items.push(val); saveList(key, items); }
        if (input) input.value = "";
        refreshMasterLists();
      }

      btn.addEventListener("click", doAdd);
      input?.addEventListener("keydown", e => { if (e.key === "Enter") doAdd(); });
    });
  }

  function refreshMasterLists() {
    const section = document.querySelector(".admin-lists-section");
    if (!section) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = renderMasterLists();
    section.replaceWith(tmp.firstElementChild);
    wireListManagement();
  }

  /* ── Companies Wire ─────────────────────────────────────── */
  function wireCompanies() {
    function refreshCompanies() {
      const section = document.getElementById("companiesSection");
      if (!section) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = renderCompanies();
      section.replaceWith(tmp.firstElementChild);
      wireCompanies();
    }

    document.getElementById("addCompanyBtn")?.addEventListener("click", () => {
      const nameInput = document.getElementById("new-company-name");
      const logoInput = document.getElementById("new-company-logo");
      const name = nameInput?.value.trim();
      if (!name) { window.Traqio.toast("Company name is required", "error"); return; }
      const companies = loadCompanies();
      if (!companies.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        companies.push({ name, logo_url: logoInput?.value.trim() || "" });
        saveCompanies(companies);
      }
      if (nameInput) nameInput.value = "";
      if (logoInput) logoInput.value = "";
      window.Traqio.toast("Company added", "success");
      refreshCompanies();
    });

    document.getElementById("new-company-name")?.addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("addCompanyBtn")?.click();
    });

    document.querySelectorAll(".del-company-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.name;
        const companies = loadCompanies().filter(c => c.name !== name);
        saveCompanies(companies);
        refreshCompanies();
      });
    });
  }

  /* ── Logo Preview ────────────────────────────────────────── */
  function wireLogoPreview() {
    const preview     = document.getElementById("logoPreview");
    const fileInput   = document.getElementById("f-logo-file");
    const urlInput    = document.getElementById("f-logo-url");
    const colorInput  = document.getElementById("f-color");
    const companyInput = document.getElementById("f-company");

    function updatePreview(src, color, letter) {
      if (!preview) return;
      if (src) {
        preview.style.background = "var(--bg-surface-2)";
        preview.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">`;
      } else {
        preview.style.background = color || "#3b82f6";
        preview.textContent = (letter || "A").charAt(0).toUpperCase();
      }
    }

    fileInput?.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      _logoFile = file;
      const reader = new FileReader();
      reader.onload = e => updatePreview(e.target.result, null, null);
      reader.readAsDataURL(file);
    });
    urlInput?.addEventListener("input",   () => { if (!_logoFile) updatePreview(urlInput.value.trim(), null, null); });
    colorInput?.addEventListener("input", () => { if (!_logoFile && !urlInput?.value.trim() && preview) preview.style.background = colorInput.value; });
    companyInput?.addEventListener("input", () => { if (!_logoFile && !urlInput?.value.trim() && preview) preview.textContent = (companyInput.value || "A").charAt(0).toUpperCase(); });
  }

  /* ── Modal Open / Close ──────────────────────────────────── */
  function openModal(job) {
    editing = job;
    _logoFile = null;
    render();
    document.getElementById("jobModalOverlay")?.classList.add("open");
  }

  function closeModal() {
    editing = null;
    _logoFile = null;
    document.getElementById("jobModalOverlay")?.classList.remove("open");
  }

  /* ── Save ────────────────────────────────────────────────── */
  async function saveJob() {
    const company  = document.getElementById("f-company")?.value.trim();
    const position = document.getElementById("f-position")?.value.trim();
    const location = document.getElementById("f-location")?.value.trim();

    if (!company || !position || !location) {
      window.Traqio.toast("Company, Position, and Location are required", "error");
      return;
    }

    const saveBtn = document.getElementById("saveJobModal");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

    try {
      let logoUrl = document.getElementById("f-logo-url")?.value.trim() || "";
      if (_logoFile) {
        window.Traqio.toast("Uploading logo…");
        logoUrl = await window.Traqio.supabase.jobs.uploadLogo(_logoFile);
      }

      const tags = Array.from(
        document.querySelectorAll("#skillsSelected .skill-selected-chip")
      ).map(el => el.dataset.skill).filter(Boolean);

      const salaryMin = parseRp(document.getElementById("f-salary-min")?.value || "");
      const salaryMax = parseRp(document.getElementById("f-salary-max")?.value || "");
      const salaryStr = salaryMin && salaryMax
        ? `Rp ${formatRp(salaryMin)} – Rp ${formatRp(salaryMax)}`
        : salaryMin ? `Rp ${formatRp(salaryMin)}` : "";

      const preferences = Array.from(
        document.querySelectorAll("#prefChipsGrid input[type=checkbox]:checked")
      ).map(cb => cb.value);

      const job = {
        ...(editing?.id ? { id: editing.id } : {}),
        company,
        position,
        industry:     document.getElementById("f-industry")?.value     || "",
        location,
        salary:       salaryStr,
        salary_min:   salaryMin || null,
        salary_max:   salaryMax || null,
        type:         document.getElementById("f-type")?.value         || "Full-time",
        description:  document.getElementById("f-desc")?.value.trim()  || "",
        requirements: document.getElementById("f-req")?.value.trim()   || "",
        tags,
        preferences,
        apply_url:    document.getElementById("f-apply-url")?.value.trim() || "",
        logo_url:     logoUrl,
        logo_color:   document.getElementById("f-color")?.value || "#3b82f6",
        active:       document.getElementById("f-active")?.checked ?? true,
      };

      await window.Traqio.supabase.jobs.upsert(job);
      window.Traqio.toast(editing ? "Job updated" : "Job added", "success");
      editing = null;
      _logoFile = null;
      allJobs = await loadJobs();
      render();
    } catch (err) {
      window.Traqio.toast("Error: " + err.message, "error");
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Job"; }
    }
  }

  /* ── Delete ──────────────────────────────────────────────── */
  async function deleteJob(id) {
    const job = allJobs.find(j => j.id === id);
    if (!job) return;
    if (!confirm(`Delete "${job.position}" at ${job.company}? This cannot be undone.`)) return;
    try {
      await window.Traqio.supabase.jobs.remove(id);
      window.Traqio.toast("Job deleted", "success");
      allJobs = await loadJobs();
      render();
    } catch (err) {
      window.Traqio.toast("Delete failed: " + err.message, "error");
    }
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function formatRp(val) {
    return String(val).replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function parseRp(val) {
    return parseInt(String(val).replace(/\./g, ""), 10) || 0;
  }

  /* ── Init ────────────────────────────────────────────────── */
  setTimeout(async function init() {
    if (!window.Traqio?.user) {
      await new Promise(r => document.addEventListener("traqio:auth-ready", r, { once: true }));
    }
    try {
      allJobs = await loadJobs();
    } catch (e) {
      window.Traqio.toast("Could not load jobs: " + e.message, "error");
    }
    render();
  }, 0);
})();
