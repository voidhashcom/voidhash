ALTER TABLE "capture_project_policy"
  DROP COLUMN "force_route",
  DROP COLUMN "custom_topic",
  DROP COLUMN "skip_enrichment",
  DROP COLUMN "processor_person_processing_enabled",
  DROP COLUMN "processor_schema_mode",
  DROP COLUMN "processor_allow_overflow",
  DROP COLUMN "processor_allow_historical",
  DROP COLUMN "processor_historical_min_age_hours";

ALTER TABLE "analytics_ingest_dlq"
  DROP COLUMN "route_class";
