import type {
  AnalyticsEventJsonEncoding,
  BuiltinEventSettingJsonEncoding,
  PageInfo,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { ExitCode, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { confirmChange, requireItem, requireText, type ItemKind } from "../input";
import {
  formatTable,
  formatTimeAgo,
  outputModeOf,
  printJson,
  printTable,
  terminalStyle,
} from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";

// ---------------------------------------------------------------------------
// Reading events
// ---------------------------------------------------------------------------

/** Events read per request, the most the API returns. */
const PAGE_SIZE = 100;
/** How far back `events list --person` looks; the API filters events by name only. */
const MAX_SCANNED = 1_000;

const nameOption = Flag.String("name").pipe(
  Flag.withDescription("Only events with this name, such as $pageview or purchase_completed"),
  Flag.optional,
);

const personOption = Flag.String("person").pipe(
  Flag.withDescription("Only events of this person: a distinct id, person id or email"),
  Flag.optional,
);

/**
 * Whether an event belongs to the person `input` names. An email is looked
 * up among the persons, since events carry ids only; anything else matches
 * the event's distinct id, previous distinct id or person id.
 */
const personMatcher = (projectId: string, input: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isNone(input)) return () => true;
    const wanted = input.value.trim();
    if (!wanted.includes("@")) {
      return (event: AnalyticsEventJsonEncoding) =>
        event.distinctId === wanted ||
        event.previousDistinctId === wanted ||
        event.personId === wanted;
    }
    const api = yield* ApiClient;
    const persons = yield* readAll((query) =>
      api.personsList(projectId, { ...query, email: wanted }),
    );
    if (Arr.isReadonlyArrayEmpty(persons)) {
      return yield* Effect.fail(
        userError(`No person has the email ${wanted}.`, {
          hint: "Pass their distinct id instead, as your app identifies them.",
          exitCode: ExitCode.notFound,
        }),
      );
    }
    const ids = HashSet.fromIterable(persons.map((person) => person.id));
    return (event: AnalyticsEventJsonEncoding) =>
      event.personId !== null && HashSet.has(ids, event.personId);
  });

/** One page of the newest events, after `cursor`. */
const eventsPage = (
  projectId: string,
  name: Option.Option<string>,
  cursor: Option.Option<string>,
) =>
  Effect.flatMap(ApiClient, (api) =>
    api.eventsList(projectId, {
      limit: PAGE_SIZE,
      cursor: Option.getOrUndefined(cursor),
      name: Option.getOrUndefined(name),
    }),
  );

const nextCursorOf = (page: { readonly pageInfo: PageInfo }) =>
  page.pageInfo.hasNextPage ? Option.fromNullishOr(page.pageInfo.endCursor) : Option.none();

/**
 * Up to `limit` of the newest events `matches` accepts, newest first, read
 * page by page. Without a person filter the first pages are the answer; with
 * one, at most {@link MAX_SCANNED} events are read, and `isComplete` says
 * whether that was enough.
 */
const newestEvents = (
  projectId: string,
  name: Option.Option<string>,
  matches: (event: AnalyticsEventJsonEncoding) => boolean,
  limit: number,
) => {
  const scan = (
    cursor: Option.Option<string>,
    found: ReadonlyArray<AnalyticsEventJsonEncoding>,
    scanned: number,
  ): Effect.Effect<
    { readonly events: ReadonlyArray<AnalyticsEventJsonEncoding>; readonly isComplete: boolean },
    Effect.Error<ReturnType<typeof eventsPage>>,
    ApiClient
  > =>
    Effect.gen(function* () {
      const page = yield* eventsPage(projectId, name, cursor);
      const matched = [...found, ...page.data.filter(matches)];
      const next = nextCursorOf(page);
      const seen = scanned + page.data.length;
      if (matched.length >= limit || Option.isNone(next)) {
        return { events: matched.slice(0, limit), isComplete: true };
      }
      if (seen >= MAX_SCANNED) return { events: matched, isComplete: false };
      return yield* scan(next, matched, seen);
    });
  return scan(Option.none(), [], 0);
};

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** A property value in a table cell: short, on one line. */
const shortValue = (value: unknown) => {
  const text = P.isString(value) ? value : encodeJson(value);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
};

/** The first few of an event's properties, as `key=value`. */
const propertiesOf = (event: AnalyticsEventJsonEncoding) => {
  const entries = R.toEntries(event.properties).filter(([key]) => !key.startsWith("$lib"));
  const shown = entries.slice(0, 3).map(([key, value]) => `${key}=${shortValue(value)}`);
  return Arr.match(shown, {
    onEmpty: () => "-",
    onNonEmpty: (some) => `${some.join(" ")}${entries.length > 3 ? " …" : ""}`,
  });
};

