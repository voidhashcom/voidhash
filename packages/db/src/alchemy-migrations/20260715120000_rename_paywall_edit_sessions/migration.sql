ALTER TABLE "paywall_edit_change_set" RENAME TO "paywall_edit_session";
--> statement-breakpoint
ALTER INDEX "paywall_edit_change_set_project_idx" RENAME TO "paywall_edit_session_project_idx";
--> statement-breakpoint
ALTER INDEX "paywall_edit_change_set_paywall_idx" RENAME TO "paywall_edit_session_paywall_idx";
--> statement-breakpoint
ALTER INDEX "paywall_edit_change_set_agent_session_idx" RENAME TO "paywall_edit_session_agent_session_idx";
--> statement-breakpoint
ALTER INDEX "paywall_edit_change_set_active_idx" RENAME TO "paywall_edit_session_active_idx";
--> statement-breakpoint
ALTER TABLE "paywall_edit_session" ADD COLUMN "last_agent_version" integer;
--> statement-breakpoint
UPDATE "paywall_edit_session" SET "last_agent_version" = "baseline_version";
--> statement-breakpoint
ALTER TABLE "paywall_edit_session" ALTER COLUMN "last_agent_version" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "paywall_edit_session" ADD COLUMN "revert_safe" boolean DEFAULT true NOT NULL;
