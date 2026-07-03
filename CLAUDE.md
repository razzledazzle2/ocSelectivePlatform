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

## Stack

Next.js 15 (App Router, RSC) · React 19 · TypeScript · Supabase (Auth + Postgres with RLS) · Tailwind v4 · shadcn/ui **`base-nova` style built on Base UI** (`@base-ui/react`, not Radix) · lucide-react · sonner. Path alias `@/*` → `src/*`.

Tailwind is v4 (CSS-first config in `src/app/globals.css`, `@tailwindcss/postcss`) — never introduce a v3 `tailwind.config.js` or v3 patterns.

## Architecture

### Auth & role-based routing (the backbone)

Six roles in `profiles.role`: `student`, `parent`, `external_customer` (student portal) and `tutor`, `admin`, `super_admin` (admin portal). Role sets and path rules live in `src/lib/types.ts` (`ADMIN_PORTAL_ROLES`, `STUDENT_PORTAL_ROLES`) and `src/lib/auth/access.ts` (`canAccessPath`, `getRoleRedirectPath`).

Two enforcement layers, both required:
1. **`middleware.ts`** (root) calls `updateSession` (refreshes the Supabase session cookie) and redirects based on role for `/student`, `/admin`, `/tutor` prefixes.
2. **Layouts / server actions** call `requireProfile({ allowedRoles })` (`src/lib/auth/require-profile.ts`), which redirects if the role isn't allowed. `getCurrentUserProfile()` (`src/lib/auth/get-current-profile.ts`) is React-`cache`d and is the canonical way to read the signed-in user server-side.

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

## Gotchas

- **Base UI `Select`**: pass an `items` map (`{ value: label }`) to `<Select>` or the trigger renders the raw value instead of the label. See `src/components/admin/question-filters.tsx`.
- Admin nav icons are a fixed union (`NavigationIconName` in `src/lib/types.ts`) mapped in `src/components/layout/app-shell.tsx` — add both when introducing a new nav item.
- `getRelationValue` helpers appear across `queries.ts` files because Supabase embedded relations come back as either an object or a one-element array depending on the query; normalize before use.