const eventColumns = (now: DateTime.DateTime) => [
  {
    header: "RECEIVED",
    cell: (event: AnalyticsEventJsonEncoding) => formatTimeAgo(event.receivedAt, now),
  },
  { header: "EVENT", cell: (event: AnalyticsEventJsonEncoding) => event.name },
  { header: "PERSON", cell: (event: AnalyticsEventJsonEncoding) => event.distinctId },
  { header: "SOURCE", cell: (event: AnalyticsEventJsonEncoding) => event.source },
  { header: "PROPERTIES", cell: propertiesOf },
];

/** `voidhash-cli events list [--name] [--person] [--limit]` */
const eventsListCommand = Command.make(
  "list",
  {
    project: projectOption,
    name: nameOption,
    person: personOption,
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("How many events to show (default: 25)"),
      Flag.withDefault(25),
    ),
    ...outputOptions,
  },
  ({ json, limit, name, person, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (limit < 1) {
        return yield* Effect.fail(
          userError("--limit must be at least 1.", { exitCode: ExitCode.usage }),
        );
      }
      const projectId = (yield* resolveProject(project)).project.id;
      const matches = yield* personMatcher(projectId, person);
      const { events, isComplete } = yield* newestEvents(projectId, name, matches, limit);
      if (!isComplete) {
        yield* Console.error(
          `Searched the latest ${MAX_SCANNED} events only; older events of this person are not shown.`,
        );
      }
      if (mode === "json") return yield* printJson(events);
      if (mode === "quiet") {
        return yield* Arr.match(events, {
          onEmpty: () => Effect.void,
          onNonEmpty: (some) => Console.log(some.map(({ id }) => id).join("\n")),
        });
      }
      yield* printTable(
        eventColumns(yield* DateTime.now),
        events,
        Option.isSome(name) || Option.isSome(person)
          ? "No events match. 'voidhash-cli events list' shows the latest of every kind."
          : "No events yet. Events appear once an app with a Voidhash SDK sends them; 'voidhash-cli analytics health' shows what is reporting.",
      );
    }),
).pipe(
  Command.withDescription(
    "List the project's latest events, newest first, optionally of one event name or one person.",
  ),
);

/** `voidhash-cli events tail [--name] [--person] [--interval] [--count]` */
const eventsTailCommand = Command.make(
  "tail",
  {
    project: projectOption,
    name: nameOption,
    person: personOption,
    interval: Flag.Int("interval").pipe(
      Flag.withDescription("Seconds between checks for new events (default: 2)"),
      Flag.withDefault(2),
    ),
    count: Flag.Int("count").pipe(
      Flag.withDescription("Stop after this many new events, such as 1 to wait for one"),
      Flag.optional,
    ),
    json: outputOptions.json,
  },
  ({ count, interval, json, name, person, project }) =>
    Effect.gen(function* () {
      if (interval < 1) {
        return yield* Effect.fail(
          userError("--interval must be at least 1 second.", { exitCode: ExitCode.usage }),
        );
      }
      const projectId = (yield* resolveProject(project)).project.id;
      const matches = yield* personMatcher(projectId, person);
      const style = yield* terminalStyle;
      const columns = eventColumns(yield* DateTime.now);
      const print = (events: ReadonlyArray<AnalyticsEventJsonEncoding>) =>
        Effect.forEach(
          events,
          (event) =>
            json
              ? printJson(event).pipe(Effect.asVoid)
              : Console.log(formatTable(columns, [event], style).split("\n").slice(1).join("\n")),
          { concurrency: 1, discard: true },
        );

      const firstPage = yield* eventsPage(projectId, name, Option.none());
      if (!json) {
        yield* Console.error(
          `Waiting for ${Option.match(name, { onNone: () => "events", onSome: (event) => `${event} events` })}${Option.match(person, { onNone: () => "", onSome: (who) => ` of ${who}` })}; press Ctrl+C to stop.`,
        );
        yield* Console.log(style.bold(columns.map(({ header }) => header).join("  ")));
      }
      if (Option.isNone(count)) {
        yield* print(Arr.reverse(firstPage.data.filter(matches).slice(0, 5)));
      }

      // Ids already seen, so an event is printed once however the pages shift.
      const seen = yield* Ref.make(HashSet.fromIterable(firstPage.data.map(({ id }) => id)));
      const printed = yield* Ref.make(0);
      /** Events not seen yet, newest first: pages are read until one holds a seen event. */
      const unseenEvents = (
        known: HashSet.HashSet<string>,
        cursor: Option.Option<string>,
        pages: number,
      ): Effect.Effect<
        ReadonlyArray<AnalyticsEventJsonEncoding>,
        Effect.Error<ReturnType<typeof eventsPage>>,
        ApiClient
      > =>
        Effect.gen(function* () {
          const page = yield* eventsPage(projectId, name, cursor);
          const unseen = page.data.filter((event) => !HashSet.has(known, event.id));
          const next = nextCursorOf(page);
          if (unseen.length < page.data.length || Option.isNone(next) || pages >= 10) return unseen;
          return [...unseen, ...(yield* unseenEvents(known, next, pages + 1))];
        });
      const pollOnce = Effect.fn("events.tail.poll")(function* () {
        yield* Effect.sleep(Duration.seconds(interval));
        const fresh = yield* unseenEvents(yield* Ref.get(seen), Option.none(), 1);
        yield* Ref.update(seen, (known) =>
          fresh.reduce((all, event) => HashSet.add(all, event.id), known),
        );
        const already = yield* Ref.get(printed);
        const matching = Arr.reverse(fresh.filter(matches));
        const shown = Option.match(count, {
          onNone: () => matching,
          onSome: (wanted) => matching.slice(0, wanted - already),
        });
        yield* print(shown);
        yield* Ref.set(printed, already + shown.length);
        return Option.exists(count, (wanted) => already + shown.length >= wanted);
      });
      yield* Effect.repeat(pollOnce(), { until: (done) => done });
    }),
).pipe(
  Command.withDescription(
    "Show events as they arrive, until Ctrl+C or --count of them. Good for checking an app's tracking while you use it.",
  ),
);

