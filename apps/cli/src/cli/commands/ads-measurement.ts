import type { MetaMeasurementSettingsJsonEncoding } from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { Command, Flag, Prompt } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { resolveProject } from "../context";
import { confirmChange, isInteractive } from "../input";
import { formatFields, formatTimeAgo, printJson } from "../output";
import { projectOption, yesOption } from "../shared-options";

const jsonOption = Flag.Boolean("json").pipe(
  Flag.withDescription("Print the API object as JSON, for scripts"),
  Flag.withDefault(false),
);

const usage = (message: string, hint: string) =>
  Effect.fail(userError(message, { exitCode: ExitCode.usage, hint }));

/** A secret from standard input or a hidden prompt; flags would leave it in the shell's history. */
const readSecret = (options: {
  readonly label: string;
  readonly fromStdin: boolean;
  readonly stdinFlag: string;
}) =>
  Effect.gen(function* () {
    if (options.fromStdin) {
      const stdio = yield* Stdio.Stdio;
      const secret = (yield* stdio.stdin.pipe(Stream.decodeText(), Stream.mkString)).trim();
      if (secret === "") {
        return yield* usage(
          `Nothing was piped in as the ${options.label}.`,
          `Pipe it in: voidhash-cli ads measurement edit --${options.stdinFlag} < file`,
        );
      }
      return secret;
    }
    if (!(yield* isInteractive)) {
      return yield* usage(
        `There is no terminal to ask for the ${options.label} in.`,
        `Pipe it in: voidhash-cli ads measurement edit --${options.stdinFlag} < file`,
      );
    }
    const typed = yield* Prompt.run(
      Prompt.Password({
        message: `The ${options.label}`,
        validate: (text) =>
          text.trim() === "" ? Effect.fail("Paste it.") : Effect.succeed(text.trim()),
      }),
    );
    return Redacted.value(typed).trim();
  });

type Settings = MetaMeasurementSettingsJsonEncoding;

/** What the last error means for what happens next, by its kind. */
const LAST_ERROR_NOTES: Readonly<Record<string, string>> = {
  event_refused: "the rest went on",
  internal: "not about Meta; purchases wait where they are",
  permanent: "needs a fix; retrying until then",
  retryable: "retrying",
  unpriced: "check that your store's server notifications reach Voidhash",
};

/** Why purchases read since Meta last took one were not sent. */
const withheldOf = ({ conversionsWithheld: withheld }: Settings) =>
  (
    [
      [withheld.noAdDataSharing, "without $ad_data_sharing"],
      [withheld.noMatchKey, "with nothing to match them by"],
      [withheld.personGone, "erased"],
      [withheld.reversed, "refunded"],
    ] as const
  ).flatMap(([count, reason]) => (count === 0 ? [] : [`${count} ${reason}`]));

const agoOrNever = (at: Settings["conversionsLastRunAt"], now: DateTime.DateTime) =>
  at ? formatTimeAgo(at, now) : "never";

const printSettings = (settings: Settings, now: DateTime.DateTime) =>
  Console.log(
    formatFields([
      ["Conversions API", settings.isConversionsEnabled ? "on" : "off"],
      ["Dataset", settings.conversionsDatasetId ?? "-"],
      ["Access token", settings.hasConversionsToken ? "set" : "not set"],
      ["Test event code", settings.conversionsTestEventCode ?? "-"],
      ["Last sent", agoOrNever(settings.conversionsLastSentAt, now)],
      ["Last run", agoOrNever(settings.conversionsLastRunAt, now)],
      [
        "Last error",
        settings.conversionsLastError === null
          ? "none"
          : `${settings.conversionsLastError} (${
              settings.conversionsLastErrorKind === "event_refused" &&
              settings.conversionsRefusedInARow > 0
                ? `${settings.conversionsRefusedInARow} refused in a row, none taken since`
                : (LAST_ERROR_NOTES[settings.conversionsLastErrorKind ?? ""] ?? "see the dashboard")
            })`,
      ],
      ["Skipped", String(settings.conversionsSkippedTotal)],
      ["Not eligible", withheldOf(settings).join(", ") || "none"],
      ["Install referrer key", settings.hasInstallReferrerKey ? "set" : "not set"],
      [
        "Referrer key error",
        settings.installReferrerLastError
          ? `${settings.installReferrerLastError} (${agoOrNever(settings.installReferrerLastErrorAt, now)}); installs from Meta ads are losing their ad`
          : "none",
      ],
    ]),
  );

/** `voidhash-cli ads measurement view` */
const measurementViewCommand = Command.make(
  "view",
  { project: projectOption, json: jsonOption },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const settings = yield* api.metaMeasurementGetSettings(projectId);
      if (json) return yield* printJson(settings);
      yield* printSettings(settings, yield* DateTime.now);
      yield* Console.error(
        "Purchases go to Meta only for people whose $ad_data_sharing trait is true. Change these with 'voidhash-cli ads measurement edit'.",
      );
    }),
).pipe(
  Command.withDescription(
    "Show how purchases reach Meta's Conversions API, what keeps them from going, and whether the install referrer key works.",
  ),
);

