CREATE TABLE "voidhash_agent_session" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"surface" varchar(64) NOT NULL,
	"paywall_id" varchar(64),
	"user_id" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone
);
--> statement-breakpoint
ALTER TABLE "voidhash_agent_session" ADD CONSTRAINT "voidhash_agent_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "voidhash_agent_session_scope_idx" ON "voidhash_agent_session" USING btree ("project_id","surface","paywall_id","updated_at");
--> statement-breakpoint
CREATE INDEX "voidhash_agent_session_user_idx" ON "voidhash_agent_session" USING btree ("user_id","updated_at");
