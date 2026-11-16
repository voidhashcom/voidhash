import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { componentApiUserError } from "../../utils/components/component-api";
import { componentCrateFiles, workingCopyComponentId } from "../../utils/components/scaffold";
import { userError } from "../../utils/error-formatter";
import { isComponentSlug } from "../../utils/workspace/working-copy";
import { openProjectWorkingCopy } from "../project-working-copy";

/** `wheel-picker` → `Wheel picker`. */
const titleFromName = (name: string) => {
  const words = name
    .split("-")
    .filter((word) => word !== "")
    .join(" ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
};

/**
 * `voidhash-cli new <name> [--title]`
 *
 * Adds a component to the working copy: `.voidhash/components/<name>/`, a
 * `voidhash-ui` component with its editor panel and the id `project/<name>`.
 * It stays local until `voidhash-cli publish` creates its first version.
 */
export const newCommand = Command.make(
  "new",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription("The component's slug: lowercase letters, digits and dashes"),
    ),
    title: Flag.String("title").pipe(
      Flag.withDescription("Its title in the paywall editor (letters, digits and spaces)"),
      Flag.optional,
    ),
  },
  ({ name, title: givenTitle }) =>
    Effect.gen(function* newCommand() {
      if (!isComponentSlug(name)) {
        return yield* Effect.fail(
          userError(`"${name}" is not a component slug: use lowercase letters, digits and dashes.`),
        );
      }
      const title = Option.getOrElse(givenTitle, () => titleFromName(name));
      if (!/^[A-Za-z0-9][A-Za-z0-9 ]*$/.test(title)) {
        return yield* Effect.fail(
          userError(
            `"${title}" is not a title the scaffold can use: use letters, digits and spaces.`,
          ),
        );
      }
      const apiClient = yield* ApiClient;
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { workingCopy, project } = yield* openProjectWorkingCopy;
      const directory = workingCopy.componentDirectory(name);
      if (yield* fileSystem.exists(directory)) {
        return yield* Effect.fail(userError(`${directory} already exists.`));
      }
      const onServer = yield* apiClient.componentsList(project.id, { slug: name }).pipe(
        Effect.map((page) => Arr.isReadonlyArrayNonEmpty(page.data)),
        Effect.mapError(componentApiUserError),
      );
      if (onServer) {
        return yield* Effect.fail(
          userError(
            `The project already has a component ${name}. Run 'voidhash-cli dev' to pull it into ${path.relative(".", workingCopy.componentsDirectory)}/, or pick another name.`,
          ),
        );
      }

      yield* workingCopy.writeComponentFiles(name, componentCrateFiles({ name, title }));
      yield* Console.log(
        [
          `✓ Created ${workingCopyComponentId(name)} in ${path.relative(".", directory)}/.`,
          "",
          "  voidhash-cli dev        # build it on every change and see it in your paywall editor",
          `                          # (under Local in the insert palette); edit ${path.join(path.relative(".", directory), "src")}/`,
          "  voidhash-cli publish    # publish it as the component's first catalog version",
        ].join("\n"),
      );
    }).pipe(
      Effect.catchTags({
        PlatformError: (error) =>
          Effect.fail(userError(`Could not write the component: ${error.message}`)),
      }),
    ),
).pipe(
  Command.withDescription(
    "Add a component with its editor panel to the working copy in .voidhash/components/.",
  ),
);
