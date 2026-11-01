# 02 – Coding Standards, Branch Strategy, Testing Strategy

> **Role speaking: Software Engineer**

## 1. Coding standards

| Area | Standard |
| --- | --- |
| Language | TypeScript `strict` + `noUncheckedIndexedAccess` everywhere (`tsconfig.base.json`). No `any`; use `unknown` and narrow with zod. |
| Validation | Every request body (Server Action, Edge Function, RPC wrapper) is parsed with the shared zod schema from `@bhw/types`. The same schema powers the form (react-hook-form + `zodResolver`). |
| Errors | Return `{ ok: false, code, message, params }` using codes from the catalog (`docs/phase-1-system-analysis/05-business-rules.md` §15). UI shows `errorMessage(code, lang, params)`. Never show stack traces or raw Postgres errors. |
| Time | All attendance logic uses `Asia/Manila` and **server time**. Client code formats only; never computes status. Use `date-fns` + `@date-fns/tz` on clients, `AT TIME ZONE 'Asia/Manila'` in SQL. |
| SQL | snake_case; one migration per concern, timestamped; `SECURITY DEFINER` functions set `search_path = ''` and fully qualify names; every table has RLS enabled and at least one policy; comments on every table and policy. |
| Naming | React components PascalCase files in web (`components/status-badge.tsx` kebab-case files, PascalCase exports — shadcn convention); hooks `useX`; Server Actions `verbNounAction`; Edge Functions kebab-case folders. |
| Styling | Tailwind classes only, using token names (`bg-brand`, `text-muted-foreground`, `bg-status-late`). No hex colors in components. Mobile follows the one-library-per-component-type table. |
| Accessibility | Labels on every input, visible focus rings, keyboard navigation, `aria-live` for scan results and toasts, contrast ≥ 4.5:1, touch targets ≥ 44 px, `prefers-reduced-motion` respected. |
| Secrets | Only in Edge Function env / Vercel server env. `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` are public by definition. Lint rule: `lib/supabase/admin.ts` imports `server-only`. |
| Comments | Explain *why* and reference rule IDs (`BR-xx`, `D-xx`, `FR-xx`). No commented-out code, no TODOs in `main`. |
| Formatting | Prettier (100 cols, double quotes, trailing commas) + `prettier-plugin-tailwindcss` for class order. |

## 2. Branch strategy (trunk-based, small team)

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Always deployable; production deploys from tags | Protected: PR + 1 review + green CI. No direct pushes. |
| `feat/<area>-<short>` | Feature work, e.g. `feat/mobile-scan-overlay` | Rebased on `main`, squash-merged. |
| `fix/<short>` | Bug fixes | Same as features. |
| `hotfix/<short>` | Urgent production fix from the latest tag | Merged to `main`, tagged `vX.Y.Z+1`. |
| Tags `vX.Y.Z` | Releases | Trigger Supabase migration deploy, Vercel production promote, EAS build/update. |

Commit messages follow Conventional Commits (`feat(web): ...`, `fix(db): ...`). Database migrations are never edited after merge; add a new migration instead.

## 3. Testing strategy

| Layer | Tool | What is tested | Target |
| --- | --- | --- | --- |
| Shared packages | `node --test` | zod schemas, error message filling, QR parsing, tokens | 90 % lines |
| Database | pgTAP (`supabase test db`) | RLS per role and table, `compute_attendance_status`, `record_scan` (time-in/out, overnight, cooldown), `dtr_month` totals, correction approval transaction, end-of-day job | Every policy and every BR with a formula |
| Edge Functions | `deno test` | Every `record-attendance` failure code (17), HMAC sign/verify/rotation, rate limiter, geofence math | 100 % of error branches |
| Web unit | Vitest + Testing Library | route rules, formatters, components with logic (status badge, DTR table) | 70 % lines |
| Web E2E | Playwright | register → approve → login; kiosk QR refresh; report generation; DTR print | Critical paths |
| Mobile | Jest (`jest-expo`) + React Native Testing Library | scan result handling, health check logic, error-code map EN/FIL | 70 % lines of `lib/` and scan screens |
| Manual / UAT | Phase 6 test case table + UAT form | Acceptance criteria AC-01..AC-12 on real phones and the kiosk tablet | All pass |

CI (GitHub Actions, Phase 6): `pnpm install --frozen-lockfile` → `turbo run lint typecheck test` → `supabase start` + `supabase test db` → `deno test supabase/functions` → `pnpm --filter @bhw/web build` → Playwright against `next start`.
