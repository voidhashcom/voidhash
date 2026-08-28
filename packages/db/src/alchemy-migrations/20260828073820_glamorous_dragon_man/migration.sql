DROP INDEX IF EXISTS "capture_project_policy_force_route_idx";--> statement-breakpoint
ALTER TABLE "payment_provider_notification_processed" ADD COLUMN IF NOT EXISTS "provider_occurred_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "payment_provider_notification_processed" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_provider_notification_processed" ADD COLUMN IF NOT EXISTS "last_attempted_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "analytics_ingest_dlq" DROP COLUMN IF EXISTS "route_class";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "force_route";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "custom_topic";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "skip_enrichment";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "processor_person_processing_enabled";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "processor_schema_mode";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "processor_allow_overflow";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "processor_allow_historical";--> statement-breakpoint
ALTER TABLE "capture_project_policy" DROP COLUMN IF EXISTS "processor_historical_min_age_hours";--> statement-breakpoint
DROP INDEX IF EXISTS "provider_key_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "provider_key_idx" ON "purchase" ("payment_provider_configuration_product_id","provider_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_configuration_active_product_key_idx" ON "payment_provider_configuration_product" ("payment_provider_configuration_id","provider_product_key") WHERE "is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_parked_replay_order_idx" ON "payment_provider_notification_processed" ("payment_provider_configuration_id","result","provider_occurred_at","processed_at","id");
