CREATE TABLE `api_key` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`start` varchar(255) NOT NULL,
	`key` varchar(255) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`is_public` boolean NOT NULL DEFAULT false,
	`project_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_key_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_store_transaction` (
	`id` varchar(255) NOT NULL,
	`transaction_id` varchar(255) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`environment` tinyint NOT NULL DEFAULT 1,
	`expire_date` timestamp,
	`in_app_ownership_type` tinyint NOT NULL DEFAULT 2,
	`is_upgraded` boolean,
	`offer_discount_type` tinyint NOT NULL DEFAULT 2,
	`offer_identifier` varchar(255),
	`offer_period` varchar(255),
	`offer_type` tinyint NOT NULL DEFAULT 1,
	`original_purchase_date` timestamp NOT NULL,
	`original_transaction_id` varchar(255) NOT NULL,
	`price` int NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`purchase_date` timestamp NOT NULL,
	`quantity` int NOT NULL,
	`revocation_date` timestamp,
	`revocation_reason` tinyint NOT NULL DEFAULT 1,
	`storefront` varchar(3) NOT NULL,
	`storefront_id` varchar(255) NOT NULL,
	`subscription_group_identifier` varchar(255),
	`transaction_reason` tinyint NOT NULL DEFAULT 1,
	`type` tinyint NOT NULL DEFAULT 1,
	`web_order_line_item_id` varchar(255),
	CONSTRAINT `app_store_transaction_id` PRIMARY KEY(`id`),
	CONSTRAINT `transaction_id_idx` UNIQUE(`transaction_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_provider_meter` (
	`id` varchar(255) NOT NULL,
	`provider_id` varchar(50) NOT NULL,
	`metric_id` varchar(100) NOT NULL,
	`external_meter_id` varchar(255) NOT NULL,
	`external_meter_slug` varchar(255),
	`last_synced_at` timestamp,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_provider_meter_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_metric_unique_idx` UNIQUE(`provider_id`,`metric_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_webhook_event` (
	`id` varchar(255) NOT NULL,
	`provider_id` varchar(50) NOT NULL,
	`external_event_id` varchar(255) NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`payload` json,
	`processed_at` timestamp,
	`error` varchar(500),
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `billing_webhook_event_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_event_unique_idx` UNIQUE(`provider_id`,`external_event_id`)
);
--> statement-breakpoint
CREATE TABLE `checkout_session` (
	`id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`payment_provider_configuration_product_id` varchar(255) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`success_callback_url` varchar(255) NOT NULL DEFAULT 'LEGACY',
	`error_callback_url` varchar(255) NOT NULL DEFAULT 'LEGACY',
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkout_session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_unlocked_perk` (
	`id` varchar(255) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`customer_id` varchar(255) NOT NULL,
	`perk_id` varchar(255) NOT NULL,
	`unlocked_by_purchase_id` varchar(255),
	`unlocked_by_subscription_id` varchar(255),
	`expires_at` timestamp,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_unlocked_perk_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_id_perk_id_idx` UNIQUE(`customer_id`,`perk_id`)
);
--> statement-breakpoint
CREATE TABLE `external_customer_identifier` (
	`id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`service_id` varchar(255) NOT NULL,
	`is_default` boolean NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_customer_identifier_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_billing` (
	`id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`tier` tinyint NOT NULL DEFAULT 1,
	`billing_provider_id` varchar(50) NOT NULL DEFAULT 'polar',
	`external_customer_id` varchar(255),
	`subscription_status` tinyint NOT NULL DEFAULT 0,
	`external_subscription_id` varchar(255),
	`current_period_start` timestamp,
	`current_period_end` timestamp,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_billing_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_id_unique_idx` UNIQUE(`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` varchar(255) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`payload` json,
	`published_at` timestamp,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_provider_configuration_product` (
	`id` varchar(255) NOT NULL,
	`payment_provider_configuration_id` varchar(255) NOT NULL,
	`provider_product_key` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`configuration` json,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_provider_configuration_product_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_provider_configuration_ext_pk_idx` UNIQUE(`payment_provider_configuration_id`,`provider_product_key`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_provider_configuration` (
	`id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`project_id` varchar(255) NOT NULL,
	`payment_provider_key` varchar(255) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`name` varchar(255) NOT NULL DEFAULT 'Unknown',
	`configuration` json,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `payment_provider_configuration_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paywall_edit_token` (
	`id` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`paywall_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `paywall_edit_token_id` PRIMARY KEY(`id`),
	CONSTRAINT `paywall_edit_token_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `perk` (
	`id` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`project_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `perk_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug_project_id_idx` UNIQUE(`slug`,`project_id`)
);
--> statement-breakpoint
CREATE TABLE `product_perk` (
	`id` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`perk_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_perk_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_id_perk_id_idx` UNIQUE(`product_id`,`perk_id`)
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`created_by` varchar(255),
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug_oragnization_id_idx` UNIQUE(`slug`,`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `purchase` (
	`id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`provider_key` varchar(255) NOT NULL,
	`type` tinyint NOT NULL DEFAULT 1,
	`payment_provider_configuration_product_id` varchar(255) NOT NULL,
	`provider_environment` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_key_idx` UNIQUE(`provider_key`)
);
--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`initial_transaction_id` varchar(255) NOT NULL,
	`latest_transaction_id` varchar(255) NOT NULL,
	`store_subscription_id` varchar(255) NOT NULL,
	`payment_provider_configuration_product_id` varchar(255) NOT NULL,
	`provider_environment` tinyint NOT NULL DEFAULT 1,
	`is_trial` boolean NOT NULL DEFAULT false,
	`starts_at` timestamp NOT NULL,
	`expires_at` timestamp,
	`purchased_at` timestamp NOT NULL,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`canceled_at` timestamp,
	`cancellation_reason` varchar(255),
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`amount_usd` int,
	`exchange_rate` int,
	`payment_provider_product_configuration_id` varchar(255) NOT NULL,
	`provider_environment` tinyint NOT NULL DEFAULT 1,
	`store_transaction_id` varchar(255),
	`occurred_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transaction_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_aggregate` (
	`id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`metric_id` varchar(100) NOT NULL,
	`period_start` timestamp NOT NULL,
	`period_end` timestamp NOT NULL,
	`total_value` bigint NOT NULL DEFAULT 0,
	`limit_value` bigint,
	`warn_threshold` bigint,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_aggregate_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_metric_period_unique_idx` UNIQUE(`organization_id`,`metric_id`,`period_start`)
);
--> statement-breakpoint
CREATE TABLE `usage_record` (
	`id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`metric_id` varchar(100) NOT NULL,
	`value` bigint NOT NULL,
	`period_start` timestamp NOT NULL,
	`period_end` timestamp NOT NULL,
	`synced_to_provider` boolean NOT NULL DEFAULT false,
	`synced_at` timestamp,
	`sync_error` varchar(500),
	`metadata` json,
	`occurred_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `usage_record_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jwks` (
	`id` varchar(36) NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`expires_at` timestamp(3),
	CONSTRAINT `jwks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_access_token` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255),
	`client_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`user_id` varchar(36),
	`reference_id` text,
	`refresh_id` varchar(36),
	`expires_at` timestamp(3),
	`created_at` timestamp(3),
	`scopes` text NOT NULL,
	CONSTRAINT `oauth_access_token_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_access_token_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `oauth_client` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`client_secret` text,
	`disabled` boolean DEFAULT false,
	`skip_consent` boolean,
	`enable_end_session` boolean,
	`scopes` text,
	`user_id` varchar(36),
	`created_at` timestamp(3),
	`updated_at` timestamp(3),
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`token_endpoint_auth_method` text,
	`grant_types` text,
	`response_types` text,
	`public` boolean,
	`type` text,
	`reference_id` text,
	`metadata` json,
	CONSTRAINT `oauth_client_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_client_client_id_unique` UNIQUE(`client_id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_consent` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`reference_id` text,
	`scopes` text NOT NULL,
	`created_at` timestamp(3),
	`updated_at` timestamp(3),
	CONSTRAINT `oauth_consent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_refresh_token` (
	`id` varchar(36) NOT NULL,
	`token` text NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`reference_id` text,
	`expires_at` timestamp(3),
	`created_at` timestamp(3),
	`revoked` timestamp(3),
	`scopes` text NOT NULL,
	CONSTRAINT `oauth_refresh_token_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
DROP TABLE `paywall_product`;--> statement-breakpoint
DROP TABLE `product_provider_configuration`;--> statement-breakpoint
DROP TABLE `project_payment_provider_configuration`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `customer` DROP INDEX `app_user_id_project_id_idx`;--> statement-breakpoint
ALTER TABLE `customer` DROP FOREIGN KEY `customer_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `paywall` DROP FOREIGN KEY `paywall_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `product` DROP FOREIGN KEY `product_project_id_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `customer` MODIFY COLUMN `app_user_id` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `account` MODIFY COLUMN `access_token_expires_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `account` MODIFY COLUMN `refresh_token_expires_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `account` MODIFY COLUMN `created_at` timestamp(3) NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `account` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `key` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `last_refill_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `enabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `rate_limit_enabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `rate_limit_time_window` int DEFAULT 86400000;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `rate_limit_max` int DEFAULT 10;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `request_count` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `last_request` timestamp(3);--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `expires_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `apikey` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation` MODIFY COLUMN `email` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation` MODIFY COLUMN `role` varchar(255);--> statement-breakpoint
ALTER TABLE `invitation` MODIFY COLUMN `status` varchar(255) NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `invitation` MODIFY COLUMN `expires_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `member` MODIFY COLUMN `role` varchar(255) NOT NULL DEFAULT 'member';--> statement-breakpoint
ALTER TABLE `member` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `organization` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `organization` MODIFY COLUMN `slug` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `organization` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `session` MODIFY COLUMN `expires_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `session` MODIFY COLUMN `created_at` timestamp(3) NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `session` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `email_verified` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `created_at` timestamp(3) NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `verification` MODIFY COLUMN `identifier` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `verification` MODIFY COLUMN `expires_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `verification` MODIFY COLUMN `created_at` timestamp(3) NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `verification` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `customer` ADD `type` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer` ADD `additional_attributes` json;--> statement-breakpoint
ALTER TABLE `customer` ADD `origin` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer` ADD `parent_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `customer` ADD `archived_at` timestamp;--> statement-breakpoint
ALTER TABLE `paywall` ADD `slug` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `paywall` ADD `design_file_metadata` json;--> statement-breakpoint
ALTER TABLE `product` ADD `type` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation` ADD `created_at` timestamp(3) DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` timestamp(3);--> statement-breakpoint
ALTER TABLE `customer` ADD CONSTRAINT `app_user_id_project_id_environment_idx` UNIQUE(`app_user_id`,`project_id`);--> statement-breakpoint
ALTER TABLE `paywall` ADD CONSTRAINT `slug_project_id_idx` UNIQUE(`slug`,`project_id`);--> statement-breakpoint
ALTER TABLE `organization` ADD CONSTRAINT `organization_slug_uidx` UNIQUE(`slug`);--> statement-breakpoint
ALTER TABLE `oauth_access_token` ADD CONSTRAINT `oauth_access_token_client_id_oauth_client_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_access_token` ADD CONSTRAINT `oauth_access_token_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_access_token` ADD CONSTRAINT `oauth_access_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_access_token` ADD CONSTRAINT `oauth_access_token_refresh_id_oauth_refresh_token_id_fk` FOREIGN KEY (`refresh_id`) REFERENCES `oauth_refresh_token`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD CONSTRAINT `oauth_client_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_consent` ADD CONSTRAINT `oauth_consent_client_id_oauth_client_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_consent` ADD CONSTRAINT `oauth_consent_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_refresh_token` ADD CONSTRAINT `oauth_refresh_token_client_id_oauth_client_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_refresh_token` ADD CONSTRAINT `oauth_refresh_token_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_refresh_token` ADD CONSTRAINT `oauth_refresh_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `processed_at_idx` ON `billing_webhook_event` (`processed_at`);--> statement-breakpoint
CREATE INDEX `customer_id_service_id_identifier_idx` ON `external_customer_identifier` (`customer_id`,`service_id`,`identifier`);--> statement-breakpoint
CREATE INDEX `external_customer_id_idx` ON `organization_billing` (`external_customer_id`);--> statement-breakpoint
CREATE INDEX `billing_provider_id_idx` ON `organization_billing` (`billing_provider_id`);--> statement-breakpoint
CREATE INDEX `payment_provider_configuration_id_idx` ON `payment_provider_configuration_product` (`payment_provider_configuration_id`);--> statement-breakpoint
CREATE INDEX `project_id_idx` ON `payment_provider_configuration` (`project_id`);--> statement-breakpoint
CREATE INDEX `provider_id_idx` ON `payment_provider_configuration` (`provider_id`);--> statement-breakpoint
CREATE INDEX `paywall_id_idx` ON `paywall_edit_token` (`paywall_id`);--> statement-breakpoint
CREATE INDEX `expires_at_idx` ON `paywall_edit_token` (`expires_at`);--> statement-breakpoint
CREATE INDEX `organization_id_idx` ON `project` (`organization_id`);--> statement-breakpoint
CREATE INDEX `status_starts_at_idx` ON `subscription` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `canceled_at_idx` ON `subscription` (`canceled_at`);--> statement-breakpoint
CREATE INDEX `customer_id_idx` ON `subscription` (`customer_id`);--> statement-breakpoint
CREATE INDEX `occurred_at_idx` ON `transaction` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `org_metric_period_idx` ON `usage_record` (`organization_id`,`metric_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE INDEX `synced_to_provider_idx` ON `usage_record` (`synced_to_provider`);--> statement-breakpoint
CREATE INDEX `parent_customer_id_idx` ON `customer` (`parent_customer_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `apikey_userId_idx` ON `apikey` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);