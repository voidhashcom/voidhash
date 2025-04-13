import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { Client } from "@planetscale/database";
import { drizzle as drizzlePlanetscale } from "drizzle-orm/planetscale-serverless";
import * as schema from "./schema";

let db: ReturnType<typeof drizzlePlanetscale> | ReturnType<typeof drizzleMysql>;

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

export * from "./schema";
