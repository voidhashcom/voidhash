import { db } from "@chiron-standalone/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@chiron-standalone/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "mysql",
		schema: schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
});
