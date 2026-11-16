import type { AnalyticsAlertJsonEncoding } from "@voidhash/generated-clients";
import { ANALYTICS_ALERT_KINDS } from "@voidhash/lib/analytics-alerts";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { ExitCode, userError } from "../../utils/error-formatter";
import { resolveProject } from "../context";
import { confirmChange } from "../input";
import { printJson, printTable } from "../output";
import { projectOption, yesOption } from "../shared-options";

const jsonOption = Flag.Boolean("json").pipe(
  Flag.withDescription("Print the API response as JSON, for scripts"),
  Flag.withDefault(false),
);

/** A project has at most 25 alerts, so one page is all of them. */
const ALERTS_PAGE = 100;

const windowLabel = (hours: number) => (hours === 168 ? "7 days" : `${hours} h`);

/** What the state column says, naming why a rule that cannot judge stays silent. */
const stateLabel = (alert: AnalyticsAlertJsonEncoding) => {
  if (!alert.isEnabled) return "off";
  if (alert.state === "not_enough_history") return "not enough history";
  if (alert.state === "not_enough_volume") return "not enough volume";
  return alert.state;
};

const alertArgument = Argument.String("alert").pipe(
  Argument.withDescription("The alert, by id or exact name"),
);

const findAlert = (projectId: string, identifier: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const { data } = yield* api.analyticsAlertsList(projectId, { limit: ALERTS_PAGE });
    const wanted = identifier.trim().toLowerCase();
    const found = data.find(
      (alert) => alert.id === identifier || alert.name.toLowerCase() === wanted,
    );
    if (found === undefined) {
      return yield* userError(`There is no alert ${identifier}.`, {
        hint: "List them with 'voidhash-cli analytics alerts list'.",
        exitCode: ExitCode.usage,
      });
    }
    return found;
  });

const listCommand = Command.make(
  "list",
  { project: projectOption, json: jsonOption },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const { data } = yield* api.analyticsAlertsList(projectId, { limit: ALERTS_PAGE });
      if (json) return yield* printJson(data);
      yield* printTable(
        [
          { header: "NAME", cell: (alert) => alert.name },
          { header: "KIND", cell: (alert) => alert.kind },
          { header: "EVENT", cell: (alert) => alert.eventName },
          { header: "WINDOW", cell: (alert) => windowLabel(alert.windowHours) },
          { header: "STATE", cell: stateLabel },
          { header: "VALUE", cell: (alert) => String(alert.value ?? "-") },
        ],
        data,
        "No alerts. 'voidhash-cli analytics alerts create' adds one.",
      );
    }),
).pipe(
  Command.withDescription("List the project's alerts and how each stood at its latest check."),
);

const createCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("What a person reads in the notice")),
    kind: Flag.Literals("kind", ANALYTICS_ALERT_KINDS).pipe(
      Flag.withDescription(
        "event_count: too many of an event. failure_share: too many failures among attempts. volume_drop: an event fell against earlier weeks",
      ),
    ),
    event: Flag.String("event").pipe(
      Flag.withDescription("The event to watch; for failure_share, the event of a failed attempt"),
    ),
    successEvent: Flag.String("success-event").pipe(
      Flag.withDescription("For failure_share: the event of an attempt that worked"),
      Flag.optional,
    ),
    windowHours: Flag.Int("window-hours").pipe(
      Flag.withDescription("The trailing window each hourly check reads: 1, 6, 24 or 168"),
    ),
    threshold: Flag.Finite("threshold").pipe(
      Flag.withDescription(
        "For event_count, the count that fires it; for the others, a share from 0 to 1",
      ),
    ),
    minPeople: Flag.Int("min-people").pipe(
      Flag.withDescription(
        "For event_count: distinct people it must affect (default: 2). Use 1 when one person matters",
      ),
      Flag.optional,
    ),
    json: jsonOption,
  },
  ({ event, json, kind, minPeople, name, project, successEvent, threshold, windowHours }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const alert = yield* api.analyticsAlertsCreate(projectId, {
        eventName: event,
        kind,
        name,
        threshold,
        windowHours,
        ...(Option.isSome(minPeople) && { minPeople: minPeople.value }),
        ...(Option.isSome(successEvent) && { successEventName: successEvent.value }),
      });
      if (json) return yield* printJson(alert);
      yield* Console.log(
        `Created ${alert.name} (${alert.id}). It is first checked at the next quarter past the hour.`,
      );
    }),
).pipe(Command.withDescription("Add a rule that tells owners and admins when events look broken."));

/** Turns an alert on or off, which starts it over. */
const setEnabled = (isEnabled: boolean) =>
  Command.make(
    isEnabled ? "enable" : "disable",
    { alert: alertArgument, project: projectOption, json: jsonOption },
    ({ alert, json, project }) =>
      Effect.gen(function* () {
        const api = yield* ApiClient;
        const projectId = (yield* resolveProject(project)).project.id;
        const found = yield* findAlert(projectId, alert);
        const updated = yield* api.analyticsAlertsUpdate(projectId, found.id, { isEnabled });
        if (json) return yield* printJson(updated);
        yield* Console.log(`${updated.name} is ${isEnabled ? "on" : "off"}.`);
      }),
  ).pipe(
    Command.withDescription(
      isEnabled
        ? "Turn an alert back on. It starts over at its next check."
        : "Turn an alert off without deleting it.",
    ),
  );

const deleteCommand = Command.make(
  "delete",
  { alert: alertArgument, project: projectOption, yes: yesOption },
  ({ alert, project, yes }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* findAlert(projectId, alert);
      yield* confirmChange({
        yes,
        message: `Delete alert ${found.name}? Nobody is told if its problem happens again.`,
      });
      yield* api.analyticsAlertsDelete(projectId, found.id);
      yield* Console.log(`Deleted ${found.name}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete an alert. Asks first; --yes skips that. 'analytics alerts disable' keeps it.",
  ),
);

export const alertsCommand = Command.make("alerts").pipe(
  Command.withDescription("Rules that tell owners and admins when events look broken."),
  Command.withSubcommands([
    listCommand,
    createCommand,
    setEnabled(true),
    setEnabled(false),
    deleteCommand,
  ]),
);
