/**
 * `voidhash-cli experiment …`: A/B tests of paywalls and feature flags. An
 * experiment splits end users between arms, each showing a paywall at its
 * paywall locations, giving feature flags a value, or both. Metrics are fixed
 * once it starts; arms are locked while it runs.
 */
import type {
  ExperimentJsonEncoding,
  ExperimentResultsJsonEncoding,
  ExperimentStatus,
  ExperimentVariantJsonEncoding,
  FeatureFlagJsonEncoding,
  PaywallJsonEncoding,
  PaywallLocationJsonEncoding,
} from "@voidhash/generated-clients";
import { compareArmToControl, significanceLevel } from "@voidhash/lib/experiment-results";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import { confirmChange, findItem, type ItemKind, requireItem, requireText } from "../input";
import {
  formatDate,
  formatFields,
  formatMoney,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printItem,
  printJson,
  printTable,
} from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { flagKind, percent } from "./flag";
import { printable } from "../../utils/printable";

export const experimentKind: ItemKind<ExperimentJsonEncoding> = {
  noun: "experiment",
  label: (experiment) => experiment.name,
  listCommand: "voidhash-cli experiment list",
  createCommand: "voidhash-cli experiment create",
  keys: () => [],
  names: (experiment) => [experiment.name],
};

const armKind: ItemKind<ExperimentVariantJsonEncoding> = {
  noun: "arm",
  label: (arm) => arm.name,
  listCommand: "voidhash-cli experiment view <experiment>",
  keys: () => [],
  names: (arm) => [arm.name, ...(arm.isControl ? ["control"] : [])],
};

const locationKind: ItemKind<PaywallLocationJsonEncoding> = {
  noun: "paywall location",
  label: (location) => `${location.name} (${location.slug})`,
  listCommand: "voidhash-cli location list",
  keys: (location) => [location.slug],
  names: (location) => [location.name],
};

const paywallKind: ItemKind<PaywallJsonEncoding> = {
  noun: "paywall",
  label: (paywall) => `${paywall.name} (${paywall.slug})`,
  listCommand: "voidhash-cli paywall list",
  keys: (paywall) => [paywall.slug],
  names: (paywall) => [paywall.name],
};

const experimentArgument = Argument.String("experiment").pipe(
  Argument.withDescription("The experiment's name or id"),
  Argument.optional,
);

const STATUSES = [
  ["draft", "draft"],
  ["running", "running"],
  ["paused", "paused"],
  ["concluded", "concluded"],
] as const satisfies ReadonlyArray<readonly [string, ExperimentStatus]>;

/** The event results count when an experiment names none. */
const DEFAULT_METRIC = "purchase_completed";

const listExperiments = (projectId: string, archived: boolean) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) =>
      api.experimentsList(projectId, { ...query, isArchived: archived ? "true" : "false" }),
    ),
  );

const armsOf = (projectId: string, experimentId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) => api.experimentsListVariants(projectId, experimentId, query)),
  );

/** The experiment a command names, in use or archived. */
const requireExperiment = (projectId: string, input: Option.Option<string>, usage: string) =>
  Effect.gen(function* () {
    const [inUse, archived] = yield* Effect.all(
      [listExperiments(projectId, false), listExperiments(projectId, true)],
      { concurrency: 2 },
    );
    return yield* requireItem(experimentKind, [...inUse, ...archived], input, usage);
  });

/** The project's paywall locations and paywalls, to name placements. */
const listPlaces = (projectId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    Effect.all(
      [
        readAll((query) => api.paywallLocationsList(projectId, query)),
        readAll((query) => api.paywallsList(projectId, query)),
      ],
      { concurrency: 2 },
    ),
  ).pipe(Effect.map(([locations, paywalls]) => ({ locations, paywalls })));
type Places = Effect.Success<ReturnType<typeof listPlaces>>;

/** The project's feature flags in use, which an arm may give a value. */
const listFlagsInUse = (projectId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) => api.featureFlagsList(projectId, { ...query, isArchived: "false" })),
  );

/** A flag value as people write it: "new-checkout off", "headline on (short)". */
const flagValueLabel = (
  value: ExperimentVariantJsonEncoding["flagValues"][number],
  flags: ReadonlyArray<FeatureFlagJsonEncoding>,
) =>
  `${flags.find(({ id }) => id === value.featureFlagId)?.key ?? value.featureFlagId} ${
    value.isEnabled ? `on${value.variantKey === null ? "" : ` (${value.variantKey})`}` : "off"
  }`;

