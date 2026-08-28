DROP INDEX IF EXISTS "provider_key_idx";

CREATE UNIQUE INDEX "provider_key_idx"
ON "purchase" ("payment_provider_configuration_product_id", "provider_key");
