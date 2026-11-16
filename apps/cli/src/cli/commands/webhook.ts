/**
 * `voidhash-cli webhook …`: the backend URLs a project's events are sent to,
 * and how their deliveries went. A webhook is named by its id, name or URL.
 *
 * Voidhash sends in the background: `test` and `retry` wait a few seconds for
 * the webhook's answer, and say where to read it when it takes longer.
 */
import type {
  CreateWebhookBodyJsonEncoding,
  WebhookDeliveryAttemptJsonEncoding,
  WebhookDeliveryJsonEncoding,
  WebhookJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schedule from "effect/Schedule";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, apiErrorCode, ExitCode, userError } from "../../utils/error-formatter";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import {
  confirmChange,
  isInteractive,
  type ItemKind,
  missingInput,
  requireItem,
  requireText,
} from "../input";
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

type EventType = CreateWebhookBodyJsonEncoding["events"][number];

/** Every event a webhook can receive, in the order people choose them. */
const EVENT_TYPES = [
  "purchase.completed",
  "purchase.refunded",
  "purchase.revoked",
  "subscription.created",
  "subscription.renewed",
  "subscription.product_changed",
  "subscription.cancelled",
  "subscription.expired",
  "person.deleted",
  "person.created",
  "person.updated",
] as const satisfies ReadonlyArray<EventType>;

/** Events the API accepts but nothing sends yet. */
const UNSENT_EVENTS: ReadonlyArray<EventType> = ["person.created", "person.updated"];

const webhookKind: ItemKind<WebhookJsonEncoding> = {
  noun: "webhook",
  label: (webhook) => `${webhook.name} (${webhook.url})`,
  listCommand: "voidhash-cli webhook list",
  createCommand: "voidhash-cli webhook create",
  keys: (webhook) => [webhook.url],
  names: (webhook) => [webhook.name],
};

const webhookArgument = Argument.String("webhook").pipe(
  Argument.withDescription("The webhook's name, URL or id"),
  Argument.optional,
);

/**
 * The events `inputs` name: event types, `purchase.*`-style groups, or
 * `all`. Fails naming what is unknown, with the list to choose from.
 */
const parseEvents = (inputs: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const unknown: Array<string> = [];
    const chosen = inputs.flatMap((input): ReadonlyArray<EventType> => {
      const wanted = input.trim();
      if (wanted === "all" || wanted === "*") {
        return EVENT_TYPES.filter((event) => !UNSENT_EVENTS.includes(event));
      }
      const matches = wanted.endsWith(".*")
        ? EVENT_TYPES.filter((event) => event.startsWith(wanted.slice(0, -1)))
        : EVENT_TYPES.filter((event) => event === wanted);
      if (Arr.isReadonlyArrayEmpty(matches)) unknown.push(input);
      return matches;
    });
    if (Arr.isReadonlyArrayNonEmpty(unknown)) {
      return yield* Effect.fail(
        userError(`Unknown event ${unknown.map((input) => `"${input}"`).join(", ")}.`, {
          hint: `Choose from ${EVENT_TYPES.join(", ")}; purchase.*, subscription.* and person.* name a group, all every event.`,
          exitCode: ExitCode.usage,
        }),
      );
    }
    return Arr.dedupe(chosen);
  });

const eventFlag = Flag.String("event").pipe(
  Flag.withDescription(
    "An event to send, such as purchase.completed, a group such as subscription.*, or all; repeat for each",
  ),
  Flag.atLeast(0),
);

/** Asks which events to send, in a terminal, with `selected` chosen already. */
const ENVIRONMENT_RULE =
  "A production webhook receives the purchase events of production keys; a test webhook those of store sandbox and test purchases. Person events reach both.";

const environmentFlag = Flag.Literals("environment", ["production", "test"]).pipe(Flag.optional);

const chooseEvents = (selected: ReadonlyArray<string>) =>
  Prompt.run(
    Prompt.MultiSelect({
      message: "Which events should it receive?",
      choices: EVENT_TYPES.map((event) => ({
        title: UNSENT_EVENTS.includes(event) ? `${event} (not sent yet)` : event,
        value: event,
        selected: selected.includes(event),
      })),
    }),
  ).pipe(
    Effect.flatMap((events) =>
      Arr.isReadonlyArrayEmpty(events)
        ? Effect.fail(
            userError("A webhook needs at least one event.", { exitCode: ExitCode.usage }),
          )
        : Effect.succeed(events),
    ),
  );

