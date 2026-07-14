# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project Goal

This is an OC and Selective learning platform for Minerva students first, with the option to become an external SaaS later.

The core learning loop is:

Practice → Feedback → Mistake Review → Revision → Progress

Prioritise features that strengthen this loop.
## Commands

```bash
npm run dev      # Next.js dev server
npm run build    # Production build — ALSO the type check + lint gate; run before committing
npm run lint     # ESLint (next lint) only
```

There is no test runner in this repo. "Testing" is manual: run the app and follow the walkthroughs in `README.md` (admin login, CSV upload, practice/attempt tracking). Verification of a change usually means `npm run build` passing plus exercising the affected flow in the browser.

### Supabase migrations

The Supabase CLI is used locally (`supabase` is a dev dependency; a global `supabase` may also exist). Migrations live in `supabase/migrations/`.

- **Never edit a migration that has already been pushed.** Add a new one.
- Generate a new migration with `supabase migration new <name>` and edit only the generated file — do not hand-invent timestamped filenames.
- **Do not run `supabase db push`.** The repo owner reviews and pushes migrations. If DB changes are needed, state the migration name, the command, and the SQL for them to run.
- Reuse existing DB helpers instead of redefining them: `public.set_updated_at()` (updated_at trigger) and `public.get_current_user_role()` (RLS role lookup).

### Supabase MCP

Supabase MCP is connected for this project. Use it to inspect the **live remote database** when debugging DB/auth/RLS issues — verify the actual remote schema before guessing.

- Default to **read-only** MCP usage: only run `SELECT`/introspection queries unless the repo owner explicitly approves writes.
- **Do not** apply migrations through MCP.
- **Do not** run destructive SQL.
- **Do not** insert/update/delete/alter live database objects through MCP unless explicitly approved.
- If schema changes are needed, create a normal migration file with `supabase migration new <descriptive_name>` and edit only that file.
- Do not edit already-pushed migrations.
- Do not run `supabase db push`; the repo owner pushes migrations themselves.
- Use MCP to verify the actual remote schema before guessing — the remote can drift from the migration files (e.g. the un-timestamped `create_initial_foundation_schema.sql` is skipped by `db push`, so foundation objects may be missing on remote).

## Stack

Next.js 15 (App Router, RSC) · React 19 · TypeScript · Supabase (Auth + Postgres with RLS) · Tailwind v4 · shadcn/ui **`base-nova` style built on Base UI** (`@base-ui/react`, not Radix) · lucide-react · sonner. Path alias `@/*` → `src/*`.

Tailwind is v4 (CSS-first config in `src/app/globals.css`, `@tailwindcss/postcss`) — never introduce a v3 `tailwind.config.js` or v3 patterns.

## Architecture

### Auth & role-based routing (the backbone)

Six roles in `profiles.role`: `student`, `parent`, `external_customer` (student portal) and `tutor`, `admin`, `super_admin` (admin portal). Role sets and path rules live in `src/lib/types.ts` (`ADMIN_PORTAL_ROLES`, `STUDENT_PORTAL_ROLES`) and `src/lib/auth/access.ts` (`canAccessPath`, `getRoleRedirectPath`).

Two enforcement layers, both required:
1. **`src/middleware.ts`** calls `updateSession` (refreshes the Supabase session cookie) and redirects anonymous users away from `/student`, `/admin`, `/tutor`. It must live in `src/` — the app router is at `src/app`, so a root-level `middleware.ts` is never registered and silently never runs. It deliberately does **not** query `profiles`: that would add a DB round trip to every request including every `<Link>` prefetch.
2. **Layouts / server actions** call `requireProfile({ allowedRoles })` (`src/lib/auth/require-profile.ts`), which redirects if the role isn't allowed. This is where role/portal enforcement actually lives (`/login` and `/signup` redirect signed-in users themselves). `getCurrentUserProfile()` (`src/lib/auth/get-current-profile.ts`) is React-`cache`d and is the canonical way to read the signed-in user server-side.

**Never call `supabase.auth.getUser()` on a render path.** It sends a request to the Auth server on *every* call and will trip `over_request_rate_limit` (429) once prefetches multiply it. Use `getVerifiedIdentity()` (`src/lib/auth/claims.ts`), which wraps `auth.getClaims()` to verify the JWT locally against the project's cached ES256 JWKS — zero network calls. Reserve `getUser()` for the rare case that genuinely needs a fresh Auth user record.

`/admin` and `/tutor` both require admin-portal roles; the admin shell nav is defined in `src/app/admin/layout.tsx`.

### Supabase clients

- `src/lib/supabase/server.ts` — `createClient()` is **async** (`await createClient()`); used in all server code (queries, mutations, actions). Next 15: also `await cookies()`, `params`, `searchParams`.
- `src/lib/supabase/client.ts` — browser client for client components.
- `src/lib/supabase/middleware.ts` — `updateSession()` used only by root middleware.

**Security is enforced by RLS, not the app.** Every table has RLS policies (see the migrations); the app always uses the anon-key client scoped to the logged-in user. There is no service-role key in app code, and code must not try to bypass RLS. When adding tables, follow the existing policy pattern: owner check (`x = auth.uid()`) OR `public.get_current_user_role() in (...)`.

### Feature module layout

Each feature is split the same way — keep pages thin and push logic into these:

