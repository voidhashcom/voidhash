import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schedule from "effect/Schedule";
import { Command, Flag, Prompt } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import {
  componentApiUserError,
  printBuildLog,
  printComponentVersion,
} from "../../utils/components/component-api";
import { userError } from "../../utils/error-formatter";
import {
  componentTitleFromSource,
  formatChanges,
  isSelectable,
  publishCandidate,
  publishedComponentState,
  PublishSelection,
  selectForPublish,
  type PublishCandidate,
} from "../../utils/workspace/publish";
import { formatSyncEvent, SyncEvent, syncWorkingCopy } from "../../utils/workspace/sync";
import { sourceFilesHash } from "../../utils/workspace/working-copy";
import { isInteractive } from "../input";
import { openProjectWorkingCopy } from "../project-working-copy";

const BUILD_POLL_INTERVAL = "2 seconds";
const BUILD_WAIT_TIMEOUT = "10 minutes";

/** One line per listed component: its kind and its per-file summary. */
const candidateLine = (candidate: PublishCandidate, width: number) =>
  `  ${candidate.slug.padEnd(width)}  ${candidate.kind.padEnd(10)}  ${
    candidate.kind === "conflicted"
      ? "resolve the conflict markers first"
      : formatChanges(candidate)
  }`;

/**
 * `voidhash-cli publish [--all] [--component <slug>]... [--yes]`
 *
 * Publishes the working copy's new and modified components as new catalog
 * versions, built by the server from their `src/**.rs` and `Cargo.toml`.
 * Newer catalog versions are merged into the working copy first, as `dev`
 * does; a component with conflicts cannot be published until they are
 * resolved. Waits for every build and exits with an error when one failed.
 */
