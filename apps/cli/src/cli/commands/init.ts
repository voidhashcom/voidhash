import { Command, Prompt } from "effect/unstable/cli";
import { Console, Effect, Path } from "effect";

import { DEFAULT_TYPES_OUTPUT } from "../../domain/schema/voidhash-config";
import { Auth } from "../../domain/services/auth";
import { Codegen } from "../../domain/services/codegen";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { ApiClient } from "../../utils/api-client";
import { userError } from "../../utils/error-formatter";
import { assertFileCanBeCreated } from "../../utils/fs";
import { selectOrganization } from "../../utils/organizations/select-organization";
import { selectProject } from "../../utils/projects/select-project";

/** The config file name matching the project's source language. */
const configFileNameFor = (language: "ts" | "js"): string => {
  if (language === "ts") return "voidhash.config.ts";
  return "voidhash.config.js";
};

/** The scaffolded SDK client file name matching the project's source language. */
const clientFileNameFor = (language: "ts" | "js"): string => {
  if (language === "ts") return "voidhash.ts";
  return "voidhash.js";
};

/**
 * `voidhash-cli init`
 *
 * One-time setup: authenticate, select team/project, write `voidhash.config.ts`
 * at the project root, and produce the initial `voidhash.gen.d.ts` so type
 * autocomplete works immediately.
 *
 * Schema files are no longer generated — the dashboard is the source of truth
 * after the server-first redesign. Likewise the client file is the user's to
 * write (it's two lines now: import + `createVoidhashClient`).
 */
export const initCommand = Command.make("init", {}, () =>
  Effect.gen(function* initCommand() {
    const auth = yield* Auth;
    const apiClient = yield* ApiClient;
    const sourceCode = yield* SourceCode;
    const codegen = yield* Codegen;
    const schemaService = yield* SchemaService;
    const path = yield* Path.Path;

    const voidhashConfig = yield* sourceCode
      .loadVoidhashConfig()
      .pipe(Effect.catchTag("VoidhashConfigNotFoundError", () => Effect.succeed(null)));

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
            return yield* auth.login.pipe(Effect.andThen(auth.getSignedInSession));
          }),
        ),
      )
      .pipe(
        Effect.catchTags({
          FailedToGetSessionError: (e) =>
            Effect.fail(userError("Failed to get user session. Please try again.")).pipe(
              Effect.tapError(() => Effect.logDebug(e)),
            ),
          NoSignedInUserError: () =>
            Effect.fail(userError("We were unable to sign you in. Please try it again.")),
        }),
      );

    // Select team
    const organization = yield* selectOrganization(session.organizations);

    // Select project
    const project = yield* selectProject(
      organization.id,
      session.projects.filter((p) => p.organizationId === organization.id),
    );

    // Sanity-check that a publishable key exists for this project; we don't
    // need to write it anywhere (the user puts it in their app code), but a
    // missing key is a configuration problem we should surface now.
    const apiKeys = yield* apiClient.apiKeysListApiKeys();
    const publishableApiKey = apiKeys.find(
      (apiKey) => apiKey.isPublic && apiKey.projectId === project.id,
    );
    if (!publishableApiKey?.rawKey?.startsWith("vh_pk_")) {
      return yield* Effect.fail(
        userError("Could not retrieve a valid publishable key for the selected project."),
      );
    }
    const publishableKey = publishableApiKey.rawKey;

    // Decide where the generated `.d.ts` lives. We default to the project
    // root since module augmentation works from anywhere in `tsconfig.include`.
    const language = yield* sourceCode.detectSrcLanguage();
    const configFileName = configFileNameFor(language);

    const configFilePath = path.resolve(configFileName);
    const typesOutputPath = path.resolve(DEFAULT_TYPES_OUTPUT);

    // Scaffold the SDK client into `src/lib` (or `lib` when there's no `src`),
    // matching the project's `src` layout and language.
    const srcDir = yield* sourceCode.retrieveSrcDir();
    const clientFileName = clientFileNameFor(language);
    const clientFilePath = path.join(srcDir, "lib", clientFileName);

    yield* assertFileCanBeCreated(configFileName, configFilePath);
    yield* assertFileCanBeCreated(DEFAULT_TYPES_OUTPUT, typesOutputPath);
    yield* assertFileCanBeCreated(clientFileName, clientFilePath);

    // Write the config. `typesOutput` is omitted from the generated file so
    // it picks up the default (`voidhash.gen.d.ts`) — keeps the config terse.
    yield* codegen.generateVoidhashConfigFile(configFilePath, {
      project: project.slug,
      team: organization.slug,
    });

    // Scaffold the SDK client with the publishable key pre-filled so the user
    // has a working import target on the first run.
    yield* codegen.generateClientFile(clientFilePath, { publishableKey });

    // Produce the initial declaration file so the user has working
    // autocomplete on the first run. Failures here are non-fatal — the user
    // can re-run `voidhash-cli types generate` later.
    const generatedVersion = yield* schemaService.fetchRemoteSchema().pipe(
      Effect.flatMap(({ schema, version }) =>
        codegen.generateTypesDeclarationFile(typesOutputPath, schema, version),
      ),
      Effect.catch((e) =>
        Effect.logWarning(
          `Failed to generate initial types: ${String(e)}. You can run 'voidhash-cli types generate' later.`,
        ).pipe(Effect.as(null)),
      ),
    );

    yield* Console.log("\nVoidhash initialized successfully!");
    yield* Console.log(`  Config:  ${configFilePath}`);
    yield* Console.log(`  Client:  ${clientFilePath}`);
    if (generatedVersion !== null) {
      yield* Console.log(`  Types:   ${typesOutputPath}`);
    }
    yield* Console.log(`\nNext steps:`);
    yield* Console.log(
      `  1. Wrap your app with <voidhash.Provider> from ${path.relative(".", clientFilePath)}.`,
    );
    yield* Console.log(
      `  2. Create your products and paywall locations in the Voidhash dashboard.`,
    );
    yield* Console.log(
      `  3. Re-run 'voidhash-cli types generate' whenever the dashboard schema changes.`,
    );
  }),
).pipe(Command.withDescription("Initialize a new Voidhash project."));
