CREATE TABLE "analytics_dashboard_item" (
	"id" varchar(255) PRIMARY KEY,
	"dashboard_id" varchar(255) NOT NULL,
	"insight_id" varchar(255) NOT NULL,
	"position" integer NOT NULL,
	"layout" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_dashboard" (
	"id" varchar(255) PRIMARY KEY,
	"organization_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "analytics_insight" (
	"id" varchar(255) PRIMARY KEY,
	"organization_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"kind" varchar(32) NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_dashboard_item_insight_idx" ON "analytics_dashboard_item" ("dashboard_id","insight_id");--> statement-breakpoint
CREATE INDEX "analytics_dashboard_item_position_idx" ON "analytics_dashboard_item" ("dashboard_id","position");--> statement-breakpoint
CREATE INDEX "analytics_dashboard_project_idx" ON "analytics_dashboard" ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "analytics_dashboard_organization_idx" ON "analytics_dashboard" ("organization_id");--> statement-breakpoint
CREATE INDEX "analytics_insight_project_idx" ON "analytics_insight" ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "analytics_insight_organization_idx" ON "analytics_insight" ("organization_id");
