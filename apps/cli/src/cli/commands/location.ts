import type {
  PaywallJsonEncoding,
  PaywallLocationJsonEncoding,
  PaywallLocationPinJsonEncoding,
  PaywallLocationRuleJsonEncoding,
  PaywallLocationShowingJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import { confirmChange, findItem, isInteractive, requireItem, requireText } from "../input";
import {
  formatDate,
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
import { describeCondition, parseCondition, parseIdentity } from "./flag";
import {
  buildLabel,
  deployedBuild,
  describeShowing,
  listBuilds,
  listExperiments,
  listLocations,
  listPaywalls,
  locationKind,
  paywallKind,
} from "./paywalls";

const locationArgument = Argument.String("location").pipe(
  Argument.withDescription("The location's slug, name or id"),
  Argument.optional,
);

/** `--env production|test`, for a command that changes what a location shows in one environment. */
const environmentOption = Flag.Literals("env", ["production", "test"]).pipe(
  Flag.withDescription(
    "production (the default), or test, which only apps using a test key see; test follows production until the location is given a test showing of its own",
  ),
  Flag.withDefault("production" as const),
);

const personArgument = Argument.String("person").pipe(
  Argument.withDescription(
    "The end user: an email, a distinct id or a person id (person_…); prefix email:, distinct_id: or person_id: to say which",
  ),
  Argument.optional,
);

/** `--env production|test`, for a pin: whose apps it answers. */
const pinEnvironmentOption = Flag.Literals("env", ["production", "test"]).pipe(
  Flag.withDescription(
    "production (the default), which answers every app, or test, which answers apps using a test key only and wins there",
  ),
  Flag.withDefault("production" as const),
);

/** The end user a pin names; a pin cannot name one by an external id. */
const requirePinned = (person: Option.Option<string>, usage: string) =>
  Effect.gen(function* () {
    const identity = parseIdentity(
      yield* requireText(person, {
        flag: "<person>",
        message: "Email, distinct id or person id",
        usage,
      }),
    );
    if (identity.type === "external_id") {
      return yield* Effect.fail(
        userError("A pin names an end user by email, distinct id or person id.", {
          hint: "An external id cannot be pinned; name them by one of those instead.",
          exitCode: ExitCode.usage,
        }),
      );
    }
    return { type: identity.type, value: identity.value };
  });

/** A pin's end user as one path segment: `email:alice%40example.com`. */
const pinSegment = (identity: { readonly type: string; readonly value: string }) =>
  `${identity.type}:${encodeURIComponent(identity.value)}`;

/** Every end user pinned at a location, in both environments, newest first. */
const listPins = (projectId: string, paywallLocationId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) => api.paywallLocationsListPins(projectId, paywallLocationId, query)),
  );

/** A pin as a line: "email ada@example.com → Annual upsell, test keys only (QA)". */
const describePin = (
  pin: PaywallLocationPinJsonEncoding,
  paywalls: ReadonlyArray<PaywallJsonEncoding>,
) => {
  const paywall = paywalls.find(({ id }) => id === pin.paywallId);
  return `${pin.identityType.replace("_", " ")} ${pin.identityValue} → ${paywall === undefined ? pin.paywallId : paywallKind.label(paywall)}${pin.environment === "test" ? ", test keys only" : ""}${pin.note === null ? "" : ` (${pin.note})`}`;
};

/** The location a command's argument names, among every location of the project. */
const requireLocation = (projectId: string, input: Option.Option<string>, usage: string) =>
  Effect.flatMap(listLocations(projectId), (locations) =>
    requireItem(locationKind, locations, input, usage),
  );

/**
 * Describes `showings` as people read them: the paywalls they serve by name,
 * and the experiments by name when a showing is one.
 */
const showingDescriber = (
  projectId: string,
  showings: ReadonlyArray<PaywallLocationShowingJsonEncoding>,
) =>
  Effect.gen(function* () {
    const [paywalls, experiments] = yield* Effect.all(
      [
        listPaywalls(projectId),
        showings.some(({ type }) => type === "feature_flag")
          ? listExperiments(projectId)
          : Effect.succeed([]),
      ],
      { concurrency: 2 },
    );
    return (showing: PaywallLocationShowingJsonEncoding) =>
      describeShowing(showing, paywalls, experiments);
  });