/** What an arm does: the paywall it shows where, and the value it gives each flag. */
const armDoesLabel = (
  arm: ExperimentVariantJsonEncoding,
  places: Places,
  flags: ReadonlyArray<FeatureFlagJsonEncoding>,
) => {
  const shows = arm.placements.map((placement) => {
    const paywall = places.paywalls.find(({ id }) => id === placement.paywallId);
    const location = places.locations.find(({ id }) => id === placement.paywallLocationId);
    return `${paywall?.slug ?? placement.paywallId} at ${location?.slug ?? placement.paywallLocationId}`;
  });
  const sets = arm.flagValues.map((value) => flagValueLabel(value, flags));
  return Arr.match([...shows, ...sets], {
    onEmpty: () => "no paywall placed, no flag set",
    onNonEmpty: (parts) => parts.join(", "),
  });
};

const statusLabel = (experiment: ExperimentJsonEncoding, now: DateTime.DateTime) =>
  experiment.status === "running" && experiment.startedAt !== null
    ? `running since ${formatTimeAgo(experiment.startedAt, now)}`
    : experiment.status === "paused"
      ? "paused (everyone sees the control)"
      : experiment.status;

/** The dashboard page of the experiment `input` names, for `voidhash-cli open experiment <experiment>`. */
export const experimentPagePath = (projectId: string, input: Option.Option<string>) =>
  Effect.map(
    requireExperiment(projectId, input, "voidhash-cli open experiment <experiment>"),
    (experiment) => `experiments/${experiment.id}`,
  );

// ---------------------------------------------------------------------------
// Arms from the command line
// ---------------------------------------------------------------------------

const armOptions = {
  location: Flag.String("location").pipe(
    Flag.withDescription("The paywall location every --arm NAME=PAYWALL shows at"),
    Flag.optional,
  ),
  arm: Flag.String("arm").pipe(
    Flag.withDescription(
      "An arm as NAME=PAYWALL (with --location) or NAME=LOCATION:PAYWALL[,LOCATION:PAYWALL]; repeat for each, the control first. Replaces the arms",
    ),
    Flag.atLeast(0),
  ),
  control: Flag.String("control").pipe(
    Flag.withDescription("Which --arm is the control (default: the first)"),
    Flag.optional,
  ),
  weights: Flag.String("weights").pipe(
    Flag.withDescription("The share of each --arm, in order, such as 60,40 (default: even)"),
    Flag.optional,
  ),
  flag: Flag.String("flag").pipe(
    Flag.withDescription(
      "A feature flag the arms set, as KEY=VALUE,VALUE with one value per --arm, in order: on, off, or one of the flag's variant keys. Repeat for each flag; an --arm needs no paywall then",
    ),
    Flag.atLeast(0),
  ),
};

const armsUsage = "--arm 'Control=monthly' --arm 'Annual first=annual' --location onboarding-end";
const flagsUsage = "--arm Control --arm 'New checkout' --flag 'new-checkout=off,on'";

/**
 * The arms `--arm` describes, with their placements resolved and existing
 * arms of the same name kept, so their end users stay in them.
 */
