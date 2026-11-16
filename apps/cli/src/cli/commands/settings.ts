import type {
  AdsKeyConversion,
  PaidAccessSharingMode,
  ProjectSettingsJsonEncoding,
  SandboxSettingsJsonEncoding,
} from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import { Argument, Command } from "effect/cli";

import { ApiClient, type ApiClientShape } from "../../utils/api-client";
import { ExitCode, ifPermitted, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { confirmChange, requireChoice, requireText } from "../input";
import { formatFields, printJson } from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";

/** Every setting `settings view` shows, as the API returns them. */
interface AllSettings {
  readonly project: ProjectSettingsJsonEncoding;
  /** `None` when the caller cannot read the sandbox. */
  readonly sandbox: Option.Option<SandboxSettingsJsonEncoding>;
}

const SHARING: Readonly<Record<PaidAccessSharingMode, string>> = {
  shared: "shared: both people keep access",
  transfer: "transfer: access moves to the person who restored it",
  disabled: "disabled: access stays with the person who bought it",
};

const CONVERSIONS: Readonly<Record<AdsKeyConversion, string>> = {
  signup: "signup: cost per signup",
  trial: "trial: cost per trial started",
  payer: "payer: cost per paying customer",
};

const onOff = (value: boolean) => (value ? "on" : "off");

/** The values a setting takes: one of a few words, or a whole number of days from 1 to `maxDays`. */
type SettingValues = { readonly choices: ReadonlyArray<string> } | { readonly maxDays: number };

const valuesUsage = (values: SettingValues) =>
  "choices" in values ? values.choices.join("|") : `1-${values.maxDays}`;

/** One setting `settings set` changes: its values, how it reads, and the request that changes it. */
interface Setting {
  readonly values: SettingValues;
  readonly describe: string;
  /** The current value; `None` when the caller cannot read it. */
  readonly read: (settings: AllSettings) => Option.Option<string>;
  /** Changes what end users of production apps get, so it asks first. */
  readonly reachesProduction: boolean;
  readonly write: (
    api: ApiClientShape,
    projectId: string,
    value: string,
  ) => Effect.Effect<unknown, unknown>;
}

const sharingMode = (value: string): PaidAccessSharingMode =>
  value === "shared" ? "shared" : value === "disabled" ? "disabled" : "transfer";

const SETTINGS: Readonly<Record<string, Setting>> = {
  "paid-access-sharing.production": {
    values: { choices: ["shared", "transfer", "disabled"] },
    describe: "When someone restores a purchase another account made, in production apps",
    read: (settings) => Option.some(settings.project.paidAccessSharing.production),
    reachesProduction: true,
    write: (api, projectId, value) =>
      api.projectsUpdateSettings(projectId, {
        paidAccessSharing: { production: sharingMode(value) },
      }),
  },
  "paid-access-sharing.sandbox": {
    values: { choices: ["shared", "transfer", "disabled"] },
    describe: "The same for store sandbox purchases (TestFlight, Play test tracks)",
    read: (settings) => Option.some(settings.project.paidAccessSharing.sandbox),
    reachesProduction: false,
    write: (api, projectId, value) =>
      api.projectsUpdateSettings(projectId, { paidAccessSharing: { sandbox: sharingMode(value) } }),
  },
  "store-sandbox-unlocks-production": {
    values: { choices: ["on", "off"] },
    describe:
      "Whether store sandbox purchases (TestFlight, App Review, Play test tracks) unlock access in production apps. Test purchases, such as Stripe test mode's, never do",
    read: (settings) => Option.some(onOff(settings.project.storeSandbox.isUnlockingProduction)),
    reachesProduction: true,
    write: (api, projectId, value) =>
      api.projectsUpdateSettings(projectId, {
        storeSandbox: { isUnlockingProduction: value === "on" },
      }),
  },
  "ads-key-conversion": {
    values: { choices: ["signup", "trial", "payer"] },
    describe: "The conversion ad spend is measured against; reports use it for past ranges too",
    read: (settings) => Option.some(settings.project.ads.keyConversion),
    reachesProduction: false,
    write: (api, projectId, value) =>
      api.projectsUpdateSettings(projectId, {
        ads: {
          keyConversion: value === "signup" ? "signup" : value === "trial" ? "trial" : "payer",
        },
      }),
  },
  "ads-attribution-window-days": {
    values: { maxDays: 90 },
    describe:
      "Days before a signup a touch may come and still be credited with it: the last touch from an ad within the window, else the last other touch. Signups with neither are unattributed. Reports use it for past ranges too",
    read: (settings) => Option.some(String(settings.project.ads.attributionWindowDays)),
    reachesProduction: false,
    write: (api, projectId, value) =>
      api.projectsUpdateSettings(projectId, { ads: { attributionWindowDays: Number(value) } }),
  },
  "sandbox-purchasing": {
    values: { choices: ["on", "off"] },
    describe:
      "Whether debug builds of your app in development mode can simulate purchases without a real store. They use the test publishable key, and the purchases are test ones",
    read: (settings) =>
      Option.map(settings.sandbox, (sandbox) => onOff(sandbox.isPurchasingEnabled)),
    reachesProduction: false,
    write: (api, projectId, value) =>
      api.sandboxUpdateSettings(projectId, { isPurchasingEnabled: value === "on" }),
  },
};

const SETTING_KEYS = R.keys(SETTINGS);

/** The project's settings, and its sandbox settings when the caller may read them. */
const readSettings = (projectId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const [project, sandbox] = yield* Effect.all(
      [api.projectsGetSettings(projectId), ifPermitted(api.sandboxGetSettings(projectId))],
      { concurrency: 2 },
    );
    return { project, sandbox } satisfies AllSettings;
  });

