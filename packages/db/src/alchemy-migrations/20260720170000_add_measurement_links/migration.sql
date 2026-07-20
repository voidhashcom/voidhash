CREATE TABLE IF NOT EXISTS "measurement_link" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "project_id" varchar(255) NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "idempotency_key" varchar(255),
  "definition" jsonb NOT NULL,
  "signed_token" text NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "measurement_link_project_idempotency_uidx"
  ON "measurement_link" ("project_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "measurement_link_project_created_idx"
  ON "measurement_link" ("project_id", "created_at");

CREATE TABLE IF NOT EXISTS "measurement_link_click" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "project_id" varchar(255) NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "link_id" varchar(255) NOT NULL,
  "context" jsonb NOT NULL,
  "deferred_token_hash" varchar(64) NOT NULL,
  "deferred_expires_at" timestamptz(3) NOT NULL,
  "installation_id" varchar(255),
  "consumed_at" timestamptz(3),
  "occurred_at" timestamptz(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "measurement_link_click_deferred_hash_uidx"
  ON "measurement_link_click" ("deferred_token_hash");
CREATE INDEX IF NOT EXISTS "measurement_link_click_project_link_idx"
  ON "measurement_link_click" ("project_id", "link_id");
