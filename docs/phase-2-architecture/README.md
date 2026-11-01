# Phase 2 – Architecture & Setup

> **Roles speaking: Software Engineer + System Administrator**

| Document | Contents |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Mermaid architecture diagram, components, scan sequence, where each rule lives, monorepo layout, versions |
| [02-engineering-standards.md](02-engineering-standards.md) | Coding standards, branch strategy, testing strategy and coverage targets |
| [03-supabase-setup.md](03-supabase-setup.md) | Local CLI dev, hosted project setup (auth, redirect URLs, deep links, buckets, Vault, secrets), env files |
| [04-operations-and-security.md](04-operations-and-security.md) | Roles × modules access matrix, backup/restore plan, HMAC secret rotation, retention schedule |
| [05-privacy-and-consent.md](05-privacy-and-consent.md) | Consent checkbox text, Data Privacy Notice (English + Filipino), Auth e-mail templates |

## Code delivered in this phase

| Path | What it is |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.editorconfig`, `.gitignore` | Monorepo root configs |
| `packages/design-tokens` | `src/tokens.ts` (single source) → `web.css` (Tailwind v4 / shadcn variables), `tailwind-preset.cjs` (NativeWind), `paperTheme()`, Tamagui tokens/themes; `pnpm --filter @bhw/design-tokens build` regenerates |
| `packages/types` | Enums, zod schemas (registration, scan request/response, attendance record, corrections, report filters, DTR, heartbeat, log-error, device-sync), QR wire format helpers, error catalog generated from the Phase 1 business rules (38 codes, EN + FIL) |
| `supabase/config.toml` | Email confirmation on, redirect URLs incl. `bhwqr://auth/callback`, password ≥ 8, three private buckets |
| `supabase/functions/.env.example` | Edge Function secrets (all server-only) |
| `apps/web` | Next.js 16 + shadcn/ui scaffold, Supabase SSR helpers, theme provider |
| `apps/mobile` | Expo SDK 58 + Expo Router scaffold with NativeWind, RN Reusables, gluestack UI v2, Paper, Tamagui and the documented provider order |
