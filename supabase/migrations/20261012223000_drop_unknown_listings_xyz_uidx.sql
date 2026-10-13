-- Player-approx coords: unknown dedupe is nearest-within-25 in ingest-scan,
-- not exact x,y,z. Drop the unique exact-xyz index so radius replace/insert works.
DROP INDEX IF EXISTS public.unknown_listings_xyz_uidx;