// ---------------------------------------------------------------------------
// Which events are stored
// ---------------------------------------------------------------------------

const builtinKind: ItemKind<BuiltinEventSettingJsonEncoding & { readonly id: string }> = {
  noun: "built-in event",
  label: (setting) => `${setting.name} (${setting.key})`,
  listCommand: "voidhash-cli events policy view",
  keys: (setting) => [setting.key, ...setting.eventNames],
  names: (setting) => [setting.name],
};

const builtinSettings = (projectId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const policy = yield* api.ingestPolicyGet(projectId);
    return {
      policy,
      settings: policy.builtinEvents.map((setting) => ({ ...setting, id: setting.key })),
    };
  });

const yesNo = (value: boolean) => (value ? "yes" : "no");

/** `voidhash-cli events policy view` */
const policyViewCommand = Command.make(
  "view",
  { project: projectOption, json: outputOptions.json },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const policy = yield* api.ingestPolicyGet(projectId);
      if (json) return yield* printJson(policy);
      yield* Console.log("Built-in events (stored only when on):");
      yield* printTable(
        [
          { header: "NAME", cell: (setting) => setting.name },
          { header: "KEY", cell: (setting) => setting.key },
          { header: "EVENTS", cell: (setting) => setting.eventNames.join(", ") },
          {
            header: "STORED",
            cell: (setting) =>
              `${yesNo(setting.isEnabled)}${setting.isOverridden ? "" : " (default)"}`,
          },
        ],
        policy.builtinEvents,
        "No built-in event settings.",
      );
      yield* Console.log(
        `\nCustom events are stored unless blocked. Blocked: ${Arr.match(
          policy.blockedCustomEvents,
          { onEmpty: () => "none", onNonEmpty: (some) => some.join(", ") },
        )}`,
      );
      yield* Console.error(
        "Change it with 'voidhash-cli events policy enable|disable <built-in event>' or 'block|unblock <custom event>'.",
      );
    }),
).pipe(
  Command.withDescription(
    "Show which built-in events are stored and which custom events are blocked.",
  ),
);

const builtinArgument = Argument.String("event").pipe(
  Argument.withDescription("A built-in event, such as $pageview, or its setting's key or name"),
  Argument.optional,
);

const customArgument = Argument.String("event").pipe(
  Argument.withDescription("The custom event's name, such as button_clicked"),
  Argument.optional,
);

