import type {
  PushNotificationConfigurationJsonEncoding,
  PushNotificationDeliveryJsonEncoding,
  PushNotificationJsonEncoding,
  PushNotificationProviderType,
  PushNotificationStatus,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { chooseItem, confirmChange, isInteractive, requireChoice, requireText } from "../input";
import { formatTimeAgo, outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { dryRunOption, outputOptions, projectOption, yesOption } from "../shared-options";
import { findPerson, personKind } from "../persons";
import { PUSH_SERVICE_LABELS, PUSH_SERVICES, randomId } from "./workspace";

const STATUS_LABELS: Readonly<Record<PushNotificationStatus, string>> = {
  pending: "queued",
  in_progress: "sending",
  succeeded: "delivered",
  partial_failed: "partly failed",
  failed: "failed",
  no_recipients: "no devices",
};

const SERVICE_SHORT: Readonly<Record<PushNotificationProviderType, string>> = {
  apns: "APNs",
  fcm: "FCM",
};

const SET_HINT =
  "Set up a push service first: 'voidhash-cli push config set apns …' or 'voidhash-cli push config set fcm …'.";

/** The project's push configurations. */
const listConfigurations = (projectId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) => api.pushNotificationConfigurationsList(projectId, query)),
  );

/** `key=value` pairs of `--data`, as the notification's data. */
const parseData = (pairs: ReadonlyArray<string>) =>
  Effect.forEach(
    pairs,
    (pair) => {
      const index = pair.indexOf("=");
      return index <= 0
        ? Effect.fail(
            userError(`--data takes key=value, not ${pair}.`, { exitCode: ExitCode.usage }),
          )
        : Effect.succeed([pair.slice(0, index), pair.slice(index + 1)] as const);
    },
    { concurrency: 1 },
  ).pipe(Effect.map((entries) => R.fromEntries(entries)));

const SEND_USAGE = 'voidhash-cli push send --to <person> --title "<title>" --body "<body>"';