/** How a webhook is doing, as a person says it. */
const healthOf = (webhook: WebhookJsonEncoding) => {
  if (webhook.status === "disabled") return "disabled";
  if (webhook.status === "failed") return `stopped after ${webhook.consecutiveFailures} failures`;
  return webhook.consecutiveFailures > 0
    ? `failing (${webhook.consecutiveFailures} in a row)`
    : "delivering";
};

/** The project's webhooks and the dashboard page of one. */
const listWebhooks = (projectId: string) =>
  Effect.flatMap(ApiClient, (api) => readAll((query) => api.webhooksList(projectId, query)));

const webhookPage = (webhook: Pick<WebhookJsonEncoding, "id">) => `settings/webhooks/${webhook.id}`;

/** What to do about a webhook that is sent nothing. */
const turnedOffHint = (webhook: WebhookJsonEncoding) =>
  webhook.status === "failed"
    ? `Voidhash stopped it after repeated failures. Fix the endpoint ('voidhash-cli webhook deliveries ${webhook.id} --failed' shows how it answered), then 'voidhash-cli webhook enable ${webhook.id}'.`
    : `Turn it on with 'voidhash-cli webhook enable ${webhook.id}'.`;

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

const isUnsuccessful = (delivery: WebhookDeliveryJsonEncoding) =>
  delivery.status === "failed" || delivery.status === "exhausted";

/** Deliveries by when they were made, newest first. */
const newestFirst = Order.flip(
  Order.mapInput(
    Order.String,
    (delivery: WebhookDeliveryJsonEncoding) => delivery.createdAt ?? delivery.eventOccurredAt,
  ),
);

const isSettled = (delivery: WebhookDeliveryJsonEncoding) =>
  delivery.status !== "pending" && delivery.status !== "in_progress";

/** How the webhook answered one attempt: `HTTP 500 Internal Server Error` or the connection error. */
const describeAnswer = (attempt: WebhookDeliveryAttemptJsonEncoding, width = 60) => {
  const body = (attempt.responseBody ?? "").replace(/\s+/g, " ").trim();
  const text =
    attempt.statusCode === null
      ? (attempt.errorMessage ?? "no answer")
      : `HTTP ${attempt.statusCode}${body === "" ? "" : ` ${body}`}`;
  return text.length > width ? `${text.slice(0, width - 1)}…` : text;
};

/** A delivery's status for a table: "retrying 14:05", "gave up". */
const deliveryState = (delivery: WebhookDeliveryJsonEncoding) => {
  if (delivery.status === "succeeded") return "delivered";
  if (delivery.status === "exhausted") return `gave up (${delivery.attemptCount} attempts)`;
  if (delivery.status === "failed") {
    return delivery.nextAttemptAt === null
      ? `failed (${delivery.attemptCount}/${delivery.maxAttempts})`
      : `retrying ${formatDate(delivery.nextAttemptAt)}`;
  }
  return "sending";
};

/** The latest attempt's answer of each unsuccessful delivery, by delivery id: one read each. */
const answersOf = (projectId: string, deliveries: ReadonlyArray<WebhookDeliveryJsonEncoding>) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const read = yield* Effect.forEach(
      deliveries.filter(isUnsuccessful),
      (delivery) => api.webhooksGetDelivery(projectId, delivery.id),
      { concurrency: 4 },
    );
    const answers = HashMap.fromIterable(
      read.flatMap((delivery) =>
        Arr.fromOption(
          Option.map(
            Arr.last(delivery.attempts),
            (attempt) => [delivery.id, describeAnswer(attempt)] as const,
          ),
        ),
      ),
    );
    return (delivery: WebhookDeliveryJsonEncoding) =>
      Option.getOrElse(HashMap.get(answers, delivery.id), () => "-");
  });

/** The delivery once its attempt has an answer, read once a second for up to {@link ANSWER_WAIT} seconds. */
const ANSWER_WAIT = 15;

