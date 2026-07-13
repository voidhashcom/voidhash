CREATE TABLE "analytics_cohort_member" (
	"id" varchar(255) PRIMARY KEY,
	"cohort_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_cohort" (
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
CREATE UNIQUE INDEX "analytics_cohort_member_person_idx" ON "analytics_cohort_member" ("cohort_id","person_id");--> statement-breakpoint
CREATE INDEX "analytics_cohort_member_cohort_idx" ON "analytics_cohort_member" ("cohort_id");--> statement-breakpoint
CREATE INDEX "analytics_cohort_project_idx" ON "analytics_cohort" ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "analytics_cohort_organization_idx" ON "analytics_cohort" ("organization_id");