import type { PaywallBuildJsonEncoding, PaywallJsonEncoding } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import { confirmChange, isInteractive, requireItem, requireText } from "../input";
import {
  formatFields,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printItem,
  printJson,
  printTable,
} from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { slugFrom } from "./catalog";
import {
  buildLabel,
  buildStatus,
  deployedBuild,
  describeFailure,
  findBuild,
  kindLabel,
  listBuilds,
  listLocations,
  listPaywalls,
  locationNames,
  locationsShowing,
  PAYWALL_KINDS,
  paywallKind,
  waitForBuild,
} from "./paywalls";

const paywallArgument = Argument.String("paywall").pipe(
  Argument.withDescription("The paywall's slug, name or id"),
  Argument.optional,
);

const archivedOption = Flag.Boolean("archived").pipe(
  Flag.withDescription("List only archived ones"),
  Flag.withDefault(false),
);

const timeoutOption = Flag.Int("timeout").pipe(
  Flag.withDescription("How many seconds to wait for the build (default: 300)"),
  Flag.withDefault(300),
);

/** The paywall a command's argument names, among every paywall of the project. */
const requirePaywall = (projectId: string, input: Option.Option<string>, usage: string) =>
  Effect.flatMap(listPaywalls(projectId), (paywalls) =>
    requireItem(paywallKind, paywalls, input, usage),
  );

/** "build #3, live 2 days ago", or "never deployed". */
const liveLabel = (deployed: Option.Option<PaywallBuildJsonEncoding>, now: DateTime.DateTime) =>
  Option.match(deployed, {
    onNone: () => "never deployed",
    onSome: (build) =>
      `${buildLabel(build)}${build.deployedAt === null ? "" : `, live ${formatTimeAgo(build.deployedAt, now)}`}`,
  });

/** The newest build when it is newer than the deployed one: "build #4 failed". */
const newerLabel = (builds: ReadonlyArray<PaywallBuildJsonEncoding>) => {
  const newest = builds[0];
  const deployed = Option.getOrUndefined(deployedBuild(builds));
  if (newest === undefined || newest.number <= (deployed?.number ?? 0)) return Option.none();
  return Option.some(
    `${buildLabel(newest)} ${newest.status === "ready" ? "ready, not deployed" : newest.status}`,
  );
};

/** `voidhash-cli paywall list [--archived]` */
const paywallListCommand = Command.make(
  "list",
  { project: projectOption, archived: archivedOption, ...outputOptions },
  ({ archived, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const paywalls = (yield* listPaywalls(projectId)).filter(
        (paywall) => paywall.isArchived === archived,
      );
      if (mode === "json") return yield* printJson(paywalls);
      if (mode === "quiet") return yield* printIds(paywalls);

      // Only people see what is live and where, so only they wait for it.
      const now = yield* DateTime.now;
      const [rows, locations] = yield* Effect.all(
        [
          Effect.forEach(
            paywalls,
            (paywall) =>
              api
                .paywallsListBuilds(projectId, paywall.id, { limit: 50 })
                .pipe(Effect.map(({ data }) => ({ paywall, builds: data }))),
            { concurrency: 8 },
          ),
          listLocations(projectId),
        ],
        { concurrency: 2 },
      );
      yield* printTable(
        [
          { header: "NAME", cell: ({ paywall }) => paywall.name },
          { header: "SLUG", cell: ({ paywall }) => paywall.slug },
          { header: "KIND", cell: ({ paywall }) => kindLabel(paywall) },
          { header: "LIVE", cell: ({ builds }) => liveLabel(deployedBuild(builds), now) },
          {
            header: "NEWER",
            cell: ({ builds }) => Option.getOrElse(newerLabel(builds), () => "-"),
          },
          {
            header: "SHOWN AT",
            cell: ({ paywall }) => locationNames(locationsShowing(locations, paywall)),
          },
          { header: "ID", cell: ({ paywall }) => paywall.id },
        ],
        rows,
        archived
          ? "No archived paywalls."
          : "No paywalls yet. Create one with 'voidhash-cli paywall create'.",
      );
    }),
).pipe(
  Command.withDescription(
    "List the project's paywalls with the build end users see and the locations that show it.",
  ),
);

