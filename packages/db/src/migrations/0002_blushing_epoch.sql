CREATE TABLE `paywall_product` (
	`paywall_id` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paywall_product_paywall_id_product_id_pk` PRIMARY KEY(`paywall_id`,`product_id`)
);
--> statement-breakpoint
ALTER TABLE `paywall_product` ADD CONSTRAINT `paywall_product_paywall_id_paywall_id_fk` FOREIGN KEY (`paywall_id`) REFERENCES `paywall`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paywall_product` ADD CONSTRAINT `paywall_product_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE no action ON UPDATE no action;