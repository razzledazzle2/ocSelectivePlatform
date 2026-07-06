-- Fix: admin (and every) user is treated as a student because the app cannot
-- read public.profiles.role.
--
-- Live-DB diagnosis (via Supabase MCP, read-only): RLS is ENABLED on
-- public.profiles but there are ZERO policies, so the `authenticated` role is
-- denied every row (default-deny). getCurrentUserProfile()/middleware read null
-- and fall back to user_metadata.role, which is 'student'. The profiles RLS
-- policies were only defined in create_initial_foundation_schema.sql, which was
-- never applied to this project.
--
-- Fix: (re)create the SELECT policy so a user can read their own profile, and
-- admins/super_admins/tutors can read the profiles they need. SELECT-only, so
-- there is no role-escalation risk. get_current_user_role() is SECURITY DEFINER
-- and STABLE, so calling it from this policy does not recurse into RLS.
--
-- NOTE: write policies (INSERT/UPDATE/DELETE) are intentionally NOT added here.
-- `authenticated` currently holds broad grants and there is no
-- enforce_profile_update_scope trigger on this table, so adding an UPDATE policy
-- without those guardrails could allow role self-escalation. Writes stay denied
-- by RLS until the broader schema reconciliation restores the grants + trigger.

drop policy if exists "profiles_select_own_or_privileged" on public.profiles;

create policy "profiles_select_own_or_privileged"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.get_current_user_role() in ('admin', 'super_admin')
  or (
    public.get_current_user_role() = 'tutor'
    and role = 'student'
  )
);
