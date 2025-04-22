CREATE TABLE `paywall` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`project_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paywall_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `paywall` ADD CONSTRAINT `paywall_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;