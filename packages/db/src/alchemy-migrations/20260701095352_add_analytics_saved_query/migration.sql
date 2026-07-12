CREATE TABLE "analytics_saved_query" (
	"id" varchar(255) PRIMARY KEY,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"voidql_text" text NOT NULL,
	"schema_version" integer NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_saved_query_org_idx" ON "analytics_saved_query" ("organization_id");