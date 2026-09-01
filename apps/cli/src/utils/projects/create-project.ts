import { Prompt } from "effect/unstable/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { NoSignedInUserError } from "../../domain/errors/auth";
import { CliConfig } from "../../domain/services/cli-config";
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

    // If the config file is not found or the api key is not set, we consider the user to be signed out
    const apiKey = config.api_key;
    if (!apiKey) {
      yield* Effect.logInfo("Api key is not set, considering the user to be signed out");
      return yield* Effect.fail(new NoSignedInUserError({ message: "No signed in user" }));
    }

    const attemptToCreateProject = Effect.fn("attemptToCreateProject")(function* attemptToCreateProject() {
      const name = yield* Prompt.run(
        Prompt.text({
          message: "Enter a name for the project",
          validate: (value) => validateProjectName(value),
        }),
      );

      const project = yield* client.projectsCreateProject({
        name,
        organizationId: input.organizationId,
      });

      yield* Console.log(`Successfully created project ${project.name}`);

      return project;
    })();

    return yield* attemptToCreateProject;
  });
