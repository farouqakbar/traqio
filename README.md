# Traqio — Track Your Growth, Own Your Future

> A modern, open-source career-tracking platform for jobseekers. Track every application, journal your interviews, manage your skills, and grow with intention.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-traqio.app-4F46E5?style=flat-square&logo=vercel)](https://traqio.github.io/Traqio/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Application Tracker** | Kanban board + table view with drag-and-drop, custom columns, and status tracking |
| **Stage & Interview Journal** | Per-stage notes, prep material, reflection prompts, and post-interview logging |
| **Skills & Goals** | Level-up tracker with proficiency dots, gap analysis, milestones, and streak system |
| **Job Search** | Curated listings matched to your skill profile with a real-time match score |
| **CV Manager** | Upload, preview, and version your resume with Supabase Storage cloud sync |
| **Admin Panel** | Job listing management, company logo management, master list configuration |
| **Profile & Preferences** | Career targets, preferred industries, social links, job preference settings |
| **Activity Feed** | Automatic logging of key events (applications, status changes) on the dashboard |
| **Dark Mode** | Full system with `localStorage` persistence and instant switching |
| **Demo Mode** | Fully interactive without a Supabase account — no sign-up required to explore |
| **i18n** | English & Bahasa Indonesia with live language switching |
| **Cross-device Sync** | All data stored in Supabase — seamless across laptop, tablet, and mobile |

---

## 🚀 Quick Start (Demo Mode)

No installation or server required. Open the landing page directly in your browser:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

Click **Get Started Free** → **Continue with Google**.  
In Demo Mode, OAuth is bypassed and you land directly on the dashboard with a local data store.

> **Note:** Demo Mode data is stored in `localStorage` — device-specific and cleared when browser storage is cleared. For persistent, cross-device data use the Supabase setup below.

---

## ⚙️ Production Setup

### Prerequisites

- A [Supabase](https://supabase.com) project (free tier is sufficient)
- A Google Cloud project for OAuth credentials
- A static hosting service (Vercel, Netlify, or GitHub Pages)

---

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon/public key** from  
   **Project Settings → API**

---

### Step 2 — Run the Database Schema

In the Supabase dashboard → **SQL Editor**, run the following schema:

```sql
-- ── Jobs table ────────────────────────────────────────────────────────────────
CREATE TABLE public.jobs (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company      text NOT NULL,
  position     text NOT NULL,
  industry     text DEFAULT '',
  location     text NOT NULL,
  salary       text DEFAULT '',
  salary_min   numeric,
  salary_max   numeric,
  type         text DEFAULT 'Full-time',
  description  text DEFAULT '',
  requirements text DEFAULT '',
  tags         text[] DEFAULT '{}',
  preferences  text[] DEFAULT '{}',
  apply_url    text DEFAULT '',
  logo_url     text DEFAULT '',
  logo_color   text DEFAULT '#3b82f6',
  active       boolean DEFAULT true,
  posted_at    timestamptz DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active" ON public.jobs
  FOR SELECT USING (active = true);

CREATE POLICY "admin_all" ON public.jobs
  FOR ALL USING (auth.email() = 'your-admin@email.com');

-- ── Applications table ────────────────────────────────────────────────────────
CREATE TABLE public.applications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id),
  job_id     uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  company    text DEFAULT '',
  position   text DEFAULT '',
  location   text DEFAULT '',
  salary     text DEFAULT '',
  status     text DEFAULT 'saved',
  source     text DEFAULT '',
  link       text DEFAULT '',
  logo       text DEFAULT '',
  logo_url   text DEFAULT '',
  color      text DEFAULT '#3b82f6',
  applied_at date,
  stages     jsonb DEFAULT '[]',
  notes      jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_applications" ON public.applications
  FOR ALL USING (auth.uid() = user_id);

-- ── User Activities table ─────────────────────────────────────────────────────
CREATE TABLE public.user_activities (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id),
  type       text DEFAULT '',
  icon       text DEFAULT 'briefcase',
  color      text DEFAULT 'c-info',
  text       text DEFAULT '',
  date       timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_activities" ON public.user_activities
  FOR ALL USING (auth.uid() = user_id);
```

---

### Step 3 — Create Storage Buckets

In Supabase dashboard → **Storage**, create two buckets:

| Bucket name | Visibility | Purpose |
|-------------|------------|---------|
| `job-logos` | Public | Company logo images uploaded by admin |
| `cv-files`  | Private | User CV/resume files |

Then run these storage policies in the **SQL Editor**:

```sql
-- job-logos: public read, admin write
CREATE POLICY "public_read_logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-logos');

CREATE POLICY "admin_upload_logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-logos'
    AND auth.email() = 'your-admin@email.com'
  );

-- cv-files: users own their folder (path = {user_id}/filename)
CREATE POLICY "users_own_cvs" ON storage.objects
  FOR ALL USING (
    bucket_id = 'cv-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

### Step 4 — Enable Google OAuth

1. Supabase dashboard → **Authentication → Providers → Google** → Enable
2. Create OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com):
   - **Authorized JavaScript origins:** `https://your-domain.com`
   - **Authorized redirect URIs:** `https://your-ref.supabase.co/auth/v1/callback`
3. Paste **Client ID** and **Client Secret** into Supabase

---

### Step 5 — Configure Redirect URLs

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://your-domain.com`
- **Redirect URLs:** `https://your-domain.com/pages/dashboard.html`

---

### Step 6 — Configure the App

Edit `assets/js/config.js`:

```js
window.TRAQIO_CONFIG = {
  SUPABASE_URL:      "https://your-ref.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key",
  AUTH_REDIRECT:     "https://your-domain.com/pages/dashboard.html",
  DEMO_MODE:         false,  // ← must be false in production
};
```

> ⚠️ **Security:** The Supabase `anon` key is safe to expose in the browser — Row-Level Security policies enforce data isolation at the database level. Never expose your `service_role` key in client-side code.

---

## 🌐 Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

Create a `vercel.json` at the project root for security headers:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options",         "value": "DENY" },
        { "key": "X-Content-Type-Options",   "value": "nosniff" },
        { "key": "Referrer-Policy",          "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy",       "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

### Netlify

1. Drag the project folder into [app.netlify.com/drop](https://app.netlify.com/drop), or connect your GitHub repo with **Publish directory:** `/`
2. Create `_headers` at the project root:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

### GitHub Pages

1. Push the repository to GitHub
2. Go to **Settings → Pages → Source:** Deploy from branch `main` / `root`
3. Update `AUTH_REDIRECT` in `config.js` to your GitHub Pages URL

---

## 🗂️ Project Structure

```
traqio/
├── index.html                      Landing page
├── vercel.json                     Vercel deployment config
├── assets/
│   ├── css/
│   │   ├── base.css                Design tokens, reset, shared components
│   │   ├── app-shell.css           Sidebar + topbar layout
│   │   ├── landing.css             Landing page styles
│   │   ├── login.css               Login page styles
│   │   ├── dashboard.css           Dashboard
│   │   ├── applications.css        Application tracker (kanban + table)
│   │   ├── application-detail.css  Stage tracker + journal
│   │   ├── jobs.css                Job search
│   │   ├── skills.css              Skills & goals
│   │   ├── cv.css                  CV manager
│   │   ├── profile.css             Profile & settings
│   │   └── admin.css               Admin panel
│   ├── js/
│   │   ├── config.js               Runtime config (Supabase credentials)
│   │   ├── supabase-client.js      Supabase JS wrapper (jobs, applications, cvFiles APIs)
│   │   ├── mock-data.js            Demo-mode data store (localStorage)
│   │   ├── auth-guard.js           Route protection for authenticated pages
│   │   ├── admin-guard.js          Route protection for admin-only pages
│   │   ├── app-shell.js            Sidebar, topbar, clock, notifications renderer
│   │   ├── state.js                Event bus + BroadcastChannel cross-tab sync
│   │   ├── i18n.js                 Internationalization (English + Bahasa Indonesia)
│   │   ├── icons.js                Inline SVG icon library
│   │   ├── theme.js                Light/dark mode toggle
│   │   ├── toast.js                Toast notification helper
│   │   ├── landing.js              Landing page interactions
│   │   ├── login.js                Google OAuth flow + demo bypass
│   │   ├── dashboard.js            Dashboard — stats, pipeline, activity feed
│   │   ├── applications.js         Applications list — kanban, table, drag-and-drop
│   │   ├── application-detail.js   Application detail — stages, notes, health score
│   │   ├── jobs.js                 Job search — match score, save, apply
│   │   ├── skills.js               Skills & goals tracker
│   │   ├── cv.js                   CV upload, preview, Supabase Storage sync
│   │   ├── profile.js              Profile settings
│   │   └── admin.js                Admin — job management, company management
│   └── logo/
│       ├── logokanan.png           Light mode logo
│       └── logodarkmode.png        Dark mode logo
└── pages/
    ├── login.html
    ├── dashboard.html
    ├── applications.html
    ├── application-detail.html
    ├── jobs.html
    ├── skills.html
    ├── cv.html
    ├── profile.html
    └── admin.html
```

---

## 🛠️ Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Vanilla HTML + CSS + JS | Zero build step, fast load, no framework lock-in |
| Auth | Supabase Auth (Google OAuth 2.0) | Free, production-grade, built-in session management |
| Database | Supabase PostgreSQL + RLS | Row-level security enforced server-side |
| File Storage | Supabase Storage | CV uploads, company logo hosting |
| Fonts | Inter via Google Fonts | Clean, professional, widely supported |
| Deployment | Vercel / Netlify / GitHub Pages | Static hosting, global CDN, zero cost |

---

## 🔒 Security Model

- **Supabase `anon` key** is intentionally public — all data access is gated by Row-Level Security policies at the database level, not in JavaScript.
- **Admin access** is enforced via both a client-side guard (UX) and a Supabase RLS policy (`auth.email() = 'admin@email.com'`). The RLS policy is the real security boundary.
- **User data isolation** — every table has `user_id uuid REFERENCES auth.users(id)` with a `FOR ALL USING (auth.uid() = user_id)` policy. Users can never access another user's data.
- **Storage paths** for CV files use `{user_id}/filename` so policies can be enforced by folder prefix.
- **Never commit** `service_role` keys to version control. The `service_role` key has full database access and must only be used in secure server-side environments.

---

## 👤 Admin Panel

The admin panel (`/pages/admin.html`) is restricted to the email set in:
- `assets/js/admin-guard.js` (client-side UX redirect)
- The Supabase RLS policy `admin_all` on the `jobs` table

Admins can:
- Create, edit, and delete job listings
- Upload company logos to Supabase Storage
- Manage the master lists (industries, skills, job preferences)
- Manage the company registry used for logo auto-fill

To change the admin email, update both the RLS policy in Supabase and `ADMIN_EMAIL` in `admin-guard.js`.

---

## 🌍 Internationalization

Traqio supports **English** and **Bahasa Indonesia** with live switching (no page reload). All UI strings are defined in `assets/js/i18n.js`. To add a new language:

1. Add a new key block in the `STRINGS` object in `i18n.js`
2. Add the language code to the cycle in `app-shell.js` lang toggle

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

```bash
# 1. Fork the repo and clone your fork
git clone https://github.com/your-username/traqio.git

# 2. Create a feature branch
git checkout -b feature/my-improvement

# 3. Make changes — no build step needed, just edit files
# 4. Test in browser (Demo Mode works without Supabase)

# 5. Open a pull request
```

**Coding conventions:**
- All JS is vanilla ES2020+, wrapped in IIFEs — no bundler required
- HTML strings use `escHtml()` / `escAttr()` for all user-supplied content
- Supabase calls go through `supabase-client.js`, never called directly from page scripts
- CSS follows the design token system defined in `base.css` (`--brand-*`, `--bg-*`, `--text-*`)

---

## 📋 Changelog

### Latest
- Cross-device sync for applications via Supabase
- CV cloud upload via Supabase Storage (`cv-files` bucket)
- Company registry in admin panel with logo auto-fill in application form
- Match score weighted by skill proficiency level + goals alignment
- Activity feed auto-logging for job applications
- New jobs notification badge on nav
- Drag-and-drop kanban now persists to Supabase
- Application detail page shows real job company logos

---

## 📄 License

MIT — free to use, fork, and build upon.

---

<p align="center">
  Built with ❤️ for jobseekers everywhere · <a href="https://traqio.github.io/Traqio/">Live Demo</a>
</p>
