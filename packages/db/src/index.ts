import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { Client } from "@planetscale/database";
import { drizzle as drizzlePlanetscale } from "drizzle-orm/planetscale-serverless";
import type { MySql2Database, MySql2Transaction } from "drizzle-orm/mysql2";
import * as schema from "./schema";
import type {
	PlanetScaleDatabase,
	PlanetScaleTransaction,
} from "drizzle-orm/planetscale-serverless";
import { reset } from "drizzle-seed";
import { ExtractTablesWithRelations } from "drizzle-orm";

export type Database =
	| PlanetScaleDatabase<typeof schema>
	| MySql2Database<typeof schema>;

export type Transaction =
	| PlanetScaleTransaction<
			typeof schema,
			ExtractTablesWithRelations<typeof schema>
	  >
	| MySql2Transaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;

let db: Database;

if (process.env.DATABASE_HOST?.includes("psdb.cloud")) {
	const client = new Client({
		host: process.env.DATABASE_HOST,
		username: process.env.DATABASE_USERNAME,
		password: process.env.DATABASE_PASSWORD,
	});

	db = drizzlePlanetscale(client, { schema });
} else {
	const connection = await mysql.createConnection({
		host: process.env["DATABASE_HOST"],
		user: process.env["DATABASE_USERNAME"],
		database: process.env["DATABASE_NAME"],
		password: process.env["DATABASE_PASSWORD"],
	});

	db = drizzleMysql({
		client: connection,
		schema,
		mode: "default",
	});
}

export { drizzle } from "drizzle-orm/planetscale-serverless";
export { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
export * from "drizzle-orm";

async function dangrously_resetDb() {
	await reset(db, schema);
}

export { db, dangrously_resetDb };
export * from "./schema";
export * from "./types";