/** What the locations show, in production and to test keys alone. */
const showingsOf = (locations: ReadonlyArray<PaywallLocationJsonEncoding>) =>
  locations.flatMap(({ showing, testShowing }) => [
    ...(showing === null ? [] : [showing]),
    ...(testShowing === null ? [] : [testShowing]),
  ]);

/** The paywall people name to show, once it has a live build to show. */
const requireShowable = (projectId: string, input: string) =>
  Effect.gen(function* () {
    const paywall = yield* Effect.flatMap(listPaywalls(projectId), (paywalls) =>
      findItem(paywallKind, paywalls, input),
    );
    const live = deployedBuild(yield* listBuilds(projectId, paywall.id));
    if (Option.isNone(live)) {
      return yield* Effect.fail(
        userError(`${paywallKind.label(paywall)} has no live build, so there is nothing to show.`, {
          hint: `Deploy it first: 'voidhash-cli paywall deploy ${paywall.slug}'.`,
        }),
      );
    }
    return { paywall, build: live.value };
  });

/** `voidhash-cli location list [--archived]` */
const locationListCommand = Command.make(
  "list",
  {
    project: projectOption,
    archived: Flag.Boolean("archived").pipe(
      Flag.withDescription("List only archived ones"),
      Flag.withDefault(false),
    ),
    ...outputOptions,
  },
  ({ archived, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const locations = (yield* listLocations(projectId)).filter(
        (location) => location.isArchived === archived,
      );
      if (mode === "json") return yield* printJson(locations);
      if (mode === "quiet") return yield* printIds(locations);
      const now = yield* DateTime.now;
      const describe = yield* showingDescriber(projectId, showingsOf(locations));
      yield* printTable(
        [
          { header: "NAME", cell: (location) => location.name },
          { header: "SLUG", cell: (location) => location.slug },
          {
            header: "SHOWS",
            cell: ({ showing }) => (showing === null ? "nothing" : describe(showing)),
          },
          {
            header: "SINCE",
            cell: ({ showing }) => (showing === null ? "-" : formatTimeAgo(showing.startedAt, now)),
          },
          // Only when a location shows test keys something of its own; otherwise test is the same.
          ...(locations.some(({ testShowing }) => testShowing !== null)
            ? [
                {
                  header: "IN TEST",
                  cell: ({ testShowing }: PaywallLocationJsonEncoding) =>
                    testShowing === null ? "the same" : describe(testShowing),
                },
              ]
            : []),
          { header: "ID", cell: (location) => location.id },
        ],
        locations,
        archived
          ? "No archived locations."
          : "No locations yet. Create one with 'voidhash-cli location create'.",
      );
    }),
).pipe(
  Command.withDescription(
    "List the places in your apps that show a paywall, with what each shows now, and what apps using a test key see where that differs.",
  ),
);

