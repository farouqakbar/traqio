/* TRAQIO — Mock data store (DEMO_MODE)
 *
 * Backs the UI when DEMO_MODE is true so the whole app is browsable
 * without a Supabase project. Persists user-edited records to localStorage
 * so adding/removing applications, notes, etc. survives a refresh.
 *
 * In production, swap calls to Traqio.store.* with Supabase queries.
 */
(function () {
  const KEY = "traqio:mock-db:v2";

  const seed = {
    applications: [],
    skills:       [],
    goals:        [],
    activities:   [],
    journal:      [],
    jobs:         [],
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    save(seed);
    return JSON.parse(JSON.stringify(seed));
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    // broadcast-only: other tabs update via BroadcastChannel, local page renders itself
    try { window.Traqio?.state?.broadcast("store:change", {}); } catch {}
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    try { window.Traqio?.state?.broadcast("store:change", {}); } catch {}
  }

  let state = load();

  const api = {
    all: () => state,
    applications: {
      list:   () => state.applications,
      get:    (id) => state.applications.find(a => a.id === id),
      add:    (app) => {
        app.id = "a" + Date.now();
        app.stages = app.stages || [];
        app.notes  = app.notes  || [];
        state.applications.unshift(app);
        save(state);
        return app;
      },
      update: (id, patch) => {
        const a = state.applications.find(x => x.id === id);
        if (a) { Object.assign(a, patch); save(state); }
        return a;
      },
      remove: (id) => { state.applications = state.applications.filter(a => a.id !== id); save(state); },
      addStage: (id, stage) => {
        const a = state.applications.find(x => x.id === id);
        if (a) { stage.id = "s" + Date.now(); a.stages.push(stage); save(state); }
        return a;
      },
      updateStage: (appId, stageId, patch) => {
        const a = state.applications.find(x => x.id === appId);
        const s = a?.stages.find(x => x.id === stageId);
        if (s) { Object.assign(s, patch); save(state); }
        return s;
      },
      removeStage: (appId, stageId) => {
        const a = state.applications.find(x => x.id === appId);
        if (a) { a.stages = a.stages.filter(s => s.id !== stageId); save(state); }
      },
      addNote: (id, text) => {
        const a = state.applications.find(x => x.id === id);
        if (a) {
          const note = { id: "n" + Date.now(), text, createdAt: new Date().toISOString().slice(0, 10) };
          a.notes.unshift(note);
          save(state);
          return note;
        }
      },
      removeNote: (appId, noteId) => {
        const a = state.applications.find(x => x.id === appId);
        if (a) { a.notes = a.notes.filter(n => n.id !== noteId); save(state); }
      },
      updateNote: (appId, noteId, patch) => {
        const a = state.applications.find(x => x.id === appId);
        const n = a?.notes?.find(x => x.id === noteId);
        if (n) { Object.assign(n, patch); save(state); }
        return n;
      },
      // Cache-only helpers (no localStorage write) — used when Supabase is source of truth
      seed:           (apps) => { state.applications = (apps || []).map(a => ({ ...a })); },
      addToCache:     (app)  => { state.applications.unshift({ ...app }); },
      removeFromCache:(id)   => { state.applications = state.applications.filter(a => a.id !== id); },
      updateInCache:  (id, patch) => {
        const a = state.applications.find(x => x.id === id);
        if (a) Object.assign(a, patch);
      },
    },
    skills: {
      list:   () => state.skills,
      add:    (s) => { s.id = "sk" + Date.now(); state.skills.push(s); save(state); return s; },
      update: (id, patch) => {
        const s = state.skills.find(x => x.id === id);
        if (s) { Object.assign(s, patch); save(state); }
        return s;
      },
      remove: (id) => { state.skills = state.skills.filter(x => x.id !== id); save(state); },
    },
    goals: {
      list:   () => state.goals,
      add:    (g) => { g.id = "g" + Date.now(); state.goals.unshift(g); save(state); return g; },
      update: (id, patch) => {
        const g = state.goals.find(x => x.id === id);
        if (g) { Object.assign(g, patch); save(state); }
        return g;
      },
      remove: (id) => { state.goals = state.goals.filter(x => x.id !== id); save(state); },
    },
    activities: {
      list: () => state.activities,
      seed: (acts) => { state.activities = (acts || []).map(a => ({ ...a })); },
      log: (activity) => {
        const entry = {
          id: "act" + Date.now(),
          date: new Date().toISOString(),
          ...activity,
        };
        state.activities.unshift(entry);
        if (state.activities.length > 100) state.activities = state.activities.slice(0, 100);
        save(state);
        const cfg = window.TRAQIO_CONFIG || {};
        if (!cfg.DEMO_MODE) {
          window.Traqio?.supabase?.activities?.log?.(entry).catch(() => {});
        }
        return entry;
      },
    },
    journal: {
      list:   () => state.journal,
      add:    (j) => { j.id = "j" + Date.now(); state.journal.unshift(j); save(state); return j; },
      remove: (id) => { state.journal = state.journal.filter(x => x.id !== id); save(state); },
    },
    jobs: { list: () => state.jobs },
    reset,
  };

  // Expose companies list (populated by admin.js, reads from localStorage)
  window.Traqio = window.Traqio || {};
  window.Traqio.store = api;
  window.Traqio.companies = {
    list: () => {
      try {
        const raw = localStorage.getItem("traqio:companies:v1");
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    },
  };
})();