- `src/lib/<feature>/queries.ts` — server reads (`getX`).
- `src/lib/<feature>/mutations.ts` — server writes; also FormData parsing/validation helpers.
- `src/app/<route>/actions.ts` or `src/app/actions/<feature>.ts` — `'use server'` server actions. Standard shape: `requireProfile(...)` → validate → call a mutation → `revalidatePath(...)` → return `ActionResult<T>` (`{ success, message?, data?, fieldErrors? }`, defined in `src/lib/types.ts`). Client components dispatch these inside `useTransition` and surface the result via `toast` from `sonner`.

Feature areas: `questions` (admin bank + student-facing published queries), `practice`, `revision` (spaced repetition), `dashboard`, `mock-exams`, `import` (CSV + paste bulk upload pipeline, entry `src/lib/import/`), `reports` (question reports + quality-control signals).

`src/lib/types.ts` is the single source of truth for shared types and the `as const` arrays that back DB check constraints (`APP_ROLES`, `QUESTION_STATUSES`, `REPORT_TYPES`, etc.) — keep these in sync with the constraints in the migrations.

### Components

- `src/components/ui/*` — shadcn/Base-UI primitives. **Do not create custom Button/Card/Input/Table/Dialog/etc.; reuse these.** Composition uses Base UI's `render` prop (e.g. `<DialogTrigger render={<Button .../>}>`), not `asChild`.
- `src/components/admin/*`, `src/components/student/*` — feature UI. Interactive pieces are `'use client'`; data fetching stays in server pages that pass props down.

### Data model essentials

`subjects → topics → question_types → questions (+ question_options)`. Student activity: `practice_sessions`, `question_attempts` (has `is_correct`, `selected_option_label`, `time_taken_seconds`; practice mode only), `student_mistake_questions` (spaced-repetition fields `next_review_at`, `correct_streak`, `status`). Mock exams use separate `mock_exam_sessions` / `mock_exam_session_questions`. Question lifecycle is `draft → published → archived` (`questions.status`); students only ever read `published`.

### Mandatory frontend completion rule

Whenever creating or modifying a frontend page, always implement and test its loading, empty, error and mutation states as part of the same task.

Use page-specific skeletons for initial data loads, inline descriptive spinners for actions, and preserve existing content during background refetches. Never use blank pages or generic full-page centred spinners for normal navigation.

Do not consider a frontend page complete until loading behaviour, layout stability, duplicate-submission prevention and obvious data-fetching performance issues have been addressed.

## Gotchas

- **Base UI `Select`**: pass an `items` map (`{ value: label }`) to `<Select>` or the trigger renders the raw value instead of the label. See `src/components/admin/question-filters.tsx`.
- Admin nav icons are a fixed union (`NavigationIconName` in `src/lib/types.ts`) mapped in `src/components/layout/app-shell.tsx` — add both when introducing a new nav item.
- `getRelationValue` helpers appear across `queries.ts` files because Supabase embedded relations come back as either an object or a one-element array depending on the query; normalize before use.
- **Middleware cookie rotation**: in `updateSession`, `setAll` must rebuild the response with `NextResponse.next({ request })` *after* mutating `request.cookies`. Skip that and the refreshed token never reaches the Server Components, so every `createClient()` in the render re-refreshes the same expired session — a refresh storm against the Auth API.

## Question Asset / Diagram Generation Rules

Full pipeline: `docs/question-asset-pipeline.md`. The rules that must hold:

- **Deterministic SVG first, never AI image generation for precise maths.** Maths and thinking-skills diagrams (coordinate grids, polygons, bar/line/pie charts, matrices, sequences, Venn diagrams, logic grids) are generated from a structured `asset_spec_json` via `scripts/lib/svg/*.mjs` + `npm run generate:assets`. AI raster generation is only ever acceptable for decorative, non-assessed illustration, and even then a human must verify it. Never let an AI-generated image carry the answer or exact values.
- **CSV references assets; it never stores binary.** Refs use the schemes in `src/lib/assets/refs.ts`: `asset://pending/<name>` (placeholder), `asset://question-assets/<path>` (generated file under `public/question-assets/`, served at `/question-assets/…`), `https://…` (external), or a bucket key. Uploaded photos/scans go in the private `question-media` bucket.
- **Generated SVGs live in `public/question-assets/generated/`** and are produced from specs in `docs/generated-question-bank/asset-specs/*.json`. Regenerate, don't hand-edit SVGs. `docs/generated-question-bank/asset-manifest.csv` is regenerated by the script — do not edit by hand.
- **Status honesty.** `asset_status` may be `generated` **only if the SVG file actually exists**. Unsupported/complex diagram types stay `pending` and must still carry a complete `asset_spec_json`. The DB `assets.status` review states (`generated`/`approved`/`rejected`) come from migration `20260708001849` — do not `supabase db push`; leave migrations for the owner.
- **Import never breaks on a missing asset** — a pending placeholder is stored and a clean card renders. **Publishing is blocked while any required asset is `pending`/`rejected`** (`assertAssetsReadyForPublish` in `src/lib/questions/mutations.ts`); never publish a question that needs a missing diagram.
- **New diagram types**: add a generator in `scripts/lib/svg/`, register it in `render.mjs` (move the type from the pending list to implemented), and keep the CSV `asset_spec_json` as the single source the SVG regenerates from.