/** `voidhash-cli location view <location>` */
const locationViewCommand = Command.make(
  "view",
  { location: locationArgument, project: projectOption, ...outputOptions },
  ({ json, location, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireLocation(
        projectId,
        location,
        "voidhash-cli location view <location>",
      );
      if (mode === "quiet") return yield* printIds([found]);
      const history = (yield* api.paywallLocationsListShowings(projectId, found.id, { limit: 5 }))
        .data;
      const pins = yield* listPins(projectId, found.id);
      const rules = yield* listRules(projectId, found.id);
      if (mode === "json") return yield* printJson({ ...found, pins, rules, history });
      const pinnedTo =
        Arr.isReadonlyArrayEmpty(pins) && Arr.isReadonlyArrayEmpty(rules)
          ? []
          : yield* listPaywalls(projectId);
      const now = yield* DateTime.now;
      const describe = yield* showingDescriber(projectId, [...history, ...showingsOf([found])]);
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          locationKind.label(found),
          formatFields([
            [
              "Shows",
              found.isArchived
                ? "nothing: it is archived"
                : found.showing === null
                  ? `nothing; show a paywall with 'voidhash-cli location show ${found.slug} <paywall>'`
                  : `${describe(found.showing)}, since ${formatTimeAgo(found.showing.startedAt, now)}`,
            ],
            ...(found.isArchived
              ? []
              : [
                  [
                    "In test",
                    found.testShowing === null
                      ? "follows production: apps using a test key get the same"
                      : `${describe(found.testShowing)}, since ${formatTimeAgo(found.testShowing.startedAt, now)}; 'voidhash-cli location clear ${found.slug} --env test' follows production again`,
                  ] as const,
                ]),
            ...(Arr.isReadonlyArrayEmpty(pins)
              ? []
              : [["Pinned", pins.map((pin) => describePin(pin, pinnedTo)).join("\n")] as const]),
            ...(Arr.isReadonlyArrayEmpty(rules)
              ? []
              : [["Rules", rules.map((rule) => describeRule(rule, pinnedTo)).join("\n")] as const]),
            ...Arr.fromNullishOr(found.description).map(
              (description) => ["Description", description] as const,
            ),
            [
              "Before",
              Arr.match(
                history.filter(({ endedAt }) => endedAt !== null),
                {
                  onEmpty: () => "nothing",
                  onNonEmpty: (past) =>
                    past
                      .map(
                        (showing) =>
                          `${describe(showing)}${showing.environment === "test" ? " in test" : ""}, until ${formatDate(showing.endedAt ?? "")}`,
                      )
                      .join("\n"),
                },
              ),
            ],
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `settings/paywall-locations/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show a location: what it shows now, what apps using a test key see, the end users pinned to a paywall of their own, and what it showed before.",
  ),
);

const CREATE_USAGE =
  "voidhash-cli location create --name <name> [--slug <slug>] [--show <paywall>]";

/** `voidhash-cli location create [--name] [--slug] [--description] [--show <paywall>]` */
const locationCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(
      Flag.withDescription("What people see, such as Onboarding end"),
      Flag.optional,
    ),
    slug: Flag.String("slug").pipe(
      Flag.withDescription(
        "What your app asks for (default: made from the name); it cannot change later",
      ),
      Flag.optional,
    ),
    description: Flag.String("description").pipe(
      Flag.withDescription("Where in the app it is"),
      Flag.optional,
    ),
    show: Flag.String("show").pipe(
      Flag.withDescription("A paywall with a live build to show there right away"),
      Flag.optional,
    ),
    ...outputOptions,
  },
  ({ description, json, name, project, quiet, show, slug }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const locationName = yield* requireText(name, {
        flag: "--name",
        message: "Name, as people see it",
        usage: CREATE_USAGE,
      });
      const locationSlug =
        Option.isSome(slug) || !(yield* isInteractive)
          ? Option.getOrElse(slug, () => slugFrom(locationName))
          : yield* requireText(slug, {
              flag: "--slug",
              message: "Slug, as your app asks for it (it cannot change later)",
              usage: CREATE_USAGE,
              initial: slugFrom(locationName),
            });
      // Find the paywall first, so one that cannot be shown creates nothing.
      const shown = yield* Effect.transposeOption(
        Option.map(show, (input) => requireShowable(projectId, input)),
      );
      const created = yield* api
        .paywallLocationsCreate(projectId, {
          name: locationName,
          slug: locationSlug,
          description: Option.getOrUndefined(description),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              paywall_location_slug_taken: `Choose another --slug; 'voidhash-cli location view ${locationSlug}' shows the location that has it.`,
            }),
          ),
        );
      const location = yield* Option.match(shown, {
        onNone: () => Effect.succeed(created),
        onSome: ({ paywall }) =>
          api
            .paywallLocationsSetShowing(projectId, created.id, {
              payload: { paywallId: paywall.id },
            })
            .pipe(Effect.andThen(api.paywallLocationsGet(projectId, created.id))),
      });
      yield* printItem(
        mode,
        location,
        Option.match(shown, {
          onNone: () =>
            [
              `Created ${locationKind.label(location)}. It shows nothing yet.`,
              `Show a paywall there: 'voidhash-cli location show ${location.slug} <paywall>'`,
              `Your app asks for it as "${location.slug}".`,
            ].join("\n"),
          onSome: ({ paywall, build }) =>
            `Created ${locationKind.label(location)}, showing ${paywallKind.label(paywall)}, ${buildLabel(build)}. Your app asks for it as "${location.slug}".`,
        }),
      );
    }),
).pipe(
  Command.withDescription(
    "Create a place in your apps that shows a paywall, which the app asks for by its slug.",
  ),
);

/** `voidhash-cli location edit <location> [--name] [--description | --clear-description]` */
const locationEditCommand = Command.make(
  "edit",
  {
    location: locationArgument,
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    description: Flag.String("description").pipe(
      Flag.withDescription("Its new description"),
      Flag.optional,
    ),
    clearDescription: Flag.Boolean("clear-description").pipe(
      Flag.withDescription("Remove its description"),
      Flag.withDefault(false),
    ),
    ...outputOptions,
  },
  ({ clearDescription, description, json, location, name, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (clearDescription && Option.isSome(description)) {
        return yield* Effect.fail(
          userError("Pass --description or --clear-description, not both.", {
            exitCode: ExitCode.usage,
          }),
        );
      }
      if (Option.isNone(name) && Option.isNone(description) && !clearDescription) {
        return yield* Effect.fail(
          userError("Nothing to change.", {
            hint: "Pass --name, --description or --clear-description. A location's slug cannot change.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireLocation(
        projectId,
        location,
        "voidhash-cli location edit <location> --name <name>",
      );
      const updated = yield* api.paywallLocationsUpdate(projectId, found.id, {
        name: Option.getOrUndefined(name),
        description: clearDescription ? null : Option.getOrUndefined(description),
      });
      yield* printItem(mode, updated, `Updated ${locationKind.label(updated)}.`);
    }),
).pipe(
  Command.withDescription(
    "Rename a location or change its description. Its slug cannot change, because apps ask for it.",
  ),
);

/** `voidhash-cli location show <location> <paywall> [--env] [--yes]` */
const locationShowCommand = Command.make(
  "show",
  {
    location: locationArgument,
    paywall: Argument.String("paywall").pipe(
      Argument.withDescription("The paywall's slug, name or id"),
      Argument.optional,
    ),
    project: projectOption,
    env: environmentOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ env, json, location, paywall, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const usage = "voidhash-cli location show <location> <paywall> [--env test]";
      const found = yield* requireLocation(projectId, location, usage);
      if (found.isArchived) {
        return yield* Effect.fail(
          userError(`${locationKind.label(found)} is archived, so it cannot show anything again.`, {
            hint: "Create a new location with 'voidhash-cli location create'.",
          }),
        );
      }
      const paywallInput = yield* Option.match(paywall, {
        onSome: Effect.succeed,
        onNone: () =>
          Effect.flatMap(listPaywalls(projectId), (paywalls) =>
            requireItem(
              paywallKind,
              paywalls.filter(({ isArchived }) => !isArchived),
              Option.none(),
              usage,
            ),
          ).pipe(Effect.map(({ id }) => id)),
      });
      const { paywall: chosen, build } = yield* requireShowable(projectId, paywallInput);
      const describe = yield* showingDescriber(projectId, showingsOf([found]));
      const setShowing = api
        .paywallLocationsSetShowing(projectId, found.id, {
          params: { environment: env },
          payload: { paywallId: chosen.id },
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              paywall_not_deployed: `Deploy it first: 'voidhash-cli paywall deploy ${chosen.slug}'.`,
            }),
          ),
        );
      if (env === "test") {
        if (found.testShowing?.paywallId === chosen.id) {
          return yield* printItem(
            mode,
            found,
            `${locationKind.label(found)} already shows ${paywallKind.label(chosen)} in test; nothing changed.`,
          );
        }
        // Only apps using a test key see it, so there is nothing end users lose to confirm.
        yield* setShowing;
        const updated = yield* api.paywallLocationsGet(projectId, found.id);
        return yield* printItem(
          mode,
          updated,
          [
            `${locationKind.label(updated)} now shows ${paywallKind.label(chosen)}, ${buildLabel(build)}, to apps using a test key. Production keeps showing ${found.showing === null ? "nothing" : describe(found.showing)}.`,
            `  Show it to everyone:          'voidhash-cli location show ${updated.slug} ${chosen.slug}'`,
            `  Follow production again:      'voidhash-cli location clear ${updated.slug} --env test'`,
          ].join("\n"),
        );
      }
      if (found.showing?.type === "paywall" && found.showing.paywallId === chosen.id) {
        return yield* printItem(
          mode,
          found,
          `${locationKind.label(found)} already shows ${paywallKind.label(chosen)}; nothing changed.`,
        );
      }
      if (found.showing !== null) {
        yield* confirmChange({
          yes,
          message: `Show ${paywallKind.label(chosen)}, ${buildLabel(build)}, at ${locationKind.label(found)} in ${projectKind(context.session).label(context.project)} instead of ${describe(found.showing)}?${found.showing.type === "feature_flag" ? " This ends the experiment's split there." : ""} End users there see it on their next visit.`,
        });
      }
      yield* setShowing;
      const updated = yield* api.paywallLocationsGet(projectId, found.id);
      yield* printItem(
        mode,
        updated,
        `${locationKind.label(updated)} now shows ${paywallKind.label(chosen)}, ${buildLabel(build)}. Deploying a newer build of it updates the location too.${updated.testShowing === null ? "" : " Apps using a test key keep seeing its test showing."}`,
      );
    }),
).pipe(
  Command.withDescription(
    "Show a paywall's live build at a location from now on. Asks first when it replaces what end users see there; --yes skips that. With --env test only apps using a test key see it, and production keeps what it shows.",
  ),
);

/** `voidhash-cli location clear <location> [--env] [--yes]` */
const locationClearCommand = Command.make(
  "clear",
  {
    location: locationArgument,
    project: projectOption,
    env: environmentOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ env, json, location, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireLocation(
        projectId,
        location,
        "voidhash-cli location clear <location> [--env test] --yes",
      );
      if (env === "test") {
        if (found.testShowing === null) {
          return yield* printItem(
            mode,
            found,
            `${locationKind.label(found)}'s test already follows production; nothing changed.`,
          );
        }
        // Test keys go back to what production shows; nothing changes for end users.
        yield* api.paywallLocationsClearShowing(projectId, found.id, { environment: "test" });
        const updated = yield* api.paywallLocationsGet(projectId, found.id);
        const describe = yield* showingDescriber(projectId, showingsOf([updated]));
        return yield* printItem(
          mode,
          updated,
          `${locationKind.label(updated)}: test follows production again (${updated.showing === null ? "nothing" : describe(updated.showing)}).`,
        );
      }
      if (found.showing === null) {
        return yield* printItem(
          mode,
          found,
          `${locationKind.label(found)} already shows nothing; nothing changed.`,
        );
      }
      const describe = yield* showingDescriber(projectId, [found.showing]);
      yield* confirmChange({
        yes,
        message: `Stop showing ${describe(found.showing)} at ${locationKind.label(found)} in ${projectKind(context.session).label(context.project)}? Apps that ask for "${found.slug}" get no paywall from then on.`,
      });
      yield* api.paywallLocationsClearShowing(projectId, found.id);
      const updated = yield* api.paywallLocationsGet(projectId, found.id);
      yield* printItem(
        mode,
        updated,
        `${locationKind.label(updated)} shows nothing now.${updated.testShowing === null ? "" : " Apps using a test key keep seeing its test showing."}`,
      );
    }),
).pipe(
  Command.withDescription(
    "Stop showing anything at a location, so apps asking for it get no paywall. Asks first; --yes skips that. With --env test it ends the location's test showing instead, so apps using a test key get what production shows again.",
  ),
);

