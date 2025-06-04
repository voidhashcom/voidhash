import { db } from "@voidhash/db";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@voidhash/db/schema";
import { nextCookies } from "better-auth/next-js";
import { APP_DOMAIN } from "@voidhash/lib";

export const auth = betterAuth({
	baseURL: APP_DOMAIN,
	database: drizzleAdapter(db, {
		provider: "mysql",
		schema: schema,
	}),
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID as string,
			clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	plugins: [organization(), apiKey(), nextCookies()],
});
