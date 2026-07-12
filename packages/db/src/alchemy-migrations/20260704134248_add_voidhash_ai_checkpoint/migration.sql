CREATE TABLE "voidhash_ai_checkpoint" (
	"id" varchar(64) PRIMARY KEY,
	"chat_id" varchar(64) NOT NULL,
	"turn_id" varchar(128) NOT NULL,
	"paywall_id" varchar(64) NOT NULL,
	"tree" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "voidhash_ai_checkpoint_turn_doc_idx" ON "voidhash_ai_checkpoint" ("chat_id","turn_id","paywall_id");--> statement-breakpoint
CREATE INDEX "voidhash_ai_checkpoint_chat_idx" ON "voidhash_ai_checkpoint" ("chat_id","created_at");--> statement-breakpoint
ALTER TABLE "voidhash_ai_checkpoint" ADD CONSTRAINT "voidhash_ai_checkpoint_chat_id_voidhash_ai_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "voidhash_ai_chat"("id") ON DELETE CASCADE;