-- Experiments ("A/B tests") are identified by their id alone; the
-- customer-authored key never fed a lookup and blocked name-only creation.
DROP INDEX IF EXISTS "experiment_key_project_id_idx";

ALTER TABLE "experiment" DROP COLUMN IF EXISTS "key";

-- A draft has no primary metric until one is picked on the detail page.
ALTER TABLE "experiment" ALTER COLUMN "primary_metric_event_name" DROP NOT NULL;
