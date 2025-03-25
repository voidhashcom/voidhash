import { db } from "@voidhash/db";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@voidhash/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "mysql",
		schema: schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [organization(), apiKey()],
});