/** `voidhash-cli push send --to <person>… --title --body [--data key=value]…` */
const pushSendCommand = Command.make(
  "send",
  {
    to: Flag.String("to").pipe(
      Flag.withDescription("A person to notify: their distinct id, email or id; repeat for each"),
      Flag.atLeast(0),
    ),
    title: Flag.String("title").pipe(
      Flag.withDescription("The notification's title"),
      Flag.optional,
    ),
    body: Flag.String("body").pipe(Flag.withDescription("The notification's text"), Flag.optional),
    data: Flag.String("data").pipe(
      Flag.withDescription("Data for your app, as key=value; repeat for each"),
      Flag.atLeast(0),
    ),
    project: projectOption,
    yes: yesOption,
    dryRun: dryRunOption,
    ...outputOptions,
  },
  ({ body, data, dryRun, json, project, quiet, title, to, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      if (Arr.isReadonlyArrayEmpty(to)) {
        return yield* Effect.fail(
          userError("Who should get it? Pass --to <person> for each person.", {
            hint: `Run it as: ${SEND_USAGE}`,
            exitCode: ExitCode.usage,
          }),
        );
      }
      const payloadData = yield* parseData(data);
      // Find everyone and check the push services first, so nothing is sent by halves.
      const persons = Arr.dedupeWith(
        yield* Effect.forEach(to, (input) => findPerson(projectId, input), { concurrency: 4 }),
        (a, b) => a.id === b.id,
      );
      const enabled = (yield* listConfigurations(projectId)).filter(({ isEnabled }) => isEnabled);
      if (Arr.isReadonlyArrayEmpty(enabled)) {
        return yield* Effect.fail(
          userError(
            `${projectKind(context.session).label(context.project)} has no push service turned on, so nothing can be sent.`,
            { hint: SET_HINT },
          ),
        );
      }
      const messageTitle = yield* requireText(title, {
        flag: "--title",
        message: "Title",
        usage: SEND_USAGE,
      });
      const messageBody = yield* requireText(body, {
        flag: "--body",
        message: "Text",
        usage: SEND_USAGE,
      });
      const audience = persons.map(personKind.label).join(", ");
      const services = enabled.map(({ type }) => SERVICE_SHORT[type]).join(" and ");
      const summary = `"${messageTitle}" to ${persons.length === 1 ? audience : `${persons.length} people (${audience})`}, on every device they registered, through ${services}`;
      if (dryRun) return yield* Console.log(`Would send ${summary}. Nothing was sent.`);
      yield* confirmChange({ yes, message: `Send ${summary}? It cannot be taken back.` });
      const sent = yield* api
        .pushNotificationsCreate(projectId, {
          params: { "idempotency-key": yield* randomId },
          payload: {
            personIds: persons.map(({ id }) => id),
            title: messageTitle,
            body: messageBody,
            ...(R.isEmptyRecord(payloadData) ? {} : { data: payloadData }),
          },
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              push_notifications_not_configured: SET_HINT,
              push_notifications_not_enabled:
                "Push notifications are not enabled for this organization; contact Voidhash to turn them on.",
            }),
          ),
        );
      yield* printItem(
        mode,
        sent,
        sent.deviceCount === 0
          ? `Sent ${sent.id}, but none of their devices is registered for push, so it reaches nobody. Your app registers a device once its user allows notifications.`
          : `Sending to ${sent.deviceCount} device${sent.deviceCount === 1 ? "" : "s"} (${sent.id}). Follow it with 'voidhash-cli push deliveries ${sent.id}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Send a push notification to people's devices. Shows who it reaches and asks first; --yes skips that, --dry-run only shows.",
  ),
);

/** The title of a sent notification, when it is still kept. */
const titleOf = (notification: PushNotificationJsonEncoding) =>
  notification.isMessagePurged
    ? "(no longer kept)"
    : Option.getOrElse(Option.filter(R.get(notification.message, "title"), P.isString), () => "-");

/** `voidhash-cli push list [--limit]` */
const pushListCommand = Command.make(
  "list",
  {
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("How many of the latest to show, at most 100"),
      Flag.withDefault(20),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ json, limit, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const page = yield* api.pushNotificationsList(projectId, {
        limit: Math.min(Math.max(limit, 1), 100),
      });
      const notifications = page.data;
      if (mode === "json") return yield* printJson(notifications);
      if (mode === "quiet") return yield* printIds(notifications);
      const now = yield* DateTime.now;
      yield* printTable(
        [
          { header: "SENT", cell: (notification) => formatTimeAgo(notification.createdAt, now) },
          { header: "TITLE", cell: titleOf },
          { header: "STATUS", cell: (notification) => STATUS_LABELS[notification.status] },
          { header: "DEVICES", cell: (notification) => String(notification.deviceCount) },
          { header: "DELIVERED", cell: (notification) => String(notification.succeededCount) },
          { header: "FAILED", cell: (notification) => String(notification.failedCount) },
          { header: "SKIPPED", cell: (notification) => String(notification.skippedCount) },
          { header: "ID", cell: (notification) => notification.id },
        ],
        notifications,
        "No push notifications sent yet. Send one with 'voidhash-cli push send'.",
      );
      if (notifications.some(({ skippedCount }) => skippedCount > 0)) {
        yield* Console.error(
          "Skipped devices use a push service the project has not turned on; 'voidhash-cli push config list' shows them.",
        );
      }
    }),
).pipe(
  Command.withDescription(
    "List the latest push notifications with how many devices each reached, failed or skipped.",
  ),
);

const pushKind = {
  noun: "push notification",
  label: (notification: PushNotificationJsonEncoding) =>
    `${titleOf(notification)} (${notification.id})`,
  listCommand: "voidhash-cli push list",
  keys: () => [],
  names: () => [],
};

/** `voidhash-cli push deliveries [push] [--failed]` */
const pushDeliveriesCommand = Command.make(
  "deliveries",
  {
    push: Argument.String("push").pipe(
      Argument.withDescription("The push notification's id, as 'voidhash-cli push list' shows"),
      Argument.optional,
    ),
    failed: Flag.Boolean("failed").pipe(
      Flag.withDescription("Only deliveries that failed or gave up"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ failed, json, project, push, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const pushId = Option.isSome(push)
        ? push.value
        : (yield* isInteractive)
          ? (yield* chooseItem(
              pushKind,
              (yield* api.pushNotificationsList(projectId, { limit: 20 })).data,
            )).id
          : yield* Effect.fail(
              userError("Missing the push notification.", {
                hint: "Run it as: voidhash-cli push deliveries <push>; 'voidhash-cli push list' shows their ids.",
                exitCode: ExitCode.usage,
              }),
            );
      const statuses = failed ? (["failed", "exhausted"] as const) : ([undefined] as const);
      const deliveries: ReadonlyArray<PushNotificationDeliveryJsonEncoding> =
        (yield* Effect.forEach(
          statuses,
          (status) =>
            readAll((query) =>
              api.pushNotificationsListDeliveries(projectId, pushId, { ...query, status }),
            ),
          { concurrency: 2 },
        )).flat();
      if (mode === "json") return yield* printJson(deliveries);
      if (mode === "quiet") return yield* printIds(deliveries);
      yield* printTable(
        [
          { header: "PERSON", cell: (delivery) => delivery.personId },
          { header: "SERVICE", cell: (delivery) => SERVICE_SHORT[delivery.provider] },
          {
            header: "STATUS",
            cell: (delivery) => (delivery.status === "exhausted" ? "gave up" : delivery.status),
          },
          {
            header: "ATTEMPTS",
            cell: (delivery) => `${delivery.attemptCount}/${delivery.maxAttempts}`,
          },
          { header: "ERROR", cell: (delivery) => delivery.lastError ?? "-" },
          { header: "ID", cell: (delivery) => delivery.id },
        ],
        deliveries,
        failed ? "No delivery failed." : "It reached no devices.",
      );
    }),
).pipe(
  Command.withDescription(
    "Show how a push notification reached each device, and why deliveries failed.",
  ),
);

// ---------------------------------------------------------------------------
// push config
// ---------------------------------------------------------------------------

/** What a configuration says about its credentials, without showing them. */
const configurationSummary = (configuration: PushNotificationConfigurationJsonEncoding) =>
  [
    configuration.isEnabled ? "on" : "off",
    ...(configuration.key === null ? ["not set up yet"] : [`for ${configuration.key}`]),
  ].join(", ");

/** `voidhash-cli push config list` */
const pushConfigListCommand = Command.make(
  "list",
  { project: projectOption, ...outputOptions },
  ({ json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const configurations = yield* listConfigurations(projectId);
      if (mode === "json") return yield* printJson(configurations);
      if (mode === "quiet") return yield* printIds(configurations);
      yield* printTable(
        [
          { header: "SERVICE", cell: (configuration) => PUSH_SERVICE_LABELS[configuration.type] },
          { header: "STATUS", cell: configurationSummary },
          { header: "ID", cell: (configuration) => configuration.id },
        ],
        configurations,
        `No push service is set up. ${SET_HINT}`,
      );
    }),
).pipe(Command.withDescription("List the push services the project sends through."));

/**
 * Saves `settings` for the project's `type` configuration, creating it when
 * missing, and turns it on; the API checks the credentials when it does.
 */
const saveConfiguration = (
  projectId: string,
  type: PushNotificationProviderType,
  settings: Record<string, unknown>,
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const existing = Arr.findFirst(
      yield* listConfigurations(projectId),
      (item) => item.type === type,
    );
    const configuration = Option.isSome(existing)
      ? existing.value
      : yield* api.pushNotificationConfigurationsCreate(projectId, { type });
    return yield* api
      .pushNotificationConfigurationsUpdate(projectId, configuration.id, {
        isEnabled: true,
        configuration: settings,
      })
      .pipe(
        Effect.mapError((error) =>
          apiError(error, {
            invalid_push_notification_configuration:
              "Check the values and files you passed; nothing was turned on.",
            push_notification_configuration_key_taken:
              "Another push configuration of this project uses these credentials.",
          }),
        ),
      );
  });

const readText = (file: string, flag: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
    fileSystem
      .readFileString(file)
      .pipe(
        Effect.mapError(() =>
          userError(`Could not read ${file} (${flag}).`, { exitCode: ExitCode.usage }),
        ),
      ),
  );

const APNS_USAGE =
  "voidhash-cli push config set apns --team-id <id> --key-id <id> --key-file <AuthKey.p8> --bundle-id <bundle id>";

/** `voidhash-cli push config set apns …` */
const pushConfigSetApnsCommand = Command.make(
  "apns",
  {
    teamId: Flag.String("team-id").pipe(
      Flag.withDescription("Your Apple Developer team id, 10 characters"),
      Flag.optional,
    ),
    keyId: Flag.String("key-id").pipe(
      Flag.withDescription("The id of your APNs authentication key"),
      Flag.optional,
    ),
    keyFile: Flag.String("key-file").pipe(
      Flag.withDescription("The .p8 key file Apple gave you"),
      Flag.optional,
    ),
    bundleId: Flag.String("bundle-id").pipe(
      Flag.withDescription("Your app's bundle id, such as com.example.app"),
      Flag.optional,
    ),
    environment: Flag.Literals("environment", ["production", "sandbox"]).pipe(
      Flag.withDescription(
        "production for App Store and TestFlight builds, sandbox for Xcode builds",
      ),
      Flag.withDefault("production" as const),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ bundleId, environment, json, keyFile, keyId, project, quiet, teamId }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const team = yield* requireText(teamId, {
        flag: "--team-id",
        message: "Team id",
        usage: APNS_USAGE,
      });
      const key = yield* requireText(keyId, {
        flag: "--key-id",
        message: "Key id",
        usage: APNS_USAGE,
      });
      const file = yield* requireText(keyFile, {
        flag: "--key-file",
        message: ".p8 key file",
        usage: APNS_USAGE,
      });
      const bundle = yield* requireText(bundleId, {
        flag: "--bundle-id",
        message: "Bundle id",
        usage: APNS_USAGE,
      });
      const privateKeyContent = yield* readText(file, "--key-file");
      const saved = yield* saveConfiguration(projectId, "apns", {
        teamId: team,
        keyId: key,
        privateKeyContent,
        bundleId: bundle,
        environment,
      });
      yield* printItem(
        mode,
        saved,
        `Push through APNs is on for ${bundle} (${environment}). Send a test with 'voidhash-cli push send --to <your distinct id> --title Test --body Hello'.`,
      );
    }),
).pipe(Command.withDescription("Send to iOS devices through APNs with your authentication key."));

const ServiceAccount = Schema.Struct({ project_id: Schema.String });
const decodeServiceAccount = Schema.decodeUnknownOption(Schema.fromJsonString(ServiceAccount));

/** `voidhash-cli push config set fcm --service-account-file <json>` */
const pushConfigSetFcmCommand = Command.make(
  "fcm",
  {
    serviceAccountFile: Flag.String("service-account-file").pipe(
      Flag.withDescription("The Firebase service account key, a JSON file"),
      Flag.optional,
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ json, project, quiet, serviceAccountFile }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const file = yield* requireText(serviceAccountFile, {
        flag: "--service-account-file",
        message: "Service account JSON file",
        usage: "voidhash-cli push config set fcm --service-account-file <file.json>",
      });
      const serviceAccountJson = yield* readText(file, "--service-account-file");
      const account = yield* Effect.fromOption(decodeServiceAccount(serviceAccountJson)).pipe(
        Effect.mapError(() =>
          userError(`${file} is not a Firebase service account key.`, {
            hint: "Download one under Project settings → Service accounts in the Firebase console.",
            exitCode: ExitCode.usage,
          }),
        ),
      );
      const saved = yield* saveConfiguration(projectId, "fcm", {
        projectId: account.project_id,
        serviceAccountJson,
      });
      yield* printItem(
        mode,
        saved,
        `Push through Firebase Cloud Messaging is on for ${account.project_id}. Send a test with 'voidhash-cli push send --to <your distinct id> --title Test --body Hello'.`,
      );
    }),
).pipe(
  Command.withDescription("Send to Android (and iOS) devices through Firebase Cloud Messaging."),
);

const serviceArgument = Argument.ChoiceWithValue("service", PUSH_SERVICES).pipe(
  Argument.withDescription("apns or fcm"),
  Argument.optional,
);

/** The project's configuration of `service`, asked for on a terminal. */
const requireConfiguration = (
  projectId: string,
  service: Option.Option<PushNotificationProviderType>,
  usage: string,
) =>
  Effect.gen(function* () {
    const type = yield* requireChoice(service, {
      flag: "the service",
      message: "Which push service?",
      usage,
      choices: PUSH_SERVICES.map(([name, value]) => ({ title: name, value })),
    });
    const found = Arr.findFirst(yield* listConfigurations(projectId), (item) => item.type === type);
    if (Option.isNone(found)) {
      return yield* Effect.fail(
        userError(`${PUSH_SERVICE_LABELS[type]} is not set up in this project.`, {
          hint: `Set it up with 'voidhash-cli push config set ${type} …'.`,
          exitCode: ExitCode.notFound,
        }),
      );
    }
    return found.value;
  });

/** `voidhash-cli push config enable|disable <service>` */
const pushConfigToggleCommand = (isEnabled: boolean) =>
  Command.make(
    isEnabled ? "enable" : "disable",
    { service: serviceArgument, project: projectOption, ...outputOptions },
    ({ json, project, quiet, service }) =>
      Effect.gen(function* () {
        const mode = yield* outputModeOf({ json, quiet });
        const api = yield* ApiClient;
        const projectId = (yield* resolveProject(project)).project.id;
        const verb = isEnabled ? "enable" : "disable";
        const found = yield* requireConfiguration(
          projectId,
          service,
          `voidhash-cli push config ${verb} <apns|fcm>`,
        );
        const updated = yield* api
          .pushNotificationConfigurationsUpdate(projectId, found.id, { isEnabled })
          .pipe(
            Effect.mapError((error) =>
              apiError(error, {
                invalid_push_notification_configuration: `Its settings are incomplete; save them with 'voidhash-cli push config set ${found.type} …'.`,
              }),
            ),
          );
        yield* printItem(
          mode,
          updated,
          isEnabled
            ? `${PUSH_SERVICE_LABELS[found.type]} is on; push notifications reach its devices.`
            : `${PUSH_SERVICE_LABELS[found.type]} is off; push notifications skip its devices. Its credentials are kept.`,
        );
      }),
  ).pipe(
    Command.withDescription(
      isEnabled
        ? "Turn a push service back on with its saved credentials."
        : "Stop sending through a push service, keeping its credentials.",
    ),
  );

/** `voidhash-cli push config delete <service> [--yes]` */
const pushConfigDeleteCommand = Command.make(
  "delete",
  { service: serviceArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, project, quiet, service, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireConfiguration(
        projectId,
        service,
        "voidhash-cli push config delete <apns|fcm> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Delete the ${PUSH_SERVICE_LABELS[found.type]} credentials of ${projectKind(context.session).label(context.project)}? Push notifications skip its devices until it is set up again.`,
      });
      yield* api.pushNotificationConfigurationsDelete(projectId, found.id);
      yield* printItem(
        mode,
        found,
        `Deleted the ${PUSH_SERVICE_LABELS[found.type]} configuration.`,
      );
    }),
).pipe(
  Command.withDescription("Delete a push service's credentials. Asks first; --yes skips that."),
);

const pushConfigCommand = Command.make("config").pipe(
  Command.withDescription(
    "The push services the project sends through (APNs, FCM): list, set up, turn on or off, delete.",
  ),
  Command.withSubcommands([
    pushConfigListCommand,
    Command.make("set").pipe(
      Command.withDescription("Set up a push service with its credentials, and turn it on."),
      Command.withSubcommands([pushConfigSetApnsCommand, pushConfigSetFcmCommand]),
    ),
    pushConfigToggleCommand(true),
    pushConfigToggleCommand(false),
    pushConfigDeleteCommand,
  ]),
);

/** `voidhash-cli push …` */
export const pushCommand = Command.make("push").pipe(
  Command.withDescription(
    "Push notifications to your users' devices: send one, see how it went, set up push services.",
  ),
  Command.withSubcommands([
    pushSendCommand,
    pushListCommand,
    pushDeliveriesCommand,
    pushConfigCommand,
  ]),
);
