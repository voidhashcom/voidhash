CREATE TABLE "voidhash_feedback" (
	"id" varchar(255) PRIMARY KEY,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"topic" varchar(32) NOT NULL,
	"sentiment" smallint,
	"message" text NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"user_id" varchar(255),
	"user_email" varchar(255),
	"user_name" varchar(255),
	"organization_id" varchar(255),
	"organization_slug" varchar(255),
	"organization_name" varchar(255),
	"project_id" varchar(255),
	"project_slug" varchar(255),
	"project_name" varchar(255),
	"pathname" varchar(1024),
	"user_agent" varchar(512),
	"read_at" timestamp(3) with time zone,
	"archived_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "voidhash_feedback_status_created_idx" ON "voidhash_feedback" ("status","created_at");--> statement-breakpoint
CREATE INDEX "voidhash_feedback_created_idx" ON "voidhash_feedback" ("created_at");--> statement-breakpoint
CREATE INDEX "voidhash_feedback_organization_idx" ON "voidhash_feedback" ("organization_id");