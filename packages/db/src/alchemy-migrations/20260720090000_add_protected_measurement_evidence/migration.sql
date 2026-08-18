CREATE TABLE IF NOT EXISTS "protected_measurement_evidence" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "blob_id" varchar(255) NOT NULL,
  "project_id" varchar(255) NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "installation_id" varchar(255) NOT NULL,
  "purpose" varchar(64) NOT NULL,
  "consent_revision" bigint NOT NULL,
  "retention_class" varchar(32) NOT NULL,
  "encryption_key_version" integer NOT NULL,
  "deletion_state" varchar(32) NOT NULL,
  "ciphertext" bytea,
  "created_at" timestamptz(3) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(3) DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "protected_measurement_evidence_project_blob_uidx"
  ON "protected_measurement_evidence" ("project_id", "blob_id");
CREATE INDEX IF NOT EXISTS "protected_measurement_evidence_project_purpose_idx"
  ON "protected_measurement_evidence" ("project_id", "purpose");
CREATE INDEX IF NOT EXISTS "protected_measurement_evidence_project_installation_idx"
  ON "protected_measurement_evidence" ("project_id", "installation_id");

CREATE TABLE IF NOT EXISTS "measurement_deletion_request" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "request_id" varchar(255) NOT NULL,
  "project_id" varchar(255) NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "installation_id" varchar(255) NOT NULL,
  "person_id" varchar(255),
  "requested_at" timestamptz(3) NOT NULL,
  "completed_at" timestamptz(3) NOT NULL,
  "deleted_protected_evidence" integer NOT NULL,
  "status" varchar(32) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "measurement_deletion_request_project_request_uidx"
  ON "measurement_deletion_request" ("project_id", "request_id");
CREATE INDEX IF NOT EXISTS "measurement_deletion_request_project_installation_idx"
  ON "measurement_deletion_request" ("project_id", "installation_id");
