import { Command, Prompt } from "effect/unstable/cli";
import { Console, Effect, Path } from "effect";

import { createInitialNormalizedSchema } from "../../domain/schema/normalized-schema";
import { Auth } from "../../domain/services/auth";
import { Codegen } from "../../domain/services/codegen";
import { SourceCode } from "../../domain/services/source-code";
import { ApiClient } from "../../utils/api-client";
import { userError } from "../../utils/error-formatter";
import { assertFileCanBeCreated } from "../../utils/fs";
import { selectOrganization } from "../../utils/organizations/select-organization";
import { selectProject } from "../../utils/projects/select-project";
import { debugOption } from "../shared-options";

export const initCommand = Command.make("init", { debug: debugOption }, () =>
	Effect.gen(function* initCommand() {
		const auth = yield* Auth;
		const apiClient = yield* ApiClient;
		const sourceCode = yield* SourceCode;
		const codegen = yield* Codegen;
		const path = yield* Path.Path;

		const voidhashConfig = yield* sourceCode
			.loadVoidhashConfig()
			.pipe(
				Effect.catchTag("VoidhashConfigNotFoundError", () =>
					Effect.succeed(null),
				),
			);

		if (voidhashConfig) {
			const shouldContinue = yield* Prompt.run(
				Prompt.confirm({
					message:
						"Voidhash was already initialized in this project. This will overwrite the existing configuration. Do you want to continue?",
				}),
			);
			if (!shouldContinue) {
				return yield* Console.log("Initialization cancelled.");
			}
			yield* sourceCode.deleteVoidhashConfig();
		}

		// Sign in
		const session = yield* auth.getSignedInSession
			.pipe(
				Effect.catchTag("NoSignedInUserError", () =>
					Effect.gen(function* session() {
						const shouldContinue = yield* Prompt.run(
							Prompt.confirm({
								message:
									"You are not logged in. In the next step, we will open a browser window to sign you in. Do you want to continue?",
							}),
						);
						if (!shouldContinue) {
							return yield* Effect.fail(userError("Login cancelled."));
						}
						return yield* auth.login.pipe(
							Effect.andThen(auth.getSignedInSession),
						);
					}),
				),
			)
			.pipe(
				Effect.catchTags({
					FailedToGetSessionError: (e) =>
						Effect.fail(
							userError("Failed to get user session. Please try again."),
						).pipe(Effect.tapError(() => Effect.logDebug(e))),
					NoSignedInUserError: () =>
						Effect.fail(
							userError("We were unable to sign you in. Please try it again."),
						),
					// TODO: handle other errors
				}),
			);

		// Select team
		const organization = yield* selectOrganization(session.organizations);

		// Select project
		const project = yield* selectProject(
			organization.id,
			session.projects.filter((p) => p.organizationId === organization.id),
		);
		const apiKeys = (yield* apiClient.apiKeysListApiKeys()) as readonly {
			id: string;
			isPublic: boolean;
			projectId: string;
			rawKey?: string;
		}[];
		const publishableApiKey = apiKeys.find(
			(apiKey) => apiKey.isPublic && apiKey.projectId === project.id,
		);
		const publishableKey = publishableApiKey?.rawKey;
		if (!publishableKey) {
			return yield* Effect.fail(
				userError(
					"Could not retrieve raw publishable key from listApiKeys for the selected project.",
				),
			);
		}
		if (!publishableKey.startsWith("vh_pk_")) {
			return yield* Effect.fail(
				userError(
					"Received an invalid publishable key from listApiKeys for the selected project.",
				),
			);
		}

		// Select folder path

		const srcFolderPath = yield* sourceCode.retrieveSrcDir();
		const hasSrcDir = srcFolderPath.endsWith("src");

		const voidhashFilesFolderPath = yield* Prompt.run(
			Prompt.text({
				default: hasSrcDir ? "./src/utils/voidhash" : "./utils/voidhash",
				message:
					"Select the folder where you want to create the Voidhash schema and client",
			}),
		);

		// File names
		const language = yield* sourceCode.detectSrcLanguage();
		const schemaFileName = language === "ts" ? "schema.ts" : "schema.js";
		const clientFileName = language === "ts" ? "client.ts" : "client.js";
		const configFileName =
			language === "ts" ? "voidhash.config.ts" : "voidhash.config.js";

		// File paths
		const schemaFilePath = path.resolve(
			voidhashFilesFolderPath,
			schemaFileName,
		);
		const clientFilePath = path.resolve(
			voidhashFilesFolderPath,
			clientFileName,
		);
		const configFilePath = path.resolve(configFileName);

		// Assert files can be created
		yield* assertFileCanBeCreated(schemaFileName, schemaFilePath);
		yield* assertFileCanBeCreated(clientFileName, clientFilePath);
		yield* assertFileCanBeCreated(configFileName, configFilePath);

		// Generate files
		yield* codegen.generateVoidhashConfigFile(configFilePath, {
			project: project.slug,
			schema: path.relative(path.resolve(), schemaFilePath),
			team: organization.slug,
		});

		// Generate initial schema file
		const initialSchema = createInitialNormalizedSchema();
		yield* codegen.generateSchemaFile(schemaFilePath, initialSchema);
		yield* codegen.generateClientFile(clientFilePath, publishableKey);

		yield* Console.log("\nVoidhash initialized successfully!");
		yield* Console.log(`  Config: ${configFilePath}`);
		yield* Console.log(`  Schema: ${schemaFilePath}`);
		yield* Console.log(`  Client: ${clientFilePath}`);
		yield* Console.log(`\nNext steps:`);
		yield* Console.log(`  1. Add your products and perks to the schema file.`);
		yield* Console.log(`  2. Use the generated client in your app code.`);
		yield* Console.log(
			`  3. Run \`voidhash-cli schema push\` to push your schema to the server.`,
		);
	}),
).pipe(Command.withDescription("Initialize a new Voidhash project."));
