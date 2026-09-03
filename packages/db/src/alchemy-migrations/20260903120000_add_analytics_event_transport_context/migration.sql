ALTER TABLE "analytics_event" ADD COLUMN "sent_at" timestamp (3) with time zone;
--> statement-breakpoint
ALTER TABLE "analytics_event" ADD COLUMN "trust_class" varchar(32) DEFAULT 'untrusted-sdk' NOT NULL;
