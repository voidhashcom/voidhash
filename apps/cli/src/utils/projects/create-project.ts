import { Prompt } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { NoSignedInUserError } from "../../domain/errors/auth";
import { CliConfig } from "../../domain/services/cli-config";
import { Credentials } from "../../domain/services/credentials";
import { ApiClient } from "../api-client";

const validateProjectName = (value: string) => {
  if (value.length < 3) {
    return Effect.fail("Project name must be at least 3 characters");
  }
  if (value.length > 32) {
    return Effect.fail("Project name must be less than 32 characters");
  }
  return Effect.succeed(value);
};

export const createProject = (input: { organizationId: string }) =>
  Effect.gen(function* createProject() {
    const client = yield* ApiClient;
    const cliConfig = yield* CliConfig;

    const config = yield* cliConfig
      .readConfig()
      .pipe(Effect.catch(() => Effect.die("Failed to read config")));

    // Without a credential for the API host, the user is signed out.
    const credential = yield* (yield* Credentials)
      .resolve(config.api_url)
      .pipe(Effect.catch(() => Effect.succeedNone));
    if (Option.isNone(credential)) {
      yield* Effect.logInfo("Api key is not set, considering the user to be signed out");
      return yield* Effect.fail(new NoSignedInUserError({ message: "No signed in user" }));
    }

    const attemptToCreateProject = Effect.fn("attemptToCreateProject")(
      function* attemptToCreateProject() {
        const name = yield* Prompt.run(
          Prompt.String({
            message: "Enter a name for the project",
            validate: (value) => validateProjectName(value),
          }),
        );

        const project = yield* client.projectsCreate(input.organizationId, { name });

        yield* Console.log(`Successfully created project ${project.name}`);

        return project;
      },
    )();

    return yield* attemptToCreateProject;
  });
