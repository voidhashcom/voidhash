import { defineConfig } from "drizzle-kit";
export default defineConfig({
	dialect: "mysql",
	schema: "./packages/db/src/schema.ts",
	out: "./packages/db/src/migrations",
	dbCredentials: {
		host: process.env["DATABASE_HOST"]!,
		user: process.env["DATABASE_USERNAME"]!,
		database: process.env["DATABASE_NAME"]!,
		password: process.env["DATABASE_PASSWORD"]!,
	},
});
