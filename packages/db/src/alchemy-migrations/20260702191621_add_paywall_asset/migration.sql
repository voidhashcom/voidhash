CREATE TABLE "paywall_asset" (
	"id" varchar(36) PRIMARY KEY,
	"organization_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_asset_key_uidx" ON "paywall_asset" ("key");--> statement-breakpoint
CREATE INDEX "paywall_asset_org_idx" ON "paywall_asset" ("organization_id");--> statement-breakpoint
ALTER TABLE "paywall_asset" ADD CONSTRAINT "paywall_asset_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;