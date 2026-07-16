ALTER TABLE "paywall_edit_change_set" ADD COLUMN "agent_session_id" varchar(64);
--> statement-breakpoint
CREATE INDEX "paywall_edit_change_set_agent_session_idx" ON "paywall_edit_change_set" USING btree ("agent_session_id");
