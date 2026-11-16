import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import { Argument, Command } from "effect/cli";

import { userError } from "../../utils/error-formatter";
import {
  directoryConfig,
  linkFor,
  projectKind,
  readCliConfig,
  signedInSession,
  writeCliConfig,
} from "../context";
import { requireItem } from "../input";

const projectArgument = Argument.String("project").pipe(
  Argument.withDescription("The project's slug, organization/slug, name or id"),
  Argument.optional,
);

/** `voidhash-cli link [project]` */
export const linkCommand = Command.make("link", { project: projectArgument }, ({ project }) =>
  Effect.gen(function* () {
    const directory = (yield* Path.Path).resolve(".");
    // An app's committed config already decides; a link beside it would be ignored.
    if (Option.isSome(yield* directoryConfig)) {
      return yield* Effect.fail(
        userError("This directory's voidhash.config.ts already names its project.", {
          hint: "To use another project here, run 'voidhash-cli init' again: it rewrites the config, the client and the types.",
        }),
      );
    }
    const session = yield* signedInSession;
    const kind = projectKind(session);
    const linked = yield* requireItem(
      kind,
      session.projects,
      project,
      "voidhash-cli link <project>",
    );
    const { links } = yield* readCliConfig;
    yield* writeCliConfig({ links: R.set(links ?? {}, directory, linked.id) });
    yield* Console.log(
      `Linked ${directory} to ${kind.label(linked)}.\nCommands you run here, and in the directories below, act on it.`,
    );
  }),
).pipe(
  Command.withDescription(
    "Make a project this directory's: commands run here and below act on it. The link is yours, kept in ~/.voidhash.",
  ),
);

/** `voidhash-cli unlink` */
export const unlinkCommand = Command.make("unlink", {}, () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const { links } = yield* readCliConfig;
    const link = linkFor(links ?? {}, path.resolve("."), path.sep);
    if (Option.isNone(link))
      return yield* Console.log("This directory is not linked to a project.");
    yield* writeCliConfig({ links: R.remove(links ?? {}, link.value.directory) });
    yield* Console.log(`Unlinked ${link.value.directory} from ${link.value.projectId}.`);
  }),
).pipe(Command.withDescription("Remove the link 'voidhash-cli link' made for this directory."));

/** `voidhash-cli switch [project]` */
export const switchCommand = Command.make("switch", { project: projectArgument }, ({ project }) =>
  Effect.gen(function* () {
    const session = yield* signedInSession;
    const kind = projectKind(session);
    const chosen = yield* requireItem(
      kind,
      session.projects,
      project,
      "voidhash-cli switch <project>",
    );
    yield* writeCliConfig({ default_project: chosen.id });
    yield* Console.log(`Your default project is now ${kind.label(chosen)}.`);
    // Say so when this directory keeps acting on another project.
    const config = yield* directoryConfig;
    if (Option.isSome(config)) {
      yield* Console.log(
        `This directory's voidhash.config.ts still names ${config.value.team}/${config.value.project}.`,
      );
      return;
    }
    const path = yield* Path.Path;
    const link = linkFor((yield* readCliConfig).links ?? {}, path.resolve("."), path.sep);
    if (Option.isSome(link) && link.value.projectId !== chosen.id) {
      yield* Console.log(
        `${link.value.directory} is still linked to ${Option.match(
          Arr.findFirst(session.projects, ({ id }) => id === link.value.projectId),
          { onNone: () => link.value.projectId, onSome: kind.label },
        )}.`,
      );
    }
  }),
).pipe(
  Command.withDescription(
    "Choose the project commands act on outside linked directories and apps with a voidhash.config.ts.",
  ),
);
