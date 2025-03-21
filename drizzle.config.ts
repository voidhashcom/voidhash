import { defineConfig } from "drizzle-kit";
export default defineConfig({
	dialect: "mysql",
	schema: "./packages/db/schema.ts",
	out: "./packages/db/migrations",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
