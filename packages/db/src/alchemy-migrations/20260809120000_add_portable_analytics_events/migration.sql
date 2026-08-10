CREATE TABLE "analytics_event" (
  "sequence" bigserial PRIMARY KEY NOT NULL,
  "schema_version" smallint DEFAULT 1 NOT NULL,
  "event_id" varchar(255) NOT NULL,
  "capture_id" varchar(255) NOT NULL,
  "event_name" varchar(255) NOT NULL,
  "event_timestamp" timestamp(3) with time zone NOT NULL,
  "processed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "organization_id" varchar(255) NOT NULL,
  "project_id" varchar(255) NOT NULL,
  "distinct_id" varchar(512) NOT NULL,
  "previous_distinct_id" varchar(512),
  "person_id" varchar(255),
  "identity_mode" varchar(32) NOT NULL,
  "properties" jsonb NOT NULL,
  "context" jsonb NOT NULL,
  "session_id" varchar(255),
  "token" varchar(255) NOT NULL,
  "request_id" varchar(255) NOT NULL,
  "request_path" varchar(255),
  "source" varchar(32) NOT NULL,
  "source_topic" varchar(255) NOT NULL,
  CONSTRAINT "analytics_event_project_id_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project"("id")
    ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "analytics_event_project_event_uidx"
  ON "analytics_event" USING btree ("project_id", "event_id");
CREATE INDEX "analytics_event_project_time_idx"
  ON "analytics_event" USING btree ("project_id", "event_timestamp");
CREATE INDEX "analytics_event_org_time_idx"
  ON "analytics_event" USING btree ("organization_id", "event_timestamp");
CREATE INDEX "analytics_event_project_name_time_idx"
  ON "analytics_event" USING btree ("project_id", "event_name", "event_timestamp");
CREATE INDEX "analytics_event_export_cursor_idx"
  ON "analytics_event" USING btree ("sequence");