/** `voidhash-cli ads measurement edit` */
const measurementEditCommand = Command.make(
  "edit",
  {
    enable: Flag.Boolean("enable").pipe(
      Flag.withDescription("Send purchases from now on (needs a dataset and a token); asks first"),
      Flag.withDefault(false),
    ),
    disable: Flag.Boolean("disable").pipe(
      Flag.withDescription("Stop sending; purchases made meanwhile are never sent"),
      Flag.withDefault(false),
    ),
    dataset: Flag.String("dataset").pipe(
      Flag.withDescription("The dataset id from Meta's Events Manager"),
      Flag.optional,
    ),
    token: Flag.Boolean("token").pipe(
      Flag.withDescription("Ask, hidden, for the dataset's Conversions API access token"),
      Flag.withDefault(false),
    ),
    tokenStdin: Flag.Boolean("token-stdin").pipe(
      Flag.withDescription("Read the access token from standard input"),
      Flag.withDefault(false),
    ),
    clearToken: Flag.Boolean("clear-token").pipe(
      Flag.withDescription("Remove the access token"),
      Flag.withDefault(false),
    ),
    testEventCode: Flag.String("test-event-code").pipe(
      Flag.withDescription("The code from Meta's Test Events tab; events then only show up there"),
      Flag.optional,
    ),
    clearTestEventCode: Flag.Boolean("clear-test-event-code").pipe(
      Flag.withDescription("Stop marking events as tests"),
      Flag.withDefault(false),
    ),
    installReferrerKey: Flag.Boolean("install-referrer-key").pipe(
      Flag.withDescription("Ask, hidden, for Meta's install referrer decryption key"),
      Flag.withDefault(false),
    ),
    installReferrerKeyStdin: Flag.Boolean("install-referrer-key-stdin").pipe(
      Flag.withDescription("Read the install referrer key from standard input"),
      Flag.withDefault(false),
    ),
    clearInstallReferrerKey: Flag.Boolean("clear-install-referrer-key").pipe(
      Flag.withDescription("Remove the install referrer key"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    json: jsonOption,
    yes: yesOption,
  },
  (flags) =>
    Effect.gen(function* () {
      if (flags.enable && flags.disable) {
        return yield* usage("--enable and --disable contradict each other.", "Pass one of them.");
      }
      if (flags.tokenStdin && flags.installReferrerKeyStdin) {
        return yield* usage(
          "Standard input can carry one secret.",
          "Run the command once for each, or leave one out to be asked for it.",
        );
      }
      const wantsToken = flags.token || flags.tokenStdin;
      const wantsKey = flags.installReferrerKey || flags.installReferrerKeyStdin;
      const changesSomething =
        flags.enable ||
        flags.disable ||
        Option.isSome(flags.dataset) ||
        Option.isSome(flags.testEventCode) ||
        wantsToken ||
        wantsKey ||
        flags.clearToken ||
        flags.clearTestEventCode ||
        flags.clearInstallReferrerKey;
      if (!changesSomething) {
        return yield* usage(
          "Nothing to change.",
          "See 'voidhash-cli ads measurement edit --help' for what it can set.",
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(flags.project)).project.id;
      const conversionsToken = wantsToken
        ? yield* readSecret({
            fromStdin: flags.tokenStdin,
            label: "Conversions API access token",
            stdinFlag: "token-stdin",
          })
        : flags.clearToken
          ? null
          : undefined;
      const installReferrerKey = wantsKey
        ? yield* readSecret({
            fromStdin: flags.installReferrerKeyStdin,
            label: "Meta install referrer key",
            stdinFlag: "install-referrer-key-stdin",
          })
        : flags.clearInstallReferrerKey
          ? null
          : undefined;
      if (flags.enable) {
        yield* confirmChange({
          message:
            "Send the purchases of people whose $ad_data_sharing trait is true to Meta, from now on?",
          yes: flags.yes,
        });
      }
      const settings = yield* api
        .metaMeasurementUpdateSettings(projectId, {
          conversionsDatasetId: Option.getOrUndefined(flags.dataset),
          conversionsTestEventCode: flags.clearTestEventCode
            ? null
            : Option.getOrUndefined(flags.testEventCode),
          conversionsToken,
          installReferrerKey,
          isConversionsEnabled: flags.enable ? true : flags.disable ? false : undefined,
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              conversions_not_configured:
                "Set both with: voidhash-cli ads measurement edit --dataset <id> --token",
              invalid_dataset_id: "Pass the number from Meta's Events Manager.",
              invalid_install_referrer_key:
                "Paste the 64 hexadecimal characters Meta shows for your app.",
              invalid_test_event_code: "Pass the code from Meta's Test Events tab.",
            }),
          ),
        );
      if (flags.json) return yield* printJson(settings);
      yield* printSettings(settings, yield* DateTime.now);
    }),
).pipe(
  Command.withDescription(
    "Set how purchases reach Meta's Conversions API, and the install referrer key. Secrets are asked for (hidden) or piped in, never passed as a flag's value.",
  ),
);

/** `voidhash-cli ads measurement …` */
export const adsMeasurementCommand = Command.make("measurement").pipe(
  Command.withDescription(
    "Meta's Conversions API and install referrer key: what Voidhash tells Meta, separate from what it reads.",
  ),
  Command.withSubcommands([measurementViewCommand, measurementEditCommand]),
);