const parseArms = (
  projectId: string,
  options: {
    readonly arm: ReadonlyArray<string>;
    readonly location: Option.Option<string>;
    readonly control: Option.Option<string>;
    readonly weights: Option.Option<string>;
    readonly flag: ReadonlyArray<string>;
  },
  existing: ReadonlyArray<ExperimentVariantJsonEncoding>,
) =>
  Effect.gen(function* () {
    if (options.arm.length < 2) {
      return yield* Effect.fail(
        userError("An experiment needs at least two arms.", {
          hint: `Pass an --arm for each: ${armsUsage}, or ${flagsUsage}`,
          exitCode: ExitCode.usage,
        }),
      );
    }
    // Each --flag gives every arm a value, in the order of --arm.
    const flags = Arr.isReadonlyArrayEmpty(options.flag) ? [] : yield* listFlagsInUse(projectId);
    const flagValues = yield* Effect.forEach(
      options.flag,
      (spec) =>
        Effect.gen(function* () {
          const [key = "", ...rest] = spec.split("=");
          const values = rest
            .join("=")
            .split(",")
            .map((value) => value.trim());
          if (values.length !== options.arm.length || values.some((value) => value === "")) {
            return yield* Effect.fail(
              userError(`--flag ${spec} needs one value per --arm, in order.`, {
                hint: `Each is on, off or one of the flag's variant keys: ${flagsUsage}`,
                exitCode: ExitCode.usage,
              }),
            );
          }
          const flag = yield* findItem(flagKind, flags, key.trim());
          return values.map((value) => ({
            featureFlagId: flag.id,
            isEnabled: value.toLowerCase() !== "off",
            ...(value.toLowerCase() === "on" || value.toLowerCase() === "off"
              ? {}
              : { variantKey: value }),
          }));
        }),
      { concurrency: 1 },
    );
    const places = yield* listPlaces(projectId);
    const defaultLocation = yield* Effect.transposeOption(
      Option.map(options.location, (input) => findItem(locationKind, places.locations, input)),
    );
    const weights = Option.map(options.weights, (text) =>
      text.split(",").map((part) => Number(part.replace(/%$/, "").trim())),
    );
    if (
      Option.exists(
        weights,
        (list) =>
          list.length !== options.arm.length ||
          list.some((weight) => !Number.isFinite(weight)) ||
          Math.round(list.reduce((sum, weight) => sum + weight, 0) * 100) !== 10_000,
      )
    ) {
      return yield* Effect.fail(
        userError("--weights needs one share per --arm, totalling 100.", {
          hint: "Such as --weights 60,40, or leave it out for an even split.",
          exitCode: ExitCode.usage,
        }),
      );
    }
    const parsed = yield* Effect.forEach(
      options.arm,
      (spec) =>
        Effect.gen(function* () {
          const [name = "", ...rest] = spec.split("=");
          const placementsSpec = rest.join("=").trim();
          const placements =
            placementsSpec === ""
              ? []
              : yield* Effect.forEach(
                  placementsSpec.split(","),
                  (part) =>
                    Effect.gen(function* () {
                      const [first = "", second] = part.split(":");
                      const location =
                        second === undefined
                          ? yield* Option.match(defaultLocation, {
                              onSome: Effect.succeed,
                              onNone: () =>
                                Effect.fail(
                                  userError(`Where does arm ${name.trim()} show ${first.trim()}?`, {
                                    hint: `Pass --location, or write it as NAME=LOCATION:PAYWALL: ${armsUsage}`,
                                    exitCode: ExitCode.usage,
                                  }),
                                ),
                            })
                          : yield* findItem(locationKind, places.locations, first.trim());
                      const paywall = yield* findItem(
                        paywallKind,
                        places.paywalls,
                        (second ?? first).trim(),
                      );
                      return { paywallLocationId: location.id, paywallId: paywall.id };
                    }),
                  { concurrency: 1 },
                );
          return { name: name.trim(), placements };
        }),
      { concurrency: 1 },
    );
    const controlIndex = Option.match(options.control, {
      onNone: () => 0,
      onSome: (wanted) =>
        parsed.findIndex((arm) => arm.name.toLowerCase() === wanted.toLowerCase()),
    });
    if (controlIndex < 0) {
      return yield* Effect.fail(
        userError(`No --arm is named ${Option.getOrElse(options.control, () => "")}.`, {
          hint: "--control names one of the --arm names.",
          exitCode: ExitCode.usage,
        }),
      );
    }
    const even = Math.floor(10_000 / parsed.length);
    const variants = parsed.map((arm, index) => {
      const kept = existing.find(
        (candidate) => candidate.name.toLowerCase() === arm.name.toLowerCase(),
      );
      const weightBps = Option.match(weights, {
        onNone: () => even + (index === controlIndex ? 10_000 - even * parsed.length : 0),
        onSome: (list) => Math.round((list[index] ?? 0) * 100),
      });
      return {
        ...(kept === undefined ? {} : { id: kept.id }),
        name: arm.name,
        isControl: index === controlIndex,
        weightPercentage: weightBps / 100,
        placements: arm.placements,
        flagValues: flagValues.flatMap((values) => Arr.fromNullishOr(values[index])),
      };
    });
    const removed = existing.filter(
      (arm) => !variants.some((variant) => "id" in variant && variant.id === arm.id),
    );
    return { variants, removed };
  });

// ---------------------------------------------------------------------------
// Results, read honestly
// ---------------------------------------------------------------------------

/**
 * Each arm against the control, as `@voidhash/lib/experiment-results` reads
 * it (the verdict the MCP tool `get_experiment_results` gives too).
 */
