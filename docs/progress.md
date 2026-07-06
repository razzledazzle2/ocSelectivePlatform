# Progress

## Tooling

### Supabase MCP (connected)

Supabase MCP is now connected for this project and should be used for **live remote
database diagnosis** — inspecting real schema, RLS policies, triggers, functions, and
logs when debugging DB/auth/RLS issues.

- Default to read-only usage: `SELECT`/introspection only, unless writes are explicitly approved.
- Do not apply migrations or run destructive/DDL SQL through MCP.
- Schema changes go through a normal migration file (`supabase migration new <name>`); the
  repo owner reviews and runs `supabase db push`.
- Verify the actual remote schema via MCP before guessing — the remote can drift from the
  migration files (the un-timestamped `create_initial_foundation_schema.sql` is skipped by
  `db push`, so some foundation objects are missing on the remote `public.profiles`).

See the **Supabase MCP** and **Supabase migrations** sections in `CLAUDE.md` for the full rules.