/** `voidhash-cli location pin <location> <person> <paywall> [--env] [--note]` */
const locationPinCommand = Command.make(
  "pin",
  {
    location: locationArgument,
    person: personArgument,
    paywall: Argument.String("paywall").pipe(
      Argument.withDescription("The paywall's slug, name or id"),
      Argument.optional,
    ),
    note: Flag.String("note").pipe(Flag.withDescription("Why, such as QA"), Flag.optional),
    env: pinEnvironmentOption,
    project: projectOption,
    ...outputOptions,
  },
  ({ env, json, location, note, paywall, person, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli location pin <location> <person> <paywall> [--env test]";
      const found = yield* requireLocation(projectId, location, usage);
      if (found.isArchived) {
        return yield* Effect.fail(
          userError(`${locationKind.label(found)} is archived, so it cannot show anything again.`, {
            hint: "Create a new location with 'voidhash-cli location create'.",
          }),
        );
      }
      const identity = yield* requirePinned(person, usage);
      const paywallInput = yield* Option.match(paywall, {
        onSome: Effect.succeed,
        onNone: () =>
          Effect.flatMap(listPaywalls(projectId), (paywalls) =>
            requireItem(
              paywallKind,
              paywalls.filter(({ isArchived }) => !isArchived),
              Option.none(),
              usage,
            ),
          ).pipe(Effect.map(({ id }) => id)),
      });
      const { paywall: chosen, build } = yield* requireShowable(projectId, paywallInput);
      const pin = yield* api
        .paywallLocationsUpsertPin(projectId, found.id, pinSegment(identity), {
          params: { environment: env },
          payload: { paywallId: chosen.id, note: Option.getOrNull(note) },
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              paywall_not_deployed: `Deploy it first: 'voidhash-cli paywall deploy ${chosen.slug}'.`,
              paywall_location_pin_limit: `'voidhash-cli location view ${found.slug}' lists its pins; remove one with 'voidhash-cli location unpin'.`,
            }),
          ),
        );
      if (mode === "json") return yield* printJson(pin);
      if (mode === "quiet") return yield* printIds([pin]);
      const who = `${pin.identityType.replace("_", " ")} ${pin.identityValue}`;
      // What the location shows everyone else there: test follows production without its own.
      const shown = env === "test" ? (found.testShowing ?? found.showing) : found.showing;
      yield* Console.log(
        [
          `${who} now sees ${paywallKind.label(chosen)}, ${buildLabel(build)}, at ${locationKind.label(found)}${env === "test" ? " in apps using a test key" : ""}, whatever it shows everyone else.`,
          ...(shown === null
            ? [
                `${locationKind.label(found)} shows nothing ${env === "test" ? "to test keys" : "in production"}, and a pin shows only where the location shows something: 'voidhash-cli location show ${found.slug} <paywall>'.`,
              ]
            : shown.type === "feature_flag"
              ? ["They are outside the experiment running there: not in an arm, and not counted."]
              : []),
          `  Undo it: 'voidhash-cli location unpin ${found.slug} ${pin.identityType}:${pin.identityValue}${env === "test" ? " --env test" : ""}'`,
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show one end user a paywall of their own at a location, whatever it shows everyone else; they are outside an experiment running there. With --env test the pin answers apps using a test key only.",
  ),
);

/** `voidhash-cli location unpin <location> <person> [--env]` */
const locationUnpinCommand = Command.make(
  "unpin",
  {
    location: locationArgument,
    person: personArgument,
    env: pinEnvironmentOption,
    project: projectOption,
  },
  ({ env, location, person, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli location unpin <location> <person> [--env test]";
      const found = yield* requireLocation(projectId, location, usage);
      const identity = yield* requirePinned(person, usage);
      yield* api
        .paywallLocationsRemovePin(projectId, found.id, pinSegment(identity), { environment: env })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              paywall_location_pin_not_found: `'voidhash-cli location view ${found.slug}' lists its pins in each environment.`,
            }),
          ),
        );
      yield* Console.log(
        `Removed the ${env} pin of ${identity.type.replace("_", " ")} ${identity.value} at ${locationKind.label(found)}; they see what it shows everyone else again.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Remove an end user's pin at a location, in production or in test with --env test, so they see what it shows everyone else again.",
  ),
);

const listRules = (projectId: string, paywallLocationId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) => api.paywallLocationsListRules(projectId, paywallLocationId, query)),
  );

/** `--env production|test`, for a rule: whose apps it answers. */
const ruleEnvironmentOption = Flag.Literals("env", ["production", "test"]).pipe(
  Flag.withDescription(
    "production (the default), whose rules answer every app, or test, whose rules answer apps using a test key only and are read first there",
  ),
  Flag.withDefault("production" as const),
);

/** A rule as a line: "1. everyone whose country is DE or AT → Annual upsell (Germany)". */
const describeRule = (
  rule: PaywallLocationRuleJsonEncoding,
  paywalls: ReadonlyArray<PaywallJsonEncoding>,
) => {
  const paywall = paywalls.find(({ id }) => id === rule.paywallId);
  return `${rule.position + 1}. everyone whose ${rule.conditions.map(describeCondition).join(" and ")} → ${paywall === undefined ? rule.paywallId : paywallKind.label(paywall)}${rule.environment === "test" ? ", test keys only" : ""}${rule.name === null ? "" : ` (${rule.name})`}`;
};

/** A rule as the API takes it back when the environment's rules are replaced. */
const ruleBody = (rule: PaywallLocationRuleJsonEncoding) => ({
  conditions: rule.conditions,
  name: rule.name,
  paywallId: rule.paywallId,
});

/** `voidhash-cli location rule add <location> <paywall> --when … [--name] [--first] [--env]` */
const locationRuleAddCommand = Command.make(
  "add",
  {
    location: locationArgument,
    paywall: Argument.String("paywall").pipe(
      Argument.withDescription("The paywall's slug, name or id"),
      Argument.optional,
    ),
    when: Flag.String("when").pipe(
      Flag.withDescription(
        "A condition the rule matches by, such as 'country in DE,AT', 'app_version >= 2.4', 'trait:plan in pro' or 'trait:beta is set'; repeat it, and all must hold. Compares platform, app_version, os_version, country, locale or trait:<key> with in, not in, >=, <, is set or is not set",
      ),
      Flag.atLeast(0),
    ),
    name: Flag.String("name").pipe(Flag.withDescription("A name for the rule"), Flag.optional),
    first: Flag.Boolean("first").pipe(
      Flag.withDescription("Read it before the location's other rules instead of after them"),
      Flag.withDefault(false),
    ),
    env: ruleEnvironmentOption,
    project: projectOption,
    ...outputOptions,
  },
  ({ env, first, json, location, name, paywall, project, quiet, when }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage =
        "voidhash-cli location rule add <location> <paywall> --when <condition> [--env test]";
      const found = yield* requireLocation(projectId, location, usage);
      if (Arr.isReadonlyArrayEmpty(when)) {
        return yield* Effect.fail(
          userError("A rule needs at least one --when condition, or it matches nobody.", {
            hint: `Such as: ${usage.replace("<condition>", "'country in DE,AT'")}`,
            exitCode: ExitCode.usage,
          }),
        );
      }
      const conditions = yield* Effect.forEach(when, parseCondition, { concurrency: 1 });
      const paywallInput = yield* Option.match(paywall, {
        onSome: Effect.succeed,
        onNone: () =>
          Effect.flatMap(listPaywalls(projectId), (paywalls) =>
            requireItem(
              paywallKind,
              paywalls.filter(({ isArchived }) => !isArchived),
              Option.none(),
              usage,
            ),
          ).pipe(Effect.map(({ id }) => id)),
      });
      const { paywall: chosen } = yield* requireShowable(projectId, paywallInput);
      const existing = (yield* listRules(projectId, found.id))
        .filter((rule) => rule.environment === env)
        .map(ruleBody);
      const added = { conditions, name: Option.getOrNull(name), paywallId: chosen.id };
      const saved = yield* api
        .paywallLocationsReplaceRules(projectId, found.id, {
          params: { environment: env },
          payload: { rules: first ? [added, ...existing] : [...existing, added] },
        })
        .pipe(Effect.mapError((error) => apiError(error)));
      const rule = saved.rules[first ? 0 : saved.rules.length - 1];
      if (mode === "json") return yield* printJson(saved);
      if (mode === "quiet") return yield* printIds(rule === undefined ? [] : [rule]);
      yield* Console.log(
        [
          `${locationKind.label(found)} now shows ${paywallKind.label(chosen)} to everyone whose ${conditions.map(describeCondition).join(" and ")}${env === "test" ? ", in apps using a test key" : ""}. It is rule ${(rule?.position ?? 0) + 1} of ${saved.rules.length}; the first rule that matches decides.`,
          ...(found[env === "test" ? "testShowing" : "showing"] === null && found.showing === null
            ? [
                `${locationKind.label(found)} shows nothing, and a rule shows only where the location shows something: 'voidhash-cli location show ${found.slug} <paywall>'.`,
              ]
            : []),
          `  Undo it: 'voidhash-cli location rule remove ${found.slug} ${(rule?.position ?? 0) + 1}${env === "test" ? " --env test" : ""}'`,
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show another paywall at a location to everyone its --when conditions hold for, in place of what the location shows everyone else; they are outside an experiment running there. Rules are read in order after pins, and the first that matches decides. With --env test, only apps using a test key are answered.",
  ),
);

/** `voidhash-cli location rule remove <location> <position> [--env]` */
const locationRuleRemoveCommand = Command.make(
  "remove",
  {
    location: locationArgument,
    position: Argument.String("position").pipe(
      Argument.withDescription("The rule's number, as 'location view' lists it, from 1"),
    ),
    env: ruleEnvironmentOption,
    project: projectOption,
  },
  ({ env, location, position, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli location rule remove <location> <position> [--env test]";
      const found = yield* requireLocation(projectId, location, usage);
      const rules = (yield* listRules(projectId, found.id)).filter(
        (rule) => rule.environment === env,
      );
      const number = Number(position);
      const removed = rules.find((rule) => rule.position === number - 1);
      if (removed === undefined) {
        return yield* Effect.fail(
          userError(
            `${locationKind.label(found)} has no ${env} rule ${position}; it has ${rules.length}.`,
            { hint: `'voidhash-cli location view ${found.slug}' lists its rules.` },
          ),
        );
      }
      yield* api
        .paywallLocationsReplaceRules(projectId, found.id, {
          params: { environment: env },
          payload: { rules: rules.filter((rule) => rule !== removed).map(ruleBody) },
        })
        .pipe(Effect.mapError((error) => apiError(error)));
      yield* Console.log(
        `Removed ${env} rule ${position} at ${locationKind.label(found)} (everyone whose ${removed.conditions.map(describeCondition).join(" and ")}); they see what the next rule that matches gives them, or what it shows everyone else.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Remove one of a location's rules by its number, in production or in test with --env test.",
  ),
);