const awaitAnswer = (projectId: string, deliveryId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* api.webhooksGetDelivery(projectId, deliveryId).pipe(
      Effect.repeat({
        schedule: Schedule.spaced(Duration.seconds(1)),
        until: isSettled,
        times: ANSWER_WAIT,
      }),
    );
  });

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** `voidhash-cli webhook list` */
const webhookListCommand = Command.make(
  "list",
  { project: projectOption, ...outputOptions },
  ({ json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const webhooks = yield* listWebhooks(projectId);
      if (mode === "json") return yield* printJson(webhooks);
      if (mode === "quiet") return yield* printIds(webhooks);
      const now = yield* DateTime.now;
      yield* printTable(
        [
          { header: "NAME", cell: (webhook) => webhook.name },
          { header: "URL", cell: (webhook) => webhook.url },
          { header: "ENVIRONMENT", cell: (webhook) => webhook.environment },
          { header: "STATUS", cell: healthOf },
          {
            header: "LAST SUCCESS",
            cell: (webhook) =>
              webhook.lastSuccessAt === null ? "-" : formatTimeAgo(webhook.lastSuccessAt, now),
          },
          { header: "EVENTS", cell: (webhook) => String(webhook.events.length) },
          { header: "ID", cell: (webhook) => webhook.id },
        ],
        webhooks,
        "No webhooks yet. Send events to your backend with 'voidhash-cli webhook create'.",
      );
      const turnedOff = webhooks.find((webhook) => webhook.status === "failed");
      if (turnedOff !== undefined) yield* Console.error(turnedOffHint(turnedOff));
    }),
).pipe(Command.withDescription("List the project's webhooks and whether they deliver."));

/** `voidhash-cli webhook view <webhook>` */
const webhookViewCommand = Command.make(
  "view",
  { webhook: webhookArgument, project: projectOption, ...outputOptions },
  ({ json, project, quiet, webhook }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        "voidhash-cli webhook view <webhook>",
      );
      if (mode === "quiet") return yield* printIds([found]);
      const recent = yield* api.webhooksListDeliveries(projectId, found.id, { limit: 10 });
      if (mode === "json") return yield* printJson({ ...found, recentDeliveries: recent.data });

      const now = yield* DateTime.now;
      const answers = yield* answersOf(projectId, recent.data);
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          webhookKind.label(found),
          formatFields([
            ["Environment", found.environment],
            ["Status", healthOf(found)],
            [
              "Last success",
              found.lastSuccessAt === null ? "never" : formatTimeAgo(found.lastSuccessAt, now),
            ],
            ["Events", found.events.join("\n")],
            ...(found.description === null ? [] : [["Description", found.description] as const]),
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, webhookPage(found)),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
          "",
        ].join("\n"),
      );
      yield* printTable(
        [
          { header: "TIME", cell: (delivery) => formatTimeAgo(delivery.eventOccurredAt, now) },
          { header: "EVENT", cell: (delivery) => delivery.eventType },
          { header: "STATUS", cell: deliveryState },
          { header: "ANSWER", cell: answers },
          { header: "ID", cell: (delivery) => delivery.id },
        ],
        recent.data,
        `No deliveries yet. Send a test event with 'voidhash-cli webhook test ${found.id}'.`,
      );
      if (found.status !== "active") yield* Console.error(turnedOffHint(found));
    }),
).pipe(
  Command.withDescription(
    "Show a webhook: its URL, events and health, and its latest deliveries with how it answered.",
  ),
);

const CREATE_USAGE =
  "voidhash-cli webhook create --name <name> --url <url> --event <event>… [--environment production|test]";

/** `voidhash-cli webhook create [--name] [--url] [--event]… [--description] [--environment]` */
const webhookCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(
      Flag.withDescription("What it is for, such as Orders backend"),
      Flag.optional,
    ),
    url: Flag.String("url").pipe(
      Flag.withDescription("The public URL Voidhash POSTs events to"),
      Flag.optional,
    ),
    event: eventFlag,
    description: Flag.String("description").pipe(
      Flag.withDescription("A note for your team"),
      Flag.optional,
    ),
    environment: environmentFlag.pipe(
      Flag.withDescription(
        "production (default), or test for a staging backend: which purchase events it receives",
      ),
    ),
    ...outputOptions,
  },
  ({ description, environment, event, json, name, project, quiet, url }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const webhookName = yield* requireText(name, {
        flag: "--name",
        message: "Name, such as Orders backend",
        usage: CREATE_USAGE,
      });
      const webhookUrl = yield* requireText(url, {
        flag: "--url",
        message: "URL to send events to",
        usage: CREATE_USAGE,
      });
      const events = Arr.isReadonlyArrayNonEmpty(event)
        ? yield* parseEvents(event)
        : (yield* isInteractive)
          ? yield* chooseEvents([])
          : yield* Effect.fail(missingInput("--event", CREATE_USAGE));

      const created = yield* api
        .webhooksCreate(projectId, {
          name: webhookName,
          url: webhookUrl,
          events,
          description: Option.getOrUndefined(description),
          environment: Option.getOrUndefined(environment),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              invalid_webhook_url:
                "Use a public URL. Voidhash does not call localhost or private networks; for local development, expose your server through a tunnel first.",
            }),
          ),
        );
      yield* printItem(
        mode,
        created,
        [
          `Created ${created.environment} webhook ${webhookKind.label(created)}, receiving ${created.events.join(", ")}${created.environment === "test" ? " of store sandbox and test purchases" : ""}.`,
          "",
          "Signing secret (shown only now):",
          `  ${created.secret}`,
          "",
          "Store it as a secret of your backend: it verifies each delivery's X-Webhook-Signature header.",
          `Next: send a test event with 'voidhash-cli webhook test ${created.id}'.`,
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    `Create a webhook and print its signing secret, shown only this once. Asks for what is missing in a terminal. ${ENVIRONMENT_RULE}`,
  ),
);

