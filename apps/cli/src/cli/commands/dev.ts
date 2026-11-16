import { NodeHttpServer } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { Base64Url } from "effect/encoding";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Command, Flag } from "effect/cli";
import { HttpRouter } from "effect/http";
// oxlint-disable-next-line effect/use-http-client-service -- NodeHttpServer serves the dev server on Node's http.Server.
import { createServer } from "node:http";

import { ApiClient } from "../../utils/api-client";
import { buildComponentCrate, CrateBuildError } from "../../utils/components/crate-build";
import { workingCopyComponentId } from "../../utils/components/scaffold";
import { userError } from "../../utils/error-formatter";
import {
  DEV_SERVER_DEFAULT_PORT,
  DevServerRoutes,
  makeDevServerState,
  workingCopyFacts,
  type DevComponentStatus,
} from "../../utils/workspace/dev-server";
import {
  makeDevSessionReporter,
  reportedComponents,
  runDevSessionReports,
} from "../../utils/workspace/dev-session";
import { filesHaveConflictMarkers } from "../../utils/workspace/merge";
import { formatSyncEvent, SyncEvent, syncWorkingCopy } from "../../utils/workspace/sync";
import { openProjectWorkingCopy } from "../project-working-copy";

/** Changes this close together start one build. */
const QUIET_PERIOD = Duration.millis(200);

/** How often `dev` looks for newer versions of the working copy's components. */
const SYNC_INTERVAL = Duration.seconds(15);

const fingerprint = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** One line per finished build: its sizes, or why it failed with cargo's diagnostics. */
const printBuild = (status: DevComponentStatus) => {
  const { build, component, slug } = status;
  if (build.state === "ready" && component !== null) {
    const panel =
      component.panel === null
        ? ""
        : `, panel ${component.panel.byteSize.toLocaleString("en-US")} bytes`;
    return Console.log(
      `✓ ${slug}: build ${build.number} ready (module ${component.module.byteSize.toLocaleString("en-US")} bytes${panel}).`,
    );
  }
  return Console.error(
    `✗ ${slug}: build ${build.number} failed: ${build.message ?? ""}${build.log.trim() === "" ? "" : `\n${build.log.trimEnd()}`}`,
  );
};

/**
 * `voidhash-cli dev [--port]`
 *
 * Keeps the project's components in the working copy `.voidhash/`, builds
 * each with the local Rust toolchain and rebuilds it on every change, serves
 * the builds on `127.0.0.1`, and registers a dev session so the paywall
 * editor of the signed-in user finds them. Every 15 seconds it merges newer
 * catalog versions into the working copy. The contract is
 * `docs/specs/component-dev-session.md`.
 */
