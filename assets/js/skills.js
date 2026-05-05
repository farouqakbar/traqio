/* TRAQIO — Skills & Goals page */
(function () {
  const I = (n) => window.Traqio.icons.render(n);
  const T = (k, ...a) => window.Traqio?.i18n?.t(k, ...a) || k;

  // Modal elements are STATIC in skills.html (outside #app) — wire them only once
  let _skillModalWired = false;
  let _goalModalWired  = false;

  function fmt(iso) {
    if (!iso) return T("no_deadline");
    const lang = window.Traqio?.i18n?.lang === "id" ? "id-ID" : "en-US";
    return new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
  }

  function daysUntil(iso) {
    if (!iso) return null;
    const diff = Math.ceil((new Date(iso) - new Date()) / 86400000);
    if (diff < 0)  return T("overdue");
    if (diff === 0) return T("today");
    return T("days_left", diff);
  }

  let activeCategory = "all";
  let searchQ = new URLSearchParams(window.location.search).get("q") || "";

  /* ── SKILL CARD ────────────────────────────────────────────── */
  function skillCard(s) {
    const dots = Array.from({ length: 5 }, (_, i) => {
      const filled = i < s.level;
      const target = !filled && i < s.target;
      return `<div class="dot ${filled ? "filled" : target ? "target" : ""}" data-lvl="${i + 1}" data-skid="${s.id}" title="${T("set_level", i + 1)}"></div>`;
    }).join("");
    const catKey = s.category === "Soft Skills" ? "Soft" : s.category;
    return `
      <div class="skill-card" data-skid="${s.id}">
        <div class="top">
          <div>
            <div class="name">${s.name}</div>
            <div class="cat"><span class="cat-badge cat-${catKey}">${s.category}</span></div>
          </div>
          <button class="btn btn-ghost btn-sm del-skill" data-skid="${s.id}" title="${T("delete")}">${I("trash")}</button>
        </div>
        <div class="level-dots" title="${T("click_to_update_level")}">${dots}</div>
        <div class="progress"><span style="width:${s.progress}%"></span></div>
        <div class="meta">
          <span>Lv ${s.level} → ${s.target}</span>
          <span class="hours" style="display:flex;align-items:center;gap:6px">
            ${I("calendar")} ${T("hours_tracked", s.hours || 0)}
            <button class="btn btn-ghost add-hour" data-skid="${s.id}" title="Log 1 hour of practice" style="padding:1px 6px;font-size:.72rem;height:auto;line-height:1.4;border-radius:6px">+1h</button>
          </span>
        </div>
      </div>`;
  }

  /* ── GOAL CARD ─────────────────────────────────────────────── */
  function goalCard(g) {
    const days = daysUntil(g.deadline);
    const daysClass = days === T("overdue") ? "pill-danger" : days === T("today") ? "pill-warning" : "pill-neutral";
    const dots = Array.from({ length: g.milestones }, (_, i) =>
      `<div class="milestone-dot ${i < g.milestonesDone ? "done" : "left"}" data-gid="${g.id}" data-idx="${i}" title="${T("click_milestone")}"></div>`
    ).join("");
    return `
      <div class="goal-card">
        <div class="top">
          <div class="title">${g.title}</div>
          <button class="btn btn-ghost btn-sm del-goal" data-gid="${g.id}" title="${T("delete")}">${I("trash")}</button>
        </div>
        <div class="meta">
          <span class="chip">${I("calendar")} ${fmt(g.deadline)}</span>
          ${days ? `<span class="pill ${daysClass}" style="padding:3px 8px">${days}</span>` : ""}
          <span class="chip">${I("flag")} ${g.milestonesDone}/${g.milestones} ${T("milestone")}</span>
        </div>
        <div class="bottom">
          <div class="progress grow"><span style="width:${g.progress}%"></span></div>
          <div class="pct">${g.progress}%</div>
        </div>
        <div class="milestone-row" title="${T("click_milestone")}">${dots}</div>
      </div>`;
  }

  /* ── INSIGHT PANEL ─────────────────────────────────────────── */
  function insightPanel(skills, goals) {
    const sorted = [...skills].sort((a, b) => b.progress - a.progress);
    const bars = sorted.map(s => `
      <div class="bar-row">
        <div class="name">${s.name}</div>
        <div class="track"><div class="fill" style="width:${s.progress}%"></div></div>
        <div class="pct">${s.progress}%</div>
      </div>`).join("");

    const gaps = skills.filter(s => s.progress < 60).slice(0, 3).map(s => `
      <div class="gap-item">
        <div class="gap-dot"></div>
        <div class="body">
          <div class="title">${s.name}</div>
          <div class="desc">${T("gap_desc", s.level, s.target, 100 - s.progress)}</div>
        </div>
      </div>`).join("");

    const DAYS = ["M","T","W","T","F","S","S"];
    const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0…Sun=6
    const activities = window.Traqio?.store?.activities?.list() || [];
    const activeDays = new Set();
    activities.forEach(a => {
      if (!a.date) return;
      const daysAgo = Math.floor((Date.now() - new Date(a.date).getTime()) / 86400000);
      if (daysAgo < 7) activeDays.add((new Date(a.date).getDay() + 6) % 7);
    });
    const streak = DAYS.map((d, i) => {
      const isPast = i <= todayIdx;
      const active = activeDays.has(i) && isPast;
      return `<div class="streak-day ${i === todayIdx ? "today" : ""} ${active ? "active" : ""}">${d}</div>`;
    }).join("");

    const done = goals.filter(g => g.progress >= 100).length;
    const avg  = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

    return `
      <div class="insight-panel">
        <div class="insight-card">
          <h4 style="display:flex;align-items:center;gap:8px">${I("chart")} ${T("insight_progress")}</h4>
          <div class="radar-wrap">${bars || `<p style="color:var(--text-muted);font-size:.85rem">${T("no_skills_insight")}</p>`}</div>
        </div>
        <div class="insight-card">
          <h4 style="display:flex;align-items:center;gap:8px">${I("target")} ${T("insight_gaps")}</h4>
          ${gaps || `<div style="color:var(--text-muted);font-size:.85rem">${T("no_gap")}</div>`}
        </div>
        <div class="insight-card">
          <h4 style="display:flex;align-items:center;gap:8px">${I("trophy")} ${T("insight_goals")}</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:var(--bg-surface-2);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:1.5rem;font-weight:800">${done}</div>
              <div style="font-size:.72rem;color:var(--text-muted)">${T("goals_completed")}</div>
            </div>
            <div style="background:var(--bg-surface-2);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:1.5rem;font-weight:800">${avg}%</div>
              <div style="font-size:.72rem;color:var(--text-muted)">${T("goals_avg")}</div>
            </div>
          </div>
        </div>
        <div class="insight-card">
          <h4 style="display:flex;align-items:center;gap:8px">${I("sparkles")} ${T("insight_streak")}</h4>
          <div class="streak-row">${streak}</div>
          <div style="font-size:.8rem;color:var(--text-secondary);margin-top:10px">${T("streak_desc")}</div>
        </div>
      </div>`;
  }

  /* ── RENDER ────────────────────────────────────────────────── */
  function render() {
    const allSkills = window.Traqio.store.skills.list();
    const allGoals  = window.Traqio.store.goals.list();

    const skills = allSkills.filter(s => {
      if (activeCategory !== "all" && s.category !== activeCategory) return false;
      if (searchQ && !s.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });

    const categories = [...new Set(allSkills.map(s => s.category))];
    const catTabs = [
      `<button class="filter-chip ${activeCategory === "all" ? "active" : ""}" data-cat="all">${T("all_label")} <span style="opacity:.6">${allSkills.length}</span></button>`,
      ...categories.map(k => `<button class="filter-chip ${activeCategory === k ? "active" : ""}" data-cat="${k}">${k} <span style="opacity:.6">${allSkills.filter(s => s.category === k).length}</span></button>`),
    ].join("");

    const html = `
      <main class="page">
        <div class="page-header">
          <div class="titles"><h1>${T("skills_title")}</h1><p>${T("skills_sub")}</p></div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-secondary" id="addGoalBtn">${I("flag")} ${T("goals_add")}</button>
            <button class="btn btn-primary"   id="addSkillBtn">${I("plus")} ${T("skills_add")}</button>
          </div>
        </div>

        <div class="skills-layout">
          <div>
            <!-- SKILLS SECTION -->
            <div style="margin-bottom:22px">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
                <h2 style="font-size:1.2rem;font-weight:700">${T("my_skills")}</h2>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  ${catTabs}
                  <div style="position:relative">
                    <input id="skillSearch" class="input" style="padding-left:32px;height:34px;font-size:.85rem;width:160px" placeholder="${T("search_skills_ph")}" value="${searchQ}" />
                    <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
                  </div>
                </div>
              </div>
              <div class="skills-grid" id="skillsGrid">
                ${skills.length
                  ? skills.map(skillCard).join("")
                  : `<div class="empty-state card card-pad" style="grid-column:1/-1"><div class="icon">${I("sparkles")}</div><h3>${T("skills_empty_h")}</h3><p>${T("skills_empty_p")}</p></div>`}
              </div>
            </div>

            <!-- GOALS SECTION -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <h2 style="font-size:1.2rem;font-weight:700">${T("nav_skills").split("&")[0].trim().split(" ")[1] || "Goals"}</h2>
                <button class="btn btn-secondary btn-sm" id="addGoalBtn2">${I("plus")} ${T("goals_add")}</button>
              </div>
              <div id="goalsList">
                ${allGoals.length
                  ? allGoals.map(goalCard).join("")
                  : `<div class="empty-state card card-pad"><div class="icon">${I("target")}</div><h3>${T("goals_empty_h")}</h3><p>${T("goals_empty_p")}</p></div>`}
              </div>
            </div>
          </div>

          ${insightPanel(allSkills, allGoals)}
        </div>
      </main>`;

    window.Traqio.shell.mount("skills", html, { searchPlaceholder: T("search_ph") });
    wireEvents();
  }

  /* ── EVENT WIRING ──────────────────────────────────────────── */
  function wireEvents() {
    // Category filter chips
    document.querySelectorAll(".filter-chip[data-cat]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat;
        render();
      });
    });

    // Skill search (targets inside #app — re-wire each render)
    document.getElementById("skillSearch")?.addEventListener("input", (e) => {
      searchQ = e.target.value;
      const all = window.Traqio.store.skills.list();
      const filtered = all.filter(s =>
        (activeCategory === "all" || s.category === activeCategory) &&
        (!searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase()))
      );
      document.getElementById("skillsGrid").innerHTML = filtered.length
        ? filtered.map(skillCard).join("")
        : `<div style="color:var(--text-muted);font-size:.88rem;padding:12px">${T("skill_not_found")}</div>`;
      wireSkillCards();
    });

    wireSkillCards();
    wireGoalCards();
    wireSkillModal();
    wireGoalModal();
  }

  function wireSkillCards() {
    // Clickable level dots — update skill level in-place (preserves ID + position)
    document.querySelectorAll(".level-dots .dot").forEach(dot => {
      dot.style.cursor = "pointer";
      dot.addEventListener("click", () => {
        const skid     = dot.dataset.skid;
        const newLevel = parseInt(dot.dataset.lvl);
        const skill    = window.Traqio.store.skills.list().find(s => s.id === skid);
        if (!skill) return;
        const target   = Math.max(skill.target, newLevel);
        window.Traqio.store.skills.update(skid, {
          level:    newLevel,
          target,
          progress: Math.round((newLevel / target) * 100),
        });
        window.Traqio.toast(T("level_updated", skill.name, newLevel), "success");
        render();
      });
    });

    // +1h button — log practice hour
    document.querySelectorAll(".add-hour").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const skill = window.Traqio.store.skills.list().find(s => s.id === btn.dataset.skid);
        if (!skill) return;
        const newHours = (skill.hours || 0) + 1;
        window.Traqio.store.skills.update(btn.dataset.skid, { hours: newHours });
        window.Traqio?.store?.activities?.log({
          type: "skill", icon: "target", color: "c-purple",
          text: `Logged 1h of ${skill.name}`,
          date: new Date().toISOString(),
        });
        window.Traqio.toast(`+1h logged for ${skill.name}`, "success");
        render();
      });
    });

    // Delete skill
    document.querySelectorAll(".del-skill").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!await window.Traqio?.confirm?.(T("confirm_delete_skill"))) return;
        window.Traqio.store.skills.remove(btn.dataset.skid);
        window.Traqio.toast(T("skill_deleted"), "success");
        render();
      });
    });
  }

  function wireGoalCards() {
    // Clickable milestone dots — update in-place (preserves ID + position)
    document.querySelectorAll(".milestone-dot").forEach(dot => {
      dot.style.cursor = "pointer";
      dot.addEventListener("click", () => {
        const gid  = dot.dataset.gid;
        const idx  = parseInt(dot.dataset.idx);
        const goal = window.Traqio.store.goals.list().find(g => g.id === gid);
        if (!goal) return;
        const wasActive      = dot.classList.contains("done");
        const milestonesDone = wasActive ? Math.max(0, idx) : Math.min(goal.milestones, idx + 1);
        const progress       = Math.round((milestonesDone / goal.milestones) * 100);
        window.Traqio.store.goals.update(gid, { milestonesDone, progress });
        window.Traqio.toast(
          wasActive ? T("milestone_undone", idx + 1) : T("milestone_done", idx + 1),
          wasActive ? "default" : "success"
        );
        render();
      });
    });

    document.querySelectorAll(".del-goal").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!await window.Traqio?.confirm?.(T("confirm_delete_goal"))) return;
        window.Traqio.store.goals.remove(btn.dataset.gid);
        window.Traqio.toast(T("goal_deleted"), "success");
        render();
      });
    });
  }

  /* ── SKILL MODAL — wire save/close once, open button re-wired each render ── */
  function wireSkillModal() {
    // Open buttons live inside #app — re-wire every render
    const open = () => {
      document.getElementById("sk-name").value  = "";
      document.getElementById("sk-level").value  = "1";
      document.getElementById("sk-target").value = "5";
      document.getElementById("addSkillModal").classList.add("open");
      document.getElementById("sk-name").focus();
    };
    document.getElementById("addSkillBtn")?.addEventListener("click", open);

    // Modal control buttons are STATIC outside #app — only wire once
    if (_skillModalWired) return;
    _skillModalWired = true;

    const close = () => document.getElementById("addSkillModal").classList.remove("open");
    document.getElementById("closeSkillModal")?.addEventListener("click",  close);
    document.getElementById("cancelSkillModal")?.addEventListener("click", close);
    document.getElementById("saveSkillModal")?.addEventListener("click", () => {
      const name = document.getElementById("sk-name").value.trim();
      if (!name) { window.Traqio.toast(T("skill_name_required"), "error"); return; }
      const level  = Math.min(5, Math.max(1, parseInt(document.getElementById("sk-level").value)  || 1));
      const target = Math.min(5, Math.max(level, parseInt(document.getElementById("sk-target").value) || 5));
      window.Traqio.store.skills.add({
        name,
        category: document.getElementById("sk-cat").value,
        level, target,
        progress: Math.round((level / target) * 100),
        hours: 0,
      });
      window.Traqio.toast(T("skill_added"), "success");
      close();
      render();
    });
  }

  /* ── GOAL MODAL — wire save/close once, open buttons re-wired each render ── */
  function wireGoalModal() {
    // Open buttons live inside #app — re-wire every render
    const open = () => {
      document.getElementById("g-title").value      = "";
      document.getElementById("g-milestones").value = "3";
      document.getElementById("g-deadline").value   = "";
      document.getElementById("addGoalModal").classList.add("open");
      document.getElementById("g-title").focus();
    };
    document.getElementById("addGoalBtn")?.addEventListener("click",  open);
    document.getElementById("addGoalBtn2")?.addEventListener("click", open);

    // Modal control buttons are STATIC outside #app — only wire once
    if (_goalModalWired) return;
    _goalModalWired = true;

    const close = () => document.getElementById("addGoalModal").classList.remove("open");
    document.getElementById("closeGoalModal")?.addEventListener("click",  close);
    document.getElementById("cancelGoalModal")?.addEventListener("click", close);
    document.getElementById("saveGoalModal")?.addEventListener("click", () => {
      const title = document.getElementById("g-title").value.trim();
      if (!title) { window.Traqio.toast(T("goal_title_required"), "error"); return; }
      window.Traqio.store.goals.add({
        title,
        deadline:       document.getElementById("g-deadline").value || null,
        progress:       0,
        milestones:     Math.max(1, parseInt(document.getElementById("g-milestones").value) || 3),
        milestonesDone: 0,
      });
      window.Traqio.toast(T("goal_created"), "success");
      close();
      render();
    });
  }

  setTimeout(render, 0);

  // Only fires from other tabs (mock-data uses broadcast-only)
  window.Traqio?.state?.on("store:change", render);
  document.addEventListener("traqio:lang-change", render);
})();