/** `voidhash-cli paywall view <paywall>` */
const paywallViewCommand = Command.make(
  "view",
  { paywall: paywallArgument, project: projectOption, ...outputOptions },
  ({ json, paywall, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requirePaywall(
        projectId,
        paywall,
        "voidhash-cli paywall view <paywall>",
      );
      if (mode === "quiet") return yield* printIds([found]);
      const [builds, locations] = yield* Effect.all(
        [listBuilds(projectId, found.id), listLocations(projectId)],
        { concurrency: 2 },
      );
      const shownAt = locationsShowing(locations, found);
      if (mode === "json") return yield* printJson({ ...found, builds, shownAt });
      const now = yield* DateTime.now;
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          paywallKind.label(found),
          formatFields([
            ["Kind", `${kindLabel(found)}${found.isArchived ? ", archived" : ""}`],
            ["Live", liveLabel(deployedBuild(builds), now)],
            ...Arr.fromOption(Option.map(newerLabel(builds), (newer) => ["Newer", newer] as const)),
            [
              "Shown at",
              locationNames(
                shownAt,
                `no location; show it with 'voidhash-cli location show <location> ${found.slug}'`,
              ),
            ],
            [
              "Builds",
              Arr.match(builds.slice(0, 5), {
                onEmpty: () =>
                  `none; build and deploy it with 'voidhash-cli paywall deploy ${found.slug}'`,
                onNonEmpty: (recent) =>
                  recent
                    .map(
                      (build) =>
                        `#${build.number}  ${buildStatus(build)}  ${formatTimeAgo(build.createdAt, now)}`,
                    )
                    .join("\n"),
              }),
            ],
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `paywalls/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show a paywall: the build end users see, newer builds, and where it is shown.",
  ),
);

const CREATE_USAGE =
  "voidhash-cli paywall create --name <name> [--slug <slug>] [--kind onboarding]";

/** `voidhash-cli paywall create [--name] [--slug] [--kind]` */
const paywallCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(
      Flag.withDescription("What people see, such as Summer sale"),
      Flag.optional,
    ),
    slug: Flag.String("slug").pipe(
      Flag.withDescription(
        "How analytics name it (default: made from the name); it cannot change later",
      ),
      Flag.optional,
    ),
    kind: Flag.ChoiceWithValue("kind", PAYWALL_KINDS).pipe(
      Flag.withDescription("paywall (default) or onboarding, a flow of screens"),
      Flag.withDefault("paywall" as const),
    ),
    ...outputOptions,
  },
  ({ json, kind, name, project, quiet, slug }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const paywallName = yield* requireText(name, {
        flag: "--name",
        message: "Name, as people see it",
        usage: CREATE_USAGE,
      });
      const paywallSlug =
        Option.isSome(slug) || !(yield* isInteractive)
          ? Option.getOrElse(slug, () => slugFrom(paywallName))
          : yield* requireText(slug, {
              flag: "--slug",
              message: "Slug, as analytics name it (it cannot change later)",
              usage: CREATE_USAGE,
              initial: slugFrom(paywallName),
            });
      const created = yield* api
        .paywallsCreate(projectId, { name: paywallName, slug: paywallSlug, kind })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              paywall_slug_taken: `Choose another --slug; 'voidhash-cli paywall view ${paywallSlug}' shows the paywall that has it.`,
            }),
          ),
        );
      yield* printItem(
        mode,
        created,
        [
          `Created ${kindLabel(created).toLowerCase()} ${paywallKind.label(created)}. It is empty, and nobody sees it yet.`,
          "Next:",
          `  Design it in the dashboard: 'voidhash-cli open paywall ${created.slug}'`,
          `  Make the design live: 'voidhash-cli paywall deploy ${created.slug}'`,
          `  Show it in your app: 'voidhash-cli location show <location> ${created.slug}'`,
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Create an empty paywall or onboarding flow."));

/** `voidhash-cli paywall edit <paywall> --name <name>` */
const paywallEditCommand = Command.make(
  "edit",
  {
    paywall: paywallArgument,
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    ...outputOptions,
  },
  ({ json, name, paywall, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli paywall edit <paywall> --name <name>";
      const found = yield* requirePaywall(projectId, paywall, usage);
      const newName = yield* requireText(name, {
        flag: "--name",
        message: "Name",
        usage,
        initial: found.name,
      });
      if (newName === found.name) return yield* printItem(mode, found, "Nothing changed.");
      const updated = yield* api.paywallsUpdate(projectId, found.id, { name: newName });
      yield* printItem(mode, updated, `Renamed ${found.name} to ${paywallKind.label(updated)}.`);
    }),
).pipe(
  Command.withDescription(
    "Rename a paywall. Its slug cannot change; its design changes in the dashboard.",
  ),
);

/** Starts a build of the paywall's current design, and waits for it when asked. */
const startBuild = (
  projectId: string,
  paywall: PaywallJsonEncoding,
  wait: Option.Option<Duration.Duration>,
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const started = yield* api.paywallsCreateBuild(projectId, paywall.id, {}).pipe(
      Effect.mapError((error) =>
        apiError(error, {
          person_credential_required:
            "Sign in as yourself with 'voidhash-cli auth login'; a project key cannot start a build.",
        }),
      ),
    );
    return yield* Option.match(wait, {
      onNone: () => Effect.succeed(started),
      onSome: (timeout) =>
        Console.error(`Building ${buildLabel(started)} of ${paywallKind.label(paywall)}…`).pipe(
          Effect.andThen(waitForBuild(projectId, started, timeout)),
        ),
    });
  });

/** Fails with what to do about a build that did not get ready. */
const requireReady = (paywall: PaywallJsonEncoding, build: PaywallBuildJsonEncoding) => {
  if (build.status === "failed") {
    return Effect.fail(
      userError(
        `Build #${build.number} of ${paywallKind.label(paywall)} failed: ${describeFailure(build)}`,
        {
          hint: `Fix the design in the dashboard ('voidhash-cli open paywall ${paywall.slug}'), then build again.`,
        },
      ),
    );
  }
  if (build.status === "building") {
    return Effect.fail(
      userError(`Build #${build.number} of ${paywallKind.label(paywall)} is still building.`, {
        hint: `Deploy it once it is ready: 'voidhash-cli paywall deploy ${paywall.slug} --build ${build.number}'.`,
      }),
    );
  }
  return Effect.succeed(build);
};

/** `voidhash-cli paywall build <paywall> [--wait] [--timeout <seconds>]` */
const paywallBuildCommand = Command.make(
  "build",
  {
    paywall: paywallArgument,
    project: projectOption,
    wait: Flag.Boolean("wait").pipe(
      Flag.withDescription("Wait until the build is ready or failed"),
      Flag.withDefault(false),
    ),
    timeout: timeoutOption,
    ...outputOptions,
  },
  ({ json, paywall, project, quiet, timeout, wait }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requirePaywall(
        projectId,
        paywall,
        "voidhash-cli paywall build <paywall>",
      );
      const build = yield* startBuild(
        projectId,
        found,
        wait ? Option.some(Duration.seconds(timeout)) : Option.none(),
      );
      if (wait) yield* requireReady(found, build);
      yield* printItem(
        mode,
        build,
        build.status === "building"
          ? `Started ${buildLabel(build)} of ${paywallKind.label(found)}. Deploy it once it is ready: 'voidhash-cli paywall deploy ${found.slug} --build ${build.number}'.`
          : `Build #${build.number} of ${paywallKind.label(found)} is ready. Make it live: 'voidhash-cli paywall deploy ${found.slug} --build ${build.number}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Build the paywall's current design without deploying it. --wait waits for the result and shows why a build failed.",
  ),
);

/** `voidhash-cli paywall deploy <paywall> [--build <number|id>] [--timeout <seconds>] [--yes]` */
const paywallDeployCommand = Command.make(
  "deploy",
  {
    paywall: paywallArgument,
    project: projectOption,
    build: Flag.String("build").pipe(
      Flag.withDescription(
        "Deploy this existing build, by number or id, such as an older one to roll back (default: build the current design)",
      ),
      Flag.optional,
    ),
    timeout: timeoutOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ build, json, paywall, project, quiet, timeout, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requirePaywall(
        projectId,
        paywall,
        "voidhash-cli paywall deploy <paywall> [--build <number>]",
      );
      const builds = yield* listBuilds(projectId, found.id);
      const locations = locationsShowing(yield* listLocations(projectId), found);
      // Without a terminal to confirm in, say so before building anything.
      if (Arr.isReadonlyArrayNonEmpty(locations) && !yes && !(yield* isInteractive)) {
        return yield* Effect.fail(
          userError(
            `Deploying ${paywallKind.label(found)} changes what end users see at ${locationNames(locations)}.`,
            {
              hint: "There is no terminal to ask in; pass --yes to deploy without asking.",
              exitCode: ExitCode.usage,
            },
          ),
        );
      }
      const before = deployedBuild(builds);
      const chosen = yield* Option.match(build, {
        onNone: () => startBuild(projectId, found, Option.some(Duration.seconds(timeout))),
        onSome: (input) =>
          Option.match(findBuild(builds, input), {
            onSome: (existing) => waitForBuild(projectId, existing, Duration.seconds(timeout)),
            onNone: () =>
              Effect.fail(
                userError(`${paywallKind.label(found)} has no build ${input}.`, {
                  hint: `'voidhash-cli paywall view ${found.slug}' lists its recent builds.`,
                  exitCode: ExitCode.notFound,
                }),
              ),
          }),
      });
      const ready = yield* requireReady(found, chosen);
      if (ready.isDeployed) {
        return yield* printItem(
          mode,
          ready,
          `Build #${ready.number} of ${paywallKind.label(found)} is already live; nothing changed.`,
        );
      }

      const replacing = Option.match(before, {
        onNone: () => "its first live build",
        onSome: (live) =>
          live.number > ready.number
            ? `rolling back from ${buildLabel(live)}`
            : `replacing ${buildLabel(live)}`,
      });
      if (Arr.isReadonlyArrayNonEmpty(locations)) {
        yield* confirmChange({
          yes,
          message: `Deploy ${buildLabel(ready)} of ${paywallKind.label(found)} in ${projectKind(context.session).label(context.project)}, ${replacing}? End users at ${locationNames(locations)} see it on their next visit.`,
        });
      }
      const deployed = yield* api.paywallsDeployBuild(projectId, found.id, ready.id).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            paywall_build_components_unavailable: `Update those components in the paywall ('voidhash-cli open paywall ${found.slug}'), then deploy again.`,
          }),
        ),
      );
      yield* printItem(
        mode,
        deployed,
        [
          `Deployed ${buildLabel(deployed)} of ${paywallKind.label(found)}, ${replacing}.`,
          Arr.match(locations, {
            onEmpty: () =>
              `No location shows it yet: 'voidhash-cli location show <location> ${found.slug}'.`,
            onNonEmpty: (some) => `Live at ${locationNames(some)}.`,
          }),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Make a paywall's design live: build it, wait for the build, and deploy it to every location that shows the paywall. --build deploys an existing build instead, such as an older one. Asks first when end users see it; --yes skips that.",
  ),
);

