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

export * from "./auth-schema";

// // PROJECTS
// export const projects = mysqlTable(
// 	"projects",
// 	{
// 		id: varchar("id", { length: 255 }).primaryKey(),
// 		name: varchar("name", { length: 255 }).notNull(),
// 		teamId: varchar("team_id", { length: 255 }).notNull(),
// 		createdByUserId: varchar("created_by", { length: 255 }).notNull(),
// 		profilePictureAssetId: varchar("profile_picture_asset_id", { length: 255 }),
// 		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
// 		updatedAt: timestamp("updated_at").onUpdateNow(),
// 	},
// 	(table) => [index("team_id_idx").on(table.teamId)]
// );
// export const projectRelations = relations(projects, ({ one, many }) => ({
// 	team: one(teams, { fields: [projects.teamId], references: [teams.id] }),
// 	profilePictureAsset: one(assets, {
// 		fields: [projects.profilePictureAssetId],
// 		references: [assets.id],
// 	}),
// }));