export const devCommand = Command.make(
  "dev",
  {
    port: Flag.Int("port").pipe(
      Flag.withDescription(`Port on 127.0.0.1 (default ${DEV_SERVER_DEFAULT_PORT})`),
      Flag.withDefault(DEV_SERVER_DEFAULT_PORT),
    ),
  },
  ({ port }) =>
    Effect.gen(function* devCommand() {
      const apiClient = yield* ApiClient;
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { workingCopy, organization, project } = yield* openProjectWorkingCopy;
      const token = Base64Url.encode(crypto.getRandomValues(new Uint8Array(32)));
      const server = yield* makeDevServerState();
      const serverTitles = yield* Ref.make<Readonly<Record<string, string>>>({});
      const notEditableAnnounced = yield* Ref.make(HashSet.empty<string>());

      /** Tells the server what the working copy says of a component now. */
      const describe = (slug: string) =>
        Effect.gen(function* () {
          const files = yield* workingCopy.readComponentFiles(slug);
          const entry = R.get((yield* workingCopy.readState).components, slug);
          if (
            Option.exists(entry, (state) => state.isConflicted) &&
            !filesHaveConflictMarkers(files)
          ) {
            yield* workingCopy.updateState((state) => ({
              ...state,
              components: Option.match(R.get(state.components, slug), {
                onNone: () => state.components,
                onSome: (component) => ({
                  ...state.components,
                  [slug]: { ...component, isConflicted: false },
                }),
              }),
            }));
            yield* Console.log(`✓ ${slug}: no conflict markers remain; the conflict is resolved.`);
          }
          yield* server.describe(
            slug,
            workingCopyFacts({
              files,
              entry,
              title: R.get(yield* Ref.get(serverTitles), slug).pipe(Option.getOrElse(() => slug)),
            }),
          );
        });

      const build = (slug: string) =>
        buildComponentCrate(workingCopy.componentDirectory(slug), { diagnostics: "capture" }).pipe(
          Effect.filterOrFail(
            (built) => built.definition.id === workingCopyComponentId(slug),
            (built) =>
              new CrateBuildError({
                message: `The crate declares the id ${built.definition.id}, but the component in components/${slug} is ${workingCopyComponentId(slug)}. Use that id in #[component] and #[panel(for = …)].`,
                log: built.log,
              }),
          ),
        );

      // Components whose files changed since their last build, built one at a time.
      const changed = yield* Ref.make(HashSet.empty<string>());
      const buildLock = yield* Semaphore.make(1);
      const buildChanged = buildLock.withPermit(
        Effect.gen(function* () {
          const slugs = Arr.sort(
            Arr.fromIterable(yield* Ref.getAndSet(changed, HashSet.empty<string>())),
            Order.String,
          );
          yield* Effect.forEach(
            slugs,
            (slug) =>
              Effect.gen(function* () {
                if (!(yield* workingCopy.isComponent(slug))) {
                  if (R.has(yield* SubscriptionRef.get(server.components), slug)) {
                    yield* server.remove(slug);
                    yield* Console.log(`- ${slug}: no longer a component crate; it is not served.`);
                  }
                  return;
                }
                yield* describe(slug);
                const status = yield* server.rebuild(slug, build(slug));
                if (Option.isSome(status)) yield* printBuild(status.value);
              }).pipe(
                Effect.catchTags({
                  PlatformError: (error) => Console.error(`! ${slug}: ${error.message}`),
                  WorkingCopyStateError: (error) => Console.error(`! ${error.message}`),
                }),
              ),
            { concurrency: 1, discard: true },
          );
        }),
      );
      const markChanged = (slugs: ReadonlyArray<string>) =>
        Ref.update(changed, (current) => HashSet.union(current, HashSet.fromIterable(slugs)));

      const sync = Effect.gen(function* () {
        const { events, titles } = yield* syncWorkingCopy(workingCopy, apiClient, {
          pullMissing: true,
        });
        yield* Ref.set(serverTitles, titles);
        // A component without source is announced once.
        const notEditable = events.filter(SyncEvent.$is("NotEditable"));
        const announced = yield* Ref.getAndUpdate(notEditableAnnounced, (current) =>
          HashSet.union(current, HashSet.fromIterable(notEditable.map((event) => event.slug))),
        );
        yield* Effect.forEach(
          events.filter(
            (event) => !SyncEvent.$is("NotEditable")(event) || !HashSet.has(announced, event.slug),
          ),
          (event) => Console.log(formatSyncEvent(event)),
          { concurrency: 1, discard: true },
        );
        // `publish` may have changed the state meanwhile: report what it says now.
        yield* Effect.forEach(
          yield* workingCopy.listComponents,
          (slug) =>
            Effect.flatMap(SubscriptionRef.get(server.components), (served) =>
              R.has(served, slug) ? describe(slug) : Effect.void,
            ),
          { concurrency: 1, discard: true },
        );
      }).pipe(
        Effect.catch((error) =>
          Console.error(
            `! Could not sync the working copy with Voidhash (${error.message}); trying again in 15 seconds.`,
          ),
        ),
      );

      yield* sync;
      const components = yield* workingCopy.listComponents;
      yield* Effect.forEach(components, describe, { concurrency: 1, discard: true });

      yield* Layer.build(
        HttpRouter.serve(DevServerRoutes({ state: server, token }), { disableLogger: true }).pipe(
          Layer.provide(NodeHttpServer.layer(createServer, { port, host: "127.0.0.1" })),
        ),
      );
      const origin = `http://127.0.0.1:${port}`;
      yield* Console.log(
        [
          "",
          `Serving the components of ${organization.slug}/${project.slug} on ${origin}:`,
          Arr.match(components, {
            onEmpty: () => "  none yet. Create one with 'voidhash-cli new <name>'.",
            onNonEmpty: (slugs) => `  ${slugs.join(", ")}`,
          }),
          "",
          `Edit them in ${path.relative(".", workingCopy.componentsDirectory)}/; each change rebuilds its component. A paywall`,
          "editor of this project that you have open picks up every build on its own. Publish",
          "the changes with 'voidhash-cli publish'. Press Ctrl-C to stop.",
          "",
        ].join("\n"),
      );

      // Rebuild a component after a burst of changes under its directory,
      // outside build output; new crates become components, removed ones go.
      yield* fileSystem.watch(workingCopy.componentsDirectory, { recursive: true }).pipe(
        // Events name paths relative to the watched directory (Node's
        // `fs.watch` filenames), which `resolve` also leaves absolute ones.
        Stream.map((event) =>
          path
            .relative(
              workingCopy.componentsDirectory,
              path.resolve(workingCopy.componentsDirectory, event.path),
            )
            .split(/[\\/]/),
        ),
        Stream.filter(
          ([slug = "", inside]) => slug !== "" && !slug.startsWith(".") && inside !== "target",
        ),
        Stream.tap(([slug = ""]) => markChanged([slug])),
        Stream.debounce(QUIET_PERIOD),
        Stream.runForEach(() => buildChanged),
        Effect.catch((error) =>
          Console.error(
            `✗ Watching ${workingCopy.componentsDirectory} stopped (${error.message}); restart voidhash-cli dev to rebuild on changes.`,
          ),
        ),
        Effect.forkScoped,
      );
      yield* Arr.match(components, {
        onEmpty: () => Effect.void,
        onNonEmpty: (slugs) =>
          Console.log(
            `Building ${slugs.join(", ")}; the first build of a component takes longest.`,
          ),
      }).pipe(
        Effect.andThen(markChanged(components)),
        Effect.andThen(buildChanged),
        Effect.forkScoped,
      );
      yield* Effect.sleep(SYNC_INTERVAL).pipe(
        Effect.andThen(sync),
        Effect.forever,
        Effect.forkScoped,
      );

      const reporter = yield* makeDevSessionReporter({
        api: apiClient,
        projectId: project.id,
        url: origin,
        token,
        components: Effect.map(server.status, reportedComponents),
      });
      return yield* runDevSessionReports(
        reporter,
        SubscriptionRef.changes(server.components).pipe(
          Stream.mapEffect(() => server.status),
          Stream.map((status) => fingerprint(reportedComponents(status))),
          Stream.changes,
        ),
      );
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        PlatformError: (error) => Effect.fail(userError(error.message)),
        WorkingCopyStateError: (error) => Effect.fail(userError(error.message)),
        ServeError: (error) =>
          Effect.fail(
            userError(
              `The dev server could not listen on 127.0.0.1:${port}: ${error.message}. Is another voidhash-cli dev running? Pass another --port otherwise.`,
            ),
          ),
      }),
    ),
).pipe(
  Command.withDescription(
    "Build the project's components in .voidhash/ on every change and serve them to your paywall editor.",
  ),
);
