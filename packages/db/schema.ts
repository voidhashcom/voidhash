import { sql, relations } from "drizzle-orm";
import {
	boolean,
	varchar,
	index,
	mysqlEnum,
	primaryKey,
	timestamp,
	int,
} from "drizzle-orm/mysql-core";
import { mysqlTable } from "drizzle-orm/mysql-core";
import { organization, user } from "./auth-schema";

export * from "./auth-schema";

// // PROJECTS
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
