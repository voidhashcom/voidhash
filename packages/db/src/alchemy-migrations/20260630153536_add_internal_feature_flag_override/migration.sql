CREATE TABLE "internal_feature_flag_override" (
	"id" varchar(36) PRIMARY KEY,
	"organization_id" varchar(36) NOT NULL,
	"flag_key" varchar(100) NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "internal_feature_flag_override_org_key_uidx" ON "internal_feature_flag_override" ("organization_id","flag_key");--> statement-breakpoint
CREATE INDEX "internal_feature_flag_override_org_idx" ON "internal_feature_flag_override" ("organization_id");--> statement-breakpoint
ALTER TABLE "internal_feature_flag_override" ADD CONSTRAINT "internal_feature_flag_override_g0qsEev0tRHY_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;