/* TRAQIO — Internationalisation (i18n)
 * Auto-detects language from browser/OS locale.
 * Supports: English (en), Bahasa Indonesia (id).
 * Usage:  Traqio.i18n.t("key")          → translated string
 *         Traqio.i18n.t("key", a, b)    → with {0} {1} substitutions
 *         Traqio.i18n.setLang("id")     → switch + persist + broadcast event
 */
(function () {
  const S = {
    en: {
      /* ── Navigation ──────────────────────────────────── */
      nav_workspace:     "Workspace",
      nav_dashboard:     "Dashboard",
      nav_applications:  "Applications",
      nav_jobs:          "Job Search",
      nav_skills:        "Skills & Goals",
      nav_cv:            "CV / Resume",

      /* ── Shell / Topbar ──────────────────────────────── */
      search_ph:         "Search applications, skills, jobs… (Ctrl+K)",
      notifications:     "Notifications",
      mark_all_read:     "Mark all read",
      no_notifs:         "No notifications",
      no_notifs_desc:    "You'll be notified about important updates.",
      view_all_activity: "View all activity →",
      clock_label:       "Local time",
      edit_profile:      "Edit Profile",
      sign_out:          "Sign Out",

      /* ── Dashboard ───────────────────────────────────── */
      dash_total_apps:   "Total Applications",
      dash_active:       "{0} active",
      dash_interviews:   "Interview Stage",
      dash_scheduled:    "{0} scheduled",
      dash_avg_skill:    "Avg. Skill",
      dash_skills_n:     "{0} skills tracked",
      dash_offers:       "Offers Received",
      dash_from_n:       "From {0} applications",
      dash_pipeline:     "Application Pipeline",
      dash_pipeline_sub: "Current status of all your applications",
      dash_open_tracker: "Open Tracker",
      dash_saved:        "Saved",
      dash_applied:      "Applied",
      dash_interview:    "Interview",
      dash_offer:        "Offer",
      dash_rejected:     "Rejected",
      dash_trend:        "Activity Trend",
      dash_trend_sub:    "Applications per week, last 7 weeks",
      dash_last7w:       "Last 7 weeks",
      dash_recent:       "Recent Activity",
      dash_recent_sub:   "Your latest moves",
      dash_view_all:     "View all",
      dash_no_activity:  "No activity yet",
      dash_no_act_desc:  "Start adding applications to see your activity here.",
      dash_add_app_btn:  "Add Application",
      dash_upcoming:     "Upcoming Interviews",
      dash_upcoming_sub: "Don't miss them",
      dash_no_schedule:  "No schedule yet",
      dash_no_sched_desc:"Add interview schedules from the application detail page.",
      dash_active_goals: "Active Goals",
      dash_goals_sub:    "What you're pursuing",
      dash_no_goals:     "No goals yet",
      dash_no_goals_desc:"Set your first goal on the Skills page.",
      dash_add_goal:     "Add goal",
      dash_manage:       "Manage",
      dash_top_skills:   "Top Skills",
      dash_top_skills_s: "Progress on your focus areas",
      dash_hello:        "Hello, {0} 👋",
      dash_welcome:      "Welcome back, {0}! Let's continue your career journey.",
      dash_interviews_w: "You have {0} interview(s) this week. Go for it, {1}!",
      dash_add_app:      "Add Application",
      dash_job_search:   "Job Search",
      milestone:         "milestone",

      /* ── Applications ────────────────────────────────── */
      apps_title:        "Applications",
      apps_sub:          "Track every opportunity end-to-end.",
      apps_add:          "Add Application",
      apps_kanban:       "Kanban",
      apps_table:        "Table",
      apps_empty_h:      "No applications yet",
      apps_empty_p:      "Track your first job application to get started.",

      /* ── Jobs ────────────────────────────────────────── */
      jobs_title:        "Job Search",
      jobs_sub:          "Curated opportunities matched to your skills.",
      jobs_found:        "{0} opportunities found",
      jobs_empty_h:      "No jobs match",
      jobs_empty_p:      "Try adjusting your search or filters.",

      /* ── Skills ──────────────────────────────────────── */
      skills_title:      "Skills & Goals",
      skills_sub:        "Track your growth, find gaps, stay on track.",
      skills_add:        "Add Skill",
      goals_add:         "Add Goal",
      skills_empty_h:    "No skills yet",
      skills_empty_p:    "Add your first skill to start tracking.",
      goals_empty_h:     "No goals yet",
      goals_empty_p:     "Set a goal to measure your progress.",

      /* ── CV ──────────────────────────────────────────── */
      cv_title:          "CV / Resume",
      cv_sub:            "Upload and manage your CV versions — always have the right one ready to send.",
      cv_upload:         "Upload CV",
      cv_empty_h:        "No CVs uploaded",
      cv_empty_p:        "Upload your CV to keep it ready to send.",

      /* ── Profile ─────────────────────────────────────── */
      profile_title:     "My Profile",
      profile_sub:       "Your public career profile and account settings.",
      profile_personal:  "Personal Information",
      profile_career:    "Career Targets",
      profile_notifs:    "Notifications",
      profile_save:      "Save Changes",
      profile_save_tgt:  "Save Targets",
      profile_save_pref: "Save Preferences",
      profile_reset:     "Reset all data",
      profile_reset_desc:"Clears all applications, skills, and goals. Cannot be undone.",
      profile_otw:       "Open to Work",

      /* ── Skills page extras ──────────────────────────── */
      my_skills:           "My Skills",
      all_label:           "All",
      no_deadline:         "No deadline",
      overdue:             "Overdue",
      today:               "Today",
      days_left:           "{0}d left",
      set_level:           "Set to level {0}",
      hours_tracked:       "{0}h tracked",
      click_to_update_level: "Click dot to update level",
      click_milestone:     "Click to toggle milestone",
      search_skills_ph:    "Search skills…",
      skill_not_found:     "No skills found.",
      skill_name_required: "Skill name is required",
      goal_title_required: "Goal title is required",
      skill_added:         "Skill added!",
      goal_created:        "Goal created!",
      skill_deleted:       "Skill deleted",
      goal_deleted:        "Goal deleted",
      confirm_delete_skill:"Delete this skill?",
      confirm_delete_goal: "Delete this goal?",
      level_updated:       "{0} → Level {1}",
      milestone_done:      "Milestone {0} completed!",
      milestone_undone:    "Milestone {0} cancelled",
      insight_progress:    "Skill Progress",
      insight_gaps:        "Skill Gaps",
      insight_goals:       "Goals Summary",
      insight_streak:      "Weekly Streak",
      goals_completed:     "Completed",
      goals_avg:           "Average",
      streak_desc:         "Start tracking to build your streak.",
      no_gap:              "No critical gaps — keep it up!",
      gap_desc:            "Lv {0} now, target Lv {1} · {2}% gap remaining",
      no_skills_insight:   "No skills yet.",

      /* ── Common ──────────────────────────────────────── */
      cancel:            "Cancel",
      save:              "Save",
      delete:            "Delete",
      edit:              "Edit",
      confirm_delete:    "Are you sure you want to delete this?",
    },

    id: {
      /* ── Navigation ──────────────────────────────────── */
      nav_workspace:     "Workspace",
      nav_dashboard:     "Dashboard",
      nav_applications:  "Lamaran",
      nav_jobs:          "Cari Kerja",
      nav_skills:        "Skill & Goals",
      nav_cv:            "CV / Resume",

      /* ── Shell / Topbar ──────────────────────────────── */
      search_ph:         "Cari lamaran, skill, pekerjaan… (Ctrl+K)",
      notifications:     "Notifikasi",
      mark_all_read:     "Tandai semua dibaca",
      no_notifs:         "Belum ada notifikasi",
      no_notifs_desc:    "Kamu akan diberitahu ketika ada update penting.",
      view_all_activity: "Lihat semua aktivitas →",
      clock_label:       "Waktu lokal",
      edit_profile:      "Edit Profil",
      sign_out:          "Keluar",

      /* ── Dashboard ───────────────────────────────────── */
      dash_total_apps:   "Total Lamaran",
      dash_active:       "{0} masih aktif",
      dash_interviews:   "Tahap Interview",
      dash_scheduled:    "{0} terjadwal",
      dash_avg_skill:    "Rata-rata Skill",
      dash_skills_n:     "{0} skill tercatat",
      dash_offers:       "Penawaran Diterima",
      dash_from_n:       "Dari {0} lamaran",
      dash_pipeline:     "Pipeline Lamaran",
      dash_pipeline_sub: "Status semua lamaran saat ini",
      dash_open_tracker: "Buka Tracker",
      dash_saved:        "Disimpan",
      dash_applied:      "Dikirim",
      dash_interview:    "Interview",
      dash_offer:        "Penawaran",
      dash_rejected:     "Ditolak",
      dash_trend:        "Tren Aktivitas",
      dash_trend_sub:    "Jumlah lamaran per minggu, 7 minggu terakhir",
      dash_last7w:       "7 minggu terakhir",
      dash_recent:       "Aktivitas Terbaru",
      dash_recent_sub:   "Gerakan terakhirmu",
      dash_view_all:     "Lihat semua",
      dash_no_activity:  "Belum ada aktivitas",
      dash_no_act_desc:  "Mulai tambahkan lamaran untuk melihat aktivitasmu di sini.",
      dash_add_app_btn:  "Tambah Lamaran",
      dash_upcoming:     "Interview Mendatang",
      dash_upcoming_sub: "Jangan sampai terlewat",
      dash_no_schedule:  "Belum ada jadwal",
      dash_no_sched_desc:"Tambahkan jadwal interview dari halaman detail lamaran.",
      dash_active_goals: "Goals Aktif",
      dash_goals_sub:    "Yang sedang kamu kejar",
      dash_no_goals:     "Belum ada goal",
      dash_no_goals_desc:"Set goal pertamamu di halaman Skills.",
      dash_add_goal:     "Tambah goal",
      dash_manage:       "Kelola",
      dash_top_skills:   "Top Skills",
      dash_top_skills_s: "Progress area fokus kamu",
      dash_hello:        "Halo, {0} 👋",
      dash_welcome:      "Selamat datang kembali, {0}! Mari lanjutkan perjalanan kariermu.",
      dash_interviews_w: "Kamu punya {0} interview minggu ini. Semangat, {1}!",
      dash_add_app:      "Tambah Lamaran",
      dash_job_search:   "Cari Kerja",
      milestone:         "milestone",

      /* ── Applications ────────────────────────────────── */
      apps_title:        "Lamaran",
      apps_sub:          "Lacak setiap peluang dari awal hingga akhir.",
      apps_add:          "Tambah Lamaran",
      apps_kanban:       "Kanban",
      apps_table:        "Tabel",
      apps_empty_h:      "Belum ada lamaran",
      apps_empty_p:      "Tambahkan lamaran pertamamu untuk memulai.",

      /* ── Jobs ────────────────────────────────────────── */
      jobs_title:        "Cari Kerja",
      jobs_sub:          "Peluang terkurasi sesuai skill dan target kariermu.",
      jobs_found:        "{0} lowongan ditemukan",
      jobs_empty_h:      "Tidak ada pekerjaan yang cocok",
      jobs_empty_p:      "Coba sesuaikan pencarian atau filter.",

      /* ── Skills ──────────────────────────────────────── */
      skills_title:      "Skill & Goals",
      skills_sub:        "Lacak pertumbuhanmu, temukan gap, tetap on track.",
      skills_add:        "Tambah Skill",
      goals_add:         "Tambah Goal",
      skills_empty_h:    "Belum ada skill",
      skills_empty_p:    "Tambahkan skill pertamamu untuk mulai melacak.",
      goals_empty_h:     "Belum ada goal",
      goals_empty_p:     "Set goal untuk mengukur progresmu.",

      /* ── CV ──────────────────────────────────────────── */
      cv_title:          "CV / Resume",
      cv_sub:            "Upload dan kelola versi CV kamu — selalu siap dikirim.",
      cv_upload:         "Upload CV",
      cv_empty_h:        "Belum ada CV",
      cv_empty_p:        "Upload CV kamu agar selalu siap dikirim.",

      /* ── Profile ─────────────────────────────────────── */
      profile_title:     "Profil Saya",
      profile_sub:       "Profil karier publik dan pengaturan akun kamu.",
      profile_personal:  "Informasi Pribadi",
      profile_career:    "Target Karier",
      profile_notifs:    "Notifikasi",
      profile_save:      "Simpan Perubahan",
      profile_save_tgt:  "Simpan Target",
      profile_save_pref: "Simpan Preferensi",
      profile_reset:     "Reset semua data",
      profile_reset_desc:"Menghapus semua lamaran, skill, dan goal. Tidak dapat dibatalkan.",
      profile_otw:       "Buka untuk Kerja",

      /* ── Skills page extras ──────────────────────────── */
      my_skills:           "Skill Saya",
      all_label:           "Semua",
      no_deadline:         "Tanpa deadline",
      overdue:             "Terlambat",
      today:               "Hari ini",
      days_left:           "{0}h lagi",
      set_level:           "Set ke level {0}",
      hours_tracked:       "{0}j tercatat",
      click_to_update_level: "Klik titik untuk update level",
      click_milestone:     "Klik untuk toggle milestone",
      search_skills_ph:    "Cari skill…",
      skill_not_found:     "Tidak ditemukan.",
      skill_name_required: "Nama skill wajib diisi",
      goal_title_required: "Judul goal wajib diisi",
      skill_added:         "Skill berhasil ditambahkan!",
      goal_created:        "Goal berhasil dibuat!",
      skill_deleted:       "Skill dihapus",
      goal_deleted:        "Goal dihapus",
      confirm_delete_skill:"Hapus skill ini?",
      confirm_delete_goal: "Hapus goal ini?",
      level_updated:       "{0} → Level {1}",
      milestone_done:      "Milestone {0} selesai!",
      milestone_undone:    "Milestone {0} dibatalkan",
      insight_progress:    "Progress Skill",
      insight_gaps:        "Gap Skill",
      insight_goals:       "Ringkasan Goal",
      insight_streak:      "Streak Mingguan",
      goals_completed:     "Selesai",
      goals_avg:           "Rata-rata",
      streak_desc:         "Mulai tambahkan skill untuk melacak streakmu.",
      no_gap:              "Tidak ada gap kritis — terus pertahankan!",
      gap_desc:            "Lv {0} sekarang, target Lv {1} · sisa gap {2}%",
      no_skills_insight:   "Belum ada skill.",

      /* ── Common ──────────────────────────────────────── */
      cancel:            "Batal",
      save:              "Simpan",
      delete:            "Hapus",
      edit:              "Edit",
      confirm_delete:    "Yakin ingin menghapus ini?",
    },
  };

  const KEY = "traqio:lang";

  function detect() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored && S[stored]) return stored;
    } catch {}
    const sys = (navigator.language || "en").slice(0, 2).toLowerCase();
    return S[sys] ? sys : "en";
  }

  let _lang = detect();

  function t(key, ...args) {
    let str = S[_lang]?.[key] ?? S.en?.[key] ?? key;
    args.forEach((a, i) => { str = str.replace(`{${i}}`, a); });
    return str;
  }

  function setLang(code) {
    if (!S[code]) return;
    _lang = code;
    try { localStorage.setItem(KEY, code); } catch {}
    document.documentElement.setAttribute("lang", code);
    document.dispatchEvent(new CustomEvent("traqio:lang-change", { detail: { lang: code } }));
  }

  document.documentElement.setAttribute("lang", _lang);

  window.Traqio = window.Traqio || {};
  window.Traqio.i18n = {
    t,
    setLang,
    get lang()  { return _lang; },
    get langs() { return Object.keys(S); },
  };
})();