/** `voidhash-cli paywall archive|unarchive <paywall>` */
const archiveCommand = (archive: boolean) =>
  Command.make(
    archive ? "archive" : "unarchive",
    { paywall: paywallArgument, project: projectOption, ...outputOptions },
    ({ json, paywall, project, quiet }) =>
      Effect.gen(function* () {
        const mode = yield* outputModeOf({ json, quiet });
        const api = yield* ApiClient;
        const projectId = (yield* resolveProject(project)).project.id;
        const found = yield* requirePaywall(
          projectId,
          paywall,
          `voidhash-cli paywall ${archive ? "archive" : "unarchive"} <paywall>`,
        );
        if (found.isArchived === archive) {
          return yield* printItem(
            mode,
            found,
            `${paywallKind.label(found)} is ${archive ? "already" : "not"} archived; nothing changed.`,
          );
        }
        const updated = archive
          ? yield* api.paywallsArchive(projectId, found.id)
          : yield* api.paywallsUnarchive(projectId, found.id);
        yield* printItem(
          mode,
          updated,
          archive
            ? `Archived ${paywallKind.label(updated)}. Locations that show it keep showing its live build.`
            : `Restored ${paywallKind.label(updated)} from the archive.`,
        );
      }),
  ).pipe(
    Command.withDescription(
      archive
        ? "Archive a paywall to tidy the list. Locations that show it keep showing its live build."
        : "Restore an archived paywall.",
    ),
  );

