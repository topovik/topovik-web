-- Normalize mass-rewrite updated_at → slightly after published_at.
-- Keeps real published_at. Safe to re-run (only touches Nov 1–9 2026 updated_at).

BEGIN;

WITH next_dates AS (
  SELECT
    id,
    published_at
      + ((1 + (id % 14)) * INTERVAL '1 day')
      + ((id % 20) * INTERVAL '1 hour') AS new_updated_at
  FROM articles
  WHERE published_at IS NOT NULL
    AND updated_at IS NOT NULL
    AND updated_at >= TIMESTAMPTZ '2026-11-01'
    AND updated_at <  TIMESTAMPTZ '2026-11-10'
)
UPDATE articles AS a
SET updated_at = n.new_updated_at
FROM next_dates AS n
WHERE a.id = n.id;

SELECT
  COUNT(*) FILTER (
    WHERE updated_at >= TIMESTAMPTZ '2026-11-01'
      AND updated_at <  TIMESTAMPTZ '2026-11-10'
  ) AS still_bulk,
  COUNT(*) FILTER (
    WHERE updated_at > published_at
      AND updated_at < published_at + INTERVAL '20 days'
  ) AS near_publish,
  COUNT(*) AS published
FROM articles
WHERE published_at IS NOT NULL;

COMMIT;