export const publishCommand = Command.make(
  "publish",
  {
    all: Flag.Boolean("all").pipe(
      Flag.withDescription("Publish every new and modified component"),
      Flag.withDefault(false),
    ),
    component: Flag.String("component").pipe(
      Flag.withDescription("Publish this component (repeatable)"),
      Flag.atLeast(0),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Publish without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  ({ all, component, yes }) =>
    Effect.gen(function* publishCommand() {
      const apiClient = yield* ApiClient;
      const { workingCopy, project } = yield* openProjectWorkingCopy;
      const interactive = yield* isInteractive;

      const { events } = yield* syncWorkingCopy(workingCopy, apiClient, { pullMissing: false });
      yield* Effect.forEach(
        events.filter((event) => !SyncEvent.$is("NotEditable")(event)),
        (event) => Console.log(formatSyncEvent(event)),
        { concurrency: 1, discard: true },
      );

      const state = yield* workingCopy.readState;
      const candidates = yield* Effect.forEach(
        yield* workingCopy.listComponents,
        (slug) =>
          Effect.map(workingCopy.readComponentFiles(slug), (files) =>
            publishCandidate({ slug, files, entry: R.get(state.components, slug) }),
          ),
        { concurrency: 1 },
      );
      const listed = candidates.filter((candidate) => candidate.kind !== "unchanged");
      if (Arr.isReadonlyArrayEmpty(listed)) {
        yield* Console.log("Nothing to publish: every component matches its catalog version.");
        return;
      }
      const width = Math.max(...listed.map((candidate) => candidate.slug.length));
      yield* Console.log(
        ["Changes in the working copy:", ...listed.map((c) => candidateLine(c, width)), ""].join(
          "\n",
        ),
      );

      const selection = selectForPublish(candidates, {
        all,
        components: component,
        isInteractive: interactive,
      });
      const slugs = yield* PublishSelection.$match(selection, {
        Refused: ({ message }) => Effect.fail(userError(message)),
        Selected: ({ slugs: selected }) => Effect.succeed(selected),
        Prompt: () =>
          Prompt.run(
            Prompt.MultiSelect({
              message: "Components to publish",
              choices: listed.map((candidate) => ({
                title: candidate.slug,
                value: candidate.slug,
                description:
                  candidate.kind === "conflicted"
                    ? "conflicted: resolve the conflict markers first"
                    : `${candidate.kind}: ${formatChanges(candidate)}`,
                disabled: !isSelectable(candidate),
                selected: isSelectable(candidate),
              })),
            }),
          ),
      });
      if (Arr.isReadonlyArrayEmpty(slugs)) {
        yield* Console.log("Nothing selected.");
        return;
      }
      const skipped = listed.filter((candidate) => candidate.kind === "conflicted");
      if (all && Arr.isReadonlyArrayNonEmpty(skipped)) {
        yield* Console.log(
          `Skipping ${skipped.map((candidate) => candidate.slug).join(", ")}: resolve the conflicts first.`,
        );
      }
      if (interactive && !yes) {
        const confirmed = yield* Prompt.run(
          Prompt.Confirm({
            message: `Publish ${slugs.join(", ")} as new catalog versions?`,
            initial: true,
          }),
        );
        if (!confirmed) {
          yield* Console.log("Nothing published.");
          return;
        }
      }

      const outcomes = yield* Effect.forEach(
        slugs,
        (slug) =>
          Effect.gen(function* () {
            const files = yield* workingCopy.readComponentFiles(slug);
            const isNew = !R.has((yield* workingCopy.readState).components, slug);
            const title = isNew
              ? Option.flatMap(R.get(files, "src/lib.rs"), componentTitleFromSource)
              : Option.none<string>();
            yield* Console.log(`\nPublishing ${slug}...`);
            const queued = yield* apiClient
              .componentsCreateVersionFromSource(project.id, {
                slug,
                files,
                title: Option.getOrUndefined(title),
              })
              .pipe(Effect.mapError(componentApiUserError));
            const version = queued.version;
            // The new version is the base now, whatever its build does.
            const baseHash = yield* sourceFilesHash(files);
            yield* workingCopy.updateState((current) => ({
              ...current,
              components: {
                ...current.components,
                [slug]: publishedComponentState({
                  previous: R.get(current.components, slug),
                  version,
                  files,
                  baseHash,
                }),
              },
            }));

            yield* Console.log(`Building ${slug} v${version}...`);
            const built = yield* apiClient
              .componentsGetVersion(project.id, queued.componentId, queued.id)
              .pipe(
                Effect.repeat({
                  schedule: Schedule.spaced(BUILD_POLL_INTERVAL),
                  until: (detail) => detail.status === "ready" || detail.status === "failed",
                }),
                Effect.mapError(componentApiUserError),
                Effect.timeoutOrElse({
                  duration: BUILD_WAIT_TIMEOUT,
                  orElse: () =>
                    Effect.fail(
                      userError(
                        `${slug} v${version} is still building after ${BUILD_WAIT_TIMEOUT}; 'voidhash-cli dev' and the catalog show it once it is done.`,
                      ),
                    ),
                }),
              );
            if (built.status === "failed") {
              yield* printComponentVersion(slug, built);
              yield* printBuildLog(built);
              yield* Console.error(`✗ The build of ${slug} v${version} failed.`);
              return false;
            }
            yield* workingCopy.updateState((current) => ({
              ...current,
              components: Option.match(R.get(current.components, slug), {
                onNone: () => current.components,
                onSome: (entry) => ({
                  ...current.components,
                  [slug]: { ...entry, publishedVersion: version },
                }),
              }),
            }));
            yield* Console.log(`✓ Published ${slug} v${version}.`);
            yield* printComponentVersion(slug, built);
            return true;
          }).pipe(
            // One component's failure is reported, and the others still publish.
            Effect.catchTag("UserError", (error) =>
              Effect.as(Console.error(`✗ ${slug}: ${error.message}`), false),
            ),
          ),
        { concurrency: 1 },
      );

      const failed = slugs.filter((_, index) => outcomes[index] !== true);
      if (Arr.isReadonlyArrayNonEmpty(failed)) {
        return yield* Effect.fail(
          userError(
            `\n✗ ${failed.length} of ${slugs.length} did not publish: ${failed.join(", ")}.`,
          ),
        );
      }
    }).pipe(
      Effect.catchTags({
        PlatformError: (error) => Effect.fail(userError(error.message)),
        WorkingCopyStateError: (error) => Effect.fail(userError(error.message)),
      }),
    ),
).pipe(
  Command.withDescription(
    "Publish the new and modified components of .voidhash/ as new catalog versions.",
  ),
);
