CREATE TABLE "paywall_edit_change_set" (
	"id" varchar(64) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"paywall_id" varchar(255) NOT NULL,
	"paywall_slug" varchar(255) NOT NULL,
	"baseline_tree" jsonb NOT NULL,
	"baseline_version" integer NOT NULL,
	"status" varchar(16) NOT NULL,
	"last_preview_signature" varchar(80),
	"last_preview_version" integer,
	"review_verdict" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "paywall_edit_change_set_project_idx" ON "paywall_edit_change_set" ("project_id");--> statement-breakpoint
CREATE INDEX "paywall_edit_change_set_paywall_idx" ON "paywall_edit_change_set" ("paywall_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_edit_change_set_active_idx" ON "paywall_edit_change_set" ("project_id","paywall_id") WHERE "status" = 'active';