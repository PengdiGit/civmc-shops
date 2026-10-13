-- One unknown listing per exact block (x,y,z). Columns are x/y/z (scan body uses block_*).
-- Deduplicate existing same-coord rows, keeping the newest.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY x, y, z
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.unknown_listings
)
DELETE FROM public.unknown_listings u
USING ranked r
WHERE u.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS unknown_listings_xyz_uidx
  ON public.unknown_listings (x, y, z);
