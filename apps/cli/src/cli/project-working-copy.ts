import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { Prompt } from "effect/cli";

import { SourceCode } from "../domain/services/source-code";
import { userError } from "../utils/error-formatter";
import { prepareWorkingCopy } from "../utils/workspace/working-copy";
import { initializeProject } from "./commands/init";
import { projectNamedBy, signedInSession } from "./context";
import { isInteractive } from "./input";

const NO_CONFIG =
  "There is no voidhash.config.ts here. Run this command in your project's root, or set the project up with 'voidhash-cli init'.";

/**
 * The project `voidhash.config.ts` names in the current directory, resolved
 * through the signed-in user's session. Offers to run `voidhash-cli init`
 * when there is no config, in a terminal.
 */
const configuredProject = Effect.fn("configuredProject")(function* () {
  const sourceCode = yield* SourceCode;
  const config = yield* sourceCode.loadVoidhashConfig().pipe(
    Effect.catchTag("VoidhashConfigNotFoundError", () =>
      Effect.gen(function* () {
        if (!(yield* isInteractive)) return yield* Effect.fail(userError(NO_CONFIG));
        const initialize = yield* Prompt.run(
          Prompt.Confirm({
            message:
              "There is no voidhash.config.ts in this directory. Set up this project with voidhash-cli init now?",
          }),
        );
        if (!initialize) return yield* Effect.fail(userError(NO_CONFIG));
        yield* initializeProject();
        return yield* sourceCode.loadVoidhashConfig();
      }),
    ),
    Effect.catchTags({
      VoidhashConfigNotFoundError: () => Effect.fail(userError(NO_CONFIG)),
      InvalidVoidhashConfigError: (error) => Effect.fail(userError(error.message)),
      FailedToLoadVoidhashConfigError: (error) => Effect.fail(userError(error.message)),
    }),
  );
  return yield* projectNamedBy(config, yield* signedInSession);
})();

/**
 * The project of the current directory and its component working copy,
 * which is created (and added to `.gitignore`) when it does not exist yet.
 * `dev`, `new` and `publish` start with it.
 */
export const openProjectWorkingCopy = Effect.fn("openProjectWorkingCopy")(function* () {
  const path = yield* Path.Path;
  const { organization, project } = yield* configuredProject;
  const { workingCopy, notes } = yield* prepareWorkingCopy(path.resolve("."), project.id).pipe(
    Effect.catchTags({
      PlatformError: (error) =>
        Effect.fail(userError(`Could not prepare the working copy: ${error.message}`)),
      WorkingCopyStateError: (error) => Effect.fail(userError(error.message)),
    }),
  );
  yield* Effect.forEach(notes, (note) => Console.log(note), { concurrency: 1, discard: true });
  return { workingCopy, organization, project };
})();