/** `voidhash-cli location rule …` */
const locationRuleCommand = Command.make("rule").pipe(
  Command.withDescription(
    "Show another paywall at a location to the end users a rule matches: add a rule with --when conditions, or remove one.",
  ),
  Command.withSubcommands([locationRuleAddCommand, locationRuleRemoveCommand]),
);

/** `voidhash-cli location history <location>` */
const locationHistoryCommand = Command.make(
  "history",
  { location: locationArgument, project: projectOption, ...outputOptions },
  ({ json, location, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireLocation(
        projectId,
        location,
        "voidhash-cli location history <location>",
      );
      const showings = yield* readAll((query) =>
        api.paywallLocationsListShowings(projectId, found.id, query),
      );
      if (mode === "json") return yield* printJson(showings);
      if (mode === "quiet") return yield* printIds(showings);
      const describe = yield* showingDescriber(projectId, showings);
      yield* printTable(
        [
          { header: "SHOWED", cell: (showing) => describe(showing) },
          // Only when the location ever showed test keys something of its own.
          ...(showings.some(({ environment }) => environment === "test")
            ? [
                {
                  header: "IN",
                  cell: ({ environment }: PaywallLocationShowingJsonEncoding) => environment,
                },
              ]
            : []),
          { header: "FROM", cell: (showing) => formatDate(showing.startedAt) },
          {
            header: "UNTIL",
            cell: (showing) => (showing.endedAt === null ? "now" : formatDate(showing.endedAt)),
          },
        ],
        showings,
        `${locationKind.label(found)} has never shown anything.`,
      );
    }),
).pipe(
  Command.withDescription(
    "List what a location has shown, in production and to test keys, most recent first.",
  ),
);