const verdictLines = (
  experiment: ExperimentJsonEncoding,
  arms: ReadonlyArray<ExperimentVariantJsonEncoding>,
  results: ExperimentResultsJsonEncoding,
) => {
  if (experiment.status === "draft") return ["It has not started, so there are no results yet."];
  const resultOf = (arm: ExperimentVariantJsonEncoding) =>
    results.variants.find((result) => result.variantId === arm.id) ?? {
      exposures: 0,
      conversions: 0,
      conversionRate: 0,
    };
  const control = arms.find((arm) => arm.isControl);
  if (control === undefined) return [];
  const base = resultOf(control);
  const others = arms.filter((arm) => !arm.isControl);
  const alpha = significanceLevel(others.length);
  const rate = (value: number) => `${(value * 100).toFixed(1)}%`;
  return [
    ...others.map((arm) => {
      const result = resultOf(arm);
      const versus = `${rate(result.conversionRate)} vs ${rate(base.conversionRate)}`;
      const read = compareArmToControl(result, base, alpha);
      if (read.verdict === "no_data")
        return `${arm.name}: nobody has been shown it, or the control, yet.`;
      if (read.verdict === "too_early")
        return `${arm.name}: too early to tell (${versus}); any difference now is likely noise.`;
      if (read.verdict === "no_difference")
        return `${arm.name}: no clear difference from ${control.name} (${versus}, p = ${read.pValue.toPrecision(2)}); only a difference of about ${(read.detectableDifference * 100).toFixed(1)} points would show at this size.`;
      return `${arm.name} converts ${read.verdict === "winner" ? "better" : "worse"} than ${control.name} (${versus}, p = ${read.pValue.toPrecision(2)}), unlikely to be chance.`;
    }),
    "Revenue is as measured, without a significance test.",
  ];
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** `voidhash-cli experiment list [--status] [--archived]` */
const experimentListCommand = Command.make(
  "list",
  {
    project: projectOption,
    status: Flag.ChoiceWithValue("status", STATUSES).pipe(
      Flag.withDescription("Only experiments in this status"),
      Flag.optional,
    ),
    archived: Flag.Boolean("archived").pipe(
      Flag.withDescription("List archived experiments instead"),
      Flag.withDefault(false),
    ),
    ...outputOptions,
  },
  ({ archived, json, project, quiet, status }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const experiments = yield* readAll((query) =>
        api.experimentsList(projectId, {
          ...query,
          status: Option.getOrUndefined(status),
          isArchived: archived ? "true" : "false",
        }),
      );
      if (mode === "json") return yield* printJson(experiments);
      if (mode === "quiet") return yield* printIds(experiments);
      const now = yield* DateTime.now;
      const rows = yield* Effect.forEach(
        experiments,
        (experiment) =>
          Effect.map(armsOf(projectId, experiment.id), (arms) => ({ experiment, arms })),
        { concurrency: 8 },
      );
      yield* printTable(
        [
          { header: "NAME", cell: ({ experiment }) => experiment.name },
          { header: "STATUS", cell: ({ experiment }) => statusLabel(experiment, now) },
          {
            header: "ARMS",
            cell: ({ arms }) =>
              arms.map((arm) => `${arm.name} ${percent(arm.weightPercentage)}`).join(", ") || "-",
          },
          { header: "ID", cell: ({ experiment }) => experiment.id },
        ],
        rows,
        "No experiments yet. Set one up with 'voidhash-cli experiment create'.",
      );
    }),
).pipe(Command.withDescription("List the project's experiments with their status and arms."));