const settingsJson = (settings: AllSettings) => ({
  ...settings.project,
  sandbox: Option.getOrNull(settings.sandbox),
});

/** `voidhash-cli settings view` */
const settingsViewCommand = Command.make(
  "view",
  { project: projectOption, json: outputOptions.json },
  ({ json, project }) =>
    Effect.gen(function* () {
      const context = yield* resolveProject(project);
      const settings = yield* readSettings(context.project.id);
      if (json) return yield* printJson(settingsJson(settings));
      const { project: values } = settings;
      yield* Console.log(
        [
          `Settings of ${projectKind(context.session).label(context.project)}`,
          "",
          "Restored purchases: when someone restores a purchase another account of your app made",
          formatFields([
            ["paid-access-sharing.production", SHARING[values.paidAccessSharing.production]],
            ["paid-access-sharing.sandbox", SHARING[values.paidAccessSharing.sandbox]],
          ]),
          "",
          "Store sandbox: TestFlight, App Review and Play test track purchases (test purchases, such as Stripe test mode's, never unlock production)",
          formatFields([
            [
              "store-sandbox-unlocks-production",
              values.storeSandbox.isUnlockingProduction
                ? "on: they unlock access in production apps too"
                : "off: they unlock access only in apps using the test key",
            ],
          ]),
          "",
          "Simulated purchases: debug builds in development mode buy without a real store, with the test publishable key, and record test purchases",
          formatFields([
            [
              "sandbox-purchasing",
              Option.match(settings.sandbox, {
                onNone: () => "not shown: your role cannot read the sandbox",
                onSome: ({ isPurchasingEnabled }) =>
                  isPurchasingEnabled
                    ? "on: debug builds can simulate purchases; play store events with 'voidhash-cli sandbox'"
                    : "off: debug builds cannot simulate purchases",
              }),
            ],
          ]),
          "",
          "Ads",
          formatFields([
            ["ads-key-conversion", CONVERSIONS[values.ads.keyConversion]],
            [
              "ads-attribution-window-days",
              `${values.ads.attributionWindowDays}: a signup is credited to the last touch from an ad in the ${values.ads.attributionWindowDays} ${values.ads.attributionWindowDays === 1 ? "day" : "days"} before it, else the last other touch`,
            ],
          ]),
          "",
          "Change one with 'voidhash-cli settings set <key> <value>'.",
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show the project's settings: restored purchases, store sandbox, simulated purchases and ads.",
  ),
);

const settingsList = R.toEntries(SETTINGS)
  .map(([key, setting]) => `  ${key} ${valuesUsage(setting.values)}`)
  .join("\n");

/** `voidhash-cli settings set <key> <value> [--yes]` */
const settingsSetCommand = Command.make(
  "set",
  {
    key: Argument.String("key").pipe(
      Argument.withDescription(`The setting: ${SETTING_KEYS.join(", ")}`),
      Argument.optional,
    ),
    value: Argument.String("value").pipe(
      Argument.withDescription("Its new value"),
      Argument.optional,
    ),
    project: projectOption,
    yes: yesOption,
    json: outputOptions.json,
  },
  ({ json, key, project, value, yes }) =>
    Effect.gen(function* () {
      const usage = "voidhash-cli settings set <key> <value>";
      const name = yield* requireChoice(key, {
        flag: "the setting",
        message: "Which setting?",
        usage,
        choices: SETTING_KEYS.map((candidate) => ({ title: candidate, value: candidate })),
      });
      const setting = SETTINGS[name];
      if (setting === undefined) {
        return yield* Effect.fail(
          userError(`There is no setting ${name}. The settings are:\n${settingsList}`, {
            exitCode: ExitCode.usage,
          }),
        );
      }
      const { values } = setting;
      const valueInput = {
        flag: "the value",
        message: setting.describe,
        usage: `voidhash-cli settings set ${name} <${valuesUsage(values)}>`,
      };
      const typed =
        "choices" in values
          ? yield* requireChoice(value, {
              ...valueInput,
              choices: values.choices.map((candidate) => ({ title: candidate, value: candidate })),
            })
          : yield* requireText(value, valueInput);
      if ("choices" in values && !values.choices.includes(typed)) {
        return yield* Effect.fail(
          userError(`${name} is one of ${values.choices.join(", ")}, not ${typed}.`, {
            exitCode: ExitCode.usage,
          }),
        );
      }
      const days = Number(typed);
      if ("maxDays" in values && !(/^\d+$/.test(typed) && days >= 1 && days <= values.maxDays)) {
        return yield* Effect.fail(
          userError(
            `${name} is a whole number of days from 1 to ${values.maxDays}, not ${typed}.`,
            { exitCode: ExitCode.usage },
          ),
        );
      }
      const wanted = "maxDays" in values ? String(days) : typed;
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const before = setting.read(yield* readSettings(projectId));
      if (Option.contains(before, wanted)) {
        if (json) return yield* printJson(settingsJson(yield* readSettings(projectId)));
        return yield* Console.log(`${name} is already ${wanted}; nothing changed.`);
      }
      if (setting.reachesProduction) {
        yield* confirmChange({
          yes,
          message: `Change ${name} of ${projectKind(context.session).label(context.project)} from ${Option.getOrElse(before, () => "?")} to ${wanted}? It changes what end users of your production apps get from their next purchase or restore.`,
        });
      }
      yield* setting.write(api, projectId, wanted);
      if (json) return yield* printJson(settingsJson(yield* readSettings(projectId)));
      yield* Console.log(
        `${name}: ${Option.getOrElse(before, () => "?")} → ${wanted}. ${setting.describe}.`,
      );
    }),
).pipe(
  Command.withDescription(
    `Change one setting. Settings that change what production apps get ask first; --yes skips that.\n${settingsList}`,
  ),
);

/** `voidhash-cli settings …` */
export const settingsCommand = Command.make("settings").pipe(
  Command.withDescription("The project's settings, explained: view them and change one."),
  Command.withSubcommands([settingsViewCommand, settingsSetCommand]),
);
