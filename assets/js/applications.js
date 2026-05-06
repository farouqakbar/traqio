/* RAQIO — Applications page v2
 * Changes from v1:
 * 1. My Priority = dedicated chip in filter row (not a sort option)
 *    - sits after status chips, separated by a thin divider
 *    - toggles priorityMode state — shows its own drag-to-rank view
 *    - works identically on desktop and mobile
 * 2. Mobile always shows list — kanban hidden on ≤767px
 * 3. Mobile list grouped by status with section headers + left-accent border
 * 4. Upcoming event shown inline on mobile cards
 * 5. Sort dropdown no longer contains "My Priority" option
 */
(function () {
  const I = (n) => window.Traqio?.icons?.render(n) || "";
  let _resizeWired = false;

  // ── DEFAULT COLUMNS ──────────────────────────────────────────────────────────
  const DEFAULT_COLUMNS = [
    { key: "saved", label: "Saved", color: "#94a3b8", emoji: "🔖" },
    { key: "applied", label: "Applied", color: "#3b82f6", emoji: "📤" },
    { key: "interview", label: "Interview", color: "#8b5cf6", emoji: "🎯" },
    { key: "offer", label: "Offer", color: "#10b981", emoji: "🎉" },
    { key: "rejected", label: "Rejected", color: "#ef4444", emoji: "❌" },
  ];

  // Status display order for mobile grouped view
  const STATUS_GROUP_ORDER = [
    "interview",
    "offer",
    "applied",
    "saved",
    "rejected",
  ];

  let _jobs = [];

  // ── MOBILE DETECTION ─────────────────────────────────────────────────────────
  function isMobile() {
    return window.innerWidth < 768;
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  // ── PRIORITY ORDER STORAGE (per-column) ─────────────────────────────────────
  const PRIORITY_ORDER_KEY = "traqio:app-priority:v2";

  function loadPriorityOrder() {
    try {
      const raw = localStorage.getItem(PRIORITY_ORDER_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function savePriorityOrder(orderMap) {
    try {
      localStorage.setItem(PRIORITY_ORDER_KEY, JSON.stringify(orderMap));
    } catch (e) {}
  }

  function applyPriorityOrder(apps) {
    // Sort within each column group by saved order, then concat in column order
    const map = loadPriorityOrder();
    const result = [];
    state.columns.forEach((col) => {
      const colApps = apps.filter((a) => a.status === col.key);
      const order = map[col.key] || [];
      if (!order.length) {
        result.push(...colApps);
        return;
      }
      const ordered = [];
      order.forEach((id) => {
        const a = colApps.find((x) => x.id === id);
        if (a) ordered.push(a);
      });
      colApps.forEach((a) => {
        if (!order.includes(a.id)) ordered.push(a);
      });
      result.push(...ordered);
    });
    const knownCols = new Set(state.columns.map((c) => c.key));
    apps.forEach((a) => {
      if (!knownCols.has(a.status)) result.push(a);
    });
    return result;
  }

  // ── COLUMN STORAGE ───────────────────────────────────────────────────────────
  function loadColumns() {
    try {
      const raw = localStorage.getItem("traqio:columns:v1");
      if (raw) {
        const cols = JSON.parse(raw);
        if (Array.isArray(cols) && cols.length > 0) return cols;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
  }

  function saveColumns(cols) {
    try {
      localStorage.setItem("traqio:columns:v1", JSON.stringify(cols));
    } catch (e) {}
  }

  // ── STATE ────────────────────────────────────────────────────────────────────
  const state = {
    filter: "all",
    sort: "newest",
    view: "kanban", // desktop default; mobile always renders list regardless
    priorityMode: false, // My Priority chip toggle — own view, not a sort option
    q: new URLSearchParams(window.location.search).get("q") || "",
    editLayout: false,
    columns: loadColumns(),
    dragging: null,
    draggingCol: null,
  };

  function fmt(d) {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function logoFor(a) {
    const job = _jobs.find((j) => j.id === a.jobId || j.id === a.job_id);
    const url = job?.logo_url || a.logo_url;
    if (url)
      return {
        html: `<img src="${escAttr(url)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:6px" onerror="this.style.display='none'">`,
        bg: "var(--bg-surface-2)",
      };
    return {
      html: escHtml(a.logo || (a.company || "?").charAt(0).toUpperCase()),
      bg: a.color || "#3b82f6",
    };
  }

  function filtered() {
    const all = window.Traqio?.store?.applications?.list() || [];
    const list = all.filter((a) => {
      if (state.filter !== "all" && a.status !== state.filter) return false;
      if (state.q) {
        const q = state.q.toLowerCase();
        return (a.company + " " + a.position + " " + (a.location || ""))
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
    // priorityMode uses its own ordering — handled in priorityView()
    if (state.sort === "oldest")
      list.sort(
        (a, b) => new Date(a.appliedAt || 0) - new Date(b.appliedAt || 0),
      );
    else if (state.sort === "az")
      list.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
    else if (state.sort === "status") {
      const ord = ["interview", "offer", "applied", "saved", "rejected"];
      list.sort((a, b) => ord.indexOf(a.status) - ord.indexOf(b.status));
    } else {
      list.sort(
        (a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0),
      );
    }
    return list;
  }

  // ── TOOLBAR ──────────────────────────────────────────────────────────────────
  function toolbar() {
    const all = window.Traqio?.store?.applications?.list() || [];
    const counts = all.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    // Status filter chip — deactivates when priorityMode is on
    const chip = (key, label, n) =>
      `<button class="filter-chip ${!state.priorityMode && state.filter === key ? "active" : ""}" data-filter="${key}">
        ${label} <span style="opacity:.65;font-size:.8em">${n != null ? n : ""}</span>
      </button>`;

    return `
      <div class="toolbar">
        <div class="search-mini">
          ${I("search")}
          <input id="q" placeholder="Search company, role, location…" value="${escAttr(state.q)}"/>
          ${state.q ? `<button id="clearQ" class="clear-search">×</button>` : ""}
        </div>

        ${isMobile() ? mobileStatsBar() : ""}

        <div class="filters" id="filtersContainer">
          ${chip("all", "All", all.length)}
          ${state.columns.map((s) => chip(s.key, s.label, counts[s.key] || 0)).join("")}

          <div class="filter-chip-sep"></div>

        </div>

        ${
          !isMobile()
            ? `
          <div class="view-switch">
            <button class="${state.view === "kanban" ? "active" : ""}" data-view="kanban" title="Kanban board">📊 Board</button>
            <button class="${state.view === "table" ? "active" : ""}" data-view="table" title="Table view">📋 List</button>
          </div>
        `
            : ""
        }

       <div class="toolbar-right">
          <a href="jobs.html" class="btn-find-jobs">🔍 Find Jobs</a>
          <button class="filter-chip filter-chip--add-stage" id="addStageChip">
            ＋ Add Stage
          </button>
          <button class="filter-chip filter-chip--priority ${state.priorityMode ? "active" : ""}" id="priorityChip">
            ⠿ My Priority
          </button>

          <select id="sortApps" class="sort-select">
            <option value="newest" ${state.sort === "newest" ? "selected" : ""}>Recently applied</option>
            <option value="oldest" ${state.sort === "oldest" ? "selected" : ""}>Oldest applications</option>
            <option value="az" ${state.sort === "az" ? "selected" : ""}>Company (A–Z)</option>
            <option value="status" ${state.sort === "status" ? "selected" : ""}>By stage</option>
          </select>
        </div>

        ${
          state.view === "kanban" && !isMobile() && !state.priorityMode
            ? `
          <button class="btn btn-secondary btn-sm ${state.editLayout ? "active" : ""}" id="editLayoutBtn">
            ${I("edit")} ${state.editLayout ? "Done Editing" : "Edit Layout"}
          </button>
        `
            : ""
        }
      </div>`;
  }

  // ── KANBAN CARD ──────────────────────────────────────────────────────────────
  function kanCard(a) {
    const doneStages = (a.stages || []).filter(
      (s) => s.state === "done",
    ).length;
    const totalStages = (a.stages || []).length;
    const upcomingStage = (a.stages || []).find(
      (s) => s.state === "current" && s.date,
    );
    const noteCount = (a.notes || []).length;
    const lg = logoFor(a);

    return `
      <div class="kan-card"
           draggable="${!isTouchDevice()}"
           data-card-id="${a.id}"
           data-col="${a.status}"
           onclick="event.stopPropagation(); location.href='application-detail.html?id=${a.id}'">
        <div class="top">
          <div class="logo" style="background:${lg.bg}">${lg.html}</div>
          <div class="meta-top">
            <div class="company">${escHtml(a.company)}</div>
            <div class="position">${escHtml(a.position)}</div>
          </div>
          <button class="kan-card-menu" title="Quick actions" onclick="event.stopPropagation(); openQuickMenu('${a.id}', event)">⋯</button>
        </div>
        ${
          upcomingStage
            ? `
          <div class="kan-upcoming">
            <span style="color:var(--brand-500)">●</span>
            ${escHtml(upcomingStage.name)} · ${fmt(upcomingStage.date)}
          </div>
        `
            : ""
        }
        <div class="info-row">
          ${a.location ? `<span>📍 ${escHtml(a.location)}</span>` : ""}
          ${a.appliedAt ? `<span>📅 ${fmt(a.appliedAt)}</span>` : ""}
          ${a.salary ? `<span>💰 ${escHtml(a.salary)}</span>` : ""}
        </div>
        <div class="kan-footer">
          ${totalStages > 0 ? `<span class="kan-tag">📊 ${doneStages}/${totalStages}</span>` : ""}
          ${noteCount > 0 ? `<span class="kan-tag">📝 ${noteCount}</span>` : ""}
        </div>
      </div>`;
  }

  // ── KANBAN BOARD ─────────────────────────────────────────────────────────────
  function kanban() {
    const apps = filtered();
    if (state.editLayout) return renderEditLayout(apps);
    if (apps.length === 0) return emptyState();

    const cols = state.columns
      .map((s) => {
        const items = apps.filter((a) => a.status === s.key);
        return `
        <div class="kanban-col"
             data-col="${s.key}"
             ondragover="event.preventDefault(); window.__traqioDragOver && window.__traqioDragOver(event)"
             ondrop="window.__traqioDrop && window.__traqioDrop(event, '${s.key}')">
          <div class="kanban-col-head">
            <div class="ttl">
              <span class="dot" style="background:${s.color}"></span>
              ${s.emoji ? `<span>${s.emoji}</span>` : ""}
              ${escHtml(s.label)}
            </div>
            <span class="count">${items.length}</span>
          </div>
          <div class="kanban-drop-zone" data-col="${s.key}">
            ${
              items.length > 0
                ? items.map(kanCard).join("")
                : `<div class="kan-empty">✨ Drop cards here</div>`
            }
          </div>
          <button class="kan-add-inline" onclick="openModalForCol('${s.key}')" title="Add to ${s.label}">
            ➕ Add
          </button>
        </div>`;
      })
      .join("");

    return `<div class="kanban" id="kanbanBoard">${cols}</div>`;
  }

  function emptyState() {
    return `
      <div class="empty-panel">
        <div class="empty-icon">📭</div>
        <h3>No applications found</h3>
        <p>${state.q ? "Try clearing your search" : "Click the + button to add your first application"}</p>
        ${state.q ? '<button class="btn btn-primary" onclick="document.getElementById(\'clearQ\')?.click()">Clear Search</button>' : ""}
      </div>`;
  }

  // ── EDIT LAYOUT ──────────────────────────────────────────────────────────────
  function renderEditLayout(apps) {
    const activeKeys = new Set(state.columns.map((c) => c.key));
    const removedDefaults = DEFAULT_COLUMNS.filter(
      (d) => !activeKeys.has(d.key),
    );

    const cols = state.columns
      .map(
        (s) => `
      <div class="edit-col-item"
           draggable="true"
           data-col-key="${s.key}"
           style="border-left:4px solid ${s.color}">
        <div class="edit-col-handle" title="Drag to reorder">⠿</div>
        <span class="edit-col-emoji">${s.emoji || ""}</span>
        <input class="edit-col-name" value="${escAttr(s.label)}" data-col-key="${s.key}"
               onchange="window.__traqioRenameCol && window.__traqioRenameCol('${s.key}', this.value)"
               placeholder="Column name"/>
        <span class="edit-col-count">${apps.filter((a) => a.status === s.key).length} cards</span>
        <input type="color" class="edit-col-color" value="${s.color}" data-col-key="${s.key}"
               onchange="window.__traqioColorCol && window.__traqioColorCol('${s.key}', this.value)"
               title="Change color"/>
        <button class="edit-col-del" onclick="window.__traqioDelCol && window.__traqioDelCol('${s.key}')" title="Delete column">✕</button>
      </div>
    `,
      )
      .join("");

    const removedSection = removedDefaults.length
      ? `
      <div class="edit-removed-defaults">
        <div class="edit-removed-label">Removed defaults — click to restore</div>
        <div class="edit-removed-list">
          ${removedDefaults
            .map(
              (d) => `
            <button class="edit-restore-btn"
                    onclick="window.__traqioRestoreCol && window.__traqioRestoreCol('${d.key}')"
                    style="border-left-color:${d.color}">
              <span>${d.emoji || ""}</span>
              <span class="edit-restore-name">${escAttr(d.label)}</span>
              <span class="edit-restore-icon">↩ Restore</span>
            </button>`,
            )
            .join("")}
        </div>
      </div>`
      : "";

    return `
      <div class="edit-layout-panel">
        <div class="edit-layout-header">
          <h3>✏️ Edit Kanban Layout</h3>
          <p>Drag columns to reorder · Rename · Change color · Add custom stages · Delete any column</p>
        </div>
        <div class="edit-cols-list" id="editColsList">${cols}</div>
        ${removedSection}
        <button class="btn btn-secondary" id="addColBtn" style="margin-top:12px;gap:8px">
          ➕ Add custom column
        </button>
      </div>`;
  }

  // ── TABLE VIEW (desktop) ──────────────────────────────────────────────────────
  function tableDesktop(apps) {
    if (!apps.length) return emptyState();

    const rows = apps
      .map((a) => {
        const col = state.columns.find((c) => c.key === a.status);
        const color = col?.color || "#94a3b8";
        const label = col?.label || a.status;
        const lg = logoFor(a);

        return `
        <tr onclick="location.href='application-detail.html?id=${a.id}'" class="table-row" data-row-id="${a.id}" data-row-col="${a.status}">
          <td>
            <div class="company-cell">
              <div class="logo" style="background:${lg.bg}">${lg.html}</div>
              <div>
                <div class="name">${escHtml(a.company)}</div>
                <div class="role">${escHtml(a.position)}</div>
              </div>
            </div>
          </td>
          <td>${escHtml(a.location || "—")}</td>
          <td>${escHtml(a.salary || "—")}</td>
          <td>
            <span class="status-pill" style="--pill-color:${color}">
              ${col?.emoji ? `<span>${col.emoji}</span>` : ""}
              ${escHtml(label)}
            </span>
          </td>
          <td>${escHtml(a.source || "—")}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openQuickMenu('${a.id}', event)">⋯</button>
          </td>
        </tr>`;
      })
      .join("");

    return `
      <div style="overflow-x:auto">
        <table class="app-table">
          <thead>
            <tr>
              <th>Company / Role</th>
              <th>Location</th>
              <th>Salary</th>
              <th>Status</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── MOBILE CARD ───────────────────────────────────────────────────────────────
  function mobileCard(a) {
    const col = state.columns.find((c) => c.key === a.status);
    const accentColor = col?.color || "#94a3b8";
    const label = col?.label || a.status;
    const lg = logoFor(a);
    const upcomingStage = (a.stages || []).find(
      (s) => s.state === "current" && s.date,
    );

    return `
      <div class="mobile-card"
           onclick="location.href='application-detail.html?id=${a.id}'"
           style="border-left-color:${accentColor}">
        <div class="mobile-card-header">
          <div class="mobile-card-logo" style="background:${lg.bg}">
            ${lg.html}
          </div>
          <div class="mobile-card-info">
            <div class="company">${escHtml(a.company)}</div>
            <div class="position">${escHtml(a.position)}</div>
          </div>
          <button class="card-menu" onclick="event.stopPropagation();openQuickMenu('${a.id}', event)">⋯</button>
        </div>
        <div class="mobile-card-details">
          ${a.location ? `<div class="detail-item">📍 ${escHtml(a.location)}</div>` : ""}
          ${a.salary ? `<div class="detail-item">💰 ${escHtml(a.salary)}</div>` : ""}
          ${a.appliedAt ? `<div class="detail-item">📅 ${fmt(a.appliedAt)}</div>` : ""}
          ${a.source ? `<div class="detail-item">🔗 ${escHtml(a.source)}</div>` : ""}
        </div>
        ${
          upcomingStage
            ? `
          <div class="mobile-card-upcoming">
            <span class="upcoming-dot">●</span>
            ${escHtml(upcomingStage.name)} · ${fmt(upcomingStage.date)}
          </div>
        `
            : ""
        }
      </div>`;
  }

  // ── MOBILE LIST (grouped by status) ──────────────────────────────────────────
  function tableMobile(apps) {
    if (!apps.length) return emptyState();

    // Build section per status in priority order
    const sections = [];
    STATUS_GROUP_ORDER.forEach((statusKey) => {
      const col = state.columns.find((c) => c.key === statusKey);
      if (!col) return;
      const items = apps.filter((a) => a.status === statusKey);
      if (!items.length) return;
      sections.push(`
        <div class="mobile-section-header">
          <span class="sec-dot" style="background:${col.color}"></span>
          ${col.emoji ? `<span style="font-size:.85rem">${col.emoji}</span>` : ""}
          ${escHtml(col.label)}
          <span class="sec-count">${items.length}</span>
        </div>
        ${items.map(mobileCard).join("")}
      `);
    });

    // Apps whose status column isn't in STATUS_GROUP_ORDER (custom columns)
    const knownKeys = new Set(STATUS_GROUP_ORDER);
    state.columns.forEach((col) => {
      if (knownKeys.has(col.key)) return;
      const items = apps.filter((a) => a.status === col.key);
      if (!items.length) return;
      sections.push(`
        <div class="mobile-section-header">
          <span class="sec-dot" style="background:${col.color}"></span>
          ${col.emoji ? `<span style="font-size:.85rem">${col.emoji}</span>` : ""}
          ${escHtml(col.label)}
          <span class="sec-count">${items.length}</span>
        </div>
        ${items.map(mobileCard).join("")}
      `);
    });

    return `<div class="mobile-list">${sections.join("")}</div>`;
  }

  // ── MY PRIORITY VIEW ─────────────────────────────────────────────────────────
  function priorityView() {
    const all = window.Traqio?.store?.applications?.list() || [];
    const apps = applyPriorityOrder(
      all.filter((a) => {
        if (state.q) {
          const q = state.q.toLowerCase();
          return (a.company + " " + a.position + " " + (a.location || ""))
            .toLowerCase()
            .includes(q);
        }
        return true;
      }),
    );

    if (!apps.length) return emptyState();

    const hint = `
      <div class="priority-hint">
        ⠿ ${
          isMobile()
            ? "Tap ⋯ to move an application up/down in priority"
            : "Drag rows to set your preferred priority order — saved per device"
        }
      </div>`;

    if (isMobile()) {
      // Mobile: card list with rank badge + dots indicator
      const cards = apps
        .map((a, idx) => {
          const col = state.columns.find((c) => c.key === a.status);
          const color = col?.color || "#94a3b8";
          const label = col?.label || a.status;
          const lg = logoFor(a);
          const isTop = idx < 3;

          return `
          <div class="priority-mobile-card"
               onclick="location.href='application-detail.html?id=${a.id}'">
            <div class="priority-rank-badge ${isTop ? "top-rank" : ""}">${idx + 1}</div>
            <div class="priority-drag-dots">
              <span><i></i><i></i></span>
              <span><i></i><i></i></span>
              <span><i></i><i></i></span>
            </div>
            <div class="logo" style="background:${lg.bg};width:36px;height:36px;min-width:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.85rem;overflow:hidden;flex-shrink:0">
              ${lg.html}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.75rem;color:var(--text-secondary)">${escHtml(a.company)}</div>
              <div style="font-size:.88rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.position)}</div>
            </div>
            <span class="status-pill" style="--pill-color:${color};font-size:.7rem;padding:3px 8px;flex-shrink:0">
              ${escHtml(label)}
            </span>
          </div>`;
        })
        .join("");

      return `
        ${hint}
        <div class="priority-mobile-list" id="priorityMobileList">
          ${cards}
        </div>`;
    }

    // Desktop: table with drag handles
    const rows = apps
      .map((a) => {
        const col = state.columns.find((c) => c.key === a.status);
        const color = col?.color || "#94a3b8";
        const label = col?.label || a.status;
        const lg = logoFor(a);

        return `
        <tr onclick="location.href='application-detail.html?id=${a.id}'" class="table-row priority-row" data-row-id="${a.id}" data-row-col="${a.status}">
          <td class="drag-handle-cell" onclick="event.stopPropagation()" title="Drag to reorder">
            <span class="tbl-drag-handle">⠿</span>
          </td>
          <td>
            <div class="company-cell">
              <div class="logo" style="background:${lg.bg}">${lg.html}</div>
              <div>
                <div class="name">${escHtml(a.company)}</div>
                <div class="role">${escHtml(a.position)}</div>
              </div>
            </div>
          </td>
          <td>${escHtml(a.location || "—")}</td>
          <td>${escHtml(a.salary || "—")}</td>
          <td>
            <span class="status-pill" style="--pill-color:${color}">
              ${col?.emoji ? `<span>${col.emoji}</span>` : ""}
              ${escHtml(label)}
            </span>
          </td>
          <td>${escHtml(a.source || "—")}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openQuickMenu('${a.id}', event)">⋯</button>
          </td>
        </tr>`;
      })
      .join("");

    return `
      ${hint}
      <div style="overflow-x:auto">
        <table class="app-table app-table--priority">
          <thead>
            <tr>
              <th style="width:32px"></th>
              <th>Company / Role</th>
              <th>Location</th>
              <th>Salary</th>
              <th>Status</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="priorityTbody">${rows}</tbody>
        </table>
      </div>`;
  }

  // ── CONTENT ROUTER ────────────────────────────────────────────────────────────
  function content() {
    if (state.priorityMode) return priorityView();
    if (isMobile()) return tableMobile(filtered());
    if (state.view === "kanban") return kanban();
    return tableDesktop(filtered());
  }

  // ── QUICK MENU ────────────────────────────────────────────────────────────────
  window.openQuickMenu = function (appId, e) {
    document.getElementById("__traqioQuickMenu")?.remove();
    const app = window.Traqio?.store?.applications?.get(appId);
    if (!app) return;

    const colOptions = state.columns
      .filter((c) => c.key !== app.status)
      .map(
        (c) =>
          `<button class="qm-item" onclick="moveCard('${appId}','${c.key}')">
          ${c.emoji || ""} Move to ${c.label}
        </button>`,
      )
      .join("");

    const menu = document.createElement("div");
    menu.id = "__traqioQuickMenu";
    menu.className = "quick-menu";
    menu.innerHTML = `
      ${colOptions}
      <div class="qm-divider"></div>
      <button class="qm-item" onclick="location.href='application-detail.html?id=${appId}'">✏️ Open Detail</button>
      <button class="qm-item danger" onclick="deleteApp('${appId}')">🗑️ Delete</button>
    `;

    const rect = e.target.getBoundingClientRect();
    menu.style.cssText = `position:fixed;top:-9999px;left:-9999px;z-index:9999;visibility:hidden`;
    document.body.appendChild(menu);

    const mw = menu.offsetWidth || 190;
    const vw = window.innerWidth;
    let left = rect.right - mw;
    left = Math.max(8, Math.min(left, vw - mw - 8));
    const top = rect.bottom + 4;
    menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;z-index:9999;visibility:visible;max-width:${vw - 16}px`;

    setTimeout(() => {
      document.addEventListener("click", () => menu.remove(), { once: true });
    }, 10);
  };

  window.moveCard = async function (appId, newStatus) {
    const movingApp = window.Traqio?.store?.applications?.get(appId);
    const wasSaved = movingApp?.status === "saved";
    const cfg = window.TRAQIO_CONFIG || {};
    if (!cfg.DEMO_MODE) {
      await window.Traqio?.supabase?.applications
        ?.update(appId, { status: newStatus })
        .catch((e) => console.warn(e));
    }
    window.Traqio?.store?.applications?.updateInCache?.(appId, {
      status: newStatus,
    });
    window.Traqio?.toast?.(
      `Moved to ${state.columns.find((c) => c.key === newStatus)?.label}`,
      "success",
    );
    if (wasSaved && movingApp?.jobId && newStatus !== "saved") {
      document.dispatchEvent(
        new CustomEvent("traqio:job-unsaved", {
          detail: { jobId: movingApp.jobId },
        }),
      );
    }
    document.getElementById("__traqioQuickMenu")?.remove();
    render();
  };

  window.deleteApp = async function (appId) {
    if (
      !(await window.Traqio?.confirm?.(
        "Delete this application? This cannot be undone.",
        "Delete",
        "danger",
      ))
    )
      return;
    const deletingApp = window.Traqio?.store?.applications?.get(appId);
    if (deletingApp?.jobId) {
      try {
        const APPLIED_KEY = "traqio:applied-jobs:v1";
        const appliedSet = new Set(
          JSON.parse(localStorage.getItem(APPLIED_KEY) || "[]"),
        );
        appliedSet.delete(deletingApp.jobId);
        localStorage.setItem(APPLIED_KEY, JSON.stringify([...appliedSet]));
      } catch {}
    }
    const cfg = window.TRAQIO_CONFIG || {};
    if (!cfg.DEMO_MODE) {
      await window.Traqio?.supabase?.applications
        ?.remove(appId)
        .catch((e) => console.warn(e));
    }
    window.Traqio?.store?.applications?.removeFromCache?.(appId);
    window.Traqio?.toast?.("Application deleted", "success");
    if (deletingApp?.jobId && deletingApp?.status === "saved") {
      document.dispatchEvent(
        new CustomEvent("traqio:job-unsaved", {
          detail: { jobId: deletingApp.jobId },
        }),
      );
    }
    document.getElementById("__traqioQuickMenu")?.remove();
    render();
  };

  window.openModalForCol = function (colKey) {
    openModal();
    requestAnimationFrame(() => {
      const sel = document.getElementById("f-status");
      if (sel) {
        sel.innerHTML = state.columns
          .map(
            (s) =>
              `<option value="${s.key}">${s.emoji ? s.emoji + " " : ""}${s.label}</option>`,
          )
          .join("");
        sel.value = colKey;
      }
    });
  };

  // ── EDIT LAYOUT WIRING ───────────────────────────────────────────────────────
  function wireEditLayout() {
    if (!state.editLayout) return;

    window.__traqioRenameCol = function (key, newLabel) {
      const col = state.columns.find((c) => c.key === key);
      if (col) {
        col.label = newLabel;
        saveColumns(state.columns);
      }
    };

    window.__traqioColorCol = function (key, color) {
      const col = state.columns.find((c) => c.key === key);
      if (col) {
        col.color = color;
        saveColumns(state.columns);
        render();
      }
    };

    window.__traqioDelCol = async function (key) {
      const isDefault = DEFAULT_COLUMNS.some((d) => d.key === key);
      const msg = isDefault
        ? "Remove this default column? You can restore it later. Applications inside will move to Saved."
        : "Delete this column? Applications in it will move to Saved.";
      if (!(await window.Traqio?.confirm?.(msg, "Remove", "danger"))) return;
      state.columns = state.columns.filter((c) => c.key !== key);
      saveColumns(state.columns);
      (window.Traqio?.store?.applications?.list() || [])
        .filter((a) => a.status === key)
        .forEach((a) =>
          window.Traqio?.store?.applications?.updateInCache?.(a.id, {
            status: "saved",
          }),
        );
      render();
    };

    window.__traqioRestoreCol = function (key) {
      const def = DEFAULT_COLUMNS.find((d) => d.key === key);
      if (!def || state.columns.find((c) => c.key === key)) return;
      const defIdx = DEFAULT_COLUMNS.indexOf(def);
      let insertAfterIdx = -1;
      DEFAULT_COLUMNS.slice(0, defIdx).forEach((d) => {
        const i = state.columns.findIndex((c) => c.key === d.key);
        if (i !== -1) insertAfterIdx = i;
      });
      const newCol = { ...def };
      if (insertAfterIdx === -1) state.columns.unshift(newCol);
      else state.columns.splice(insertAfterIdx + 1, 0, newCol);
      saveColumns(state.columns);
      render();
    };

    document.getElementById("addColBtn")?.addEventListener("click", () => {
      const palette = [
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
        "#10b981",
        "#f59e0b",
        "#06b6d4",
      ];
      state.columns.push({
        key: "custom_" + Date.now(),
        label: "New Column",
        color: palette[Math.floor(Math.random() * palette.length)],
        emoji: "",
      });
      saveColumns(state.columns);
      render();
    });

    // Column drag-and-drop reorder
    let dragKey = null;
    let dragEl = null;
    document.querySelectorAll(".edit-col-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        dragKey = item.dataset.colKey;
        dragEl = item;
        item.style.opacity = "0.4";
        e.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener("dragend", () => {
        if (dragEl) dragEl.style.opacity = "1";
        document
          .querySelectorAll(".edit-col-item")
          .forEach((i) => i.classList.remove("drag-over"));
        dragKey = null;
        dragEl = null;
      });
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (dragKey === item.dataset.colKey) return;
        document
          .querySelectorAll(".edit-col-item")
          .forEach((i) => i.classList.remove("drag-over"));
        item.classList.add("drag-over");
      });
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        document
          .querySelectorAll(".edit-col-item")
          .forEach((i) => i.classList.remove("drag-over"));
        if (!dragKey || dragKey === item.dataset.colKey) return;
        const fromIdx = state.columns.findIndex((c) => c.key === dragKey);
        const toIdx = state.columns.findIndex(
          (c) => c.key === item.dataset.colKey,
        );
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = state.columns.splice(fromIdx, 1);
        state.columns.splice(toIdx, 0, moved);
        saveColumns(state.columns);
        render();
      });
    });
  }

  // ── PRIORITY ROW DRAG-AND-DROP (desktop table) ───────────────────────────────
  function wirePriorityDrag() {
    if (!state.priorityMode || isMobile()) return;
    const tbody = document.getElementById("priorityTbody");
    if (!tbody) return;

    let dragRow = null;

    tbody.querySelectorAll("tr.priority-row").forEach((row) => {
      row.setAttribute("draggable", "true");

      row.addEventListener("dragstart", (e) => {
        dragRow = row;
        row.classList.add("priority-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.rowId);
      });

      row.addEventListener("dragend", () => {
        if (dragRow) dragRow.classList.remove("priority-dragging");
        tbody
          .querySelectorAll("tr")
          .forEach((r) => r.classList.remove("priority-drag-over"));
        dragRow = null;
        // Commit new order per column
        const allRows = [...tbody.querySelectorAll("tr[data-row-id]")];
        const byCol = {};
        allRows.forEach((r) => {
          const colKey = r.dataset.rowCol;
          if (!colKey) return;
          if (!byCol[colKey]) byCol[colKey] = [];
          byCol[colKey].push(r.dataset.rowId);
        });
        const map = loadPriorityOrder();
        Object.entries(byCol).forEach(([col, ids]) => {
          map[col] = ids;
        });
        savePriorityOrder(map);
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!dragRow || dragRow === row) return;
        e.dataTransfer.dropEffect = "move";
        tbody
          .querySelectorAll("tr")
          .forEach((r) => r.classList.remove("priority-drag-over"));
        row.classList.add("priority-drag-over");
      });

      row.addEventListener("dragleave", (e) => {
        if (!row.contains(e.relatedTarget))
          row.classList.remove("priority-drag-over");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragRow || dragRow === row) return;
        const rect = row.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        if (before) tbody.insertBefore(dragRow, row);
        else tbody.insertBefore(dragRow, row.nextSibling);
        tbody
          .querySelectorAll("tr")
          .forEach((r) => r.classList.remove("priority-drag-over"));
      });
    });
  }

  // ── KANBAN DRAG AND DROP (desktop only) ──────────────────────────────────────
  function wireDragDrop() {
    if (isTouchDevice() || isMobile() || state.priorityMode) return;

    let dragCardId = null;
    let dragEl = null;

    document.querySelectorAll(".kan-card[draggable]").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        dragCardId = card.dataset.cardId;
        dragEl = card;
        card.style.opacity = "0.4";
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragCardId);
        state.dragging = { cardId: dragCardId, fromCol: card.dataset.col };
      });

      card.addEventListener("dragend", () => {
        if (dragEl) dragEl.style.opacity = "1";
        document
          .querySelectorAll(".kanban-col")
          .forEach((c) => c.classList.remove("drag-over"));
        dragCardId = null;
        dragEl = null;
        state.dragging = null;
      });
    });

    window.__traqioDragOver = function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const col = e.currentTarget;
      document
        .querySelectorAll(".kanban-col")
        .forEach((c) => c.classList.remove("drag-over"));
      col.classList.add("drag-over");
    };

    window.__traqioDrop = async function (e, colKey) {
      e.preventDefault();
      document
        .querySelectorAll(".kanban-col")
        .forEach((c) => c.classList.remove("drag-over"));
      const cardId =
        e.dataTransfer.getData("text/plain") || state.dragging?.cardId;
      if (!cardId) return;
      if (state.dragging?.fromCol !== colKey) {
        const draggedApp = window.Traqio?.store?.applications?.get(cardId);
        const wasSaved = state.dragging?.fromCol === "saved";
        const cfg = window.TRAQIO_CONFIG || {};
        if (!cfg.DEMO_MODE) {
          await window.Traqio?.supabase?.applications
            ?.update(cardId, { status: colKey })
            .catch((err) => console.warn(err));
        }
        window.Traqio?.store?.applications?.updateInCache?.(cardId, {
          status: colKey,
        });
        window.Traqio?.toast?.(
          `Moved to ${state.columns.find((c) => c.key === colKey)?.label}`,
          "success",
        );
        if (wasSaved && draggedApp?.jobId && colKey !== "saved") {
          document.dispatchEvent(
            new CustomEvent("traqio:job-unsaved", {
              detail: { jobId: draggedApp.jobId },
            }),
          );
        }
        render();
      }
    };
  }

  // ── STATS BAR (mobile) — single "Stage" button with dropdown ─────────────────
  function mobileStatsBar() {
    const all = window.Traqio?.store?.applications?.list() || [];
    const counts = all.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});
    const total = all.length;

    // Active stage label for button display
    let activeLabel = "All stages";
    if (!state.priorityMode && state.filter !== "all") {
      const col = state.columns.find((c) => c.key === state.filter);
      if (col) activeLabel = (col.emoji ? col.emoji + " " : "") + col.label;
    }

    // Build stats rows for the dropdown
    const statRows = [
      {
        filter: "all",
        label: "All",
        emoji: "📋",
        num: total,
        color: "#64748b",
      },
      ...state.columns.map((col) => ({
        filter: col.key,
        label: col.label,
        emoji: col.emoji || "",
        num: counts[col.key] || 0,
        color: col.color || "#3b82f6",
      })),
    ];

    const rowsHtml = statRows
      .map((r) => {
        const isActive = !state.priorityMode && state.filter === r.filter;
        const pct = total > 0 ? Math.round((r.num / total) * 100) : 0;
        return `
          <button class="stage-stat-row ${isActive ? "active" : ""}" data-filter="${r.filter}">
            <span class="stage-stat-emoji">${r.emoji}</span>
            <span class="stage-stat-name">${r.label}</span>
            <span class="stage-stat-bar-wrap">
              <span class="stage-stat-bar" style="width:${pct}%;background:${r.color}"></span>
            </span>
            <span class="stage-stat-count" style="color:${r.color}">${r.num}</span>
          </button>`;
      })
      .join("");

    return `
      <div class="stage-btn-wrap" id="stageBtnWrap">
        <button class="stage-toggle-btn" id="stageToggleBtn" aria-expanded="false" aria-controls="stageDropdown">
          <span class="stage-toggle-icon">📊</span>
          <span class="stage-toggle-label" id="stageToggleLabel">${activeLabel}</span>
          <span class="stage-toggle-total">${total} total</span>
          <span class="stage-toggle-chevron" id="stageChevron">▾</span>
        </button>
        <div class="stage-dropdown" id="stageDropdown" aria-hidden="true">
          <div class="stage-dropdown-inner">
            ${rowsHtml}
          </div>
        </div>
      </div>`;
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  function render() {
    const statusOptions = state.columns
      .map(
        (s) =>
          `<option value="${s.key}">${s.emoji ? s.emoji + " " : ""}${s.label}</option>`,
      )
      .join("");

    const html = `
      <main class="page">
        <div class="page-header">
          <div class="titles">
            <h1>Applications</h1>
            <p>${(window.Traqio?.store?.applications?.list() || []).length} total tracked</p>
          </div>
          <div class="page-header-actions">
            <a href="jobs.html" class="btn-find-jobs">🔍 Find Jobs</a>
            <button class="btn btn-primary" id="addBtn">➕ Add Application</button>
          </div>
        </div>

        ${toolbar()}

        <div id="content">${content()}</div>
      </main>
    `;

    window.Traqio?.shell?.mount("applications", html);

    // FAB lives OUTSIDE the shell-mounted area so it never conflicts with
    // app-shell nav z-index. We append it to body and track it manually.
    let fab = document.getElementById("fabAdd");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "fabAdd";
      fab.className = "fab-add";
      fab.title = "Add Application";
      fab.setAttribute("aria-label", "Add Application");
      fab.innerHTML = "+";
      document.body.appendChild(fab);
    }
    fab.onclick = openModal;
    wire();

    const fStatus = document.getElementById("f-status");
    if (fStatus) fStatus.innerHTML = statusOptions;
  }

  // ── WIRE EVENTS ───────────────────────────────────────────────────────────────
  function wire() {
    // Status filter chips — deactivate when My Priority is on
    document
      .querySelectorAll(".filter-chip:not(.filter-chip--priority):not(.filter-chip--add-stage)")
      .forEach((b) => {
        b.addEventListener("click", () => {
          state.filter = b.dataset.filter;
          state.priorityMode = false; // exit priority mode when a filter is picked
          render();
        });
      });

    // Add Stage chip — open quick add-stage modal
    document.getElementById("addStageChip")?.addEventListener("click", () => {
      openAddStageModal();
    });

    // My Priority chip — toggle priorityMode
    document.getElementById("priorityChip")?.addEventListener("click", () => {
      state.priorityMode = !state.priorityMode;
      if (state.priorityMode) {
        state.filter = "all"; // show all apps in priority view
        state.editLayout = false;
        // Keep current view setting intact; content() routes to priorityView() regardless
      }
      render();
    });

    // View switch (desktop only — hidden on mobile via CSS)
    document.querySelectorAll(".view-switch button").forEach((b) => {
      b.addEventListener("click", () => {
        state.view = b.dataset.view;
        render();
      });
    });

    // Edit layout toggle
    document.getElementById("editLayoutBtn")?.addEventListener("click", () => {
      state.editLayout = !state.editLayout;
      render();
    });

    // Search
    const q = document.getElementById("q");
    if (q) {
      q.addEventListener("input", (e) => {
        state.q = e.target.value;
        render();
      });
    }
    document.getElementById("clearQ")?.addEventListener("click", () => {
      state.q = "";
      render();
    });

    // Add button
    document.getElementById("addBtn")?.addEventListener("click", openModal);

    // Stage dropdown toggle
    const stageBtn = document.getElementById("stageToggleBtn");
    const stageDropdown = document.getElementById("stageDropdown");
    const stageChevron = document.getElementById("stageChevron");
    if (stageBtn && stageDropdown) {
      stageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = stageDropdown.classList.contains("open");
        if (isOpen) {
          stageDropdown.classList.remove("open");
          stageBtn.setAttribute("aria-expanded", "false");
          stageDropdown.setAttribute("aria-hidden", "true");
          if (stageChevron) stageChevron.style.transform = "";
        } else {
          stageDropdown.classList.add("open");
          stageBtn.setAttribute("aria-expanded", "true");
          stageDropdown.setAttribute("aria-hidden", "false");
          if (stageChevron) stageChevron.style.transform = "rotate(180deg)";
        }
      });
      // Close on outside click
      document.addEventListener(
        "click",
        (e) => {
          const wrap = document.getElementById("stageBtnWrap");
          if (wrap && !wrap.contains(e.target)) {
            stageDropdown.classList.remove("open");
            stageBtn.setAttribute("aria-expanded", "false");
            if (stageChevron) stageChevron.style.transform = "";
          }
        },
        { capture: true, once: false },
      );
    }

    // Stage dropdown rows — filter selection
    document.querySelectorAll(".stage-stat-row[data-filter]").forEach((b) => {
      b.addEventListener("click", () => {
        state.filter = b.dataset.filter;
        state.priorityMode = false;
        // Close dropdown
        stageDropdown?.classList.remove("open");
        stageBtn?.setAttribute("aria-expanded", "false");
        if (stageChevron) stageChevron.style.transform = "";
        render();
      });
    });

    // Sort (no longer contains "My Priority")
    document.getElementById("sortApps")?.addEventListener("change", (e) => {
      state.sort = e.target.value;
      render();
    });

    // Edit layout sub-wiring
    wireEditLayout();

    // Priority drag (desktop table)
    wirePriorityDrag();

    // Kanban drag-drop
    wireDragDrop();

    // Resize — collapse to list on mobile
    if (!_resizeWired) {
      _resizeWired = true;
      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          // On mobile we always render list regardless — just re-render if crossing breakpoint
          const wasMobile = isMobile();
          render();
        }, 250);
      });
    }

    // Escape closes modal / quick menu
    document.onkeydown = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.getElementById("__traqioQuickMenu")?.remove();
      }
    };
  }

  // ── ADD STAGE MODAL ───────────────────────────────────────────────────────────
  function openAddStageModal() {
    const palette = ["#3b82f6","#8b5cf6","#ec4899","#10b981","#f59e0b","#06b6d4","#f97316","#84cc16"];
    const color = palette[Math.floor(Math.random() * palette.length)];
    const overlay = document.createElement("div");
    overlay.id = "addStageOverlay";
    overlay.className = "modal-overlay open";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Add Custom Stage");
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:360px">
        <h3 style="margin-bottom:16px;font-size:1rem;font-weight:700">➕ Add Custom Stage</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:4px">Stage Name</label>
            <input id="newStageName" class="input" placeholder="e.g. HR Interview, Assessment…" style="width:100%"/>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <label style="font-size:.82rem;font-weight:600">Color</label>
            <input type="color" id="newStageColor" value="${color}" style="width:40px;height:32px;border:none;cursor:pointer;background:none"/>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
          <button class="btn btn-secondary" id="addStageCancelBtn">Cancel</button>
          <button class="btn btn-primary" id="addStageConfirmBtn">Add Stage</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("newStageName")?.focus();
    document.getElementById("addStageCancelBtn")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("addStageConfirmBtn")?.addEventListener("click", () => {
      const name = document.getElementById("newStageName")?.value?.trim();
      const col = document.getElementById("newStageColor")?.value || color;
      if (!name) { document.getElementById("newStageName")?.focus(); return; }
      state.columns.push({ key: "custom_" + Date.now(), label: name, color: col, emoji: "" });
      saveColumns(state.columns);
      overlay.remove();
      render();
      window.Traqio?.toast?.(`Stage "${name}" added`, "success");
    });
  }

  // ── MODAL ─────────────────────────────────────────────────────────────────────
  function openModal() {
    const m = document.getElementById("addModal");
    if (m) m.classList.add("open");
  }

  function closeModal() {
    const m = document.getElementById("addModal");
    if (m) m.classList.remove("open");
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return String(s || "").replace(/"/g, "&quot;");
  }

  // ── MODAL SAVE ────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("closeAdd")?.addEventListener("click", closeModal);
    document.getElementById("cancelAdd")?.addEventListener("click", closeModal);

    document.getElementById("saveAdd")?.addEventListener("click", async () => {
      const company = document.getElementById("f-company").value.trim();
      const position = document.getElementById("f-position").value.trim();
      if (!company || !position) {
        window.Traqio?.toast?.("Company and position are required", "error");
        return;
      }
      const existingApps = window.Traqio?.store?.applications?.all() || [];
      const duplicate = existingApps.find(
        (a) =>
          a.company.trim().toLowerCase() === company.toLowerCase() &&
          a.position.trim().toLowerCase() === position.toLowerCase(),
      );
      if (duplicate) {
        window.Traqio?.toast?.(
          `"${company} — ${position}" already exists in your tracker.`,
          "error",
        );
        return;
      }
      const saveBtn = document.getElementById("saveAdd");
      const origText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      const palette = [
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#06b6d4",
      ];
      const statusVal = document.getElementById("f-status").value;
      const autoLogoUrl =
        document.getElementById("f-logo-url")?.value.trim() || "";

      const appData = {
        company,
        position,
        location: document.getElementById("f-location").value.trim(),
        salary: document.getElementById("f-salary").value.trim(),
        status: statusVal,
        source: document.getElementById("f-source").value.trim(),
        link: document.getElementById("f-link").value.trim(),
        appliedAt: new Date().toISOString().slice(0, 10),
        logo: company.charAt(0).toUpperCase(),
        logo_url: autoLogoUrl,
        color: autoLogoUrl
          ? "var(--bg-surface-2)"
          : palette[Math.floor(Math.random() * palette.length)],
        stages:
          statusVal === "applied"
            ? [
                {
                  id: "s" + Date.now(),
                  name: "Application Submitted",
                  state: "done",
                  date: new Date().toISOString().slice(0, 10),
                  note: "",
                },
              ]
            : [],
        notes: [],
      };

      const cfg = window.TRAQIO_CONFIG || {};
      try {
        if (!cfg.DEMO_MODE) {
          const saved =
            await window.Traqio?.supabase?.applications?.add(appData);
          window.Traqio?.store?.applications?.addToCache?.(saved);
        } else {
          window.Traqio?.store?.applications?.add(appData);
        }
      } catch (e) {
        window.Traqio?.toast?.("Failed to save: " + e.message, "error");
        saveBtn.disabled = false;
        saveBtn.textContent = origText;
        return;
      }

      saveBtn.disabled = false;
      saveBtn.textContent = origText;
      window.Traqio?.toast?.("Application added ✓", "success");

      [
        "f-company",
        "f-position",
        "f-location",
        "f-salary",
        "f-source",
        "f-link",
        "f-logo-url",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const preview = document.getElementById("f-company-logo-preview");
      if (preview) preview.style.display = "none";
      closeModal();
      render();
    });

    document.getElementById("f-company")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("f-position")?.focus();
    });

    // Auto-fill company logo
    document.getElementById("f-company")?.addEventListener("input", () => {
      const name = document
        .getElementById("f-company")
        ?.value.trim()
        .toLowerCase();
      const preview = document.getElementById("f-company-logo-preview");
      const img = document.getElementById("f-company-logo-img");
      const hidden = document.getElementById("f-logo-url");
      if (!name) {
        if (preview) preview.style.display = "none";
        if (hidden) hidden.value = "";
        return;
      }
      const matchJob = _jobs.find((j) => j.company.toLowerCase() === name);
      const matchCo = (window.Traqio?.companies?.list() || []).find(
        (c) => c.name.toLowerCase() === name,
      );
      const url = matchJob?.logo_url || matchCo?.logo_url || "";
      if (hidden) hidden.value = url;
      if (preview && img) {
        if (url) {
          img.src = url;
          preview.style.display = "block";
        } else preview.style.display = "none";
      }
    });
  });

  // ── INIT ──────────────────────────────────────────────────────────────────────
  async function initApps() {
    const cfg = window.TRAQIO_CONFIG || {};
    if (!cfg.DEMO_MODE) {
      const [apps, jobs] = await Promise.all([
        window.Traqio?.supabase?.applications?.list().catch(() => []),
        window.Traqio?.supabase?.jobs?.list().catch(() => []),
      ]);
      _jobs = jobs || [];
      window.Traqio?.store?.applications?.seed?.(apps || []);
      const prevTotal = parseInt(
        localStorage.getItem("traqio:jobs-total:v1") || "0",
      );
      if (_jobs.length > prevTotal) {
        localStorage.setItem("traqio:jobs-total:v1", String(_jobs.length));
      }
    }
    render();
  }

  setTimeout(initApps, 0);

  window.Traqio?.state?.on("store:change", () => {
    render();
  });
  document.addEventListener("traqio:lang-change", initApps);
})();