/** `voidhash-cli paywall delete <paywall> [--yes]` */
const paywallDeleteCommand = Command.make(
  "delete",
  { paywall: paywallArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, paywall, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requirePaywall(
        projectId,
        paywall,
        "voidhash-cli paywall delete <paywall> --yes",
      );
      const shownAt = locationsShowing(yield* listLocations(projectId), found);
      if (Arr.isReadonlyArrayNonEmpty(shownAt)) {
        return yield* Effect.fail(
          userError(
            `${paywallKind.label(found)} cannot be deleted while ${locationNames(shownAt)} ${shownAt.length === 1 ? "shows" : "show"} it.`,
            {
              hint: `Show another paywall there ('voidhash-cli location show <location> <paywall>') or clear it ('voidhash-cli location clear <location>') first, or archive it instead: 'voidhash-cli paywall archive ${found.slug}'.`,
            },
          ),
        );
      }
      yield* confirmChange({
        yes,
        message: `Delete ${paywallKind.label(found)} with its design and builds from ${projectKind(context.session).label(context.project)}? This cannot be undone.`,
      });
      yield* api.paywallsDelete(projectId, found.id);
      yield* printItem(mode, found, `Deleted ${paywallKind.label(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete a paywall that no location shows, with its design and builds. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli paywall …` */
export const paywallCommand = Command.make("paywall").pipe(
  Command.withAlias("paywalls"),
  Command.withDescription(
    "Paywalls and onboarding flows: list and view them, create them, build and deploy their designs, archive and delete them.",
  ),
  Command.withSubcommands([
    paywallListCommand,
    paywallViewCommand,
    paywallCreateCommand,
    paywallEditCommand,
    paywallBuildCommand,
    paywallDeployCommand,
    archiveCommand(true),
    archiveCommand(false),
    paywallDeleteCommand,
  ]),
);
