ALTER TABLE "payment_provider_notification_processed"
ADD COLUMN "provider_occurred_at" timestamptz(3),
ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL,
ADD COLUMN "last_attempted_at" timestamptz(3);

UPDATE "payment_provider_notification_processed"
SET "provider_occurred_at" = "processed_at"
WHERE "provider_occurred_at" IS NULL;

WITH "ranked_active_mappings" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "payment_provider_configuration_id", "provider_product_key"
      ORDER BY "updated_at" DESC NULLS LAST, "created_at" DESC NULLS LAST, "id" DESC
    ) AS "position"
  FROM "payment_provider_configuration_product"
  WHERE "is_active" = true
)
UPDATE "payment_provider_configuration_product" AS "mapping"
SET "is_active" = false
FROM "ranked_active_mappings" AS "ranked"
WHERE "mapping"."id" = "ranked"."id"
  AND "ranked"."position" > 1;

CREATE UNIQUE INDEX "provider_configuration_active_product_key_idx"
ON "payment_provider_configuration_product" ("payment_provider_configuration_id", "provider_product_key")
WHERE "is_active" = true;

CREATE INDEX "notif_parked_replay_order_idx"
ON "payment_provider_notification_processed" (
  "payment_provider_configuration_id",
  "result",
  "provider_occurred_at",
  "processed_at",
  "id"
);

UPDATE "purchase_ledger" AS "ledger"
SET "events_payload" = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN "mapping"."id" IS NOT NULL AND "product"."id" IS NOT NULL THEN
          jsonb_set(
            jsonb_set(
              "entry"."event",
              '{properties,productId}',
              to_jsonb("product"."id"::text),
              true
            ),
            '{properties,providerProductKey}',
            to_jsonb("mapping"."provider_product_key"::text),
            true
          )
        ELSE "entry"."event"
      END
      ORDER BY "entry"."ordinality"
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements("ledger"."events_payload") WITH ORDINALITY
    AS "entry"("event", "ordinality")
  LEFT JOIN "payment_provider_configuration_product" AS "mapping"
    ON "mapping"."id" =
      "entry"."event" #>> '{properties,paymentProviderConfigurationProductId}'
  LEFT JOIN "product"
    ON "product"."id" = "mapping"."product_id"
)
WHERE jsonb_typeof("ledger"."events_payload") = 'array';
