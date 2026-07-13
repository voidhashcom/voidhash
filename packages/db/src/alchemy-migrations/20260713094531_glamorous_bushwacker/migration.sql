ALTER TABLE "analytics_dashboard_item" RENAME COLUMN "insight_id" TO "source_id";--> statement-breakpoint
DROP INDEX "analytics_dashboard_item_insight_idx";--> statement-breakpoint
ALTER TABLE "analytics_dashboard_item" ADD COLUMN "source_type" varchar(32) DEFAULT 'insight' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_dashboard_item" ALTER COLUMN "source_type" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_dashboard_item_source_idx" ON "analytics_dashboard_item" ("dashboard_id","source_type","source_id");