const EDIT_USAGE =
  "voidhash-cli webhook edit <webhook> [--name <name>] [--url <url>] [--event <event>]… [--description <text>] [--environment production|test] [--yes]";

/** `voidhash-cli webhook edit <webhook> [--name] [--url] [--event]… [--description] [--environment] [--yes]` */
const webhookEditCommand = Command.make(
  "edit",
  {
    webhook: webhookArgument,
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    url: Flag.String("url").pipe(Flag.withDescription("Its new URL"), Flag.optional),
    event: eventFlag.pipe(
      Flag.withDescription("Every event it should receive from now on; repeat for each"),
    ),
    description: Flag.String("description").pipe(
      Flag.withDescription('Its new note; "" removes it'),
      Flag.optional,
    ),
    environment: environmentFlag.pipe(
      Flag.withDescription("Which purchase events it receives from now on: production or test"),
    ),
    yes: yesOption,
    ...outputOptions,
  },
  ({ description, environment, event, json, name, project, quiet, url, webhook, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        EDIT_USAGE,
      );
      const flagged =
        Option.isSome(name) ||
        Option.isSome(url) ||
        Option.isSome(description) ||
        Option.isSome(environment) ||
        Arr.isReadonlyArrayNonEmpty(event);
      const asked = flagged
        ? {
            name,
            url,
            description,
            environment,
            events: Arr.isReadonlyArrayNonEmpty(event)
              ? Option.some(yield* parseEvents(event))
              : Option.none(),
          }
        : yield* Effect.gen(function* () {
            if (!(yield* isInteractive)) {
              return yield* Effect.fail(
                userError("Nothing to change.", {
                  hint: `Pass --name, --url, --event, --description or --environment: ${EDIT_USAGE}. To turn it off, 'voidhash-cli webhook disable'.`,
                  exitCode: ExitCode.usage,
                }),
              );
            }
            return {
              name: Option.some(
                yield* Prompt.run(Prompt.String({ message: "Name", default: found.name })),
              ),
              url: Option.some(
                yield* Prompt.run(Prompt.String({ message: "URL", default: found.url })),
              ),
              description: Option.none<string>(),
              environment: Option.none<"production" | "test">(),
              events: Option.some(yield* chooseEvents(found.events)),
            };
          });
      const newName = Option.filter(asked.name, (value) => value !== found.name);
      const newUrl = Option.filter(asked.url, (value) => value !== found.url);
      const newDescription = Option.filter(
        Option.map(asked.description, (value) => (value === "" ? null : value)),
        (value) => value !== found.description,
      );
      const newEnvironment = Option.filter(
        asked.environment,
        (value) => value !== found.environment,
      );
      const newEvents = Option.filter(
        asked.events,
        (events) =>
          events.length !== found.events.length ||
          events.some((one) => !found.events.includes(one)),
      );
      if (
        Option.isNone(newName) &&
        Option.isNone(newUrl) &&
        Option.isNone(newDescription) &&
        Option.isNone(newEnvironment) &&
        Option.isNone(newEvents)
      ) {
        return yield* printItem(mode, found, "Nothing changed.");
      }
      if (Option.contains(newEnvironment, "test")) {
        yield* confirmChange({
          yes,
          message: `Move ${webhookKind.label(found)} to test? It stops receiving the events of production purchases and receives those of store sandbox and test purchases instead.`,
        });
      }
      const updated = yield* api
        .webhooksUpdate(projectId, found.id, {
          name: Option.getOrUndefined(newName),
          url: Option.getOrUndefined(newUrl),
          description: Option.getOrUndefined(newDescription),
          events: Option.getOrUndefined(newEvents),
          environment: Option.getOrUndefined(newEnvironment),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              invalid_webhook_url:
                "Use a public URL. Voidhash does not call localhost or private networks.",
            }),
          ),
        );
      yield* printItem(
        mode,
        updated,
        [
          `Updated webhook ${webhookKind.label(updated)}.`,
          ...Arr.fromOption(
            Option.map(
              newUrl,
              () =>
                `Events go to the new URL from now on, retries of earlier ones too. Check it with 'voidhash-cli webhook test ${updated.id}'.`,
            ),
          ),
          ...Arr.fromOption(Option.map(newEvents, (events) => `It receives ${events.join(", ")}.`)),
          ...Arr.fromOption(
            Option.map(newEnvironment, (value) =>
              value === "test"
                ? "It receives the events of store sandbox and test purchases from now on, no longer production ones."
                : "It receives the events of production purchases from now on, no longer test ones.",
            ),
          ),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    `Change a webhook's name, URL, events, description or environment. Asks in a terminal when no flag is given. ${ENVIRONMENT_RULE}`,
  ),
);

