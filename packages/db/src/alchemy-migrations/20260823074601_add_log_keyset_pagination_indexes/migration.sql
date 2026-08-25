-- Keyset-pagination indexes for the log-shaped collections.
--
-- Hand-written: the drizzle snapshot ledger trails the hand-written
-- migrations, so `db:generate` cannot emit a safe diff. This file adds ONLY
-- the indexes the new keyset reads walk (schema.ts is the source of truth).

-- analytics_event: arrival-order (sequence) keyset walks, unfiltered and
-- filtered by event name.
CREATE INDEX "analytics_event_project_sequence_idx"
  ON "analytics_event" USING btree ("project_id", "sequence");
CREATE INDEX "analytics_event_project_name_sequence_idx"
  ON "analytics_event" USING btree ("project_id", "event_name", "sequence");

-- webhook_delivery: (coalesce(created_at, epoch), id) desc walks. The
-- expression matches the read's ORDER BY exactly because created_at is
-- nullable there.
CREATE INDEX "webhook_delivery_project_created_idx"
  ON "webhook_delivery" USING btree ("project_id", (coalesce("created_at", 'epoch'::timestamptz)), "id");
CREATE INDEX "webhook_delivery_endpoint_created_idx"
  ON "webhook_delivery" USING btree ("webhook_endpoint_id", (coalesce("created_at", 'epoch'::timestamptz)), "id");

-- push_notification_send: extend the send-history index with id so the
-- (created_at, id) keyset sort is fully index-ordered.
DROP INDEX "push_notification_send_project_created_idx";
CREATE INDEX "push_notification_send_project_created_idx"
  ON "push_notification_send" USING btree ("project_id", "created_at", "id");

-- push_notification_delivery: (created_at, id) asc walk within one send.
CREATE INDEX "push_notification_delivery_send_created_idx"
  ON "push_notification_delivery" USING btree ("push_notification_send_id", "created_at", "id");
