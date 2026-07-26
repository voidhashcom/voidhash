-- Variant keys were never customer-facing; the backing flag's variant rows
-- are keyed by the experiment variant's id instead.
DROP INDEX IF EXISTS "experiment_variant_experiment_key_idx";

ALTER TABLE "experiment_variant" DROP COLUMN IF EXISTS "key";