/** `enable` or `disable` a built-in event setting. */
const setBuiltin = (isEnabled: boolean) =>
  Command.make(
    isEnabled ? "enable" : "disable",
    {
      event: builtinArgument,
      project: projectOption,
      yes: yesOption,
      json: outputOptions.json,
    },
    (flags) =>
      Effect.gen(function* () {
        const api = yield* ApiClient;
        const context = yield* resolveProject(flags.project);
        const projectId = context.project.id;
        const { settings } = yield* builtinSettings(projectId);
        const verb = isEnabled ? "enable" : "disable";
        const setting = yield* requireItem(
          builtinKind,
          settings,
          flags.event,
          `voidhash-cli events policy ${verb} <event>`,
        );
        if (setting.isEnabled === isEnabled) {
          if (flags.json) return yield* printJson(setting);
          return yield* Console.log(
            `${builtinKind.label(setting)} is already ${isEnabled ? "stored" : "not stored"}; nothing changed.`,
          );
        }
        if (!isEnabled) {
          yield* confirmChange({
            yes: flags.yes,
            message: `Stop storing ${setting.eventNames.join(", ")} in ${projectKind(context.session).label(context.project)}? Events sent while it is off are dropped and cannot be recovered.${setting.warning === null ? "" : ` ${setting.warning}`}`,
          });
        }
        const updated = yield* api.ingestPolicyUpsertBuiltinEvent(projectId, setting.key, {
          isEnabled,
        });
        if (flags.json) return yield* printJson(updated);
        yield* Console.log(
          isEnabled
            ? `Now storing ${updated.eventNames.join(", ")} (${updated.name}).`
            : `Stopped storing ${updated.eventNames.join(", ")} (${updated.name}). Turn it back on with 'voidhash-cli events policy enable ${updated.key}'.`,
        );
      }),
  ).pipe(
    Command.withDescription(
      isEnabled
        ? "Start storing a built-in event, such as $pageview."
        : "Stop storing a built-in event; events sent meanwhile are dropped. Asks first; --yes skips that.",
    ),
  );

/** `block` or `unblock` a custom event. */
const setCustom = (isBlocked: boolean) =>
  Command.make(
    isBlocked ? "block" : "unblock",
    {
      event: customArgument,
      project: projectOption,
      yes: yesOption,
      json: outputOptions.json,
    },
    (flags) =>
      Effect.gen(function* () {
        const api = yield* ApiClient;
        const context = yield* resolveProject(flags.project);
        const projectId = context.project.id;
        const verb = isBlocked ? "block" : "unblock";
        const eventName = yield* requireText(flags.event, {
          flag: "<event>",
          message: "Custom event name",
          usage: `voidhash-cli events policy ${verb} <event>`,
        });
        if (eventName.startsWith("$")) {
          return yield* Effect.fail(
            userError(`${eventName} is a built-in event; it is turned on and off by its setting.`, {
              hint: `Run 'voidhash-cli events policy ${isBlocked ? "disable" : "enable"} ${eventName}'.`,
              exitCode: ExitCode.usage,
            }),
          );
        }
        const policy = yield* api.ingestPolicyGet(projectId);
        if (policy.blockedCustomEvents.includes(eventName) === isBlocked) {
          if (flags.json) return yield* printJson({ eventName, isBlocked });
          return yield* Console.log(
            `${eventName} is already ${isBlocked ? "blocked" : "stored"}; nothing changed.`,
          );
        }
        if (isBlocked) {
          yield* confirmChange({
            yes: flags.yes,
            message: `Stop storing ${eventName} events in ${projectKind(context.session).label(context.project)}? Events sent while it is blocked are dropped and cannot be recovered.`,
          });
        }
        const updated = yield* api.ingestPolicyUpsertCustomEvent(projectId, eventName, {
          isBlocked,
        });
        if (flags.json) return yield* printJson(updated);
        yield* Console.log(
          isBlocked
            ? `Blocked ${updated.eventName}: it is no longer stored. Undo with 'voidhash-cli events policy unblock ${updated.eventName}'.`
            : `Unblocked ${updated.eventName}: it is stored again from now on.`,
        );
      }),
  ).pipe(
    Command.withDescription(
      isBlocked
        ? "Stop storing a custom event; events sent meanwhile are dropped. Asks first; --yes skips that."
        : "Store a blocked custom event again.",
    ),
  );

/** `voidhash-cli events policy …` */
const eventsPolicyCommand = Command.make("policy").pipe(
  Command.withDescription(
    "Which events the project stores: built-in events are stored once enabled, custom events unless blocked.",
  ),
  Command.withSubcommands([
    policyViewCommand,
    setBuiltin(true),
    setBuiltin(false),
    setCustom(true),
    setCustom(false),
  ]),
);

/** `voidhash-cli events …` */
export const eventsCommand = Command.make("events").pipe(
  Command.withAlias("event"),
  Command.withDescription(
    "The events your apps send: list the latest, watch them arrive, and choose which are stored.",
  ),
  Command.withSubcommands([eventsListCommand, eventsTailCommand, eventsPolicyCommand]),
);
