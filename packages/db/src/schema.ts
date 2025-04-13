import { sql, relations } from "drizzle-orm";
import {
	boolean,
	varchar,
	index,
	mysqlEnum,
	primaryKey,
	timestamp,
	int,
	json,
} from "drizzle-orm/mysql-core";
import { mysqlTable } from "drizzle-orm/mysql-core";
import { organization, user } from "./auth-schema";

export * from "./auth-schema";

export const projects = mysqlTable(
	"projects",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull().unique(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organization.id),
		createdByUserId: varchar("created_by", { length: 255 })
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [index("organization_id_idx").on(table.organizationId)]
);

export const projectsRelations = relations(projects, ({ one }) => ({
	organization: one(organization, {
		fields: [projects.organizationId],
		references: [organization.id],
	}),
}));

export const customer = mysqlTable("customer", {
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }),
	email: varchar("email", { length: 255 }),
	projectId: varchar("project_id", { length: 255 })
		.notNull()
		.references(() => projects.id),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const projectPaymentProviderConfiguration = mysqlTable(
	"project_payment_provider_configuration",
	{
		providerId: varchar("provider_id", { length: 255 }),
		projectId: varchar("project_id", { length: 255 })
			.notNull()
			.references(() => projects.id),
		enabled: boolean("enabled").notNull().default(false),
		configuration: json("configuration").$type<object>(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.providerId] }),
		index("project_id_idx").on(table.projectId),
		index("provider_id_idx").on(table.providerId),
	]
);