/** `voidhash-cli experiment view <experiment>` */
const experimentViewCommand = Command.make(
  "view",
  { experiment: experimentArgument, project: projectOption, ...outputOptions },
  ({ experiment, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireExperiment(
        projectId,
        experiment,
        "voidhash-cli experiment view <experiment>",
      );
      if (mode === "quiet") return yield* printIds([found]);
      const arms = yield* armsOf(projectId, found.id);
      if (mode === "json") return yield* printJson({ ...found, arms });
      const places = yield* listPlaces(projectId);
      const flags = arms.some((arm) => Arr.isReadonlyArrayNonEmpty(arm.flagValues))
        ? yield* listFlagsInUse(projectId)
        : [];
      const now = yield* DateTime.now;
      const { web_url } = yield* readCliConfig;
      const winner = arms.find((arm) => arm.id === found.winningVariantId);
      const next =
        found.status === "draft"
          ? `start it with 'voidhash-cli experiment start ${found.id}'`
          : found.status === "running"
            ? `'voidhash-cli experiment results ${found.id}' shows how it is doing`
            : found.status === "paused"
              ? `resume it with 'voidhash-cli experiment start ${found.id}'`
              : "it cannot run again";
      yield* Console.log(
        [
          printable(found.name),
          formatFields([
            [
              "Status",
              `${statusLabel(found, now)}${found.isArchived ? ", archived" : ""}; ${next}`,
            ],
            ...Arr.fromOption(
              Option.map(
                Option.fromNullishOr(found.hypothesis),
                (text) => ["Hypothesis", text] as const,
              ),
            ),
            [
              "Conversion",
              `${found.primaryMetricEventName ?? `${DEFAULT_METRIC} (default)`}${found.status === "draft" ? "" : ", fixed since it started"}`,
            ],
            [
              "Arms",
              arms
                .map(
                  (arm) =>
                    `${arm.name}${arm.isControl ? " (control)" : ""}  ${percent(arm.weightPercentage)}  ${armDoesLabel(arm, places, flags)}`,
                )
                .join("\n"),
            ],
            ...Arr.fromOption(
              Option.map(Option.fromNullishOr(winner), (arm) => ["Winner", arm.name] as const),
            ),
            ...Arr.fromOption(
              Option.map(
                Option.fromNullishOr(found.startedAt),
                (time) => ["Started", formatDate(time)] as const,
              ),
            ),
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `experiments/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show an experiment: its status, metric, the paywall each arm shows where and the value it gives each flag.",
  ),
);

const setupOptions = {
  hypothesis: Flag.String("hypothesis").pipe(
    Flag.withDescription("What you expect to happen"),
    Flag.optional,
  ),
  metric: Flag.String("metric").pipe(
    Flag.withDescription(
      `The event that counts as a conversion (default: ${DEFAULT_METRIC}); fixed once it starts`,
    ),
    Flag.optional,
  ),
};

const CREATE_USAGE = `voidhash-cli experiment create --name <name> ${armsUsage}`;

/** `voidhash-cli experiment create [--name] [--hypothesis] [--metric] [--arm]…` */
const experimentCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(
      Flag.withDescription("Such as Annual-first onboarding"),
      Flag.optional,
    ),
    ...setupOptions,
    ...armOptions,
    ...outputOptions,
  },
  ({ arm, control, flag, hypothesis, json, location, metric, name, project, quiet, weights }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const experimentName = yield* requireText(name, {
        flag: "--name",
        message: "Name",
        usage: CREATE_USAGE,
      });
      // Find the paywalls and flags first, so a typo creates nothing.
      const arms =
        Arr.isReadonlyArrayEmpty(arm) && Arr.isReadonlyArrayEmpty(flag)
          ? Option.none()
          : Option.some(yield* parseArms(projectId, { arm, location, control, weights, flag }, []));
      const created = yield* api.experimentsCreate(projectId, { name: experimentName });
      const experiment =
        Option.isSome(hypothesis) || Option.isSome(metric)
          ? yield* api.experimentsUpdate(projectId, created.id, {
              hypothesis: Option.getOrUndefined(hypothesis),
              primaryMetricEventName: Option.getOrUndefined(metric),
            })
          : created;
      if (Option.isSome(arms)) {
        yield* api.experimentsReplaceVariants(projectId, created.id, {
          variants: arms.value.variants,
        });
      }
      yield* printItem(
        mode,
        experiment,
        [
          `Created ${experiment.name} as a draft.`,
          "Next:",
          ...(Option.isNone(arms)
            ? [
                `  Give each arm a paywall: 'voidhash-cli experiment edit ${experiment.id} ${armsUsage}'`,
                `  Or a value for a flag: 'voidhash-cli experiment edit ${experiment.id} ${flagsUsage}'`,
              ]
            : []),
          `  Start it: 'voidhash-cli experiment start ${experiment.id}'`,
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Set up an experiment as a draft, optionally with its arms."));

/** `voidhash-cli experiment edit <experiment> [--name] [--hypothesis] [--metric] [--arm]…` */
const experimentEditCommand = Command.make(
  "edit",
  {
    experiment: experimentArgument,
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    description: Flag.String("description").pipe(
      Flag.withDescription("What it is for"),
      Flag.optional,
    ),
    ...setupOptions,
    secondaryMetric: Flag.String("secondary-metric").pipe(
      Flag.withDescription("Another event to track; repeat for each; fixed once it starts"),
      Flag.atLeast(0),
    ),
    ...armOptions,
    yes: yesOption,
    ...outputOptions,
  },
  ({
    arm,
    control,
    description,
    experiment,
    flag,
    hypothesis,
    json,
    location,
    metric,
    name,
    project,
    quiet,
    secondaryMetric,
    weights,
    yes,
  }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireExperiment(
        projectId,
        experiment,
        "voidhash-cli experiment edit <experiment> --name <name>",
      );
      const changesMetrics = Option.isSome(metric) || Arr.isReadonlyArrayNonEmpty(secondaryMetric);
      if (changesMetrics && found.status !== "draft") {
        return yield* Effect.fail(
          userError(`${found.name} is ${found.status}, so what counts as a conversion is fixed.`, {
            hint: "Changing it mid-test would make the results meaningless; create a new experiment to measure another event.",
          }),
        );
      }
      // The arms are given whole, so a --flag comes with every --arm it gives a value.
      const changesArms = Arr.isReadonlyArrayNonEmpty(arm) || Arr.isReadonlyArrayNonEmpty(flag);
      if (changesArms && found.status === "running") {
        return yield* Effect.fail(
          userError(`${found.name} is running, so its arms are locked.`, {
            hint: `Pause it first: 'voidhash-cli experiment pause ${found.id}'.`,
          }),
        );
      }
      const changesSetup =
        Option.isSome(name) ||
        Option.isSome(description) ||
        Option.isSome(hypothesis) ||
        changesMetrics;
      if (!changesSetup && !changesArms) {
        return yield* Effect.fail(
          userError("Nothing to change.", {
            hint: "Pass --name, --description, --hypothesis, --metric, or --arm with --flag.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const arms = changesArms
        ? Option.some(
            yield* parseArms(
              projectId,
              { arm, location, control, weights, flag },
              yield* armsOf(projectId, found.id),
            ),
          )
        : Option.none();
      if (Option.isSome(arms) && found.status !== "draft") {
        yield* confirmChange({
          yes,
          message: `Replace the arms of ${found.name}, which is ${found.status}?${Arr.match(
            arms.value.removed,
            {
              onEmpty: () => "",
              onNonEmpty: (removed) =>
                ` End users in ${removed.map(({ name: armName }) => armName).join(", ")} move to another arm.`,
            },
          )} Arms kept by name keep their end users.`,
        });
      }
      const updated = changesSetup
        ? yield* api
            .experimentsUpdate(projectId, found.id, {
              name: Option.getOrUndefined(name),
              description: Option.getOrUndefined(description),
              hypothesis: Option.getOrUndefined(hypothesis),
              primaryMetricEventName: Option.getOrUndefined(metric),
              ...(Arr.isReadonlyArrayEmpty(secondaryMetric)
                ? {}
                : { secondaryMetricEventNames: secondaryMetric }),
            })
            .pipe(Effect.mapError((error) => apiError(error)))
        : found;
      if (Option.isSome(arms)) {
        yield* api
          .experimentsReplaceVariants(projectId, found.id, { variants: arms.value.variants })
          .pipe(
            Effect.mapError((error) =>
              apiError(error, {
                experiment_variants_locked: `Pause it first: 'voidhash-cli experiment pause ${found.id}'.`,
              }),
            ),
          );
      }
      yield* printItem(mode, updated, `Updated ${updated.name}.`);
    }),
).pipe(
  Command.withDescription(
    "Change an experiment's name, hypothesis, metrics (draft only) or arms (not while running).",
  ),
);

/** `voidhash-cli experiment start <experiment> [--yes]` */
const experimentStartCommand = Command.make(
  "start",
  { experiment: experimentArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ experiment, json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireExperiment(
        projectId,
        experiment,
        "voidhash-cli experiment start <experiment> --yes",
      );
      if (found.status === "running" || found.status === "concluded") {
        return yield* Effect.fail(
          userError(
            found.status === "running"
              ? `${found.name} is already running.`
              : `${found.name} has concluded and cannot run again.`,
            {
              hint:
                found.status === "running"
                  ? `'voidhash-cli experiment results ${found.id}' shows how it is doing.`
                  : "Set up a new one with 'voidhash-cli experiment create'.",
            },
          ),
        );
      }
      const arms = yield* armsOf(projectId, found.id);
      if (
        arms.every(
          (one) =>
            Arr.isReadonlyArrayEmpty(one.placements) && Arr.isReadonlyArrayEmpty(one.flagValues),
        )
      ) {
        return yield* Effect.fail(
          userError(
            `${found.name} has no paywalls placed and sets no flag, so starting it would change nothing.`,
            {
              hint: `Give each arm a paywall: 'voidhash-cli experiment edit ${found.id} ${armsUsage}', or a value for a flag: ${flagsUsage}.`,
            },
          ),
        );
      }
      const places = yield* listPlaces(projectId);
      const locations = Arr.dedupe(
        arms.flatMap((one) => one.placements.map((placement) => placement.paywallLocationId)),
      ).map((id) => places.locations.find((candidate) => candidate.id === id)?.slug ?? id);
      const flagIds = Arr.dedupe(
        arms.flatMap((one) => one.flagValues.map((value) => value.featureFlagId)),
      );
      const flags = Arr.isReadonlyArrayEmpty(flagIds) ? [] : yield* listFlagsInUse(projectId);
      const flagKeys = flagIds.map(
        (id) => flags.find((candidate) => candidate.id === id)?.key ?? id,
      );
      // Who is split: whoever reaches a location, and whoever's app reads a flag it sets.
      const reached = [
        ...(Arr.isReadonlyArrayEmpty(locations) ? [] : [`at ${locations.join(", ")}`]),
        ...(Arr.isReadonlyArrayEmpty(flagKeys) ? [] : [`whose app reads ${flagKeys.join(", ")}`]),
      ].join(" or ");
      yield* confirmChange({
        yes,
        message: `${found.status === "paused" ? "Resume" : "Start"} ${found.name} in ${projectKind(context.session).label(context.project)}? End users ${reached} are split ${arms.map((one) => `${percent(one.weightPercentage)} ${one.name}`).join(", ")}.`,
      });
      const started = yield* api.experimentsStart(projectId, found.id).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            experiment_not_startable:
              "Deploy each placed paywall ('voidhash-cli paywall deploy'), or conclude the other experiment at that location or on that flag.",
            experiment_archived: `Restore it first: 'voidhash-cli experiment restore ${found.id}'.`,
          }),
        ),
      );
      yield* printItem(
        mode,
        started,
        `${found.status === "paused" ? "Resumed" : "Started"} ${started.name}. Follow it with 'voidhash-cli experiment results ${started.id}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Start or resume an experiment at its paywall locations and on the flags it sets. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli experiment pause <experiment>` */
const experimentPauseCommand = Command.make(
  "pause",
  { experiment: experimentArgument, project: projectOption, ...outputOptions },
  ({ experiment, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireExperiment(
        projectId,
        experiment,
        "voidhash-cli experiment pause <experiment>",
      );
      const paused = yield* api
        .experimentsPause(projectId, found.id)
        .pipe(
          Effect.mapError((error) =>
            apiError(error, { experiment_not_running: "Only a running experiment can be paused." }),
          ),
        );
      yield* printItem(
        mode,
        paused,
        `Paused ${paused.name}: everyone sees the control until 'voidhash-cli experiment start ${paused.id}'.`,
      );
    }),
).pipe(
  Command.withDescription("Pause an experiment: everyone sees the control arm until it resumes."),
);

/** `voidhash-cli experiment results <experiment>` */
const experimentResultsCommand = Command.make(
  "results",
  { experiment: experimentArgument, project: projectOption, ...outputOptions },
  ({ experiment, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireExperiment(
        projectId,
        experiment,
        "voidhash-cli experiment results <experiment>",
      );
      const [arms, results] = yield* Effect.all(
        [armsOf(projectId, found.id), api.experimentsGetResults(projectId, found.id)],
        { concurrency: 2 },
      );
      if (mode === "json") return yield* printJson(results);
      if (mode === "quiet") return yield* printIds(arms);
      const resultOf = (arm: ExperimentVariantJsonEncoding) =>
        Option.fromNullishOr(results.variants.find((result) => result.variantId === arm.id));
      yield* Console.error(
        printable(`${found.name}, conversions counted as ${results.primaryMetricEventName}`),
      );
      yield* printTable(
        [
          { header: "ARM", cell: (arm) => `${arm.name}${arm.isControl ? " (control)" : ""}` },
          {
            header: "SHOWN",
            cell: (arm) =>
              String(Option.match(resultOf(arm), { onNone: () => 0, onSome: (r) => r.exposures })),
          },
          {
            header: "CONVERTED",
            cell: (arm) =>
              String(
                Option.match(resultOf(arm), { onNone: () => 0, onSome: (r) => r.conversions }),
              ),
          },
          {
            header: "RATE",
            cell: (arm) =>
              Option.match(resultOf(arm), {
                onNone: () => "-",
                onSome: (r) => `${(r.conversionRate * 100).toFixed(1)}%`,
              }),
          },
          {
            header: "REVENUE",
            cell: (arm) =>
              Option.match(resultOf(arm), {
                onNone: () => "-",
                onSome: (r) => formatMoney(r.revenue, r.currency),
              }),
          },
        ],
        arms,
        "The experiment has no arms.",
      );
      yield* Console.log(verdictLines(found, arms, results).map(printable).join("\n"));
    }),
).pipe(
  Command.withDescription(
    "Show how each arm converts, with a verdict that says when it is too early to tell.",
  ),
);

/** `voidhash-cli experiment conclude <experiment> [--winner <arm>] [--yes]` */
const experimentConcludeCommand = Command.make(
  "conclude",
  {
    experiment: experimentArgument,
    winner: Flag.String("winner").pipe(
      Flag.withDescription("The winning arm by name (default: the control)"),
      Flag.optional,
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ experiment, json, project, quiet, winner, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireExperiment(
        projectId,
        experiment,
        "voidhash-cli experiment conclude <experiment> --winner <arm> --yes",
      );
      const arms = yield* armsOf(projectId, found.id);
      const chosen = yield* Option.match(winner, {
        onNone: () =>
          Effect.fromOption(Option.fromNullishOr(arms.find((arm) => arm.isControl))).pipe(
            Effect.mapError(() =>
              userError("It has no control arm; name the winner with --winner.", {
                exitCode: ExitCode.usage,
              }),
            ),
          ),
        onSome: (input) => findItem(armKind, arms, input),
      });
      const verdict = yield* api.experimentsGetResults(projectId, found.id).pipe(
        Effect.map((results) => verdictLines(found, arms, results)),
        Effect.orElseSucceed(() => ["Results could not be read."]),
      );
      yield* Console.error(verdict.map(printable).join("\n"));
      yield* confirmChange({
        yes,
        message: `Conclude ${found.name} with ${chosen.name} as the winner? Its paywalls show to everyone at its locations, the flags it set give its values to everyone their own rules and overrides don't name, and it can never run again.`,
      });
      const concluded = yield* api
        .experimentsConclude(projectId, found.id, { winningVariantId: chosen.id })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              experiment_not_started: `A draft has nothing to conclude; archive it: 'voidhash-cli experiment archive ${found.id}'.`,
            }),
          ),
        );
      yield* printItem(mode, concluded, `Concluded ${concluded.name}: ${chosen.name} won.`);
    }),
).pipe(
  Command.withDescription(
    "End an experiment for good with a winner. Shows the results and asks first.",
  ),
);

/** `voidhash-cli experiment archive <experiment>` */
const experimentArchiveCommand = Command.make(
  "archive",
  { experiment: experimentArgument, project: projectOption, ...outputOptions },
  ({ experiment, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        experimentKind,
        yield* listExperiments(projectId, false),
        experiment,
        "voidhash-cli experiment archive <experiment>",
      );
      const archived = yield* api.experimentsArchive(projectId, found.id).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            experiment_in_progress: `Conclude it first: 'voidhash-cli experiment conclude ${found.id}'.`,
          }),
        ),
      );
      yield* printItem(
        mode,
        archived,
        `Archived ${archived.name}. Bring it back with 'voidhash-cli experiment restore ${archived.id}'.`,
      );
    }),
).pipe(Command.withDescription("Archive a draft or concluded experiment."));

/** `voidhash-cli experiment restore <experiment>` */
const experimentRestoreCommand = Command.make(
  "restore",
  { experiment: experimentArgument, project: projectOption, ...outputOptions },
  ({ experiment, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        { ...experimentKind, listCommand: "voidhash-cli experiment list --archived" },
        yield* listExperiments(projectId, true),
        experiment,
        "voidhash-cli experiment restore <experiment>",
      );
      const restored = yield* api.experimentsUnarchive(projectId, found.id);
      yield* printItem(mode, restored, `Restored ${restored.name} (${restored.status}).`);
    }),
).pipe(Command.withDescription("Bring back an archived experiment."));

/** `voidhash-cli experiment …` */
export const experimentCommand = Command.make("experiment").pipe(
  Command.withAlias("experiments"),
  Command.withDescription(
    "A/B tests of paywalls and feature flags: set up arms, start, follow the results, and conclude with a winner.",
  ),
  Command.withSubcommands([
    experimentListCommand,
    experimentViewCommand,
    experimentCreateCommand,
    experimentEditCommand,
    experimentStartCommand,
    experimentPauseCommand,
    experimentResultsCommand,
    experimentConcludeCommand,
    experimentArchiveCommand,
    experimentRestoreCommand,
  ]),
);
