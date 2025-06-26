import { Effect } from "effect";
import { env } from "../env";

export class Config extends Effect.Service<Config>()("app/Config", {
	effect: Effect.gen(function* () {
		return {
			getConfig: Effect.succeed({
				betterAuthSecret: env.BETTER_AUTH_SECRET,
				databaseHost: env.DATABASE_HOST,
				databasePort: env.DATABASE_PORT,
				databaseUsername: env.DATABASE_USERNAME,
				databasePassword: env.DATABASE_PASSWORD,
				databaseName: env.DATABASE_NAME,
				voidhashSecretKey: env.VOIDHASH_SECRET_KEY,
				triggerProjectId: env.TRIGGER_PROJECT_ID,
				triggerSecretKey: env.TRIGGER_SECRET_KEY,
				githubClientId: env.GITHUB_CLIENT_ID,
				githubClientSecret: env.GITHUB_CLIENT_SECRET,
				polarAccessToken: env.POLAR_ACCESS_TOKEN,
				axiomLogsDataset: env.AXIOM_LOGS_DATASET,
				axiomToken: env.AXIOM_TOKEN,
				axiomLogLevel: env.AXIOM_LOG_LEVEL,
			}),
		};
	}),
	dependencies: [],
}) {}
