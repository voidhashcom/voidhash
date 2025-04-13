import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { Client } from "@planetscale/database";
import { drizzle as drizzlePlanetscale } from "drizzle-orm/planetscale-serverless";
import * as schema from "./schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless";

let db: MySql2Database<typeof schema> | PlanetScaleDatabase<typeof schema>;

if (process.env["NODE_ENV"] === "production") {
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

export { db };
export * from "./schema";
