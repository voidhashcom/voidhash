CREATE TABLE "experiment_treatment" (
	"id" varchar(255) PRIMARY KEY,
	"experiment_id" varchar(255) NOT NULL,
	"variant_id" varchar(255) NOT NULL,
	"treatment_type" varchar(50) NOT NULL,
	"config" jsonb NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "experiment_variant" (
	"id" varchar(255) PRIMARY KEY,
	"experiment_id" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"weight_bps" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "experiment" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"feature_flag_id" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"hypothesis" varchar(2000),
	"status" smallint DEFAULT 1 NOT NULL,
	"primary_metric_event_name" varchar(255) NOT NULL,
	"secondary_metric_event_names" jsonb,
	"started_at" timestamp(3) with time zone,
	"ended_at" timestamp(3) with time zone,
	"winning_variant_id" varchar(255),
	"created_by_user_id" varchar(255),
	"updated_by_user_id" varchar(255),
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_flag_override" ADD COLUMN "forced_variant_key" varchar(255);--> statement-breakpoint
CREATE INDEX "experiment_treatment_experiment_id_idx" ON "experiment_treatment" ("experiment_id");--> statement-breakpoint
CREATE INDEX "experiment_treatment_variant_id_idx" ON "experiment_treatment" ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_variant_experiment_key_idx" ON "experiment_variant" ("experiment_id","key");--> statement-breakpoint
CREATE INDEX "experiment_variant_experiment_id_idx" ON "experiment_variant" ("experiment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_key_project_id_idx" ON "experiment" ("key","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_feature_flag_id_idx" ON "experiment" ("feature_flag_id");--> statement-breakpoint
CREATE INDEX "experiment_project_id_idx" ON "experiment" ("project_id");