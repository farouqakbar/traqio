/* TRAQIO — Dashboard page
 *  Mobile-first redesign: removed all job-search references.
 *  Focus: Applications pipeline + Skills progress.
 *  i18n via Traqio.i18n.t(), targeted DOM refresh on store:change.
 */
(function () {
  function I(n) {
    return window.Traqio.icons.render(n);
  }
  function T(k, ...a) {
    const translation = window.Traqio?.i18n?.t(k, ...a);
    // Fallback untuk kunci yang tidak ditemukan
    if (translation === k) {
      const fallbacks = {
        dash_manage_skills: "Manage Skills",
        dash_total_apps: "Total Applications",
        dash_interviews: "Interviews",
        dash_avg_skill: "Avg Skill",
        dash_offers: "Offers",
        dash_active: "%s active",
        dash_scheduled: "%s scheduled",
        dash_skills_n: "%s skills tracked",
        dash_from_n: "from %s apps",
        dash_pipeline: "Application Pipeline",
        dash_pipeline_sub: "Track your progress",
        dash_open_tracker: "Open Tracker",
        dash_saved: "Saved",
        dash_applied: "Applied",
        dash_interview: "Interview",
        dash_offer: "Offer",
        dash_rejected: "Rejected",
        dash_trend: "Applications Trend",
        dash_trend_sub: "Last 7 days activity",
        dash_last7w: "Last 7 days",
        dash_recent: "Recent Activity",
        dash_recent_sub: "Latest updates",
        dash_view_all: "View all",
        dash_upcoming: "Upcoming Interviews",
        dash_upcoming_sub: "Your schedule",
        dash_no_schedule: "No interviews scheduled",
        dash_no_sched_desc: "Add applications to track interviews",
        dash_add_app_btn: "Add Application",
        dash_active_goals: "Active Goals",
        dash_goals_sub: "Learning progress",
        dash_manage: "Manage",
        dash_top_skills: "Top Skills",
        dash_top_skills_s: "In progress",
        dash_welcome: "Ready to grow, %s?",
        dash_interviews_w: "%s interview(s) ahead, %s!",
        dash_add_app: "Add App",
        dash_intv_today: "Interview Today",
        dash_intv_tomorrow: "Interview Tomorrow",
        dash_prep_done: "%s/%s prepared",
        dash_onboarding_title: "Start Your Journey",
        dash_onboarding_desc:
          "Add your first application and begin tracking your career progress",
        dash_add_first_app: "Add First Application",
        dash_stale_title: "%s application(s) pending follow-up",
        dash_stale_review: "Review",
        dash_no_activity: "No recent activity",
        dash_no_act_desc: "Your activity will appear here",
        milestone: "milestones",
        rel_just_now: "Just now",
        rel_min_ago: "%s min ago",
        rel_hr_ago: "%s hour ago",
        rel_day_ago: "%s day ago",
        search_ph: "Search...",
      };
      return fallbacks[k] || k;
    }
    return translation;
  }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fmt(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(
      window.Traqio?.i18n?.lang === "id" ? "id-ID" : "en-US",
      { day: "numeric", month: "short" },
    );
  }

  function pipelineCounts(apps) {
    const c = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    apps.forEach((a) => {
      if (c[a.status] !== undefined) c[a.status]++;
    });
    return c;
  }

  function upcomingInterviews(apps) {
    const today = new Date(new Date().toDateString());
    return apps
      .flatMap((a) =>
        (a.stages || [])
          .filter(
            (s) => s.state === "current" && s.date && new Date(s.date) >= today,
          )
          .map((s) => ({ app: a, stage: s })),
      )
      .sort((a, b) => new Date(a.stage.date) - new Date(b.stage.date))
      .slice(0, 4);
  }

  function weeklyBuckets(apps) {
    const now = new Date();
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return {
        label: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        dateStr: d.toDateString(),
        count: 0,
      };
    });
    apps.forEach((a) => {
      if (!a.appliedAt) return;
      const ds = new Date(a.appliedAt).toDateString();
      const b = buckets.find((x) => x.dateStr === ds);
      if (b) b.count++;
    });
    return buckets;
  }

  /* ── STAT CARDS ── */
  function renderStats(apps, skills, upcomingCount) {
    const active = apps.filter((a) =>
      ["applied", "interview"].includes(a.status),
    ).length;
    const interviews = apps.filter((a) => a.status === "interview").length;
    const offers = apps.filter((a) => a.status === "offer").length;
    const avgSkill = skills.length
      ? Math.round(skills.reduce((s, x) => s + x.progress, 0) / skills.length)
      : 0;

    return `
      <div class="dash-grid">
        <div class="stat-card c-info">
          <div class="stat-icon">${I("briefcase")}</div>
          <div class="label">${T("dash_total_apps")}</div>
          <div class="value">${apps.length}</div>
          <div class="delta up">${T("dash_active", active)}</div>
        </div>
        <div class="stat-card c-purple">
          <div class="stat-icon">${I("calendar")}</div>
          <div class="label">${T("dash_interviews")}</div>
          <div class="value">${interviews}</div>
          <div class="delta up">${T("dash_scheduled", upcomingCount)}</div>
        </div>
        <div class="stat-card c-success">
          <div class="stat-icon">${I("target")}</div>
          <div class="label">${T("dash_avg_skill")}</div>
          <div class="value">${avgSkill}%</div>
          <div class="delta flat">${T("dash_skills_n", skills.length)}</div>
        </div>
        <div class="stat-card c-warning">
          <div class="stat-icon">${I("trophy")}</div>
          <div class="label">${T("dash_offers")}</div>
          <div class="value">${offers}</div>
          <div class="delta flat">${T("dash_from_n", apps.length)}</div>
        </div>
      </div>`;
  }

  /* ── PIPELINE ── */
  function renderPipeline(apps) {
    const c = pipelineCounts(apps);
    const max = Math.max(...Object.values(c), 1);
    const step = (label, count) => `
      <div class="pipe-step">
        <div class="num">${count}</div>
        <div class="lab">${label}</div>
        <div class="bar"><span style="width:${(count / max) * 100}%"></span></div>
      </div>`;
    return `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h3>${T("dash_pipeline")}</h3>
            <div class="sub">${T("dash_pipeline_sub")}</div>
          </div>
          <a href="applications.html" class="btn btn-secondary btn-sm">${T("dash_open_tracker")} ${I("arrowRight")}</a>
        </div>
        <div class="pipeline">
          ${step(T("dash_saved"), c.saved)}
          ${step(T("dash_applied"), c.applied)}
          ${step(T("dash_interview"), c.interview)}
          ${step(T("dash_offer"), c.offer)}
          ${step(T("dash_rejected"), c.rejected)}
        </div>
      </div>`;
  }

  /* ── BAR CHART ── */
  function renderChart(apps) {
    const buckets = weeklyBuckets(apps);
    const max = Math.max(...buckets.map((b) => b.count), 1);
    const bars = buckets
      .map(
        (b) => `
      <div class="bar-col" title="${b.count} application(s) on ${b.label}">
        ${b.count > 0 ? `<div class="bar-value">${b.count}</div>` : ""}
        <div class="bar" style="height:${(b.count / max) * 100}%"></div>
        <div class="label">${b.label}</div>
      </div>`,
      )
      .join("");
    return `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h3>${T("dash_trend")}</h3>
            <div class="sub">${T("dash_trend_sub")}</div>
          </div>
          <span class="pill">${T("dash_last7w")}</span>
        </div>
        <div class="chart-wrap">
          <div class="bars-chart">${bars}</div>
        </div>
      </div>`;
  }

  function fmtRelAct(iso) {
    if (!iso) return T("rel_just_now");
    const d = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (d < 1) return T("rel_just_now");
    if (d < 60) return T("rel_min_ago", d);
    const h = Math.floor(d / 60);
    if (h < 24) return T("rel_hr_ago", h);
    return T("rel_day_ago", Math.floor(h / 24));
  }

  function renderActivities(activities) {
    const items = activities
      .slice(0, 5)
      .map(
        (a) => `
      <div class="act-item">
        <div class="ico ${a.color || "info"}">${I(a.icon || "briefcase")}</div>
        <div class="body">
          <div class="text">${a.text || T("dash_no_act_desc")}</div>
          <div class="time">${a.date ? fmtRelAct(a.date) : a.time || ""}</div>
        </div>
      </div>`,
      )
      .join("");

    const empty = `
      <div class="empty-state" style="padding:20px 0">
        <div class="icon">${I("sparkles")}</div>
        <h3>${T("dash_no_activity")}</h3>
        <p>${T("dash_no_act_desc")}</p>
      </div>`;

    return `
      <div class="panel">
        <div class="panel-head">
          <div><h3>${T("dash_recent")}</h3><div class="sub">${T("dash_recent_sub")}</div></div>
          <a href="applications.html" class="btn btn-ghost btn-sm">${T("dash_view_all")}</a>
        </div>
        <div class="activity-feed">${items || empty}</div>
      </div>`;
  }

  function renderUpcoming(items) {
    if (!items.length) {
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h3>${T("dash_upcoming")}</h3><div class="sub">${T("dash_upcoming_sub")}</div></div>
          </div>
          <div class="empty-state">
            <div class="icon">${I("calendar")}</div>
            <h3>${T("dash_no_schedule")}</h3>
            <p>${T("dash_no_sched_desc")}</p>
            <a href="applications.html" class="btn btn-primary" style="margin-top:12px">${I("plus")} ${T("dash_add_app_btn")}</a>
          </div>
        </div>`;
    }
    const cards = items
      .map(({ app, stage }) => {
        const d = new Date(stage.date);
        return `
        <a href="application-detail.html?id=${app.id}" class="upcoming-card">
          <div class="date-block">
            <div class="d">${d.getDate()}</div>
            <div class="m">${d.toLocaleString("en", { month: "short" })}</div>
          </div>
          <div class="body">
            <div class="role">${stage.name} · ${app.company}</div>
            <div class="meta"><span>${app.position}</span> · <span>${app.location}</span></div>
          </div>
          ${I("chevronRight")}
        </a>`;
      })
      .join("");
    return `
      <div class="panel">
        <div class="panel-head">
          <div><h3>${T("dash_upcoming")}</h3><div class="sub">${T("dash_upcoming_sub")}</div></div>
          <a href="applications.html" class="btn btn-ghost btn-sm">${T("dash_view_all")}</a>
        </div>
        ${cards}
      </div>`;
  }

  function renderGoals(goals) {
    if (!goals.length) {
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h3>${T("dash_active_goals")}</h3></div>
            <a href="skills.html" class="btn btn-ghost btn-sm">${T("dash_add_goal")}</a>
          </div>
          <div class="empty-state">
            <div class="icon">${I("target")}</div>
            <h3>${T("dash_no_goals")}</h3>
            <p>${T("dash_no_goals_desc")}</p>
          </div>
        </div>`;
    }
    const items = goals
      .map(
        (g) => `
      <div class="goal-item">
        <div class="top">
          <div class="title">${g.title}</div>
          <div class="pct">${g.progress}%</div>
        </div>
        <div class="meta">${g.milestonesDone}/${g.milestones} ${T("milestone")} · ${fmt(g.deadline)}</div>
        <div class="progress"><span style="width:${g.progress}%"></span></div>
      </div>`,
      )
      .join("");
    return `
      <div class="panel">
        <div class="panel-head">
          <div><h3>${T("dash_active_goals")}</h3><div class="sub">${T("dash_goals_sub")}</div></div>
          <a href="skills.html" class="btn btn-ghost btn-sm">${T("dash_manage")}</a>
        </div>
        ${items}
      </div>`;
  }

  function renderSkills(skills) {
    const items = [...skills]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4)
      .map(
        (s) => `
      <div class="goal-item">
        <div class="top">
          <div class="title">${s.name}</div>
          <div class="pct">Lv ${s.level}/${s.target}</div>
        </div>
        <div class="meta">${s.category} · ${s.hours}h tracked</div>
        <div class="progress"><span style="width:${s.progress}%"></span></div>
      </div>`,
      )
      .join("");
    return `
      <div class="panel">
        <div class="panel-head">
          <div><h3>${T("dash_top_skills")}</h3><div class="sub">${T("dash_top_skills_s")}</div></div>
          <a href="skills.html" class="btn btn-ghost btn-sm">${T("dash_view_all")}</a>
        </div>
        ${items}
      </div>`;
  }

  /* ── WELCOME BANNER — no job search button ── */
  function renderWelcome(user, interviewCount) {
    const storedName = (() => {
      try {
        return (
          JSON.parse(localStorage.getItem("traqio:profile:v1") || "{}").name ||
          ""
        );
      } catch {
        return "";
      }
    })();
    const raw =
      storedName ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "there";
    const name = raw.split(" ")[0];
    const hour = new Date().getHours();
    let greeting = "";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    const msg =
      interviewCount > 0
        ? T("dash_interviews_w", interviewCount, name)
        : T("dash_welcome", name);

    return `
      <div class="welcome-banner">
        <div class="welcome-text">
          <div class="welcome-greeting">${greeting}</div>
          <h2>${esc(name)} 👋</h2>
          <p>${msg}</p>
        </div>
        <div class="actions">
          <a href="applications.html" class="btn btn-primary">${I("plus")} ${T("dash_add_app")}</a>
          <a href="skills.html" class="btn btn-secondary">${I("target")} ${T("dash_manage_skills")}</a>
        </div>
      </div>`;
  }

  function renderInterviewBanner(apps, upcoming) {
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 86400000).toDateString();
    const urgent = upcoming
      .map(({ app, stage }) => ({
        app,
        stage,
        ds: new Date(stage.date).toDateString(),
      }))
      .filter((x) => x.ds === today || x.ds === tomorrow);
    if (!urgent.length) return "";
    const { app, stage, ds } = urgent[0];
    const isToday = ds === today;
    const prepChecked =
      (app.prepChecklist || []).filter(Boolean).length +
      (app.prepChecklistCustom || []).filter(Boolean).length;
    const prepTotal = 6 + (app.prepChecklistItems || []).length;
    const prepBar =
      prepTotal > 0 ? Math.round((prepChecked / prepTotal) * 100) : 0;
    const prepColor =
      prepBar >= 80
        ? "var(--success)"
        : prepBar >= 40
          ? "var(--warning)"
          : "var(--danger)";
    return `
      <a href="application-detail.html?id=${app.id}" class="interview-alert-banner">
        <div class="iab-accent"></div>
        <div class="iab-icon">🎯</div>
        <div class="iab-body">
          <div class="iab-title">${isToday ? T("dash_intv_today") : T("dash_intv_tomorrow")}: <strong>${esc(stage.name)}</strong></div>
          <div class="iab-meta">${esc(app.company)} · ${esc(app.position)}</div>
          <div class="iab-prep">
            <div class="iab-prep-bar">
              <div class="iab-prep-fill" style="width:${prepBar}%;background:${prepColor}"></div>
            </div>
            <span class="iab-prep-label" style="color:${prepColor}">${T("dash_prep_done", prepChecked, prepTotal)}</span>
          </div>
        </div>
        <div class="iab-arrow">${I("arrowRight")}</div>
      </a>`;
  }

  function renderConversionRate(apps) {
    if (apps.length < 2) return "";
    const c = pipelineCounts(apps);
    const a2iDen = c.applied + c.interview;
    const i2oDen = c.interview + c.offer;
    const a2iPct = a2iDen > 0 ? Math.round((c.interview / a2iDen) * 100) : null;
    const i2oPct = i2oDen > 0 ? Math.round((c.offer / i2oDen) * 100) : null;
    const rejPct =
      apps.length > 0 ? Math.round((c.rejected / apps.length) * 100) : null;
    const stat = (pct, num, den, label, color) => {
      const main = pct !== null ? `${num}/${den}` : "—";
      const sub = pct !== null ? `${pct}%` : "";
      return `
      <div class="conv-stat">
        <div style="font-size:1.1rem;font-weight:800;color:${color}">${main}</div>
        ${sub ? `<div style="font-size:.72rem;font-weight:600;color:${color};opacity:.75">${sub}</div>` : ""}
        <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px;white-space:nowrap">${label}</div>
      </div>`;
    };
    return `
      <div class="panel" style="padding:12px 20px">
        <div class="conv-row">
          <div class="conv-label">Conversion</div>
          ${stat(a2iPct, c.interview, a2iDen, "Applied → Interview", "var(--brand-500)")}
          ${stat(i2oPct, c.offer, i2oDen, "Interview → Offer", "var(--success)")}
          ${stat(rejPct, c.rejected, apps.length, "Rejection rate", "var(--danger)")}
        </div>
      </div>`;
  }

  /* ── ONBOARDING — no job search link ── */
  function renderOnboarding(apps) {
    if (apps.length > 0) return "";
    return `
      <div class="onboarding-banner">
        <div class="ob-emoji">🚀</div>
        <h3>${T("dash_onboarding_title")}</h3>
        <p>${T("dash_onboarding_desc")}</p>
        <div class="ob-actions">
          <a href="applications.html" class="btn btn-primary">${I("plus")} ${T("dash_add_first_app")}</a>
          <a href="skills.html" class="btn btn-secondary">${I("target")} ${T("dash_manage_skills")}</a>
        </div>
      </div>`;
  }

  function renderStaleBanner(apps) {
    const cutoff = Date.now() - 14 * 86400000;
    const stale = apps.filter(
      (a) =>
        a.status === "applied" &&
        a.appliedAt &&
        new Date(a.appliedAt).getTime() < cutoff,
    );
    if (!stale.length) return "";
    return `
      <div class="alert-banner alert-banner--warning">
        <div class="ab-icon">${I("clock")}</div>
        <div class="ab-body">
          <strong>${T("dash_stale_title", stale.length)}</strong>
          <div class="ab-meta">${stale.map((a) => esc(a.company)).join(", ")}</div>
        </div>
        <a href="applications.html" class="btn btn-secondary btn-sm ab-action">${T("dash_stale_review")}</a>
      </div>`;
  }

  /* ── QUICK ACTIONS (mobile-first shortcuts) ── */
  function renderQuickActions() {
    return `
      <div class="quick-actions">
        <a href="applications.html" class="qa-btn">
          <span class="qa-icon">${I("briefcase")}</span>
          <span class="qa-label">Applications</span>
        </a>
        <a href="skills.html" class="qa-btn">
          <span class="qa-icon">${I("target")}</span>
          <span class="qa-label">Skills</span>
        </a>
        <a href="applications.html?filter=interview" class="qa-btn">
          <span class="qa-icon">${I("calendar")}</span>
          <span class="qa-label">Interviews</span>
        </a>
        <a href="skills.html?tab=goals" class="qa-btn">
          <span class="qa-icon">${I("trophy")}</span>
          <span class="qa-label">Goals</span>
        </a>
      </div>`;
  }

  const DASH_ORDER_KEY = "traqio:dash-order:v1";
  const DASH_DEFAULT_ORDER = [
    "stats",
    "pipeline",
    "conversion",
    "row2",
    "row3",
  ];

  function loadDashOrder() {
    try {
      const remoteRaw = localStorage.getItem(DASH_ORDER_KEY + ":remote");
      let saved = null;
      if (remoteRaw) {
        try {
          saved = JSON.parse(remoteRaw).order || null;
        } catch {
          /* ignore */
        }
      }
      if (!saved) {
        saved = JSON.parse(localStorage.getItem(DASH_ORDER_KEY) || "null");
      }
      if (!Array.isArray(saved)) return [...DASH_DEFAULT_ORDER];
      const valid = saved.filter((k) => DASH_DEFAULT_ORDER.includes(k));
      const missing = DASH_DEFAULT_ORDER.filter((k) => !valid.includes(k));
      return [...valid, ...missing];
    } catch {
      return [...DASH_DEFAULT_ORDER];
    }
  }

  function saveDashOrder(order) {
    localStorage.setItem(DASH_ORDER_KEY, JSON.stringify(order));
    const payload = { order, ts: Date.now() };
    localStorage.setItem(DASH_ORDER_KEY + ":remote", JSON.stringify(payload));
    try {
      window.Traqio?.supabase?.client?.auth
        ?.updateUser({ data: { dash_widget_order: payload } })
        .catch(() => {});
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(
        DASH_ORDER_KEY + ":broadcast",
        JSON.stringify({ order, ts: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== DASH_ORDER_KEY + ":broadcast") return;
    try {
      const parsed = JSON.parse(e.newValue || "null") || {};
      const order = parsed.order;
      if (!Array.isArray(order)) return;
      const container = document.getElementById("dashWidgets");
      if (!container) return;
      const widgetEls = {};
      container.querySelectorAll(".dash-widget[data-widget]").forEach((el) => {
        widgetEls[el.dataset.widget] = el;
      });
      const valid = order.filter((k) => widgetEls[k]);
      const missing = Object.keys(widgetEls).filter((k) => !valid.includes(k));
      [...valid, ...missing].forEach((k) => {
        if (widgetEls[k]) container.appendChild(widgetEls[k]);
      });
    } catch {
      /* ignore */
    }
  });

  async function syncRemoteDashOrder() {
    try {
      const res = await window.Traqio?.supabase?.client?.auth?.getUser();
      const remote = res?.data?.user?.user_metadata?.dash_widget_order;
      if (remote && Array.isArray(remote.order)) {
        const localTs = (() => {
          try {
            return (
              JSON.parse(
                localStorage.getItem(DASH_ORDER_KEY + ":remote") || "{}",
              ).ts || 0
            );
          } catch {
            return 0;
          }
        })();
        if ((remote.ts || 0) > localTs) {
          localStorage.setItem(
            DASH_ORDER_KEY + ":remote",
            JSON.stringify(remote),
          );
          localStorage.setItem(DASH_ORDER_KEY, JSON.stringify(remote.order));
        }
      }
    } catch {
      /* ignore */
    }
  }

  function widget(key, html) {
    if (!html || !html.trim()) return "";
    const draggable = key !== "stats";
    return `<div class="dash-widget dash-widget--cols-12" data-widget="${key}"${draggable ? ' draggable="true"' : ""}>
      ${draggable ? `<div class="dash-widget-controls mobile-hidden">
        <div class="dash-widget-handle" title="Drag to reorder" aria-hidden="true"></div>
      </div>` : ""}
      ${html}
    </div>`;
  }

  function renderPage() {
    const store = window.Traqio.store;
    const apps = store.applications.list();
    const skills = store.skills.list();
    const goals = store.goals.list();
    const activities = store.activities.list();
    const upcoming = upcomingInterviews(apps);
    const order = loadDashOrder();

    const widgetsMap = {
      stats: renderStats(apps, skills, upcoming.length),
      pipeline: renderPipeline(apps),
      conversion: renderConversionRate(apps),
      row2: `<div class="row-2">${renderChart(apps)}${renderUpcoming(upcoming)}</div>`,
      row3: `<div class="row-3">${renderActivities(activities)}${renderGoals(goals)}${renderSkills(skills)}</div>`,
    };

    const orderedWidgets = order
      .map((key) => widget(key, widgetsMap[key]))
      .join("");

    return `
      <main class="page">
        ${renderWelcome(window.Traqio.user, upcoming.length)}
        ${renderQuickActions()}
        ${renderInterviewBanner(apps, upcoming)}
        ${renderOnboarding(apps)}
        ${renderStaleBanner(apps)}
        <div id="dashWidgets">${orderedWidgets}</div>
      </main>`;
  }

  /* ── Drag & Drop ── */
  function wireDashDragDrop() {
    const container = document.getElementById("dashWidgets");
    if (!container) return;
    let dragEl = null;
    let placeholder = null;

    function widgets() {
      return [...container.querySelectorAll(".dash-widget[data-widget]")];
    }
    function createPlaceholder(refEl) {
      if (placeholder) placeholder.remove();
      placeholder = document.createElement("div");
      placeholder.className = "dash-widget-placeholder";
      placeholder.style.cssText = `
        height: ${refEl.offsetHeight}px;
        border: 2px dashed var(--brand-500);
        border-radius: var(--radius-lg);
        background: rgba(99,102,241,.06);
        transition: height .15s;
        pointer-events: none;
      `;
      return placeholder;
    }
    function removePlaceholder() {
      if (placeholder) {
        placeholder.remove();
        placeholder = null;
      }
    }
    function commitOrder() {
      removePlaceholder();
      const order = widgets().map((el) => el.dataset.widget);
      saveDashOrder(order);
    }
    function clearDragStyles() {
      widgets().forEach((el) => {
        el.classList.remove("drag-over");
        el.style.opacity = "";
      });
    }

    container.querySelectorAll(".dash-widget[draggable='true']").forEach((w) => {
      w.setAttribute("draggable", "true");
      w.addEventListener("dragstart", (e) => {
        dragEl = w;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", w.dataset.widget);
        requestAnimationFrame(() => {
          w.style.opacity = "0.35";
        });
      });
      w.addEventListener("dragend", () => {
        if (dragEl) {
          if (placeholder && placeholder.parentNode === container) {
            container.insertBefore(dragEl, placeholder);
          }
          dragEl.style.opacity = "";
        }
        dragEl = null;
        clearDragStyles();
        commitOrder();
      });
      w.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragEl || dragEl === w) return;
        const rect = w.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        const ph = createPlaceholder(dragEl);
        if (before) container.insertBefore(ph, w);
        else container.insertBefore(ph, w.nextSibling);
        w.classList.add("drag-over");
      });
      w.addEventListener("dragleave", (e) => {
        if (!w.contains(e.relatedTarget)) w.classList.remove("drag-over");
      });
      w.addEventListener("drop", (e) => {
        e.preventDefault();
        clearDragStyles();
      });
    });
  }

  /* ── BOTTOM NAV (mobile) ── */
  function injectBottomNav() {
    if (document.getElementById("traqio-bottom-nav")) return;
    const nav = document.createElement("nav");
    nav.id = "traqio-bottom-nav";
    nav.className = "bottom-nav";
    nav.setAttribute("aria-label", "Main navigation");
    const page = window.location.pathname.split("/").pop() || "dashboard.html";
    const links = [
      { href: "dashboard.html", icon: "home", label: "Home" },
      { href: "applications.html", icon: "briefcase", label: "Applications" },
      { href: "skills.html", icon: "target", label: "Skills" },
      { href: "profile.html", icon: "user", label: "Profile" },
    ];
    nav.innerHTML = links
      .map(
        (
          l,
        ) => `<a href="${l.href}" class="bottom-nav-item${page === l.href ? " active" : ""}" aria-label="${l.label}">
          <span class="bottom-nav-icon">${window.Traqio.icons.render(l.icon)}</span>
          <span class="bottom-nav-label">${l.label}</span>
        </a>`,
      )
      .join("");
    document.body.appendChild(nav);
  }

  function checkInterviewNotifications(apps) {
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 86400000).toDateString();
    const urgent = apps
      .flatMap((a) =>
        (a.stages || [])
          .filter((s) => s.state === "current" && s.date)
          .map((s) => ({
            app: a,
            stage: s,
            ds: new Date(s.date).toDateString(),
          })),
      )
      .filter((x) => x.ds === today || x.ds === tomorrow);
    if (!urgent.length) return;
    const sessionKey = "traqio:notif:" + new Date().toDateString();
    if (!sessionStorage.getItem(sessionKey)) {
      urgent.slice(0, 2).forEach((x) => {
        const label = x.ds === today ? "Today" : "Tomorrow";
        window.Traqio?.toast?.(
          `${label}: ${x.stage.name} at ${x.app.company}`,
          "info",
        );
      });
      sessionStorage.setItem(sessionKey, "1");
    }
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        const x = urgent[0];
        new Notification(`Interview ${x.ds === today ? "Today" : "Tomorrow"}`, {
          body: `${x.stage.name} · ${x.app.company}`,
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }

  function refreshContent() {
    const existing = document.querySelector("#app .page");
    if (!existing) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = renderPage();
    existing.replaceWith(tmp.firstElementChild);
    wireDashDragDrop();
  }

  async function init() {
    const cfg = window.TRAQIO_CONFIG || {};
    if (!cfg.DEMO_MODE) {
      window.Traqio.shell.mount(
        "dashboard",
        `<main class="page" style="animation:none">
          <div class="skel skel--banner"></div>
          <div class="skel skel--quick-actions"></div>
          <div class="skel-stat-grid">
            ${Array.from({ length: 4 })
              .map(() => `<div class="skel skel--stat"></div>`)
              .join("")}
          </div>
          <div class="skel skel--panel"></div>
          <div class="skel-row2">
            <div class="skel skel--panel-tall"></div>
            <div class="skel skel--panel-tall"></div>
          </div>
        </main>`,
        { searchPlaceholder: T("search_ph") },
      );
    }
    if (!cfg.DEMO_MODE) {
      try {
        const [apps, acts] = await Promise.all([
          window.Traqio?.supabase?.applications?.list().catch(() => []),
          window.Traqio?.supabase?.activities?.list().catch(() => []),
        ]);
        window.Traqio?.store?.applications?.seed?.(apps || []);
        if (Array.isArray(acts) && acts.length) {
          window.Traqio?.store?.activities?.seed?.(acts);
        }
      } catch (e) {
        console.warn("Dashboard init error:", e);
      }
    }
    window.Traqio.shell.mount("dashboard", renderPage(), {
      searchPlaceholder: T("search_ph"),
    });
    wireDashDragDrop();
    checkInterviewNotifications(window.Traqio.store.applications.list());
  }

  setTimeout(async () => {
    await syncRemoteDashOrder();
    await init();
    injectBottomNav();
    const style = document.createElement("style");
    style.textContent = `
      @media (max-width: 640px) {
        .dash-widget-controls { display: none !important; }
        .dash-widget[draggable="true"] { cursor: grab; }
      }
      @media (min-width: 641px) {
        .dash-widget-controls { opacity: 0; transition: opacity 0.1s; }
        .dash-widget:hover .dash-widget-controls { opacity: 1; }
      }
      .bottom-nav a.active svg,
      .bottom-nav button.active svg {
        filter: drop-shadow(0 0 6px var(--brand-500));
      }
      .bar-col .bar-value {
        font-size: 0.65rem;
        font-weight: 800;
        color: var(--brand-600);
        margin-bottom: 2px;
        line-height: 1;
        text-align: center;
        min-height: 14px;
      }
    `;
    document.head.appendChild(style);
  }, 0);

  window.Traqio?.state?.on("store:change", refreshContent);
  document.addEventListener("traqio:lang-change", init);
})();
