# BHW QR Attendance System

QR-based attendance for the **Barangay Kalawag II Health Workers (BHW) Office**. It replaces manual logbooks (and the originally proposed fingerprint scanner) with:

- **Web portal** (Next.js + shadcn/ui): registration, admin approval, employees, schedules, corrections, CSC Form 48 DTR, reports, device health, audit log, and a full-screen **kiosk** page that shows a rotating signed QR code.
- **Mobile app** (Expo): a BHW binds one phone, scans the kiosk QR to time in/out, sees history, files correction requests, downloads the DTR, and can show a personal QR for fallback.
- **Supabase** backend: Postgres with Row Level Security, Edge Functions for QR signing and scan validation, Realtime dashboard, pg_cron jobs.

Proponent: Janine Ariane Raganas, BSIT-2B. Specification: [development.md](development.md).

## Repository layout

```
apps/web                 Next.js admin portal, registration, kiosk
apps/mobile              Expo employee app
packages/types           zod schemas, enums, error-code catalog (EN/FIL), generated DB types
packages/design-tokens   colors, radius, fonts -> Tailwind v4 (web), NativeWind preset, Paper, Tamagui
supabase                 config.toml, migrations, seed.sql, Edge Functions, pgTAP tests
docs                     phase-by-phase documentation
```

## Quick start (local)

Requirements: Node 20.18+ (24 recommended), pnpm 11, Docker Desktop, Android phone with Expo Go or a development build.

```bash
pnpm install
pnpm --filter @bhw/design-tokens build     # regenerate token CSS/preset (already committed)
pnpm db:start                              # local Supabase (Docker)
pnpm db:reset                              # migrations + seed data
pnpm seed:photos                           # illustrated profile photos for the demo BHWs (dev only)
cp apps/web/.env.example apps/web/.env.local          # fill keys printed by db:start
cp apps/mobile/.env.example apps/mobile/.env          # use your PC's LAN IP for a real phone
cp supabase/functions/.env.example supabase/functions/.env   # generate secrets
pnpm functions:serve                       # Edge Functions
pnpm dev:web                               # http://localhost:3000
pnpm dev:mobile                            # Expo dev server, scan the QR with Expo Go
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:test`.

## Documentation

| Phase                    | Folder                                                                 | Contents                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1 – System Analysis      | [docs/phase-1-system-analysis](docs/phase-1-system-analysis/README.md) | Decisions, scope, 151 FRs, 73 NFRs, 63 use cases, 98 business rules, flowcharts, DFD, ERD, data dictionary, risks |
| 2 – Architecture & Setup | [docs/phase-2-architecture](docs/phase-2-architecture/README.md)       | Architecture, standards, Supabase setup, access matrix, backups, secret rotation, privacy notice                  |
| 3 – Backend              | `supabase/` + docs/phase-3-backend                                     | Migrations, RLS, RPCs, Edge Functions, cron, seed, tests                                                          |
| 4 – Web                  | `apps/web` + docs/phase-4-web                                          | Screens, kiosk, DTR, Playwright                                                                                   |
| 5 – Mobile               | `apps/mobile` + docs/phase-5-mobile                                    | Screens, scan flow, EAS                                                                                           |
| 6 – Testing & Deployment | docs/phase-6-deployment                                                | Test cases, UAT, deployment, manuals                                                                              |

## Mobile UI library strategy

Each library has one job so they never overlap (details in [apps/mobile/README.md](apps/mobile/README.md)).

| Library                    | Role                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **NativeWind**             | Styling foundation: all layout, spacing, color, typography via Tailwind classes, sharing tokens with web                          |
| **React Native Reusables** | Primary components (shadcn port): Button, Card, Input, Label, Avatar, Badge, Tabs, Dialog, Separator, Progress, Text              |
| **gluestack UI v2**        | Toast, Actionsheet, FormControl with validation messages, Spinner, Skeleton                                                       |
| **React Native Paper**     | FAB (Scan button), Snackbar (offline notice), SegmentedButtons (history filter) only; PaperProvider theme mapped to shared tokens |
| **Tamagui**                | Animated scan result overlay and attendance detail bottom sheet only; Tamagui config mapped to shared tokens                      |

## Deployment

Production runs on a **new Supabase project in ap-southeast-1 (Singapore)**, the web portal on **Vercel** (region `sin1`), and the Android app through **EAS Build / EAS Update** and Google Play internal testing. `supabase/seed.sql` is demo data only and is never run in production; the production database is initialised with [`scripts/bootstrap-production.sql`](scripts/bootstrap-production.sql).

| Step | Document |
| --- | --- |
| Overview of Phase 6 | [docs/phase-6-deployment/README.md](docs/phase-6-deployment/README.md) |
| Backend: migrations, Vault and Edge Function secrets, functions, cron, RLS checks, Auth/SMTP | [03-deployment.md §1](docs/phase-6-deployment/03-deployment.md#1-backend-developer--supabase-production) |
| Web on Vercel, kiosk tablet, Android APK/AAB, OTA updates, distribution | [03-deployment.md §2](docs/phase-6-deployment/03-deployment.md#2-frontend-developer--web-kiosk-and-android-app) |
| CI pipeline ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) | [03-deployment.md §3](docs/phase-6-deployment/03-deployment.md#3-software-engineer--ci-pipeline) |
| Go-live checklist, first admin, station coordinates, monitoring, backups, incidents, secret rotation, offboarding, data subject requests | [04-operations.md](docs/phase-6-deployment/04-operations.md) |
| Kiosk tablet setup | [06-kiosk-setup-guide.md](docs/phase-6-deployment/06-kiosk-setup-guide.md) |
| Test cases and UAT, admin manual, BHW quick guide | [01](docs/phase-6-deployment/01-test-cases-and-uat.md), [05](docs/phase-6-deployment/05-admin-manual.md), [07](docs/phase-6-deployment/07-bhw-quick-guide.md) |
