ALTER TABLE "project"
ADD COLUMN "development_purchases_enabled" boolean DEFAULT true NOT NULL;

ALTER TABLE "product"
ADD COLUMN "duration" smallint;

ALTER TABLE "person_unlocked_perk"
ADD COLUMN "environment" smallint DEFAULT 1 NOT NULL;

UPDATE "person_unlocked_perk" AS "grant"
SET "environment" = COALESCE(
  (
    SELECT "subscription"."provider_environment"
    FROM "subscription"
    WHERE "subscription"."id" = "grant"."unlocked_by_subscription_id"
  ),
  (
    SELECT "purchase"."provider_environment"
    FROM "purchase"
    WHERE "purchase"."id" = "grant"."unlocked_by_purchase_id"
  ),
  1
);

DROP INDEX IF EXISTS "person_id_perk_id_idx";

CREATE UNIQUE INDEX "person_id_perk_id_environment_idx"
ON "person_unlocked_perk" ("person_id", "perk_id", "environment");
