CREATE TABLE "voidhash_ai_chat" (
	"id" varchar(64) PRIMARY KEY,
	"organization_id" varchar(36) NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"surface" varchar(64) NOT NULL,
	"chat_type" varchar(32) NOT NULL,
	"paywall_id" varchar(64),
	"user_id" varchar(64),
	"title" varchar(255) NOT NULL,
	"messages" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "voidhash_ai_chat_org_idx" ON "voidhash_ai_chat" ("organization_id");--> statement-breakpoint
CREATE INDEX "voidhash_ai_chat_scope_idx" ON "voidhash_ai_chat" ("project_id","surface","paywall_id","chat_type");--> statement-breakpoint
CREATE INDEX "voidhash_ai_chat_updated_idx" ON "voidhash_ai_chat" ("updated_at");--> statement-breakpoint
ALTER TABLE "voidhash_ai_chat" ADD CONSTRAINT "voidhash_ai_chat_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;