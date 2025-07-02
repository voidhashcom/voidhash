import { Data, Effect } from "effect";
import * as schema from "@voidhash/db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { APP_DOMAIN } from "@voidhash/lib/constants";
import { Db } from "./db";
import { apiKey, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

export class BetterAuthError extends Data.TaggedError("BetterAuthError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class BetterAuth extends Effect.Service<BetterAuth>()("app/BetterAuth", {
	dependencies: [Db.Default],
	effect: Effect.gen(function* () {
		const dbService = yield* Db;
		const auth = yield* dbService.use(async (db) =>
			betterAuth({
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
			})
		);

		return {
			use: <A,>(fn: (client: typeof auth) => Promise<A>) =>
				Effect.tryPromise({
					try: () => fn(auth),
					catch: (error) =>
						new BetterAuthError({
							message: "Failed to use better-auth",
							cause: error,
						}),
				}),
		};
	}),
}) {}
