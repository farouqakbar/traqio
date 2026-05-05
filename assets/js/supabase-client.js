/* TRAQIO — Supabase client wrapper */
(function () {
  const cfg = window.TRAQIO_CONFIG || {};
  let _client = null;

  function getClient() {
    if (cfg.DEMO_MODE) return null;
    if (_client) return _client;
    if (!window.supabase?.createClient) {
      console.warn("Supabase JS not loaded.");
      return null;
    }
    _client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
    return _client;
  }

  async function getUser() {
    if (cfg.DEMO_MODE) {
      return {
        id: "demo-user",
        email: "demo@traqio.app",
        user_metadata: { full_name: "Demo User", avatar_url: "" },
      };
    }
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getUser();
    return data?.user || null;
  }

  async function getSession() {
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data?.session || null;
  }

  async function signInWithGoogle() {
    if (cfg.DEMO_MODE) {
      window.location.href = "dashboard.html";
      return;
    }
    const c = getClient();
    if (!c) throw new Error("Supabase not initialised");

    // Build the redirect URL relative to where the project is served
    const redirectTo =
      cfg.AUTH_REDIRECT || window.location.origin + "/pages/dashboard.html";

    const { error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (cfg.DEMO_MODE) {
      window.location.href = "../index.html";
      return;
    }
    const c = getClient();
    if (c) await c.auth.signOut();
    // Navigate relative to current location (works from /pages/ or root)
    const isInPages = window.location.pathname.includes("/pages/");
    window.location.href = isInPages ? "../index.html" : "index.html";
  }

  /* ── Jobs API ──────────────────────────────────────────── */
  const jobs = {
    async list(includeInactive = false) {
      if (cfg.DEMO_MODE) return window.Traqio?.store?.jobs?.list() || [];
      const c = getClient();
      if (!c) return [];

      let q = c
        .from("jobs")
        .select("*")
        .order("posted_at", { ascending: false });
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) {
        console.warn("jobs.list:", error.message);
        return [];
      }
      return data || [];
    },

    async upsert(job) {
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");

      // FIX: attach authenticated user_id so RLS INSERT/UPDATE policy is satisfied.
      const { data: authData } = await c.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error("Not authenticated");

      const row = { ...job, user_id: user.id };
      // Remove id only for new records so Postgres generates it via DEFAULT
      if (!row.id) delete row.id;

      // FIX: onConflict is required in Supabase v2 — without it the server
      // cannot determine INSERT vs UPDATE and returns 400 Bad Request.
      const { data, error } = await c
        .from("jobs")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async add(job) {
      return this.upsert({ ...job, id: undefined, active: true });
    },

    async remove(id) {
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");
      const { error } = await c.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },

    async uploadLogo(file) {
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `logos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await c.storage
        .from("job-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = c.storage.from("job-logos").getPublicUrl(path);
      return data.publicUrl;
    },
  };

  /* ── Applications API ─────────────────────────────────── */
  function _appToDb(a) {
    const row = { ...a };
    if ("jobId"     in row) { row.job_id     = row.jobId     || null; delete row.jobId; }
    if ("appliedAt" in row) { row.applied_at = row.appliedAt || null; delete row.appliedAt; }
    // Drop local string IDs (e.g. "a1234567") — DB generates UUID
    if (typeof row.id === "string" && /^[a-z]\d+$/.test(row.id)) delete row.id;
    if (!Array.isArray(row.stages)) row.stages = [];
    if (!Array.isArray(row.notes))  row.notes  = [];
    delete row.created_at;
    delete row.updated_at;
    return row;
  }

  function _appFromDb(row) {
    if (!row) return null;
    return {
      ...row,
      jobId:     row.job_id     ?? null,
      appliedAt: row.applied_at ?? "",
      stages:    Array.isArray(row.stages) ? row.stages : [],
      notes:     Array.isArray(row.notes)  ? row.notes  : [],
    };
  }

  const applications = {
    async list() {
      if (cfg.DEMO_MODE) return window.Traqio?.store?.applications?.list() || [];
      const c = getClient();
      if (!c) return [];
      const { data, error } = await c
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { console.warn("applications.list:", error.message); return []; }
      return (data || []).map(_appFromDb);
    },

    async get(id) {
      if (cfg.DEMO_MODE) return window.Traqio?.store?.applications?.get(id) || null;
      const c = getClient();
      if (!c) return null;
      const { data, error } = await c
        .from("applications").select("*").eq("id", id).maybeSingle();
      if (error) { console.warn("applications.get:", error.message); return null; }
      return _appFromDb(data);
    },

    async add(app) {
      if (cfg.DEMO_MODE) return window.Traqio?.store?.applications?.add({ ...app });
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");
      const { data: authData } = await c.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Not authenticated");
      const row = { ..._appToDb(app), user_id: userId };
      const { data, error } = await c.from("applications").insert(row).select().single();
      if (error) throw error;
      return _appFromDb(data);
    },

    async update(id, patch) {
      if (cfg.DEMO_MODE) return window.Traqio?.store?.applications?.update(id, patch);
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");
      const row = _appToDb({ ...patch });
      delete row.user_id;
      delete row.id;
      const { data, error } = await c
        .from("applications").update(row).eq("id", id).select().single();
      if (error) throw error;
      return _appFromDb(data);
    },

    async remove(id) {
      if (cfg.DEMO_MODE) { window.Traqio?.store?.applications?.remove(id); return; }
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");
      const { error } = await c.from("applications").delete().eq("id", id);
      if (error) throw error;
    },
  };

  /* ── CV Files API (Supabase Storage) ──────────────────────
   * Requires a "cv-files" Storage bucket in Supabase.
   * Bucket policy: allow authenticated users to read/write
   * files where (storage.foldername(name))[1] = auth.uid()::text
   */
  const cvFiles = {
    async upload(file) {
      const c = getClient();
      if (!c) throw new Error("Supabase not initialised");
      const { data: authData } = await c.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await c.storage.from("cv-files").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = c.storage.from("cv-files").getPublicUrl(path);
      return data.publicUrl;
    },
    async remove(publicUrl) {
      const c = getClient();
      if (!c) return;
      const match = publicUrl.match(/\/storage\/v1\/object\/public\/cv-files\/(.+)$/);
      if (!match) return;
      await c.storage.from("cv-files").remove([match[1]]).catch(() => {});
    },
  };

  /* ── Activities API ──────────────────────────────────────
   * Requires an "activities" table:
   *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
   *   user_id uuid REFERENCES auth.users ON DELETE CASCADE,
   *   type text, icon text, color text, text text,
   *   date timestamptz DEFAULT now()
   * RLS: USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
   */
  const activities = {
    async list() {
      if (cfg.DEMO_MODE) return window.Traqio?.store?.activities?.list() || [];
      const c = getClient();
      if (!c) return [];
      const { data, error } = await c
        .from("activities")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (error) { console.warn("activities.list:", error.message); return []; }
      return data || [];
    },

    async log(activity) {
      if (cfg.DEMO_MODE) return;
      const c = getClient();
      if (!c) return;
      const { data: authData } = await c.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;
      const row = { type: activity.type, icon: activity.icon, color: activity.color, text: activity.text, date: activity.date || new Date().toISOString(), user_id: userId };
      await c.from("activities").insert(row).catch(() => {});
    },
  };

  window.Traqio = window.Traqio || {};
  window.Traqio.supabase = {
    getClient,
    getUser,
    getSession,
    signInWithGoogle,
    signOut,
    jobs,
    applications,
    cvFiles,
    activities,
  };
})();