/** `voidhash-cli webhook enable <webhook>` */
const webhookEnableCommand = Command.make(
  "enable",
  { webhook: webhookArgument, project: projectOption, ...outputOptions },
  ({ json, project, quiet, webhook }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        "voidhash-cli webhook enable <webhook>",
      );
      if (found.status === "active") {
        return yield* printItem(mode, found, `${webhookKind.label(found)} is already on.`);
      }
      const updated = yield* api.webhooksUpdate(projectId, found.id, { status: "active" });
      yield* printItem(
        mode,
        updated,
        [
          `Turned on ${webhookKind.label(updated)}; deliveries waiting for it are sent now.`,
          ...(found.status === "failed"
            ? [
                `Its failure count is cleared. Deliveries that gave up are not resent: 'voidhash-cli webhook deliveries ${updated.id} --failed', then 'voidhash-cli webhook retry'.`,
              ]
            : []),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Turn a webhook on again, also one Voidhash stopped after repeated failures.",
  ),
);

/** `voidhash-cli webhook disable <webhook> [--yes]` */
const webhookDisableCommand = Command.make(
  "disable",
  { webhook: webhookArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, project, quiet, webhook, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        "voidhash-cli webhook disable <webhook> --yes",
      );
      if (found.status === "disabled") {
        return yield* printItem(mode, found, `${webhookKind.label(found)} is already off.`);
      }
      yield* confirmChange({
        yes,
        message: `Turn off ${webhookKind.label(found)}? Events that happen while it is off are never sent to it, not even after it is turned on again.`,
      });
      const updated = yield* api.webhooksUpdate(projectId, found.id, { status: "disabled" });
      yield* printItem(
        mode,
        updated,
        `Turned off ${webhookKind.label(updated)}. Turn it on with 'voidhash-cli webhook enable ${updated.id}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Stop sending events to a webhook without deleting it. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli webhook delete <webhook> [--yes]` */
const webhookDeleteCommand = Command.make(
  "delete",
  { webhook: webhookArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, project, quiet, webhook, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        "voidhash-cli webhook delete <webhook> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Delete webhook ${webhookKind.label(found)} from ${projectKind(context.session).label(context.project)}, with its delivery history? It stops receiving events. This cannot be undone.`,
      });
      yield* api.webhooksDelete(projectId, found.id);
      yield* printItem(mode, found, `Deleted webhook ${webhookKind.label(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete a webhook and its delivery history. Asks first; --yes skips that. 'webhook disable' pauses one instead.",
  ),
);

/** `voidhash-cli webhook rotate <webhook> [--yes]` */
const webhookRotateCommand = Command.make(
  "rotate",
  { webhook: webhookArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, project, quiet, webhook, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        "voidhash-cli webhook rotate <webhook> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Replace the signing secret of ${webhookKind.label(found)}? The current secret stops working at once: your backend rejects deliveries until it verifies with the new one.`,
      });
      const rotated = yield* api.webhooksRotate(projectId, found.id);
      yield* printItem(
        mode,
        rotated,
        [
          `Replaced the signing secret of ${webhookKind.label(rotated)}.`,
          "",
          "New signing secret (shown only now):",
          `  ${rotated.secret}`,
          "",
          "Update the secret your backend verifies X-Webhook-Signature with and deploy it;",
          "Voidhash retries what fails meanwhile.",
          `Then check it with 'voidhash-cli webhook test ${rotated.id}'.`,
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Replace a webhook's signing secret and print the new one. The old one stops working at once. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli webhook test <webhook>` */
const webhookTestCommand = Command.make(
  "test",
  { webhook: webhookArgument, project: projectOption, ...outputOptions },
  ({ json, project, quiet, webhook }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        webhookKind,
        yield* listWebhooks(projectId),
        webhook,
        "voidhash-cli webhook test <webhook>",
      );
      if (found.status !== "active") {
        return yield* Effect.fail(
          userError(`${webhookKind.label(found)} is ${healthOf(found)}, so it is sent nothing.`, {
            hint: turnedOffHint(found),
          }),
        );
      }
      const sent = yield* api.webhooksTest(projectId, found.id);
      if (mode === "human") yield* Console.error(`Sent a test event to ${found.url}…`);
      const delivery = yield* awaitAnswer(projectId, sent.id);
      if (mode === "json") return yield* printJson(delivery);
      if (mode === "quiet") return yield* Console.log(delivery.id);
      const attempt = Arr.last(delivery.attempts);
      if (!isSettled(delivery) || Option.isNone(attempt)) {
        return yield* Effect.fail(
          userError(`${found.name} has not answered after ${ANSWER_WAIT} seconds.`, {
            hint: `See how it answers with 'voidhash-cli webhook delivery ${delivery.id}'.`,
          }),
        );
      }
      const took = attempt.value.durationMs === null ? "" : ` in ${attempt.value.durationMs} ms`;
      if (attempt.value.isSuccessful) {
        return yield* Console.log(
          `${found.name} answered HTTP ${attempt.value.statusCode ?? "-"}${took}: it is reachable and accepts deliveries.`,
        );
      }
      return yield* Effect.fail(
        userError(`${found.name} answered ${describeAnswer(attempt.value, 200)}${took}.`, {
          hint:
            attempt.value.statusCode === 401 || attempt.value.statusCode === 403
              ? `Your backend probably verifies the signature with another secret. 'voidhash-cli webhook rotate ${found.id}' gives a new one to store there.`
              : `Voidhash retries it like any delivery; fix the endpoint and test again.`,
        }),
      );
    }),
).pipe(
  Command.withDescription(
    "Send a signed test event to a webhook and show how it answered. Exits with 1 when it did not accept it.",
  ),
);

/** `voidhash-cli webhook deliveries [webhook] [--failed] [--limit]` */
const webhookDeliveriesCommand = Command.make(
  "deliveries",
  {
    webhook: webhookArgument.pipe(
      Argument.withDescription(
        "Only this webhook's deliveries: its name, URL or id (default: all)",
      ),
    ),
    failed: Flag.Boolean("failed").pipe(
      Flag.withDescription("Only deliveries that failed or gave up"),
      Flag.withDefault(false),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("How many to show, newest first (default 20, at most 100)"),
      Flag.withDefault(20),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ failed, json, limit, project, quiet, webhook }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (limit < 1 || limit > 100) {
        return yield* Effect.fail(
          userError("--limit takes 1 to 100.", { exitCode: ExitCode.usage }),
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const webhooks = yield* listWebhooks(projectId);
      const chosen = Option.isSome(webhook)
        ? [yield* requireItem(webhookKind, webhooks, webhook, "voidhash-cli webhook deliveries")]
        : webhooks;
      // The API filters neither by status nor across webhooks: read each one's newest page.
      const pages = yield* Effect.forEach(
        chosen,
        (one) => api.webhooksListDeliveries(projectId, one.id, { limit: 100 }),
        { concurrency: 4 },
      );
      const deliveries = Arr.sort(
        pages
          .flatMap((page) => page.data)
          .filter((delivery) => !failed || isUnsuccessful(delivery)),
        newestFirst,
      ).slice(0, limit);
      if (mode === "json") return yield* printJson(deliveries);
      if (mode === "quiet") return yield* printIds(deliveries);

      const now = yield* DateTime.now;
      const answers = yield* answersOf(projectId, deliveries);
      const nameOf = (id: string) => webhooks.find((one) => one.id === id)?.name ?? id;
      yield* printTable(
        [
          { header: "TIME", cell: (delivery) => formatTimeAgo(delivery.eventOccurredAt, now) },
          ...(chosen.length === 1
            ? []
            : [
                {
                  header: "WEBHOOK",
                  cell: (delivery: WebhookDeliveryJsonEncoding) => nameOf(delivery.webhookId),
                },
              ]),
          { header: "EVENT", cell: (delivery) => delivery.eventType },
          { header: "STATUS", cell: deliveryState },
          { header: "ANSWER", cell: answers },
          { header: "ID", cell: (delivery) => delivery.id },
        ],
        deliveries,
        Arr.isReadonlyArrayEmpty(webhooks)
          ? "No webhooks yet. Create one with 'voidhash-cli webhook create'."
          : failed
            ? "No failed deliveries."
            : "No deliveries yet.",
      );
      if (pages.some((page) => page.pageInfo.hasNextPage)) {
        yield* Console.error(
          "Read the newest 100 deliveries of each webhook; older ones are not shown.",
        );
      }
      if (deliveries.some((delivery) => delivery.status === "exhausted")) {
        yield* Console.error(
          "Send the ones that gave up again with 'voidhash-cli webhook retry <delivery>…'.",
        );
      }
    }),
).pipe(
  Command.withDescription(
    "List deliveries, newest first, across webhooks or of one, with how the webhook answered. --failed shows only failures.",
  ),
);

const deliveryIdArgument = Argument.String("delivery").pipe(
  Argument.withDescription("The delivery's id, as 'webhook deliveries' shows it"),
);

/** `voidhash-cli webhook delivery <delivery>` */
const webhookDeliveryCommand = Command.make(
  "delivery",
  { delivery: deliveryIdArgument, project: projectOption, ...outputOptions },
  ({ delivery, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* api.webhooksGetDelivery(projectId, delivery).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            webhook_delivery_not_found:
              "'voidhash-cli webhook deliveries' lists the deliveries of this project.",
          }),
        ),
      );
      if (mode === "json") return yield* printJson(found);
      if (mode === "quiet") return yield* Console.log(found.id);
      const now = yield* DateTime.now;
      const webhooks = yield* listWebhooks(projectId);
      const target = webhooks.find((one) => one.id === found.webhookId);
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          `${found.eventType} to ${target === undefined ? found.webhookId : webhookKind.label(target)}`,
          formatFields([
            ["Status", deliveryState(found)],
            [
              "Happened",
              `${formatDate(found.eventOccurredAt)} (${formatTimeAgo(found.eventOccurredAt, now)})`,
            ],
            ["Attempts", `${found.attemptCount} of ${found.maxAttempts}`],
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `settings/webhooks/${found.webhookId}/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
          "",
        ].join("\n"),
      );
      yield* printTable(
        [
          { header: "#", cell: (attempt) => String(attempt.attemptNumber) },
          {
            header: "TIME",
            cell: (attempt) => (attempt.createdAt === null ? "-" : formatDate(attempt.createdAt)),
          },
          { header: "RESULT", cell: (attempt) => (attempt.isSuccessful ? "accepted" : "failed") },
          {
            header: "DURATION",
            cell: (attempt) => (attempt.durationMs === null ? "-" : `${attempt.durationMs} ms`),
          },
          { header: "ANSWER", cell: (attempt) => describeAnswer(attempt, 80) },
        ],
        found.attempts,
        "No attempt yet.",
      );
      if (found.status === "exhausted") {
        yield* Console.error(`Send it again with 'voidhash-cli webhook retry ${found.id}'.`);
      }
    }),
).pipe(
  Command.withDescription(
    "Show one delivery with every attempt and how the webhook answered each.",
  ),
);

const RETRY_USAGE = "voidhash-cli webhook retry <delivery>…";

/** `voidhash-cli webhook retry [delivery…]` */
const webhookRetryCommand = Command.make(
  "retry",
  {
    deliveries: Argument.String("delivery").pipe(
      Argument.withDescription("The ids of the deliveries to send again"),
      Argument.variadic(),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ deliveries, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const webhooks = yield* listWebhooks(projectId);
      const ids = Arr.isReadonlyArrayNonEmpty(deliveries)
        ? Arr.dedupe(deliveries)
        : yield* Effect.gen(function* () {
            if (!(yield* isInteractive)) {
              return yield* Effect.fail(missingInput("the deliveries", RETRY_USAGE));
            }
            const pages = yield* Effect.forEach(
              webhooks.filter((one) => one.status === "active"),
              (one) => api.webhooksListDeliveries(projectId, one.id, { limit: 100 }),
              { concurrency: 4 },
            );
            const failedOnes = pages.flatMap((page) => page.data).filter(isUnsuccessful);
            if (Arr.isReadonlyArrayEmpty(failedOnes)) {
              return yield* Effect.fail(
                userError("No failed deliveries to send again.", {
                  hint: "'voidhash-cli webhook deliveries --failed' lists failures, also of webhooks that are off.",
                  exitCode: ExitCode.notFound,
                }),
              );
            }
            const now = yield* DateTime.now;
            return yield* Prompt.run(
              Prompt.MultiSelect({
                message: "Which deliveries should be sent again?",
                choices: failedOnes.map((one) => ({
                  title: `${one.eventType} to ${webhooks.find((hook) => hook.id === one.webhookId)?.name ?? one.webhookId}, ${formatTimeAgo(one.eventOccurredAt, now)} (${deliveryState(one)})`,
                  value: one.id,
                  selected: one.status === "exhausted",
                })),
              }),
            );
          });

      const results = yield* Effect.forEach(
        ids,
        (id) =>
          Effect.gen(function* () {
            const before = yield* api.webhooksGetDelivery(projectId, id);
            const target = webhooks.find((one) => one.id === before.webhookId);
            if (target !== undefined && target.status !== "active") {
              return {
                id,
                isDelivered: false,
                line: `${id}: not sent; ${target.name} is ${healthOf(target)}. ${turnedOffHint(target)}`,
                delivery: Option.some<WebhookDeliveryJsonEncoding>(before),
              };
            }
            yield* api.webhooksRetryDelivery(projectId, id);
            const after = yield* awaitAnswer(projectId, id);
            const answer = Option.match(Arr.last(after.attempts), {
              onNone: () => "",
              onSome: (attempt) => `: ${describeAnswer(attempt)}`,
            });
            return {
              id,
              isDelivered: after.status === "succeeded",
              line: !isSettled(after)
                ? `${id}: sent, no answer yet ('voidhash-cli webhook delivery ${id}')`
                : after.status === "succeeded"
                  ? `${id}: delivered${answer}`
                  : `${id}: failed again${answer}`,
              delivery: Option.some<WebhookDeliveryJsonEncoding>(after),
            };
          }).pipe(
            // One delivery that cannot be sent does not stop the others.
            Effect.catchIf(
              (error) =>
                Option.exists(
                  apiErrorCode(error),
                  (code) =>
                    code === "webhook_delivery_not_found" ||
                    code === "webhook_delivery_not_retryable",
                ),
              (error) =>
                Effect.succeed({
                  id,
                  isDelivered: false,
                  line: Option.contains(apiErrorCode(error), "webhook_delivery_not_found")
                    ? `${id}: no such delivery in this project`
                    : `${id}: not sent; it succeeded or is still being sent`,
                  delivery: Option.none<WebhookDeliveryJsonEncoding>(),
                }),
            ),
          ),
        { concurrency: 4 },
      );
      const sent = results.flatMap(({ delivery }) => Arr.fromOption(delivery));
      if (mode === "json") yield* printJson(sent);
      else if (mode === "quiet") yield* printIds(sent);
      else yield* Console.log(results.map(({ line }) => line).join("\n"));
      const undelivered = results.filter(({ isDelivered }) => !isDelivered);
      if (Arr.isReadonlyArrayNonEmpty(undelivered)) {
        return yield* Effect.fail(
          userError(
            `${undelivered.length} of ${results.length} ${results.length === 1 ? "delivery was" : "deliveries were"} not delivered.`,
            {
              hint: "Fix the endpoint first ('voidhash-cli webhook test <webhook>' checks it); Voidhash keeps retrying those that failed again.",
            },
          ),
        );
      }
    }),
).pipe(
  Command.withDescription(
    "Send failed deliveries again now and show how the webhook answered. Without ids it asks which in a terminal. Exits with 1 unless all were delivered.",
  ),
);

/** `voidhash-cli webhook …` */
export const webhookCommand = Command.make("webhook").pipe(
  Command.withAlias("webhooks"),
  Command.withDescription(
    "The backend URLs your project's events are sent to: create and change them, test them, and see and retry their deliveries.",
  ),
  Command.withSubcommands([
    webhookListCommand,
    webhookViewCommand,
    webhookCreateCommand,
    webhookEditCommand,
    webhookEnableCommand,
    webhookDisableCommand,
    webhookDeleteCommand,
    webhookRotateCommand,
    webhookTestCommand,
    webhookDeliveriesCommand,
    webhookDeliveryCommand,
    webhookRetryCommand,
  ]),
);

/** Finds a webhook for `voidhash-cli open webhook <webhook>`: its dashboard page. */
export const webhookPagePath = (projectId: string, input: Option.Option<string>) =>
  Effect.gen(function* () {
    const found = yield* requireItem(
      webhookKind,
      yield* listWebhooks(projectId),
      input,
      "voidhash-cli open webhook <webhook>",
    );
    return webhookPage(found);
  });
