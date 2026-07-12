CREATE TABLE "paywall_component_manifest" (
	"source_hash" varchar(64) PRIMARY KEY,
	"status" varchar(16) NOT NULL,
	"manifest" jsonb,
	"diagnostics" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
