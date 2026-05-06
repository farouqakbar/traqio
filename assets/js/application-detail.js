/* TRAQIO — Application Detail page v2
 *
 * Jobseeker-first UX enhancements:
 * 1. Stage → status sync: marking a stage "current" auto-suggests updating app status
 * 2. Quick stage templates (common hiring stages pre-filled)
 * 3. Stage "Mark done / Mark current" one-click buttons
 * 4. Note pin / search
 * 5. "Today I" quick note shortcuts (reflection, prep, follow-up)
 * 6. Application health score in sidebar
 * 7. Auto-reminders for stale applications
 */
(function () {
  const I = (n) => window.Traqio?.icons?.render(n) || "";
  let _detailJobs = [];
  let _isDirty = false;
  let _noteFilter = "all";

  window.addEventListener("beforeunload", (e) => {
    if (_isDirty) { e.preventDefault(); e.returnValue = ""; }
  });

  function fmt(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function fmtRel(iso) {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return fmt(iso);
  }

  function getId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  function logoFor(app) {
    const job = _detailJobs.find(
      (j) => j.id === app.jobId || j.id === app.job_id,
    );
    const url = job?.logo_url || app.logo_url;
    if (url)
      return {
        html: `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:6px" onerror="this.style.display='none'">`,
        bg: "var(--bg-surface-2)",
      };
    return {
      html: escHtml(app.logo || (app.company || "?").charAt(0).toUpperCase()),
      bg: app.color || "#3b82f6",
    };
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Load custom columns for status display ───────────────────────────────────
  function loadColumns() {
    const DEFAULT = [
      { key: "saved", label: "Saved", color: "#94a3b8", emoji: "🔖" },
      { key: "applied", label: "Applied", color: "#3b82f6", emoji: "📤" },
      { key: "interview", label: "Interview", color: "#8b5cf6", emoji: "🎯" },
      { key: "offer", label: "Offer", color: "#10b981", emoji: "🎉" },
      { key: "rejected", label: "Rejected", color: "#ef4444", emoji: "❌" },
    ];
    try {
      const raw = localStorage.getItem("traqio:columns:v1");
      if (raw) {
        const cols = JSON.parse(raw);
        if (Array.isArray(cols) && cols.length > 0) return cols;
      }
    } catch (e) {}
    return DEFAULT;
  }

  const COLUMNS = loadColumns();

  function getColInfo(status) {
    return (
      COLUMNS.find((c) => c.key === status) || {
        label: status,
        color: "#94a3b8",
        emoji: "📋",
      }
    );
  }

  // ── APPLICATION HEALTH SCORE ─────────────────────────────────────────────────
  function calcHealth(app) {
    let score = 0;
    const checks = [];
    if (app.stages?.length > 0) {
      score += 20;
      checks.push({ ok: true, label: "Has stage history" });
    } else {
      checks.push({ ok: false, label: "No stages recorded" });
    }

    if (app.notes?.length > 0) {
      score += 15;
      checks.push({ ok: true, label: "Has notes" });
    } else {
      checks.push({ ok: false, label: "No notes yet" });
    }

    if (app.location) {
      score += 10;
      checks.push({ ok: true, label: "Location filled" });
    } else {
      checks.push({ ok: false, label: "Location missing" });
    }

    if (app.salary) {
      score += 10;
      checks.push({ ok: true, label: "Salary noted" });
    } else {
      checks.push({ ok: false, label: "Salary not noted" });
    }

    if (app.link) {
      score += 15;
      checks.push({ ok: true, label: "Job link saved" });
    } else {
      checks.push({ ok: false, label: "No job link" });
    }

    if (app.source) {
      score += 10;
      checks.push({ ok: true, label: "Source tracked" });
    } else {
      checks.push({ ok: false, label: "Source unknown" });
    }

    const lastActive =
      app.notes?.[0]?.createdAt ||
      app.stages?.[app.stages.length - 1]?.date ||
      app.appliedAt;
    if (lastActive) {
      const days = Math.floor((Date.now() - new Date(lastActive)) / 86400000);
      if (days <= 7) {
        score += 20;
        checks.push({ ok: true, label: "Active this week" });
      } else if (days <= 30) {
        score += 10;
        checks.push({ ok: true, label: "Active this month" });
      } else {
        checks.push({ ok: false, label: "No recent activity" });
      }
    }

    return { score: Math.min(score, 100), checks };
  }

  // ── STAGE RENDER ─────────────────────────────────────────────────────────────
  function stageDot(state) {
    const map = { done: I("check"), current: I("star"), upcoming: I("flag") };
    return `<div class="stage-dot ${state}">${map[state] || ""}</div>`;
  }

  function stageCard(stage, appId) {
    const isCurrent = stage.state === "current";
    const isDone = stage.state === "done";
    const daysBadge = stage.date
      ? (() => {
          const d = Math.floor((Date.now() - new Date(stage.date)) / 86400000);
          if (d === 0)
            return `<span class="stage-badge badge-today">Today</span>`;
          if (d > 0 && d <= 3)
            return `<span class="stage-badge badge-recent">${d}d ago</span>`;
          if (d < 0)
            return `<span class="stage-badge badge-upcoming">In ${Math.abs(d)}d</span>`;
          return "";
        })()
      : "";

    return `
      <div class="stage-item" data-sid="${stage.id}">
        ${stageDot(stage.state)}
        <div class="stage-card ${isCurrent ? "current" : ""}">
          <div class="stage-card-head">
            <div>
              <div class="name">${escHtml(stage.name)}</div>
              ${stage.date ? `<div class="date">${I("calendar")} ${fmt(stage.date)} ${daysBadge}</div>` : ""}
            </div>
            <div class="stage-actions-wrap">
              ${!isDone ? `<button class="btn btn-ghost btn-sm mark-done-btn" data-sid="${stage.id}" title="Mark as done ✓">✓ Done</button>` : ""}
              ${!isCurrent ? `<button class="btn btn-ghost btn-sm mark-current-btn" data-sid="${stage.id}" title="Set as current stage">★ Current</button>` : ""}
              <div class="actions">
                <button class="btn btn-ghost btn-sm edit-stage" data-sid="${stage.id}" title="Edit">${I("edit")}</button>
                <button class="btn btn-ghost btn-sm del-stage" data-sid="${stage.id}" title="Delete">${I("trash")}</button>
              </div>
            </div>
          </div>
          ${
            stage.note
              ? `<div class="stage-note">${escHtml(stage.note)}</div>`
              : `<div class="stage-note empty" onclick="openStageEditFromNote('${stage.id}')">Click to add prep notes, questions, or reflections…</div>`
          }
        </div>
      </div>`;
  }

  // ── QUICK STAGE TEMPLATES ────────────────────────────────────────────────────
  const STAGE_TEMPLATES = [
    { name: "Application Submitted", state: "done", note: "" },
    {
      name: "Online Assessment",
      state: "upcoming",
      note: "Prepare: LeetCode, HackerRank, system design",
    },
    {
      name: "HR Screening",
      state: "upcoming",
      note: "Questions to expect: salary expectations, notice period, motivation",
    },
    {
      name: "Technical Interview",
      state: "upcoming",
      note: "Topics: DSA, system design, past projects, STAR stories",
    },
    {
      name: "Case Study / Take-home",
      state: "upcoming",
      note: "Deadline: | Tools allowed: | Submit via: ",
    },
    {
      name: "Final Interview (C-Suite)",
      state: "upcoming",
      note: "Research: company direction, recent news, culture",
    },
    {
      name: "Offer Received",
      state: "done",
      note: "Salary: | Benefits: | Start date: | Deadline to decide: ",
    },
    {
      name: "Offer Negotiation",
      state: "current",
      note: "Counter offer: | Leverage: ",
    },
    { name: "Reference Check", state: "current", note: "Referees contacted: " },
    { name: "Background Check", state: "current", note: "" },
  ];

  // ── NOTE CARD ────────────────────────────────────────────────────────────────
  function noteCard(note, appId) {
    const pinClass = note.pinned ? "pinned" : "";
    return `
      <div class="note-card ${pinClass}" data-nid="${note.id}">
        <div class="note-head">
          <div class="note-date">${fmtRel(note.createdAt)}</div>
          <div style="display:flex;gap:4px;align-items:center">
            ${note.tag ? `<span class="note-tag note-tag-${note.tag}">${note.tag}</span>` : ""}
            <button class="btn btn-ghost btn-sm pin-note" data-nid="${note.id}" title="${note.pinned ? "Unpin note" : "Pin note"}" style="opacity:${note.pinned ? "1" : "0"};font-size:.85rem">${note.pinned ? "📌" : "☆"}</button>
            <button class="btn btn-ghost btn-sm note-del" data-nid="${note.id}" title="Delete" style="opacity:0">${I("trash")}</button>
          </div>
        </div>
        <div class="note-body">${escHtml(note.text)}</div>
      </div>`;
  }

  // ── SIDEBAR ──────────────────────────────────────────────────────────────────
  function sidePanel(app) {
    const col = getColInfo(app.status);
    const health = calcHealth(app);
    const healthColor =
      health.score >= 80
        ? "#10b981"
        : health.score >= 50
          ? "#f59e0b"
          : "#ef4444";
    const healthLabel =
      health.score >= 80 ? "Strong" : health.score >= 50 ? "Fair" : "Weak";

    const daysSinceApplied = app.appliedAt
      ? Math.floor((Date.now() - new Date(app.appliedAt)) / 86400000)
      : null;

    const staleBanner =
      daysSinceApplied && daysSinceApplied > 14 && app.status === "applied"
        ? `<div class="stale-banner">⚠️ No update in ${daysSinceApplied} days. Consider following up!</div>`
        : "";

    const rows = [
      [
        "Status",
        `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:${col.color}22;color:${col.color};font-size:.8rem;font-weight:600;border:1px solid ${col.color}44">${col.emoji} ${col.label}</span>`,
      ],
      ["Location", escHtml(app.location) || "—"],
      ["Salary", escHtml(app.salary) || "—"],
      ["Applied", fmt(app.appliedAt) || "—"],
      ["Source", escHtml(app.source) || "—"],
      [
        "Days since applied",
        daysSinceApplied != null ? `${daysSinceApplied}d` : "—",
      ],
      ["Last updated", app.updatedAt ? fmt(app.updatedAt) : "—"],
    ];

    const colOptions = loadColumns()
      .map(
        (c) =>
          `<option value="${c.key}" ${app.status === c.key ? "selected" : ""}>${c.emoji || ""} ${c.label}</option>`,
      )
      .join("");

    return `
      <div class="side-panel" id="sidePanel">
        ${staleBanner}

        <!-- Profile card -->
        <div class="info-card">
          <h4>Application Info</h4>
          ${rows.map(([l, v]) => `<div class="info-row"><span class="lbl">${l}</span><span class="val">${v}</span></div>`).join("")}
          <div class="info-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:10px;">
            <span class="lbl">Quick status</span>
            <select class="select" id="quickStatusSelect" style="font-size:.78rem;padding:3px 6px;width:auto"
                    onchange="window.__traqioQuickStatus && window.__traqioQuickStatus(this.value)">
              ${colOptions}
            </select>
          </div>
        </div>

        <!-- Health score -->
        <div class="info-card">
          <h4 style="display:flex;align-items:center;justify-content:space-between">
            Profile Completeness
            <span style="color:${healthColor};font-size:.85rem;font-weight:700">${healthLabel} · ${health.score}%</span>
          </h4>
          <div class="progress" style="margin-bottom:12px;height:6px">
            <span style="width:${health.score}%;background:${healthColor}"></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${health.checks
              .map(
                (c) => `
              <div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--text-secondary)">
                <span style="color:${c.ok ? "#10b981" : "#94a3b8"};font-size:.85rem">${c.ok ? "✓" : "○"}</span>
                ${c.label}
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="info-card">
          <h4>Quick Actions</h4>
          <div class="quick-actions">
            <button class="btn btn-primary" id="addStageBtn">${I("plus")} Add Stage</button>
            <button class="btn btn-secondary" id="editAppBtn">${I("edit")} Edit Application</button>
            ${
              app.link
                ? `
              <div style="display:flex;gap:6px">
                <a href="${escHtml(app.link)}" target="_blank" rel="noopener" class="btn btn-secondary" style="flex:1">${I("link")} View Job</a>
                <button class="btn btn-ghost" id="copyLinkBtn" title="Copy link" style="padding:0 10px" data-link="${escHtml(app.link)}">${I("copy") || "⎘"}</button>
              </div>`
                : ""
            }
            <button class="btn btn-danger" id="deleteAppBtn">${I("trash")} Delete</button>
          </div>
        </div>

        <!-- Interview prep checklist (persistent + customizable) -->
        <div class="info-card tips-card">
          ${(() => {
            const defaultItems = [
              "Research the company & team",
              "Prepare 3 STAR stories",
              "Study the JD tech stack",
              "Prepare 5 questions to ask",
              "Write post-interview reflection",
              "Send thank-you email within 24h",
            ];
            const customItems  = app.prepChecklistItems || [];
            const totalChecked = (app.prepChecklist || []).filter(Boolean).length
              + (app.prepChecklistCustom || []).filter(Boolean).length;
            const total = defaultItems.length + customItems.length;
            const defaultRows = defaultItems.map((item, i) => `
              <label class="tip-check" style="cursor:pointer">
                <input type="checkbox" data-prep-idx="${i}" ${(app.prepChecklist || [])[i] ? "checked" : ""}> ${escHtml(item)}
              </label>`).join("");
            const customRows = customItems.map((item, i) => `
              <label class="tip-check" style="cursor:pointer;display:flex;align-items:center;gap:6px">
                <input type="checkbox" data-prep-custom-idx="${i}" ${(app.prepChecklistCustom || [])[i] ? "checked" : ""} style="flex-shrink:0">
                <span style="flex:1;font-size:.83rem">${escHtml(item)}</span>
                <button class="btn btn-ghost del-prep-custom" data-prep-custom-del="${i}" title="Remove" style="padding:2px 6px;font-size:.7rem;opacity:.5;flex-shrink:0">✕</button>
              </label>`).join("");
            return `
              <h4 style="display:flex;align-items:center;justify-content:space-between">
                ${I("sparkles")} Prep Checklist
                <span style="font-size:.75rem;font-weight:400;color:var(--text-muted)">${totalChecked}/${total} done</span>
              </h4>
              ${defaultRows}
              ${customRows}
              <div style="display:flex;gap:6px;margin-top:8px">
                <input id="prepCustomInput" class="input" placeholder="Add custom item…" style="flex:1;font-size:.82rem;padding:7px 10px;height:auto"/>
                <button id="prepCustomAdd" class="btn btn-secondary btn-sm" style="flex-shrink:0">Add</button>
              </div>`;
          })()}
        </div>
      </div>`;
  }

  // ── FULL PAGE RENDER ─────────────────────────────────────────────────────────
  function render(app) {
    const col = getColInfo(app.status);

    const html = `
      <main class="page">
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <a href="applications.html" class="btn btn-ghost btn-sm" style="gap:5px">◀ Back</a>
          <span style="color:var(--text-muted);font-size:.83rem">/ <a href="applications.html" style="color:var(--text-muted)">${escHtml(col.label)}</a> / ${escHtml(app.company)}</span>
        </div>

        <!-- App header -->
        <div class="app-header">
          <div class="logo" style="background:${logoFor(app).bg}">${logoFor(app).html}</div>
          <div class="info">
            <h1>${escHtml(app.company)}</h1>
            <div class="role">${escHtml(app.position)}</div>
            <div class="meta-row">
              ${app.location ? `<span class="chip">${I("map")} ${escHtml(app.location)}</span>` : ""}
              ${app.salary ? `<span class="chip">💰 ${escHtml(app.salary)}</span>` : ""}
              ${app.appliedAt ? `<span class="chip">${I("calendar")} Applied ${fmt(app.appliedAt)}</span>` : ""}
              ${app.source ? `<span class="chip">${I("link")} ${escHtml(app.source)}</span>` : ""}
            </div>
          </div>
          <div class="actions">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;background:${col.color}22;color:${col.color};font-size:.85rem;font-weight:600;border:1px solid ${col.color}44">
              ${col.emoji} ${col.label}
            </span>
          </div>
        </div>

        <div class="detail-layout">
          <!-- LEFT -->
          <div>
            <!-- Stage Tracker -->
            <div class="section">
              <div class="section-title">
                <div class="left">
                  <div class="icon-wrap">${I("map")}</div>
                  <div>
                    <div>Hiring Journey</div>
                    <div style="font-size:.76rem;font-weight:400;color:var(--text-muted)">Every step of the process</div>
                  </div>
                </div>
                <!-- Stage templates dropdown -->
                <div style="position:relative" id="templateWrap">
                  <button class="btn btn-secondary btn-sm" id="templateBtn">⚡ Quick Add</button>
                </div>
              </div>

              <div class="stage-tracker" id="stageTracker">
                <div class="stage-line"></div>
                ${(app.stages || []).map((s) => stageCard(s, app.id)).join("") || ""}
              </div>
              <button class="add-stage-btn" id="addStageBtnMain">${I("plus")} Add a stage</button>
            </div>

            <!-- Notes / Journal -->
            <div class="section">
              <div class="section-title">
                <div class="left">
                  <div class="icon-wrap">${I("journal")}</div>
                  <div>
                    <div>Journal</div>
                    <div style="font-size:.76rem;font-weight:400;color:var(--text-muted)">Notes, reflections, reminders</div>
                  </div>
                </div>
              </div>

              <!-- Quick note shortcuts -->
              <div class="note-shortcuts">
                <button class="note-shortcut" data-prefix="🎯 Interview reflection: " data-tag="reflection">🎯 Reflection</button>
                <button class="note-shortcut" data-prefix="📝 Prep notes: " data-tag="prep">📝 Prep</button>
                <button class="note-shortcut" data-prefix="📞 Follow-up: " data-tag="followup">📞 Follow-up</button>
                <button class="note-shortcut" data-prefix="💡 Idea / insight: " data-tag="idea">💡 Insight</button>
              </div>

              <div class="note-compose">
                <textarea id="noteInput" placeholder="Write a note… (Ctrl+Enter to save)"></textarea>
                <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
                  <input type="hidden" id="noteTag" value="">
                  <button class="btn btn-primary" id="addNoteBtn" style="width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center">${I("plus")}</button>
                </div>
              </div>

              <div class="note-filter-chips" id="noteFilterChips">
                <button class="note-chip ${_noteFilter === "all" ? "active" : ""}" data-filter="all">All</button>
                <button class="note-chip ${_noteFilter === "reflection" ? "active" : ""}" data-filter="reflection">🎯 Reflection</button>
                <button class="note-chip ${_noteFilter === "prep" ? "active" : ""}" data-filter="prep">📝 Prep</button>
                <button class="note-chip ${_noteFilter === "followup" ? "active" : ""}" data-filter="followup">📞 Follow-up</button>
                <button class="note-chip ${_noteFilter === "idea" ? "active" : ""}" data-filter="idea">💡 Insight</button>
              </div>

              <div id="notesList">
                ${renderNotesList(app)}
              </div>
            </div>
          </div>

          <!-- RIGHT: sidebar -->
          ${sidePanel(app)}
        </div>
      </main>`;

    window.Traqio?.shell?.mount("applications", html);
    wireEvents(app.id);
  }

  function renderNotesList(app) {
    let notes = [...(app.notes || [])].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    if (_noteFilter !== "all") {
      notes = notes.filter((n) => n.tag === _noteFilter);
    }
    if (!notes.length) {
      const msg = _noteFilter === "all"
        ? "Use the shortcuts above or write freely below."
        : `No ${_noteFilter} notes yet.`;
      return `<div class="empty-state" style="padding:20px 0"><div class="icon">${I("journal")}</div><h3>No notes yet</h3><p>${msg}</p></div>`;
    }
    return notes.map((n) => noteCard(n, app.id)).join("");
  }

  // ── WIRE EVENTS ──────────────────────────────────────────────────────────────
  let editingStageId = null;
  let pendingNoteTag = "";

  function wireSidePanelCollapse() {
    if (window.innerWidth > 768) return; // desktop: always expanded
    const panel = document.getElementById("sidePanel");
    if (!panel) return;
    panel.querySelectorAll(".info-card").forEach((card, i) => {
      const h4 = card.querySelector("h4");
      if (!h4) return;
      // Quick Actions card stays open by default; others collapsed on mobile
      const startOpen = i === 2; // Quick Actions is 3rd card (index 2)
      if (!startOpen) card.classList.add("info-card--collapsed");
      h4.style.cursor = "pointer";
      h4.style.userSelect = "none";
      const arrow = document.createElement("span");
      arrow.className = "info-card-arrow";
      arrow.textContent = startOpen ? "▲" : "▼";
      arrow.style.cssText = "font-size:.7rem;opacity:.5;margin-left:auto;flex-shrink:0";
      h4.style.display = "flex";
      h4.style.alignItems = "center";
      h4.style.justifyContent = "space-between";
      h4.appendChild(arrow);
      h4.addEventListener("click", () => {
        const collapsed = card.classList.toggle("info-card--collapsed");
        arrow.textContent = collapsed ? "▼" : "▲";
      });
    });
  }

  function wireEvents(appId) {
    // Icon render for [data-icon]
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML =
        window.Traqio?.icons?.render(el.getAttribute("data-icon")) || "";
    });

    wireSidePanelCollapse();

    // Quick status change
    window.__traqioQuickStatus = function (newStatus) {
      window.Traqio?.store?.applications?.update(appId, { status: newStatus });
      syncToSupabase(appId);
      window.Traqio?.toast?.(`Status updated`, "success");
      reload(appId);
    };

    // ── Stage: Add / Edit / Delete / Mark done / Mark current ──
    const openStageModal = (prefill) => {
      editingStageId = null;
      document.getElementById("stageModalTitle").textContent = "Add Stage";
      document.getElementById("sm-name").value = prefill?.name || "";
      document.getElementById("sm-date").value = new Date()
        .toISOString()
        .slice(0, 10);
      document.getElementById("sm-state").value = prefill?.state || "upcoming";
      document.getElementById("sm-note").value = prefill?.note || "";
      document.getElementById("stageModal").classList.add("open");
    };

    document
      .getElementById("addStageBtn")
      ?.addEventListener("click", () => openStageModal());
    document
      .getElementById("addStageBtnMain")
      ?.addEventListener("click", () => openStageModal());

    // Quick add template menu - FIXED VERSION (position absolute, tidak ikut scroll)
    const templateBtn = document.getElementById("templateBtn");
    const templateWrap = document.getElementById("templateWrap");

    templateBtn?.addEventListener("click", (e) => {
      e.stopPropagation();

      // Remove existing menu if any
      const existingMenu = document.getElementById("__templateMenu");
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement("div");
      menu.id = "__templateMenu";
      menu.className = "quick-menu";

      const stateMap = {
        done: {
          icon: "✓",
          color: "#10b981",
          dotBg: "#d1fae5",
          badgeBg: "#d1fae5",
          label: "Done",
        },
        current: {
          icon: "★",
          color: "#3b82f6",
          dotBg: "#dbeafe",
          badgeBg: "#dbeafe",
          label: "Active",
        },
        upcoming: {
          icon: "○",
          color: "#64748b",
          dotBg: "#e2e8f0",
          badgeBg: "#e2e8f0",
          label: "Upcoming",
        },
      };

      menu.innerHTML = `
        <div class="qm-section-label">⚡ Quick Stage Templates</div>
        ${STAGE_TEMPLATES.map((t) => {
          const s = stateMap[t.state] || stateMap.upcoming;
          return `
            <button class="qm-template-card" data-template='${JSON.stringify(t)}'>
              <span class="qm-tc-dot" style="background: ${s.dotBg}; color: ${s.color}">${s.icon}</span>
              <span class="qm-tc-name">${escHtml(t.name)}</span>
              <span class="qm-tc-badge" style="background: ${s.badgeBg}; color: ${s.color}">${s.label}</span>
            </button>`;
        }).join("")}`;

      // Append menu to templateWrap (relative container)
      templateWrap.appendChild(menu);

      // Add click handlers to each template card
      const cards = menu.querySelectorAll(".qm-template-card");
      cards.forEach((card) => {
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const templateData = JSON.parse(card.dataset.template);
          openStageModal(templateData);
          menu.remove();
        });

        // Add hover effects
        card.addEventListener("mouseenter", () => {
          card.style.background = "var(--bg-surface-2)";
          card.style.borderColor = "var(--brand-500)";
          card.style.transform = "translateX(2px)";
        });

        card.addEventListener("mouseleave", () => {
          card.style.background = "var(--bg-surface)";
          card.style.borderColor = "var(--border)";
          card.style.transform = "translateX(0)";
        });
      });

      // Close on click outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== templateBtn) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      };

      setTimeout(() => {
        document.addEventListener("click", closeMenu);
      }, 10);
    });

    window.openStageEditFromNote = function (sid) {
      const app = window.Traqio?.store?.applications?.get(appId);
      const s = app?.stages?.find((x) => x.id === sid);
      if (!s) return;
      editingStageId = sid;
      document.getElementById("stageModalTitle").textContent = "Edit Stage";
      document.getElementById("sm-name").value = s.name || "";
      document.getElementById("sm-date").value = s.date || "";
      document.getElementById("sm-state").value = s.state || "upcoming";
      document.getElementById("sm-note").value = s.note || "";
      document.getElementById("stageModal").classList.add("open");
      setTimeout(() => document.getElementById("sm-note")?.focus(), 100);
    };

    // Edit stage buttons
    document.querySelectorAll(".edit-stage").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const sid = btn.dataset.sid;
        const app = window.Traqio?.store?.applications?.get(appId);
        const s = app?.stages?.find((x) => x.id === sid);
        if (!s) return;
        editingStageId = sid;
        document.getElementById("stageModalTitle").textContent = "Edit Stage";
        document.getElementById("sm-name").value = s.name || "";
        document.getElementById("sm-date").value = s.date || "";
        document.getElementById("sm-state").value = s.state || "upcoming";
        document.getElementById("sm-note").value = s.note || "";
        document.getElementById("stageModal").classList.add("open");
      });
    });

    // Mark done
    document.querySelectorAll(".mark-done-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.Traqio?.store?.applications?.updateStage(
          appId,
          btn.dataset.sid,
          { state: "done" },
        );
        syncToSupabase(appId);
        window.Traqio?.toast?.("Stage marked done ✓", "success");
        reload(appId);
      });
    });

    // Mark current — also suggest status update
    document.querySelectorAll(".mark-current-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const sid = btn.dataset.sid;
        const app = window.Traqio?.store?.applications?.get(appId);
        const stage = app?.stages?.find((s) => s.id === sid);

        // Mark previous current as done
        app?.stages?.forEach((s) => {
          if (s.state === "current" && s.id !== sid) {
            window.Traqio?.store?.applications?.updateStage(appId, s.id, {
              state: "done",
            });
          }
        });

        window.Traqio?.store?.applications?.updateStage(appId, sid, {
          state: "current",
        });

        // Smart status suggestion
        const updatedApp = window.Traqio?.store?.applications?.get(appId);
        if (
          stage &&
          stage.name.toLowerCase().includes("interview") &&
          updatedApp?.status === "applied"
        ) {
          window.Traqio?.confirm?.(
            `🎯 Looks like you have an interview! Update status to "Interview"?`,
            "Update",
            "primary",
          ).then((ok) => {
            if (ok) {
              window.Traqio?.store?.applications?.update(appId, {
                status: "interview",
              });
              syncToSupabase(appId);
              reload(appId);
            }
          });
        } else if (
          stage &&
          stage.name.toLowerCase().includes("offer") &&
          !["offer", "rejected"].includes(updatedApp?.status)
        ) {
          window.Traqio?.confirm?.(
            `🎉 Offer stage! Update status to "Offer"?`,
            "Update",
            "primary",
          ).then((ok) => {
            if (ok) {
              window.Traqio?.store?.applications?.update(appId, {
                status: "offer",
              });
              syncToSupabase(appId);
              reload(appId);
            }
          });
        }

        syncToSupabase(appId);
        window.Traqio?.toast?.("Stage set as current", "success");
        reload(appId);
      });
    });

    // Delete stage
    document.querySelectorAll(".del-stage").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!(await window.Traqio?.confirm?.("Remove this stage?"))) return;
        window.Traqio?.store?.applications?.removeStage(appId, btn.dataset.sid);
        syncToSupabase(appId);
        window.Traqio?.toast?.("Stage removed", "success");
        reload(appId);
      });
    });

    // Static modal wiring (once)
    wireStaticModals(appId);

    // ── Notes ──
    document.querySelectorAll(".note-shortcut").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.getElementById("noteInput");
        const prefix = btn.dataset.prefix;
        pendingNoteTag = btn.dataset.tag;
        document.getElementById("noteTag").value = pendingNoteTag;
        input.value = prefix;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        document
          .querySelectorAll(".note-shortcut")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Single combined input handler (avoids duplicate listeners)
    document.getElementById("noteInput")?.addEventListener("input", () => {
      const val = document.getElementById("noteInput")?.value || "";
      _isDirty = !!val.trim();
      if (!val) {
        pendingNoteTag = "";
        document.getElementById("noteTag").value = "";
        document.querySelectorAll(".note-shortcut").forEach((b) => b.classList.remove("active"));
      }
    });

    document
      .getElementById("addNoteBtn")
      ?.addEventListener("click", () => { saveNote(appId); _isDirty = false; });
    document.getElementById("noteInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { saveNote(appId); _isDirty = false; }
    });

    // Note filter chips
    document.getElementById("noteFilterChips")?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      _noteFilter = chip.dataset.filter;
      document.querySelectorAll(".note-chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === _noteFilter));
      reloadNotes(appId);
    });

    // Note pin & delete (delegated)
    const notesList = document.getElementById("notesList");
    notesList?.addEventListener("click", async (e) => {
      const pinBtn = e.target.closest(".pin-note");
      const delBtn = e.target.closest(".note-del");
      if (pinBtn) {
        e.stopPropagation();
        const nid = pinBtn.dataset.nid;
        const app = window.Traqio?.store?.applications?.get(appId);
        const note = app?.notes?.find((n) => n.id === nid);
        if (note) {
          window.Traqio?.store?.applications?.updateNote?.(appId, nid, {
            pinned: !note.pinned,
          });
          syncToSupabase(appId);
          reloadNotes(appId);
        }
      }
      if (delBtn) {
        e.stopPropagation();
        if (!(await window.Traqio?.confirm?.("Delete this note?"))) return;
        window.Traqio?.store?.applications?.removeNote(
          appId,
          delBtn.dataset.nid,
        );
        syncToSupabase(appId);
        window.Traqio?.toast?.("Note deleted", "success");
        reloadNotes(appId);
      }
    });
    notesList?.addEventListener("mouseover", (e) => {
      const card = e.target.closest(".note-card");
      if (card) {
        const pinBtn = card.querySelector(".pin-note");
        const delBtn = card.querySelector(".note-del");
        if (pinBtn) pinBtn.style.opacity = "1";
        if (delBtn) delBtn.style.opacity = "1";
      }
    });
    notesList?.addEventListener("mouseout", (e) => {
      const card = e.target.closest(".note-card");
      if (card) {
        const pinBtn = card.querySelector(".pin-note");
        const delBtn = card.querySelector(".note-del");
        const note_app = window.Traqio?.store?.applications?.get(appId);
        const nid = card.dataset.nid;
        const note = note_app?.notes?.find((n) => n.id === nid);
        if (pinBtn) pinBtn.style.opacity = note?.pinned ? "1" : "0";
        if (delBtn) delBtn.style.opacity = "0";
      }
    });

    // Default prep checklist
    document.querySelectorAll("[data-prep-idx]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const cur = window.Traqio?.store?.applications?.get(appId);
        if (!cur) return;
        const prep = [...(cur.prepChecklist || Array(6).fill(false))];
        prep[parseInt(cb.dataset.prepIdx)] = cb.checked;
        window.Traqio.store.applications.update(appId, { prepChecklist: prep });
        syncToSupabase(appId);
        updatePrepCounter(appId);
      });
    });

    // Custom checklist — toggle
    document.querySelectorAll("[data-prep-custom-idx]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const cur = window.Traqio?.store?.applications?.get(appId);
        if (!cur) return;
        const items = cur.prepChecklistItems || [];
        const custom = [...(cur.prepChecklistCustom || Array(items.length).fill(false))];
        custom[parseInt(cb.dataset.prepCustomIdx)] = cb.checked;
        window.Traqio.store.applications.update(appId, { prepChecklistCustom: custom });
        syncToSupabase(appId);
        updatePrepCounter(appId);
      });
    });

    // Custom checklist — delete
    document.querySelectorAll("[data-prep-custom-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cur = window.Traqio?.store?.applications?.get(appId);
        if (!cur) return;
        const idx = parseInt(btn.dataset.prepCustomDel);
        const items  = [...(cur.prepChecklistItems || [])];
        const custom = [...(cur.prepChecklistCustom || [])];
        items.splice(idx, 1);
        custom.splice(idx, 1);
        window.Traqio.store.applications.update(appId, { prepChecklistItems: items, prepChecklistCustom: custom });
        syncToSupabase(appId);
        reload(appId);
      });
    });

    // Custom checklist — add
    const prepInput = document.getElementById("prepCustomInput");
    document.getElementById("prepCustomAdd")?.addEventListener("click", () => {
      const text = prepInput?.value.trim();
      if (!text) return;
      const cur = window.Traqio?.store?.applications?.get(appId);
      if (!cur) return;
      const items  = [...(cur.prepChecklistItems  || []), text];
      const custom = [...(cur.prepChecklistCustom || []), false];
      window.Traqio.store.applications.update(appId, { prepChecklistItems: items, prepChecklistCustom: custom });
      syncToSupabase(appId);
      reload(appId);
    });
    prepInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("prepCustomAdd")?.click();
    });

    // Copy job link
    document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
      const link = document.getElementById("copyLinkBtn")?.dataset.link;
      if (link)
        navigator.clipboard
          .writeText(link)
          .then(() => window.Traqio?.toast?.("Link copied!", "success"))
          .catch(() => window.Traqio?.toast?.("Could not copy", "error"));
    });

    // Edit & delete app
    document.getElementById("editAppBtn")?.addEventListener("click", () => {
      const app = window.Traqio?.store?.applications?.get(appId);
      document.getElementById("em-company").value = app.company || "";
      document.getElementById("em-position").value = app.position || "";
      document.getElementById("em-location").value = app.location || "";
      document.getElementById("em-salary").value = app.salary || "";
      document.getElementById("em-status").value = app.status || "applied";
      document.getElementById("em-source").value = app.source || "";
      document.getElementById("em-link").value = app.link || "";
      document.getElementById("editModal").classList.add("open");
    });

    document
      .getElementById("deleteAppBtn")
      ?.addEventListener("click", async () => {
        if (
          !(await window.Traqio?.confirm?.(
            "Permanently delete this application? This cannot be undone.",
            "Delete",
            "danger",
          ))
        )
          return;
        const cfg = window.TRAQIO_CONFIG || {};
        if (!cfg.DEMO_MODE) {
          await window.Traqio?.supabase?.applications
            ?.remove(appId)
            .catch((e) => console.warn(e));
        }
        window.Traqio?.store?.applications?.remove(appId);
        window.Traqio?.toast?.("Application deleted");
        window.location.href = "applications.html";
      });
  }

  function saveNote(appId) {
    const text = document.getElementById("noteInput").value.trim();
    if (!text) return;
    const tag = document.getElementById("noteTag").value || "";

    // Extend addNote to support tag if possible, else fallback
    if (window.Traqio?.store?.applications?.addNote) {
      const noteData = {
        id: "n" + Date.now(),
        text,
        tag,
        createdAt: new Date().toISOString(),
        pinned: false,
      };
      const app = window.Traqio.store.applications.get(appId);
      if (app) {
        app.notes = [noteData, ...(app.notes || [])];
        window.Traqio.store.applications.update(appId, { notes: app.notes });
        syncToSupabase(appId);
      }
    }

    document.getElementById("noteInput").value = "";
    pendingNoteTag = "";
    document.getElementById("noteTag").value = "";
    document
      .querySelectorAll(".note-shortcut")
      .forEach((b) => b.classList.remove("active"));
    window.Traqio?.toast?.("Note saved ✓", "success");
    reloadNotes(appId);
  }

  function updatePrepCounter(appId) {
    const cur = window.Traqio?.store?.applications?.get(appId);
    if (!cur) return;
    const defDone  = (cur.prepChecklist       || []).filter(Boolean).length;
    const custDone = (cur.prepChecklistCustom || []).filter(Boolean).length;
    const total    = 6 + (cur.prepChecklistItems || []).length;
    const counter  = document.querySelector(".tips-card h4 span");
    if (counter) counter.textContent = `${defDone + custDone}/${total} done`;
  }

  // ── RELOAD HELPERS ───────────────────────────────────────────────────────────
  function reload(appId) {
    const app = window.Traqio?.store?.applications?.get(appId);
    if (app) render(app);
  }

  function reloadNotes(appId) {
    const app = window.Traqio?.store?.applications?.get(appId);
    if (!app) return;
    const el = document.getElementById("notesList");
    if (!el) return;
    el.innerHTML = renderNotesList(app);
  }

  // ── STATIC MODAL WIRING ──────────────────────────────────────────────────────
  let _wired = false;
  function wireStaticModals(appId) {
    if (_wired) return;
    _wired = true;

    document
      .getElementById("closeStageModal")
      ?.addEventListener("click", () =>
        document.getElementById("stageModal").classList.remove("open"),
      );
    document
      .getElementById("cancelStageModal")
      ?.addEventListener("click", () =>
        document.getElementById("stageModal").classList.remove("open"),
      );

    document.getElementById("saveStageModal")?.addEventListener("click", () => {
      const currentAppId = getId();
      const name = document.getElementById("sm-name").value.trim();
      if (!name) {
        window.Traqio?.toast?.("Stage name is required", "error");
        return;
      }
      const payload = {
        name,
        date: document.getElementById("sm-date").value,
        state: document.getElementById("sm-state").value,
        note: document.getElementById("sm-note").value.trim(),
      };

      if (editingStageId) {
        window.Traqio?.store?.applications?.updateStage(
          currentAppId,
          editingStageId,
          payload,
        );
        window.Traqio?.toast?.("Stage updated", "success");
      } else {
        window.Traqio?.store?.applications?.addStage(currentAppId, payload);
        window.Traqio?.toast?.("Stage added ✓", "success");
      }

      // Auto status sync
      const updatedApp = window.Traqio?.store?.applications?.get(currentAppId);
      if (
        payload.state === "current" &&
        payload.name.toLowerCase().includes("interview") &&
        updatedApp?.status === "applied"
      ) {
        window.Traqio?.confirm?.(
          `🎯 Update status to "Interview"?`,
          "Update",
          "primary",
        ).then((ok) => {
          if (ok) {
            window.Traqio?.store?.applications?.update(currentAppId, {
              status: "interview",
            });
            syncToSupabase(currentAppId);
            reload(currentAppId);
          }
        });
      }

      syncToSupabase(currentAppId);
      document.getElementById("stageModal").classList.remove("open");
      reload(currentAppId);
    });

    document
      .getElementById("closeEditModal")
      ?.addEventListener("click", () =>
        document.getElementById("editModal").classList.remove("open"),
      );
    document
      .getElementById("cancelEditModal")
      ?.addEventListener("click", () =>
        document.getElementById("editModal").classList.remove("open"),
      );

    document.getElementById("saveEditModal")?.addEventListener("click", () => {
      const currentAppId = getId();
      window.Traqio?.store?.applications?.update(currentAppId, {
        company: document.getElementById("em-company").value.trim(),
        position: document.getElementById("em-position").value.trim(),
        location: document.getElementById("em-location").value.trim(),
        salary: document.getElementById("em-salary").value.trim(),
        status: document.getElementById("em-status").value,
        source: document.getElementById("em-source").value.trim(),
        link: document.getElementById("em-link").value.trim(),
      });
      syncToSupabase(currentAppId);
      window.Traqio?.toast?.("Application updated ✓", "success");
      document.getElementById("editModal").classList.remove("open");
      reload(currentAppId);
    });
  }

  // ── SUPABASE SYNC (fire-and-forget) ─────────────────────────────────────────
  function syncToSupabase(appId) {
    const cfg = window.TRAQIO_CONFIG || {};
    if (cfg.DEMO_MODE) return;
    const now = new Date().toISOString();
    window.Traqio?.store?.applications?.update?.(appId, { updatedAt: now });
    const app = window.Traqio?.store?.applications?.get(appId);
    if (!app) return;
    window.Traqio?.supabase?.applications
      ?.update(appId, {
        status: app.status,
        stages: app.stages || [],
        notes: app.notes || [],
        company: app.company,
        position: app.position,
        location: app.location || "",
        salary: app.salary || "",
        source: app.source || "",
        link: app.link || "",
        appliedAt: app.appliedAt || null,
        updatedAt: new Date().toISOString(),
        prepChecklist:       app.prepChecklist       || [],
        prepChecklistItems:  app.prepChecklistItems  || [],
        prepChecklistCustom: app.prepChecklistCustom || [],
      })
      .catch((e) => console.warn("[supabase] sync failed:", e));
  }

  // ── INIT ─────────────────────────────────────────────────────────────────────
  async function init() {
    const id = getId();
    if (!id) {
      window.location.href = "applications.html";
      return;
    }
    let app = window.Traqio?.store?.applications?.get(id);
    const cfg = window.TRAQIO_CONFIG || {};
    if (!cfg.DEMO_MODE) {
      if (_detailJobs.length === 0) {
        _detailJobs =
          (await window.Traqio?.supabase?.jobs?.list().catch(() => [])) || [];
      }
      if (!app) {
        app = await window.Traqio?.supabase?.applications
          ?.get(id)
          .catch(() => null);
        if (app) window.Traqio?.store?.applications?.addToCache?.(app);
      }
    }
    if (!app) {
      window.Traqio?.shell?.mount(
        "applications",
        `<main class="page"><div class="empty-state"><div class="icon">${I("briefcase")}</div><h3>Application not found</h3><a href="applications.html" class="btn btn-primary" style="margin-top:12px">Back to tracker</a></div></main>`,
      );
      return;
    }
    render(app);
  }

  setTimeout(init, 0);

  window.Traqio?.state?.on("store:change", () => {
    const id = getId();
    if (!id) return;
    const app = window.Traqio?.store?.applications?.get(id);
    if (app) reload(id);
  });

  document.addEventListener("traqio:lang-change", init);
})();
