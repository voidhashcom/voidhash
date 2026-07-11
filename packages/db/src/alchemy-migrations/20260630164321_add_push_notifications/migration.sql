CREATE TABLE "push_device_token" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"platform" varchar(20) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"platform_token" varchar(1024) NOT NULL,
	"bundle_id" varchar(255),
	"environment" varchar(20),
	"invalidated_at" timestamp(3) with time zone,
	"invalidation_reason" varchar(100),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "push_notification_config" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"push_provider_key" varchar(255) DEFAULT 'empty' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"name" varchar(255) DEFAULT 'Unknown' NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone,
	"active_provider_id" varchar(50) GENERATED ALWAYS AS ((case when deleted_at is null then provider_id else null end)) STORED
);
--> statement-breakpoint
CREATE TABLE "push_notification_delivery" (
	"id" varchar(255) PRIMARY KEY,
	"push_notification_send_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"push_device_token_id" varchar(255) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp(3) with time zone,
	"provider_message_id" varchar(255),
	"last_error" varchar(500),
	"completed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_notification_delivery_attempt" (
	"id" varchar(255) PRIMARY KEY,
	"push_notification_delivery_id" varchar(255) NOT NULL,
	"attempt_number" integer NOT NULL,
	"status_code" integer,
	"provider_error_code" varchar(100),
	"response_body" varchar(2048),
	"error_message" varchar(500),
	"duration_ms" integer,
	"succeeded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_notification_send" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"idempotency_key" varchar(255),
	"message" jsonb NOT NULL,
	"requested_person_ids" jsonb DEFAULT '[]' NOT NULL,
	"requested_distinct_ids" jsonb DEFAULT '[]' NOT NULL,
	"unresolved_distinct_ids" jsonb DEFAULT '[]' NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"device_count" integer DEFAULT 0 NOT NULL,
	"succeeded_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"message_purged_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "push_person_device_token" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"push_device_token_id" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "push_device_token_dedup_uidx" ON "push_device_token" ("project_id","provider","platform_token",coalesce("environment", ''));--> statement-breakpoint
CREATE INDEX "push_device_token_project_invalidated_idx" ON "push_device_token" ("project_id","invalidated_at");--> statement-breakpoint
CREATE INDEX "push_notification_config_project_id_idx" ON "push_notification_config" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_notification_config_project_active_provider_uidx" ON "push_notification_config" ("project_id","active_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_notification_delivery_send_device_uidx" ON "push_notification_delivery" ("push_notification_send_id","push_device_token_id");--> statement-breakpoint
CREATE INDEX "push_notification_delivery_send_status_idx" ON "push_notification_delivery" ("push_notification_send_id","status");--> statement-breakpoint
CREATE INDEX "push_notification_delivery_next_attempt_idx" ON "push_notification_delivery" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "push_notification_delivery_attempt_delivery_idx" ON "push_notification_delivery_attempt" ("push_notification_delivery_id");--> statement-breakpoint
CREATE INDEX "push_notification_send_project_created_idx" ON "push_notification_send" ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_notification_send_idempotency_uidx" ON "push_notification_send" ("project_id","idempotency_key") WHERE "idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "push_person_device_token_uidx" ON "push_person_device_token" ("person_id","push_device_token_id");--> statement-breakpoint
CREATE INDEX "push_person_device_token_person_idx" ON "push_person_device_token" ("person_id","deleted_at");--> statement-breakpoint
CREATE INDEX "push_person_device_token_token_idx" ON "push_person_device_token" ("push_device_token_id","deleted_at");