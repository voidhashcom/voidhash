import { Command, Prompt } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { DEFAULT_TYPES_OUTPUT } from "../../domain/schema/voidhash-config";
import { Auth } from "../../domain/services/auth";
import { Codegen, typedSdkPackagesOf } from "../../domain/services/codegen";
import { Credentials } from "../../domain/services/credentials";
import { SchemaService } from "../../domain/services/schema";
import { SourceCode } from "../../domain/services/source-code";
import { ApiClient } from "../../utils/api-client";
import { userError } from "../../utils/error-formatter";
import { assertFileCanBeCreated } from "../../utils/fs";
import { selectOrganization } from "../../utils/organizations/select-organization";
import { selectProject } from "../../utils/projects/select-project";
import { signedInSession } from "../context";
import { installMcpServer } from "./mcp-install";

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
 * The setup `voidhash-cli init` runs, which `dev`, `new` and `publish` offer
 * in a directory without a config.
 *
 * One-time setup: authenticate, select team/project, write `voidhash.config.ts`
 * at the project root, and produce the initial `voidhash.gen.d.ts` so type
 * autocomplete works immediately.
 *
 * Schema files are no longer generated — the dashboard is the source of truth
 * after the server-first redesign. Likewise the client file is the user's to
 * write (it's two lines now: import + `createVoidhashClient`).
 */
export const initializeProject = Effect.fn("initializeProject")(function* initializeProject() {
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
      Prompt.Confirm({
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
  const sessionOrSignIn = auth.getSignedInSession
    .pipe(
      Effect.catchTag("NoSignedInUserError", () =>
        Effect.fn("session")(function* session() {
          const shouldContinue = yield* Prompt.run(
            Prompt.Confirm({
              message:
                "You are not logged in. In the next step, you will approve a sign-in code in your browser. Do you want to continue?",
            }),
          );
          if (!shouldContinue) {
            return yield* Effect.fail(userError("Login cancelled."));
          }
          return yield* auth
            .login({ readOnly: false, noBrowser: false })
            .pipe(Effect.andThen(auth.getSignedInSession));
        })(),
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
        DeviceLoginError: (e) =>
          Effect.fail(userError(e.message, { hint: "Run 'voidhash-cli init' again." })),
        FailedToLoginError: () =>
          Effect.fail(userError("We were unable to sign you in. Please try it again.")),
      }),
    );
  // VOIDHASH_API_KEY wins over any sign-in, so when the server refuses it,
  // signing in cannot help.
  const session = Option.isSome((yield* Credentials).environmentKey)
    ? yield* signedInSession
    : yield* sessionOrSignIn;

  // Select team
  const organization = yield* selectOrganization(session.organizations);

  // Select project
  const project = yield* selectProject(
    organization.id,
    session.projects.filter((p) => p.organizationId === organization.id),
  );

  // The scaffolded client ships with the production publishable key; the
  // test one is printed for debug, staging and test builds.
  const apiKeysPage = yield* apiClient.apiKeysList(project.id, { type: "publishable" });
  const publishableKeyOf = (environment: "production" | "test") =>
    apiKeysPage.data.find(
      (apiKey) =>
        apiKey.type === "publishable" &&
        apiKey.environment === environment &&
        apiKey.rawKey !== null,
    )?.rawKey ?? undefined;
  const publishableKey = publishableKeyOf("production");
  if (publishableKey === undefined) {
    return yield* Effect.fail(
      userError("Could not retrieve a valid publishable key for the selected project."),
    );
  }
  const testPublishableKey = publishableKeyOf("test");

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
  const generatedVersion = yield* Effect.all(
    [
      schemaService.fetchRemoteSchema(project.id),
      schemaService.fetchFeatureFlags(project.id),
      sourceCode.loadPackageJson().pipe(
        Effect.map(Option.some),
        Effect.catchTag("PackageJsonNotFoundError", () => Effect.succeed(Option.none())),
      ),
    ],
    { concurrency: "unbounded" },
  ).pipe(
    Effect.flatMap(([{ schema, version }, flags, packageJson]) =>
      codegen.generateTypesDeclarationFile(typesOutputPath, schema, version, {
        flags,
        packages: typedSdkPackagesOf(packageJson),
      }),
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
  if (testPublishableKey !== undefined) {
    yield* Console.log(
      `\nThe client uses the production publishable key. For debug, staging and test builds, use the test publishable key instead: ${testPublishableKey}\n  It reads store sandbox and test purchases only, and debug builds simulate purchases only with it; test purchases never unlock production.`,
    );
  }
  yield* Console.log(`\nNext steps:`);
  yield* Console.log(
    `  1. Wrap your app with <voidhash.Provider> from ${path.relative(".", clientFilePath)}.`,
  );
  yield* Console.log(
    `  2. Create your products and perks ('voidhash-cli product create', 'voidhash-cli perk create'), and your paywall locations in the dashboard.`,
  );
  yield* Console.log(`  3. Check what the project still needs with 'voidhash-cli status'.`);
  yield* Console.log(
    `  4. Re-run 'voidhash-cli types generate' whenever the dashboard schema changes.`,
  );

  const connectAgents = yield* Prompt.run(
    Prompt.Confirm({
      message: "Connect your AI agents (Claude Code, Cursor, Codex, ...) to Voidhash too?",
      initial: true,
    }),
  );
  if (connectAgents) yield* installMcpServer({ yes: false });
});

/** `voidhash-cli init`: {@link initializeProject}. */
export const initCommand = Command.make("init", {}, () => initializeProject()).pipe(
  Command.withDescription("Initialize a new Voidhash project."),
);
