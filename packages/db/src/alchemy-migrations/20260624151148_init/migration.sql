CREATE TABLE "analytics_ingest_dlq" (
	"id" varchar(255) PRIMARY KEY,
	"capture_id" varchar(255),
	"project_id" varchar(255) NOT NULL,
	"distinct_id" varchar(512),
	"route_class" varchar(32) NOT NULL,
	"failure_class" varchar(64) NOT NULL,
	"failure_message" varchar(1000) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"source_shard" varchar(255) NOT NULL,
	"source_sequence" bigint NOT NULL,
	"replayed_at" timestamp(3) with time zone,
	"replay_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"end" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"prefix" varchar(16) NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"created_at" timestamp(3) with time zone NOT NULL,
	"enabled" boolean DEFAULT true,
	"expires_at" timestamp(3) with time zone,
	"id" varchar(36) PRIMARY KEY,
	"key" varchar(255) NOT NULL,
	"last_refill_at" timestamp(3) with time zone,
	"last_request" timestamp(3) with time zone,
	"metadata" text,
	"name" text,
	"permissions" text,
	"prefix" text,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_max" integer DEFAULT 10,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"refill_amount" integer,
	"refill_interval" integer,
	"remaining" integer,
	"request_count" integer DEFAULT 0,
	"end" text,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"user_id" varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_store_transaction" (
	"id" varchar(255) PRIMARY KEY,
	"transaction_id" varchar(255) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"environment" smallint DEFAULT 1 NOT NULL,
	"expire_date" timestamp(3) with time zone,
	"in_app_ownership_type" smallint DEFAULT 2 NOT NULL,
	"is_upgraded" boolean,
	"offer_discount_type" smallint DEFAULT 2 NOT NULL,
	"offer_identifier" varchar(255),
	"offer_period" varchar(255),
	"offer_type" smallint DEFAULT 1 NOT NULL,
	"original_purchase_date" timestamp(3) with time zone NOT NULL,
	"original_transaction_id" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"product_id" varchar(255) NOT NULL,
	"purchase_date" timestamp(3) with time zone NOT NULL,
	"quantity" integer NOT NULL,
	"revocation_date" timestamp(3) with time zone,
	"revocation_reason" smallint DEFAULT 1 NOT NULL,
	"storefront" varchar(3) NOT NULL,
	"storefront_id" varchar(255) NOT NULL,
	"subscription_group_identifier" varchar(255),
	"transaction_reason" smallint DEFAULT 1 NOT NULL,
	"type" smallint DEFAULT 1 NOT NULL,
	"web_order_line_item_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"parent_entity_id" varchar(255),
	"action" varchar(50) NOT NULL,
	"actor_user_id" varchar(255),
	"actor_type" smallint DEFAULT 1 NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_provider_meter" (
	"id" varchar(255) PRIMARY KEY,
	"provider_id" varchar(50) NOT NULL,
	"metric_id" varchar(100) NOT NULL,
	"external_meter_id" varchar(255) NOT NULL,
	"external_meter_slug" varchar(255),
	"last_synced_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"id" varchar(255) PRIMARY KEY,
	"provider_id" varchar(50) NOT NULL,
	"external_event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp(3) with time zone,
	"error" varchar(500),
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capture_project_policy" (
	"project_id" varchar(255) PRIMARY KEY,
	"ingest_enabled" boolean DEFAULT true NOT NULL,
	"requests_per_minute" integer,
	"events_per_day" integer,
	"force_route" varchar(32),
	"custom_topic" varchar(255),
	"skip_enrichment" boolean DEFAULT false NOT NULL,
	"processor_enabled" boolean DEFAULT true NOT NULL,
	"processor_person_processing_enabled" boolean DEFAULT true NOT NULL,
	"processor_schema_mode" varchar(16) DEFAULT 'reject' NOT NULL,
	"processor_allow_overflow" boolean DEFAULT true NOT NULL,
	"processor_allow_historical" boolean DEFAULT true NOT NULL,
	"processor_historical_min_age_hours" integer DEFAULT 48 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "checkout_session" (
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"person_id" varchar(255) NOT NULL,
	"error_callback_url" varchar(255) DEFAULT 'LEGACY' NOT NULL,
	"id" varchar(255) PRIMARY KEY,
	"payment_provider_configuration_product_id" varchar(255) NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"success_callback_url" varchar(255) DEFAULT 'LEGACY' NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "feature_flag_override" (
	"id" varchar(255) PRIMARY KEY,
	"feature_flag_id" varchar(255) NOT NULL,
	"identity_type" smallint NOT NULL,
	"identity_value" varchar(255) NOT NULL,
	"forced_enabled" boolean,
	"note" varchar(1000),
	"created_by_user_id" varchar(255),
	"updated_by_user_id" varchar(255),
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "feature_flag_target" (
	"id" varchar(255) PRIMARY KEY,
	"feature_flag_id" varchar(255) NOT NULL,
	"list_type" smallint NOT NULL,
	"identity_type" smallint NOT NULL,
	"identity_value" varchar(255) NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "feature_flag_variant" (
	"id" varchar(255) PRIMARY KEY,
	"feature_flag_id" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"weight_bps" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "feature_flag" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"enabled" boolean DEFAULT false NOT NULL,
	"rollout_bps" integer DEFAULT 10000 NOT NULL,
	"salt" varchar(255) NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"owner_type" varchar(50),
	"owner_id" varchar(255),
	"archived_at" timestamp(3) with time zone,
	"created_by_user_id" varchar(255),
	"updated_by_user_id" varchar(255),
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rate" (
	"id" varchar(255) PRIMARY KEY,
	"currency" varchar(3) NOT NULL,
	"as_of_date" timestamp(3) with time zone NOT NULL,
	"usd_rate" integer NOT NULL,
	"source" varchar(64) NOT NULL,
	"fetched_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"id" varchar(36) PRIMARY KEY,
	"inviter_id" varchar(36) NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"role" varchar(255),
	"status" varchar(255) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"created_at" timestamp(3) with time zone NOT NULL,
	"id" varchar(36) PRIMARY KEY,
	"organization_id" varchar(36) NOT NULL,
	"role" varchar(255) DEFAULT 'member' NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"workos_membership_id" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"created_at" timestamp(3) with time zone NOT NULL,
	"id" varchar(36) PRIMARY KEY,
	"logo" text,
	"metadata" text,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL UNIQUE,
	"workos_organization_id" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_billing" (
	"id" varchar(255) PRIMARY KEY,
	"organization_id" varchar(255) NOT NULL,
	"tier" smallint DEFAULT 1 NOT NULL,
	"billing_provider_id" varchar(50) DEFAULT 'polar' NOT NULL,
	"external_customer_id" varchar(255),
	"subscription_status" smallint DEFAULT 0 NOT NULL,
	"external_subscription_id" varchar(255),
	"current_period_start" timestamp(3) with time zone,
	"current_period_end" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_provider_configuration_product" (
	"configuration" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"id" varchar(255) PRIMARY KEY,
	"is_active" boolean DEFAULT true NOT NULL,
	"payment_provider_configuration_id" varchar(255) NOT NULL,
	"product_id" varchar(255) NOT NULL,
	"provider_product_key" varchar(255) NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_provider_configuration" (
	"id" varchar(255) PRIMARY KEY,
	"provider_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"payment_provider_key" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"name" varchar(255) DEFAULT 'Unknown' NOT NULL,
	"configuration" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone,
	"active_provider_id" varchar(255) GENERATED ALWAYS AS ((case when deleted_at is null then provider_id else null end)) STORED
);
--> statement-breakpoint
CREATE TABLE "payment_provider_notification_processed" (
	"id" varchar(255) PRIMARY KEY,
	"payment_provider_configuration_id" varchar(255) NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"notification_uuid" varchar(255) NOT NULL,
	"notification_type" varchar(64) NOT NULL,
	"notification_subtype" varchar(64),
	"source" varchar(32) NOT NULL,
	"processed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"result" varchar(32) NOT NULL,
	"result_note" varchar(500),
	"parked_until_provider_product_key" varchar(255),
	"parked_until_original_transaction_id" varchar(255),
	"parked_raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "paywall_component_version" (
	"id" varchar(255) PRIMARY KEY,
	"component_id" varchar(255) NOT NULL,
	"deploy_id" varchar(255) NOT NULL,
	"version" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywall_component" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywall_deploy_blob" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"bytes" integer NOT NULL,
	"content_type" varchar(255),
	"storage_key" varchar(512) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywall_deploy_file" (
	"id" varchar(255) PRIMARY KEY,
	"deploy_id" varchar(255) NOT NULL,
	"role" smallint NOT NULL,
	"logical_path" varchar(512) NOT NULL,
	"sha256" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywall_deploy" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"schema_version" integer NOT NULL,
	"cli_version" varchar(255) NOT NULL,
	"runtime_version" varchar(255) NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"manifest" jsonb NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"created_by_name" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywall_location_showing" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"paywall_location_id" varchar(255) NOT NULL,
	"type" smallint DEFAULT 1 NOT NULL,
	"paywall_id" varchar(255),
	"paywall_release_id" varchar(255),
	"feature_flag_id" varchar(255),
	"started_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp(3) with time zone,
	"created_by_user_id" varchar(255),
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "paywall_location" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "paywall_release" (
	"id" varchar(255) PRIMARY KEY,
	"paywall_id" varchar(255) NOT NULL,
	"s3_key" varchar(512) NOT NULL,
	"s3_bucket" varchar(255) NOT NULL,
	"version" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"deploy_id" varchar(255),
	"content_hash" varchar(64),
	"runtime_config" jsonb,
	"published_by" varchar(255) NOT NULL,
	"published_at" timestamp(3) with time zone DEFAULT now(),
	"is_active" boolean DEFAULT false NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paywall" (
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"design_file_metadata" jsonb,
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"source" smallint DEFAULT 1 NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "perk" (
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person_deletion_request" (
	"id" varchar(255) PRIMARY KEY,
	"person_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"requested_by" varchar(255) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"requested_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person_external_identifier" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255),
	"person_id" varchar(255) NOT NULL,
	"service_id" varchar(255) NOT NULL,
	"is_default" boolean NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person_identity" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"distinct_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"kind" smallint DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person_identity_migration_job" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"previous_distinct_id" varchar(255) NOT NULL,
	"distinct_id" varchar(255) NOT NULL,
	"target_person_id" varchar(255) NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"person_events" jsonb,
	"mapping_events" jsonb,
	"requested_at" timestamp(3) with time zone NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person_personless_identity" (
	"project_id" varchar(255) NOT NULL,
	"distinct_id" varchar(255) NOT NULL,
	"is_merged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person_unlocked_perk" (
	"id" varchar(255) PRIMARY KEY,
	"status" smallint DEFAULT 1 NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"perk_id" varchar(255) NOT NULL,
	"unlocked_by_purchase_id" varchar(255),
	"unlocked_by_subscription_id" varchar(255),
	"expires_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255),
	"email" varchar(255),
	"traits" jsonb,
	"origin" smallint DEFAULT 1 NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"merged_into_person_id" varchar(255),
	"primary_distinct_id" varchar(255),
	"first_seen_at" timestamp(3) with time zone,
	"last_seen_at" timestamp(3) with time zone,
	"archived_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone,
	"deletion_reason" varchar(64),
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "product_perk" (
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"id" varchar(255) PRIMARY KEY,
	"perk_id" varchar(255) NOT NULL,
	"product_id" varchar(255) NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "product" (
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" smallint DEFAULT 1 NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "project" (
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"created_by" varchar(255),
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "purchase_ledger" (
	"id" varchar(255) PRIMARY KEY,
	"idempotency_key" varchar(512) NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"provider_event_type" varchar(100) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"result_payload" jsonb NOT NULL,
	"events_payload" jsonb NOT NULL,
	"raw_provider_payload" jsonb,
	"source" varchar(32),
	"status" smallint DEFAULT 1 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp(3) with time zone,
	"last_error" varchar(1000),
	"claimed_by" varchar(64),
	"claimed_at" timestamp(3) with time zone,
	"published_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" varchar(255) PRIMARY KEY,
	"person_id" varchar(255) NOT NULL,
	"provider_key" varchar(255) NOT NULL,
	"type" smallint DEFAULT 1 NOT NULL,
	"payment_provider_configuration_product_id" varchar(255) NOT NULL,
	"provider_environment" smallint DEFAULT 1 NOT NULL,
	"refunded_at" timestamp(3) with time zone,
	"refund_reason" varchar(100),
	"revoked_at" timestamp(3) with time zone,
	"revocation_reason" varchar(100),
	"last_event_occurred_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" varchar(255) PRIMARY KEY,
	"person_id" varchar(255) NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"initial_transaction_id" varchar(255) NOT NULL,
	"latest_transaction_id" varchar(255) NOT NULL,
	"store_subscription_id" varchar(255) NOT NULL,
	"payment_provider_configuration_product_id" varchar(255) NOT NULL,
	"provider_environment" smallint DEFAULT 1 NOT NULL,
	"is_trial" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp(3) with time zone NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"purchased_at" timestamp(3) with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp(3) with time zone,
	"cancellation_reason" varchar(255),
	"last_event_occurred_at" timestamp(3) with time zone,
	"billing_retry_at" timestamp(3) with time zone,
	"grace_period_expires_at" timestamp(3) with time zone,
	"extended_to" timestamp(3) with time zone,
	"pending_price_amount" integer,
	"pending_price_currency" varchar(3),
	"pending_price_effective_at" timestamp(3) with time zone,
	"pending_product_change_id" varchar(255),
	"redeemed_offer_id" varchar(255),
	"redeemed_offer_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" varchar(255) PRIMARY KEY,
	"person_id" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_usd" integer,
	"storefront" varchar(3),
	"gross_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"store_commission_amount" integer DEFAULT 0 NOT NULL,
	"proceeds_amount" integer DEFAULT 0 NOT NULL,
	"proceeds_after_tax_amount" integer DEFAULT 0 NOT NULL,
	"gross_amount_usd" integer,
	"tax_amount_usd" integer,
	"store_commission_amount_usd" integer,
	"proceeds_amount_usd" integer,
	"proceeds_after_tax_amount_usd" integer,
	"exchange_rate" integer,
	"payment_provider_product_configuration_id" varchar(255) NOT NULL,
	"provider_environment" smallint DEFAULT 1 NOT NULL,
	"store_transaction_id" varchar(255),
	"occurred_at" timestamp(3) with time zone NOT NULL,
	"refunded_at" timestamp(3) with time zone,
	"refund_reason" varchar(100),
	"revoked_at" timestamp(3) with time zone,
	"revocation_reason" varchar(100),
	"last_event_occurred_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_aggregate" (
	"id" varchar(255) PRIMARY KEY,
	"organization_id" varchar(255) NOT NULL,
	"metric_id" varchar(100) NOT NULL,
	"period_start" timestamp(3) with time zone NOT NULL,
	"period_end" timestamp(3) with time zone NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"limit_value" bigint,
	"warn_threshold" bigint,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_record" (
	"id" varchar(255) PRIMARY KEY,
	"organization_id" varchar(255) NOT NULL,
	"metric_id" varchar(100) NOT NULL,
	"value" bigint NOT NULL,
	"period_start" timestamp(3) with time zone NOT NULL,
	"period_end" timestamp(3) with time zone NOT NULL,
	"synced_to_provider" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp(3) with time zone,
	"sync_error" varchar(500),
	"metadata" jsonb,
	"occurred_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"ban_expires" timestamp(3) with time zone,
	"ban_reason" text,
	"banned" boolean DEFAULT false,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" varchar(36) PRIMARY KEY,
	"image" text,
	"name" varchar(255) NOT NULL,
	"role" text,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"workos_user_id" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery" (
	"id" varchar(255) PRIMARY KEY,
	"webhook_endpoint_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp(3) with time zone,
	"event_occurred_at" timestamp(3) with time zone NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_attempt" (
	"id" varchar(255) PRIMARY KEY,
	"webhook_delivery_id" varchar(255) NOT NULL,
	"attempt_number" integer NOT NULL,
	"status_code" integer,
	"response_body" varchar(2048),
	"error_message" varchar(500),
	"duration_ms" integer,
	"succeeded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoint" (
	"id" varchar(255) PRIMARY KEY,
	"project_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"secret" varchar(255) NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"events" jsonb NOT NULL,
	"description" varchar(500),
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now(),
	"updated_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "workos_webhook_event" (
	"id" varchar(255) PRIMARY KEY,
	"external_event_id" varchar(255) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp(3) with time zone,
	"error" varchar(500),
	"created_at" timestamp(3) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_ingest_dlq_capture_id_idx" ON "analytics_ingest_dlq" ("capture_id");--> statement-breakpoint
CREATE INDEX "analytics_ingest_dlq_project_failure_idx" ON "analytics_ingest_dlq" ("project_id","failure_class");--> statement-breakpoint
CREATE INDEX "analytics_ingest_dlq_replay_idx" ON "analytics_ingest_dlq" ("replay_status","created_at");--> statement-breakpoint
CREATE INDEX "api_key_key_idx" ON "api_key" ("key");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" ("key");--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "apikey" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_id_idx" ON "app_store_transaction" ("transaction_id");--> statement-breakpoint
CREATE INDEX "audit_project_created_idx" ON "audit_log" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_created_idx" ON "audit_log" ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_project_entity_type_created_idx" ON "audit_log" ("project_id","entity_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_created_idx" ON "audit_log" ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_metric_unique_idx" ON "billing_provider_meter" ("provider_id","metric_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_event_unique_idx" ON "billing_webhook_event" ("provider_id","external_event_id");--> statement-breakpoint
CREATE INDEX "processed_at_idx" ON "billing_webhook_event" ("processed_at");--> statement-breakpoint
CREATE INDEX "capture_project_policy_force_route_idx" ON "capture_project_policy" ("force_route");--> statement-breakpoint
CREATE UNIQUE INDEX "ff_override_unique_idx" ON "feature_flag_override" ("feature_flag_id","identity_type","identity_value");--> statement-breakpoint
CREATE INDEX "ff_override_identity_idx" ON "feature_flag_override" ("identity_type","identity_value");--> statement-breakpoint
CREATE UNIQUE INDEX "ff_target_unique_idx" ON "feature_flag_target" ("feature_flag_id","list_type","identity_type","identity_value");--> statement-breakpoint
CREATE INDEX "ff_target_identity_idx" ON "feature_flag_target" ("identity_type","identity_value");--> statement-breakpoint
CREATE UNIQUE INDEX "ff_variant_flag_key_idx" ON "feature_flag_variant" ("feature_flag_id","key");--> statement-breakpoint
CREATE INDEX "ff_variant_flag_id_idx" ON "feature_flag_variant" ("feature_flag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ff_key_project_id_idx" ON "feature_flag" ("key","project_id");--> statement-breakpoint
CREATE INDEX "ff_project_id_idx" ON "feature_flag" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rate_currency_date_idx" ON "fx_rate" ("currency","as_of_date");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_workos_id_uidx" ON "member" ("workos_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_workos_id_uidx" ON "organization" ("workos_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_id_unique_idx" ON "organization_billing" ("organization_id");--> statement-breakpoint
CREATE INDEX "external_customer_id_idx" ON "organization_billing" ("external_customer_id");--> statement-breakpoint
CREATE INDEX "billing_provider_id_idx" ON "organization_billing" ("billing_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_provider_configuration_ext_pk_idx" ON "payment_provider_configuration_product" ("payment_provider_configuration_id","provider_product_key","product_id");--> statement-breakpoint
CREATE INDEX "payment_provider_configuration_id_idx" ON "payment_provider_configuration_product" ("payment_provider_configuration_id");--> statement-breakpoint
CREATE INDEX "project_id_idx" ON "payment_provider_configuration" ("project_id");--> statement-breakpoint
CREATE INDEX "provider_id_idx" ON "payment_provider_configuration" ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_configuration_project_active_provider_uidx" ON "payment_provider_configuration" ("project_id","active_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_uuid_uniq" ON "payment_provider_notification_processed" ("payment_provider_configuration_id","notification_uuid");--> statement-breakpoint
CREATE INDEX "notif_processed_at_idx" ON "payment_provider_notification_processed" ("processed_at");--> statement-breakpoint
CREATE INDEX "notif_parked_lookup_idx" ON "payment_provider_notification_processed" ("payment_provider_configuration_id","result","parked_until_provider_product_key");--> statement-breakpoint
CREATE INDEX "notif_parked_sdk_idx" ON "payment_provider_notification_processed" ("payment_provider_configuration_id","result","parked_until_original_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_component_version_component_version_idx" ON "paywall_component_version" ("component_id","version");--> statement-breakpoint
CREATE INDEX "paywall_component_version_component_hash_idx" ON "paywall_component_version" ("component_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_component_project_id_slug_idx" ON "paywall_component" ("project_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_deploy_blob_project_id_sha256_idx" ON "paywall_deploy_blob" ("project_id","sha256");--> statement-breakpoint
CREATE INDEX "paywall_deploy_file_deploy_id_idx" ON "paywall_deploy_file" ("deploy_id");--> statement-breakpoint
CREATE INDEX "paywall_deploy_project_id_created_at_idx" ON "paywall_deploy" ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_deploy_project_id_manifest_hash_idx" ON "paywall_deploy" ("project_id","manifest_hash");--> statement-breakpoint
CREATE INDEX "paywall_location_showing_location_ended_started_idx" ON "paywall_location_showing" ("paywall_location_id","ended_at","started_at");--> statement-breakpoint
CREATE INDEX "paywall_location_showing_project_location_started_idx" ON "paywall_location_showing" ("project_id","paywall_location_id","started_at");--> statement-breakpoint
CREATE INDEX "paywall_location_showing_release_idx" ON "paywall_location_showing" ("paywall_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_location_slug_project_id_idx" ON "paywall_location" ("slug","project_id");--> statement-breakpoint
CREATE INDEX "paywall_location_project_id_idx" ON "paywall_location" ("project_id");--> statement-breakpoint
CREATE INDEX "paywall_location_archived_at_idx" ON "paywall_location" ("archived_at");--> statement-breakpoint
CREATE INDEX "paywall_release_paywall_id_idx" ON "paywall_release" ("paywall_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_release_version_status_idx" ON "paywall_release" ("paywall_id","version","status");--> statement-breakpoint
CREATE INDEX "paywall_release_status_idx" ON "paywall_release" ("paywall_id","status");--> statement-breakpoint
CREATE INDEX "paywall_release_paywall_id_content_hash_idx" ON "paywall_release" ("paywall_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "paywall_slug_project_id_idx" ON "paywall" ("slug","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "perk_slug_project_id_idx" ON "perk" ("slug","project_id");--> statement-breakpoint
CREATE INDEX "person_deletion_request_person_idx" ON "person_deletion_request" ("person_id");--> statement-breakpoint
CREATE INDEX "person_deletion_request_project_status_idx" ON "person_deletion_request" ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "person_external_identifier_project_service_identifier_uidx" ON "person_external_identifier" ("project_id","service_id","identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "person_identity_project_distinct_uidx" ON "person_identity" ("project_id","distinct_id");--> statement-breakpoint
CREATE INDEX "person_identity_project_person_idx" ON "person_identity" ("project_id","person_id");--> statement-breakpoint
CREATE INDEX "person_identity_migration_project_status_created_idx" ON "person_identity_migration_job" ("project_id","status","created_at");--> statement-breakpoint
CREATE INDEX "person_identity_migration_project_previous_idx" ON "person_identity_migration_job" ("project_id","previous_distinct_id");--> statement-breakpoint
CREATE INDEX "person_identity_migration_project_distinct_idx" ON "person_identity_migration_job" ("project_id","distinct_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_personless_identity_project_distinct_uidx" ON "person_personless_identity" ("project_id","distinct_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_id_perk_id_idx" ON "person_unlocked_perk" ("person_id","perk_id");--> statement-breakpoint
CREATE INDEX "person_merged_into_person_id_idx" ON "person" ("merged_into_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_id_perk_id_idx" ON "product_perk" ("product_id","perk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_slug_project_id_idx" ON "product" ("slug","project_id");--> statement-breakpoint
CREATE INDEX "organization_id_idx" ON "project" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_oragnization_id_idx" ON "project" ("slug","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_ledger_idempotency_key_idx" ON "purchase_ledger" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "purchase_ledger_poll_idx" ON "purchase_ledger" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "purchase_ledger_provider_idx" ON "purchase_ledger" ("provider_id","provider_event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_key_idx" ON "purchase" ("provider_key");--> statement-breakpoint
CREATE INDEX "purchase_person_active_idx" ON "purchase" ("person_id","refunded_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_store_subscription_unique_idx" ON "subscription" ("payment_provider_configuration_product_id","store_subscription_id");--> statement-breakpoint
CREATE INDEX "status_starts_at_idx" ON "subscription" ("status","starts_at");--> statement-breakpoint
CREATE INDEX "canceled_at_idx" ON "subscription" ("canceled_at");--> statement-breakpoint
CREATE INDEX "person_id_idx" ON "subscription" ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_provider_tx_unique_idx" ON "transaction" ("payment_provider_product_configuration_id","store_transaction_id");--> statement-breakpoint
CREATE INDEX "occurred_at_idx" ON "transaction" ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_metric_period_unique_idx" ON "usage_aggregate" ("organization_id","metric_id","period_start");--> statement-breakpoint
CREATE INDEX "org_metric_period_idx" ON "usage_record" ("organization_id","metric_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "synced_to_provider_idx" ON "usage_record" ("synced_to_provider");--> statement-breakpoint
CREATE UNIQUE INDEX "user_workos_id_uidx" ON "user" ("workos_user_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_endpoint_status_idx" ON "webhook_delivery" ("webhook_endpoint_id","status");--> statement-breakpoint
CREATE INDEX "webhook_delivery_next_attempt_idx" ON "webhook_delivery" ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_attempt_delivery_idx" ON "webhook_delivery_attempt" ("webhook_delivery_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoint_project_status_idx" ON "webhook_endpoint" ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workos_event_unique_idx" ON "workos_webhook_event" ("external_event_id");--> statement-breakpoint
CREATE INDEX "workos_event_processed_at_idx" ON "workos_webhook_event" ("processed_at");--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "capture_project_policy" ADD CONSTRAINT "capture_project_policy_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_deletion_request" ADD CONSTRAINT "person_deletion_request_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_deletion_request" ADD CONSTRAINT "person_deletion_request_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_external_identifier" ADD CONSTRAINT "person_external_identifier_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_external_identifier" ADD CONSTRAINT "person_external_identifier_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_identity" ADD CONSTRAINT "person_identity_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_identity" ADD CONSTRAINT "person_identity_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_identity_migration_job" ADD CONSTRAINT "person_identity_migration_job_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_identity_migration_job" ADD CONSTRAINT "person_identity_migration_job_target_person_id_person_id_fkey" FOREIGN KEY ("target_person_id") REFERENCES "person"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person_personless_identity" ADD CONSTRAINT "person_personless_identity_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;