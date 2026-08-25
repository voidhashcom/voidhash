-- Splits the single server timestamp on analytics_event into two:
-- received_at (capture-endpoint acceptance, carried on the wire) and
-- processed_at (row insert, stamped by its default). processed_at - received_at
-- is the time the event spent in the ingest queue.
--
-- Existing rows predate the split: their processed_at was written with the
-- acceptance time, so it is the correct backfill value.
ALTER TABLE "analytics_event" ADD COLUMN "received_at" timestamp(3) with time zone;

UPDATE "analytics_event" SET "received_at" = "processed_at" WHERE "received_at" IS NULL;

ALTER TABLE "analytics_event" ALTER COLUMN "received_at" SET NOT NULL;
