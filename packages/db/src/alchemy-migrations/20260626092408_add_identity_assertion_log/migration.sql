CREATE TABLE "identity_assertion" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"distinct_id_a" varchar(255) NOT NULL,
	"distinct_id_b" varchar(255) NOT NULL,
	"event_ts" timestamp(3) with time zone NOT NULL,
	"source" smallint DEFAULT 5 NOT NULL,
	"dedup_key" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "traits_meta" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_assertion_project_dedup_uidx" ON "identity_assertion" ("project_id","dedup_key");--> statement-breakpoint
CREATE INDEX "identity_assertion_project_a_idx" ON "identity_assertion" ("project_id","distinct_id_a");--> statement-breakpoint
CREATE INDEX "identity_assertion_project_b_idx" ON "identity_assertion" ("project_id","distinct_id_b");--> statement-breakpoint
ALTER TABLE "identity_assertion" ADD CONSTRAINT "identity_assertion_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;