# EggSight — Chatrapati Egg Farms frontend

The customer-facing web app for **Chatrapati Egg Farms Pvt Ltd (CEFPL)**, live at
[cefpl.in](https://cefpl.in). It pairs a public marketing/forecast site with an
authenticated team portal ("EggSight") for the Solapur layer-farming operation.

## What's here

- **Landing page** — company intro, platform module overview, live NECC price strip.
- **Live Forecast** (`/forecast`) — public Hyderabad egg-price forecast (1/7/14-day)
  with model reasoning, pulled from the EggSight API.
- **Team portal** (`/app`, login required) — market intelligence dashboard,
  raw-material (feed) cost tracking, and a grounded AI Market Analyst.

## Stack

| | |
|---|---|
| Framework | React 19 + React Router 7 |
| Build | Vite |
| Styling | Tailwind CSS 4 (theme tokens in `src/index.css`) |
| Animation | Framer Motion |
| Auth + DB | Supabase (`@supabase/supabase-js`) |
| Forecast API | FastAPI service at `api.cefpl.in` (separate `EggSight` repo) |
| Hosting | Vercel |

## Local development

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5173
```

### Environment variables

All are build-time, browser-exposed (Vite inlines `VITE_*`). Use public keys only.
See [.env.example](.env.example):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (auth + portal data) |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `VITE_EGGSIGHT_API_URL` | Forecast API base URL (e.g. `https://api.cefpl.in`) |

If the Supabase vars are missing the app still boots, but logs a console warning
and auth/portal features won't work.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Architecture

- **Routes** are defined in `src/App.jsx`. Public routes render inside
  `src/components/Layout.jsx`; the portal renders inside
  `src/pages/app/AppShell.jsx` (which redirects to `/` when signed out).
- **Auth** is Supabase email/password, gated by a server-side allowlist
  (`allowed_emails`) enforced by a signup trigger in the database.
- **Data**: the public forecast and portal dashboards fetch from the EggSight
  API; feed-cost entries read/write Supabase directly (RLS-protected).

## Deployment

Hosted on Vercel. `vercel.json` rewrites all routes to `index.html` for SPA
client-side routing. Set the environment variables above in the Vercel project
settings (Production + Preview).
