# Stalker IPTV Billing — Next.js port

Author: **Emmanuel Aro**

A modern Next.js 16 / React 19 rewrite of the legacy CodeIgniter 3 billing
panel. The CI app remains in `../../26062025/var/www/` as the source of
truth for business rules; this project ports the workflow into a typed,
componentised stack with a neon-glass dark theme tuned for long sessions.

## Architecture at a glance

| Layer        | Tech                                          |
| ------------ | --------------------------------------------- |
| Framework    | Next.js 16 (App Router, server actions, RSC) |
| UI runtime   | React 19, Tailwind v4, Radix primitives, Lucide |
| Server data  | mysql2/promise pools (billing + Stalker)     |
| Client cache | TanStack Query v5                            |
| Client state | Zustand 5 (persisted UI flags only)          |
| Charts       | recharts with custom SVG glow filters        |
| Auth         | HMAC-signed `billing_session` cookie         |
| API obfusc.  | AES-256-GCM payload envelope (per-session key) |

## Getting started (local)

```bash
cp .env.local .env.local.local   # keep your secrets out of git
npm install
npm run dev
```

Open <http://localhost:3000>. Default landing flow: not-logged-in → `/login`,
logged-in → `/admin/dashboard` (or the role-appropriate portal).

### Environment variables (.env.local)

```ini
# Primary billing DB (MySQL)
DATABASE_HOST=51.222.104.198
DATABASE_PORT=3306
DATABASE_USER=php_dev
DATABASE_PASSWORD=Th61O1CaB9bpGZ
DATABASE_NAME=stalker_billing

# Optional Ministra/Stalker DB (events, send-message)
STALKER_DATABASE_HOST=51.222.104.198
STALKER_DATABASE_NAME=stalker_db_tvz1_bk

# 64+ random chars in production — rotates all sessions when changed
BILLING_SESSION_SECRET=

# 32-byte base64; rotates the per-session payload encryption key
PAYLOAD_CIPHER_KEY=

# Set to 1 if your MySQL host requires TLS (Aiven, RDS, PlanetScale)
DATABASE_SSL=
```

## What ships in this build

- **Theme**: neon-glass dark + clean enterprise light. Token names are
  unchanged so the existing 135+ components automatically inherit. New
  utilities: `fx-glass`, `fx-ring-grad`, `fx-rise`, `fx-rise-stagger`,
  `fx-shine`, `fx-pulse-dot`, `fx-text-grad`, plus animation primitives
  for Radix data-state transitions (`fx-overlay-in`, `fx-content-in`).
- **Modal primitive** at `components/ui/dialog.tsx` (Radix-based). Wired
  on the dashboard via the **Quick Actions** launcher next to "Key
  metrics" — opens a modal of common admin shortcuts.
- **Charts**: `components/dashboard/AdminDashboardCharts.tsx` upgraded
  with cyan→violet→magenta neon palette, SVG GaussianBlur glow filter,
  gradient bar fills, and a custom glassmorphic tooltip
  (`NeonTooltip`). Stat footers and inline tables retuned to match.
- **Encrypted API responses**: `secureJson(data, request)` opt-in helper
  encrypts the body with AES-256-GCM if the client sends
  `x-cipher-mode: aes-gcm-v1`. Demo wired to
  `/api/admin/users/[account]/details` (returns password + MAC). Client
  decrypts via `lib/api/secureFetch.ts`. Key handed off at
  `/api/security/key` after login.

  > **Honest caveat**: this is obfuscation, not confidentiality. A
  > determined user with a debugger can extract the key from
  > sessionStorage and decrypt locally. It raises the bar against
  > casual F12 inspection — no more.
- **Perf**: TanStack Query provider in `app/providers.tsx`, Zustand
  store at `lib/store/ui.ts` for sidebar / density / palette state.
  Server data should migrate from inline `fetch` to `useQuery` route by
  route; the user-details endpoint is wired as the first example.
- **Hardening**: `next.config.mjs` disables source maps in prod,
  removes `x-powered-by`, sets HSTS / X-Frame-Options /
  X-Content-Type-Options / Referrer-Policy / Permissions-Policy.

## Coexistence with the CodeIgniter project

Both projects live side by side and share the same MySQL host. The
CI app (`../../26062025/var/www/`) is **untouched** by this work —
it's still the canonical implementation for any rule that hasn't
been ported yet.

```text
Nerdy_imman/
├── 26062025/var/www/          ← legacy CodeIgniter (PHP) app
└── nextjs/nextjs/             ← this project (Next.js 16)
        └── lib/ci-next-parity-map.json  ← per-feature port status
```

To run the CI app locally for parity checks: drop `var/www/` into your
local LAMP/XAMPP, point its `application/config/database.php` at the
same MySQL host (`51.222.104.198`), browse to `http://localhost/var/www/`.

## Free-tier production deployment

The recommended free-tier topology:

```text
        ┌─────────────────────────┐
Browser → Cloudflare (free)       │  TLS, DDoS, caching
        │    ↓                    │
        │ Vercel (free / hobby)   │  Next.js runtime
        │    ↓ outbound           │
        │ MySQL @ 51.222.104.198 │  shared with CI app
        └─────────────────────────┘
```

### Vercel (Next.js)

1. `git push` the `nextjs/` directory to a GitHub repo.
2. Import in Vercel → set Framework = **Next.js**, Root = `nextjs/`.
3. Set the env vars above. **Don't** ship a real
   `BILLING_SESSION_SECRET` or `PAYLOAD_CIPHER_KEY` in git — set them
   in the Vercel dashboard.
4. Deploy. `vercel.json` already pins region `fra1` (closest free
   region to a European MySQL host) and re-applies security headers.

### Cloudflare in front of Vercel

1. Add your domain to Cloudflare → set NS records.
2. CNAME the apex / app subdomain to your Vercel deployment.
3. SSL/TLS mode → **Full (strict)**. Enable "Always use HTTPS".
4. (Optional) Cloudflare Tunnel from the MySQL box to Cloudflare so
   port 3306 is never internet-exposed — Vercel egress connects via
   `cloudflared`. Free tier supports this.

### CI app (PHP) on the same VPS as MySQL

Apache/Nginx + PHP 7.4+ alongside MySQL. No public exposure needed
once the Next.js app handles the front of house — keep the CI app
on a private hostname for ops/admin escape hatch.

## Scripts

```bash
npm run dev         # Turbopack dev at :3000
npm run build       # Production build
npm run start       # Production server (after build)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # Vitest (run-once)
npm run test:watch  # Vitest watch mode
```

## Project layout

```text
app/                    # Routes (admin, manager, reseller, dealer, api)
components/
├── admin/              # Admin-only UI (modals, tables, forms)
├── dashboard/          # KPI cards + charts
├── forms/              # Shared form primitives
├── layout/             # Header, sidebar, mobile nav
├── portal/             # Operator-tier shared UI
└── ui/                 # Buttons, dialog, inputs, selects (the kit)
lib/
├── api/                # respond() / secureFetch()
├── auth/               # password helpers
├── db/                 # mysql2 pool
├── repos/              # Per-table repositories (billing logic)
├── security/           # payloadCipher / sessionKey
├── store/              # Zustand stores
├── ui/                 # Tailwind class utilities
└── *.ts                # Domain helpers (data, session, formatters)
actions/                # Server actions (auth, forms, git)
contexts/               # React Context providers (theme)
proxy.ts                # Auth gate (Next.js 16 middleware)
```

## License

Proprietary. © Emmanuel Aro.
