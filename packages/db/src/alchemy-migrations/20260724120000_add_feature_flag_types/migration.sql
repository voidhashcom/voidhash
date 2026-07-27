ALTER TABLE "feature_flag" ADD COLUMN "type" varchar(20) DEFAULT 'boolean' NOT NULL;

UPDATE "feature_flag_variant" AS "variant"
SET "payload" = to_jsonb("variant"."key")
FROM "feature_flag" AS "flag"
WHERE
  "variant"."feature_flag_id" = "flag"."id"
  AND "variant"."archived_at" IS NULL
  AND "flag"."internal" = false
  AND EXISTS (
    SELECT 1
    FROM "feature_flag_variant" AS "active_variant"
    WHERE
      "active_variant"."feature_flag_id" = "flag"."id"
      AND "active_variant"."archived_at" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "feature_flag_variant" AS "active_variant"
    WHERE
      "active_variant"."feature_flag_id" = "flag"."id"
      AND "active_variant"."archived_at" IS NULL
      AND "active_variant"."payload" IS NOT NULL
  );

UPDATE "feature_flag" AS "flag"
SET "type" = CASE
  WHEN NOT EXISTS (
    SELECT 1
    FROM "feature_flag_variant" AS "variant"
    WHERE
      "variant"."feature_flag_id" = "flag"."id"
      AND "variant"."archived_at" IS NULL
  ) THEN 'boolean'
  WHEN NOT EXISTS (
    SELECT 1
    FROM "feature_flag_variant" AS "variant"
    WHERE
      "variant"."feature_flag_id" = "flag"."id"
      AND "variant"."archived_at" IS NULL
      AND jsonb_typeof("variant"."payload") IS DISTINCT FROM 'string'
  ) THEN 'string'
  WHEN NOT EXISTS (
    SELECT 1
    FROM "feature_flag_variant" AS "variant"
    WHERE
      "variant"."feature_flag_id" = "flag"."id"
      AND "variant"."archived_at" IS NULL
      AND jsonb_typeof("variant"."payload") IS DISTINCT FROM 'number'
  ) THEN 'number'
  ELSE 'json'
END;
