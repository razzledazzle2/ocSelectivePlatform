-- Asset review workflow: richer statuses + a structured spec column.
--
-- The deterministic diagram pipeline (see docs/question-asset-pipeline.md)
-- produces SVGs from structured specs. This migration lets an asset row:
--   1. carry the spec it was generated from (so it can be regenerated), and
--   2. move through a review lifecycle beyond the original pending/uploaded/
--      archived: 'generated' (produced, awaiting review), 'approved' (cleared
--      for publishing) and 'rejected' (sent back, must not publish).
--
-- Backwards compatible: existing rows keep their current status; the app only
-- writes 'generated' for asset://question-assets/... refs and 'approved'/
-- 'rejected' from the (future) admin review action.

-- 1. Structured spec the SVG can be regenerated from (coordinate_grid, bar_chart, …).
alter table public.assets
  add column if not exists spec jsonb;

-- 2. Widen the status check constraint to the full review lifecycle.
alter table public.assets
  drop constraint if exists assets_status_check;
alter table public.assets
  add constraint assets_status_check
  check (status in ('pending', 'generated', 'uploaded', 'approved', 'rejected', 'archived'));

-- Optional: quickly find assets awaiting review or blocking publishing.
create index if not exists idx_assets_status_review
  on public.assets(status)
  where status in ('pending', 'generated', 'rejected');