/** `voidhash-cli location archive <location> [--yes]` */
const locationArchiveCommand = Command.make(
  "archive",
  { location: locationArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, location, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireLocation(
        projectId,
        location,
        "voidhash-cli location archive <location> --yes",
      );
      if (found.isArchived) {
        return yield* printItem(
          mode,
          found,
          `${locationKind.label(found)} is already archived; nothing changed.`,
        );
      }
      const describe = yield* showingDescriber(projectId, showingsOf([found]));
      yield* confirmChange({
        yes,
        message: `Archive ${locationKind.label(found)} in ${projectKind(context.session).label(context.project)}? ${found.showing === null ? "" : `It stops showing ${describe(found.showing)}, and apps that ask for "${found.slug}" get no paywall. `}This cannot be undone.`,
      });
      const archived = yield* api.paywallLocationsArchive(projectId, found.id);
      yield* printItem(mode, archived, `Archived ${locationKind.label(archived)}.`);
    }),
).pipe(
  Command.withDescription(
    "Archive a location your apps no longer ask for; it shows nothing from then on. This cannot be undone. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli location …` */
export const locationCommand = Command.make("location").pipe(
  Command.withAlias("locations"),
  Command.withDescription(
    "The places in your apps that show a paywall: list and view them, choose what each shows, pin an end user to a paywall of their own, and see what they showed before.",
  ),
  Command.withSubcommands([
    locationListCommand,
    locationViewCommand,
    locationCreateCommand,
    locationEditCommand,
    locationShowCommand,
    locationClearCommand,
    locationPinCommand,
    locationUnpinCommand,
    locationRuleCommand,
    locationHistoryCommand,
    locationArchiveCommand,
  ]),
);
