/**
 * `voidhash-cli flag …`: the project's feature flags. Who gets a flag is set
 * per environment, production and test, and read top to bottom: switched off,
 * the flag is off for everyone there; then an end user's override decides;
 * then the rules, in order; then the share everyone else gets, and among
 * variants the split. Test follows production until something is changed in it.
 *
 * A rule matches the end users it names, and everyone all its conditions hold
 * for: `--when` conditions on a person's traits and on what their app reports.
 */
import type {
  FeatureFlagConditionAttribute,
  FeatureFlagConditionJsonEncoding,
  FeatureFlagConditionOperator,
  FeatureFlagEnvironmentJsonEncoding,
  FeatureFlagEnvironmentName,
  FeatureFlagEnvironmentOverrideJsonEncoding,
  FeatureFlagIdentityType,
  FeatureFlagJsonEncoding,
  FeatureFlagRuleJsonEncoding,
  FeatureFlagServeJsonEncoding,
  FeatureFlagType,
  FeatureFlagVariantJsonEncoding,
  PutFeatureFlagEnvironmentBodyJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { printable } from "../../utils/printable";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import { confirmChange, type ItemKind, requireChoice, requireItem, requireText } from "../input";
import { formatFields, outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { personsMatching } from "../persons";
import { outputOptions, projectOption, yesOption } from "../shared-options";

export const flagKind: ItemKind<FeatureFlagJsonEncoding> = {
  noun: "flag",
  label: (flag) => flag.key,
  listCommand: "voidhash-cli flag list",
  createCommand: "voidhash-cli flag create",
  keys: (flag) => [flag.key],
  names: () => [],
};

const flagArgument = Argument.String("flag").pipe(
  Argument.withDescription("The flag's key or id"),
  Argument.optional,
);

/** `--env production|test`, for a command that reads or changes one environment. */
const environmentOption = Flag.Literals("env", ["production", "test"]).pipe(
  Flag.withDescription(
    "production (the default), or test, which apps using a test key read; test follows production until something is changed in it",
  ),
  Flag.withDefault("production" as const),
);

const personArgument = Argument.String("person").pipe(
  Argument.withDescription(
    "The end user: an email, a distinct id or a person id (person_…); prefix email:, distinct_id:, person_id: or external_id: to say which",
  ),
  Argument.optional,
);

/** The flag types as `--type` takes them. */
const FLAG_TYPES = [
  ["boolean", "boolean"],
  ["string", "string"],
  ["number", "number"],
  ["json", "json"],
] as const satisfies ReadonlyArray<readonly [string, FeatureFlagType]>;

/** A share of end users: "25%". */
export const percent = (value: number) => `${Number(value.toFixed(2))}%`;

/** The configuration that decides in `environment`: test follows production until it has its own. */
const environmentOf = (
  flag: FeatureFlagJsonEncoding,
  environment: FeatureFlagEnvironmentName,
): FeatureFlagEnvironmentJsonEncoding =>
  environment === "test"
    ? (flag.environments.test ?? flag.environments.production)
    : flag.environments.production;

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Whether an environment is on, and for what share of the end users no rule matches. */
const environmentState = (config: FeatureFlagEnvironmentJsonEncoding) =>
  config.isEnabled
    ? `on for ${percent(config.fallthrough.rolloutPercentage)}${Arr.isReadonlyArrayEmpty(config.rules) ? "" : `, ${plural(config.rules.length, "rule")}`}`
    : "off";

/** Whether a flag is on in production, and for whom, before overrides and rules. */
const flagState = (flag: FeatureFlagJsonEncoding) =>
  flag.isArchived ? "archived" : environmentState(flag.environments.production);

/** What apps using a test key get: production's answers, or test's own. */
const testState = (flag: FeatureFlagJsonEncoding) =>
  flag.environments.test === null ? "follows production" : environmentState(flag.environments.test);

/** An environment's configuration as `PUT …/environments/{environment}` takes it whole. */
const environmentBody = (
  config: FeatureFlagEnvironmentJsonEncoding,
): PutFeatureFlagEnvironmentBodyJsonEncoding => ({
  isEnabled: config.isEnabled,
  overrides: config.overrides,
  rules: config.rules,
  fallthrough: config.fallthrough,
});

/** What a first change in test does to a flag whose test still follows production. */
const testSplitsOff = (flag: FeatureFlagJsonEncoding) =>
  `Test now has a configuration of its own, started from production's. 'voidhash-cli flag follow ${flag.key}' makes it follow production again.`;

/**
 * A variant's value as the API sends it. The generated client does not type
 * JSON fields, so it is read off the object.
 */
const valueOf = (item: object): unknown => ("value" in item ? item.value : null);

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

const formatValue = (value: unknown) => encodeJson(value ?? null);

const variantLabel = (variant: FeatureFlagVariantJsonEncoding) =>
  variant.label === null
    ? formatValue(valueOf(variant))
    : `${variant.label} (${formatValue(valueOf(variant))})`;

/** The flags in use, and the archived ones with `archived`. */
const listFlags = (projectId: string, archived: boolean) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) =>
      api.featureFlagsList(projectId, { ...query, isArchived: archived ? "true" : "false" }),
    ),
  );

/** Every flag a command can name: in use, then archived. */
const allFlags = (projectId: string) =>
  Effect.map(
    Effect.all([listFlags(projectId, false), listFlags(projectId, true)], { concurrency: 2 }),
    ([inUse, archived]) => [...inUse, ...archived],
  );

const variantsOf = (projectId: string, flagId: string) =>
  Effect.flatMap(ApiClient, (api) =>
    readAll((query) => api.featureFlagsListVariants(projectId, flagId, query)),
  );

const PREFIXED_IDENTITY = /^(person_id|distinct_id|email|external_id):(.+)$/;
const IDENTITY_TYPES: ReadonlyArray<FeatureFlagIdentityType> = [
  "person_id",
  "distinct_id",
  "email",
  "external_id",
];

/** An end user identity: a typed prefix, a person id, an email, or else a distinct id. */
export const parseIdentity = (
  input: string,
): { readonly type: FeatureFlagIdentityType; readonly value: string } => {
  const value = input.trim();
  const prefixed = PREFIXED_IDENTITY.exec(value);
  const type = IDENTITY_TYPES.find((candidate) => candidate === prefixed?.[1]);
  if (type !== undefined && prefixed?.[2] !== undefined) return { type, value: prefixed[2] };
  if (value.startsWith("person_")) return { type: "person_id", value };
  if (value.includes("@")) return { type: "email", value };
  return { type: "distinct_id", value };
};

/** An identity as one path segment: `email:alice%40example.com`. */
const identitySegment = (identity: { readonly type: string; readonly value: string }) =>
  `${identity.type}:${encodeURIComponent(identity.value)}`;

const identityLabel = (identity: {
  readonly identityType: string;
  readonly identityValue: string;
}) => `${identity.identityType.replace("_", " ")} ${identity.identityValue}`;

/** The variant `input` names: its id or key, its label, or its value. */
const findVariant = (variants: ReadonlyArray<FeatureFlagVariantJsonEncoding>, input: string) =>
  variants.find(
    (candidate) =>
      candidate.id === input ||
      candidate.key === input ||
      candidate.label?.toLowerCase() === input.toLowerCase() ||
      formatValue(valueOf(candidate)) === input ||
      valueOf(candidate) === input,
  );

/** What a share of people gets: "25% get it", "100% get it, Red ("red")", "nobody gets it". */
const describeServe = (
  serve: FeatureFlagServeJsonEncoding,
  variants: ReadonlyArray<FeatureFlagVariantJsonEncoding>,
) => {
  if (serve.rolloutPercentage === 0) return "nobody gets it";
  const variant = variants.find(({ key }) => key === serve.variantKey);
  const which =
    serve.variantKey === null
      ? ""
      : `, ${variant === undefined ? serve.variantKey : variantLabel(variant)}`;
  return `${percent(serve.rolloutPercentage)} get it${which}`;
};

const ruleLabel = (rule: FeatureFlagRuleJsonEncoding) =>
  rule.name === null ? rule.id : `${rule.id} (${rule.name})`;

/** What `--when` compares, as it is typed; a trait is `trait:<key>`. */
const CONDITION_ATTRIBUTES = [
  "platform",
  "app_version",
  "os_version",
  "country",
  "locale",
] as const satisfies ReadonlyArray<FeatureFlagConditionAttribute>;

/** How `--when` compares, as it is typed: in words or signs, and as the API names them. */
const CONDITION_OPERATORS: ReadonlyArray<readonly [string, FeatureFlagConditionOperator]> = [
  ["is not set", "is_not_set"],
  ["is_not_set", "is_not_set"],
  ["is set", "is_set"],
  ["is_set", "is_set"],
  ["not in", "not_in"],
  ["not_in", "not_in"],
  ["in", "in"],
  [">=", "gte"],
  ["gte", "gte"],
  ["<", "lt"],
  ["lt", "lt"],
];

const WHEN_HINT =
  "Write it as '<what> <how> [<values>]': what is platform, app_version, os_version, country, locale or trait:<key>; how is in, not in, >=, <, is set or is not set; values are separated by commas. Such as 'country in DE,AT', 'app_version >= 2.4' or 'trait:beta is set'.";

/**
 * A `--when` condition, such as `country in DE,AT` or `trait:plan is set`. Only its shape is
 * read here; the API says what a condition's values must be.
 */
export const parseCondition = (input: string) => {
  const refuse = (message: string) =>
    Effect.fail(userError(message, { hint: WHEN_HINT, exitCode: ExitCode.usage }));
  const [what = "", ...rest] = input.trim().split(/\s+/);
  const how = rest.join(" ");
  const isTrait = what.toLowerCase().startsWith("trait:");
  const key = isTrait ? what.slice("trait:".length) : "";
  const attribute = isTrait
    ? "trait"
    : CONDITION_ATTRIBUTES.find((candidate) => candidate === what.toLowerCase());
  if (attribute === undefined || (isTrait && key === "")) {
    return refuse(
      isTrait
        ? `--when '${input}' names no trait: write trait:<key>, such as trait:plan.`
        : `--when '${input}' compares "${what}", which is not something a rule can ask.`,
    );
  }
  if (/^(<=|>(?!=))/.test(how)) {
    return refuse(
      `--when '${input}' compares with a sign a rule does not take: use >= (that version or newer) or < (older than it).`,
    );
  }
  const operator = CONDITION_OPERATORS.find(([typed]) =>
    // A sign may touch its value (`>=2.4`); a word is followed by a space or ends the condition.
    /^[<>=]+$/.test(typed)
      ? how.startsWith(typed)
      : how.toLowerCase() === typed || how.toLowerCase().startsWith(`${typed} `),
  );
  if (operator === undefined) {
    return refuse(`--when '${input}' does not say how to compare ${what}.`);
  }
  const [typed, op] = operator;
  const condition: FeatureFlagConditionJsonEncoding = {
    attribute,
    key: isTrait ? key : null,
    op,
    values: how
      .slice(typed.length)
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value !== ""),
  };
  return Effect.succeed(condition);
};

const CONDITION_SUBJECTS: Readonly<
  Record<Exclude<FeatureFlagConditionAttribute, "trait">, string>
> = {
  platform: "platform",
  app_version: "app version",
  os_version: "OS version",
  country: "country",
  locale: "locale",
};

/** A condition in words: "country is DE or AT", "app version is 2.4 or newer". */
export const describeCondition = (condition: FeatureFlagConditionJsonEncoding) => {
  const subject =
    condition.attribute === "trait"
      ? `trait ${condition.key ?? "?"}`
      : CONDITION_SUBJECTS[condition.attribute];
  const [first = "?"] = condition.values;
  return Match.value(condition.op).pipe(
    Match.when("in", () => `${subject} is ${condition.values.join(" or ")}`),
    Match.when("not_in", () => `${subject} is not ${condition.values.join(" or ")}`),
    Match.when("gte", () => `${subject} is ${first} or newer`),
    Match.when("lt", () => `${subject} is older than ${first}`),
    Match.when("is_set", () => `${subject} is set`),
    Match.when("is_not_set", () => `${subject} is not set`),
    Match.exhaustive,
  );
};

/** Who a rule matches: the end users it names, and everyone its conditions hold for. */
const describeRuleMatch = (rule: FeatureFlagRuleJsonEncoding) => {
  const named = rule.identities.map(identityLabel).join(", ");
  const matched = Arr.isReadonlyArrayEmpty(rule.conditions)
    ? ""
    : `everyone whose ${rule.conditions.map(describeCondition).join(" and ")}`;
  if (named === "" && matched === "") return "nobody";
  return [named, matched].filter((part) => part !== "").join(", and ");
};

/** One environment as lines, in the order it is read: overrides, rules, everyone else. */
const describeEnvironment = (
  config: FeatureFlagEnvironmentJsonEncoding,
  variants: ReadonlyArray<FeatureFlagVariantJsonEncoding>,
) => {
  const describeOverride = (override: FeatureFlagEnvironmentOverrideJsonEncoding) => {
    const variant = variants.find(({ key }) => key === override.variantKey);
    const setting =
      override.variantKey === null
        ? override.isEnabled
          ? "on"
          : "off"
        : `on, ${variant === undefined ? override.variantKey : variantLabel(variant)}`;
    return `Override  ${identityLabel(override)}: ${setting}`;
  };
  return [
    config.isEnabled
      ? `on for ${percent(config.fallthrough.rolloutPercentage)} of end users${Arr.isReadonlyArrayEmpty(config.rules) ? "" : " no rule matches"}`
      : "off for everyone, overrides included",
    ...config.overrides.map(describeOverride),
    ...config.rules.map(
      (rule, index) =>
        `Rule ${index + 1}    ${ruleLabel(rule)}: ${describeRuleMatch(rule)} → ${describeServe(rule.serve, variants)}`,
    ),
    `Everyone else: ${describeServe(config.fallthrough, variants)}`,
  ].join("\n");
};

const requirePerson = (person: Option.Option<string>, usage: string) =>
  Effect.map(
    requireText(person, { flag: "<person>", message: "Email, distinct id or person id", usage }),
    parseIdentity,
  );

/** A share of end users from the command line: "25%", "25" or "12.5". */
const parsePercent = (input: string) => {
  const value = Number(input.trim().replace(/%$/, ""));
  return Number.isFinite(value) && value >= 0 && value <= 100
    ? Effect.succeed(Math.round(value * 100) / 100)
    : Effect.fail(
        userError(`"${input}" is not a share of end users.`, {
          hint: "Give a percentage from 0 to 100, such as 25%.",
          exitCode: ExitCode.usage,
        }),
      );
};

/** A variant value from the command line, as the flag's type needs it. */
const parseValue = (type: FeatureFlagType, input: string) =>
  Match.value(type).pipe(
    Match.when("number", () =>
      Number.isFinite(Number(input)) && input.trim() !== ""
        ? Effect.succeed<unknown>(Number(input))
        : Effect.fail(
            userError(`"${input}" is not a number.`, {
              hint: "A number flag's variants are numbers.",
              exitCode: ExitCode.usage,
            }),
          ),
    ),
    Match.when("json", () =>
      decodeJson(input).pipe(
        Effect.mapError(() =>
          userError(`"${input}" is not JSON.`, {
            hint: `Quote it for your shell, such as '{"color":"blue"}'.`,
            exitCode: ExitCode.usage,
          }),
        ),
      ),
    ),
    Match.orElse(() => Effect.succeed<unknown>(input)),
  );

const keyTakenHint = (key: string) =>
  `Choose another --key, or bring back the archived flag with 'voidhash-cli flag restore ${key}'.`;

/** The flag a command names, among every flag of the project, archived ones included. */
const requireFlag = (projectId: string, flag: Option.Option<string>, usage: string) =>
  Effect.flatMap(allFlags(projectId), (flags) => requireItem(flagKind, flags, flag, usage));

/** The dashboard page of the flag `input` names, for `voidhash-cli open flag <flag>`. */
export const flagPagePath = (projectId: string, input: Option.Option<string>) =>
  Effect.map(
    requireFlag(projectId, input, "voidhash-cli open flag <flag>"),
    (flag) => `flags/${flag.id}`,
  );

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** `voidhash-cli flag list [--archived]` */
const flagListCommand = Command.make(
  "list",
  {
    project: projectOption,
    archived: Flag.Boolean("archived").pipe(
      Flag.withDescription("List archived flags instead"),
      Flag.withDefault(false),
    ),
    ...outputOptions,
  },
  ({ archived, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const flags = yield* listFlags(projectId, archived);
      if (mode === "json") return yield* printJson(flags);
      if (mode === "quiet") return yield* printIds(flags);
      // Only people see the variants, so only they wait for them.
      const rows = yield* Effect.forEach(
        flags,
        (flag) =>
          (flag.type === "boolean"
            ? Effect.succeed<ReadonlyArray<FeatureFlagVariantJsonEncoding>>([])
            : variantsOf(projectId, flag.id)
          ).pipe(Effect.map((variants) => ({ flag, variants }))),
        { concurrency: 8 },
      );
      yield* printTable(
        [
          { header: "KEY", cell: ({ flag }) => flag.key },
          { header: "TYPE", cell: ({ flag }) => flag.type },
          { header: "STATE", cell: ({ flag }) => flagState(flag) },
          ...(archived
            ? []
            : [
                {
                  header: "TEST",
                  cell: ({ flag }: { readonly flag: FeatureFlagJsonEncoding }) => testState(flag),
                },
              ]),
          {
            header: "VARIANTS",
            cell: ({ variants }) => variants.map(variantLabel).join(", ") || "-",
          },
          { header: "ID", cell: ({ flag }) => flag.id },
        ],
        rows,
        archived
          ? "No archived flags."
          : "No feature flags yet. Create one with 'voidhash-cli flag create'.",
      );
    }),
).pipe(
  Command.withDescription(
    "List the project's feature flags with their state in production, whether test follows it, and their variants.",
  ),
);

/** `voidhash-cli flag view <flag>` */
const flagViewCommand = Command.make(
  "view",
  { flag: flagArgument, project: projectOption, ...outputOptions },
  ({ flag, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireFlag(projectId, flag, "voidhash-cli flag view <flag>");
      if (mode === "quiet") return yield* printIds([found]);
      const variants = yield* variantsOf(projectId, found.id);
      if (mode === "json") return yield* printJson({ ...found, variants });
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          `${found.key} (${found.type} flag)`,
          formatFields([
            ...(found.isArchived
              ? [
                  [
                    "State",
                    `archived; bring it back with 'voidhash-cli flag restore ${found.key}'`,
                  ] as const,
                ]
              : []),
            ...Arr.fromOption(
              Option.map(
                Option.fromNullishOr(found.description),
                (text) => ["Description", text] as const,
              ),
            ),
            ...Arr.match(variants, {
              onEmpty: () => [],
              onNonEmpty: (some) => [
                [
                  "Variants",
                  some
                    .map(
                      (variant) => `${variantLabel(variant)}  ${percent(variant.weightPercentage)}`,
                    )
                    .join("\n"),
                ] as const,
              ],
            }),
            ["Production", describeEnvironment(found.environments.production, variants)],
            [
              "Test",
              found.environments.test === null
                ? "follows production: apps using a test key get the same"
                : describeEnvironment(found.environments.test, variants),
            ],
            ...(found.experimentId === null
              ? []
              : [
                  [
                    "Experiment",
                    `${found.experimentId}; change it through the experiment`,
                  ] as const,
                ]),
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `flags/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show a flag: its variants, and who gets it in production and in test: overrides, rules, then everyone else.",
  ),
);

const CREATE_USAGE = "voidhash-cli flag create --key <key> [--type <type> --variant <value>…]";

/** `voidhash-cli flag create [--key] [--type] [--variant]… [--description] [--rollout]` */
const flagCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    key: Flag.String("key").pipe(
      Flag.withDescription("What your app asks for, such as new-checkout"),
      Flag.optional,
    ),
    type: Flag.ChoiceWithValue("type", FLAG_TYPES).pipe(
      Flag.withDescription("boolean (on or off; the default), or string, number or json variants"),
      Flag.optional,
    ),
    variant: Flag.String("variant").pipe(
      Flag.withDescription("A value the flag can hand out; repeat for each (not for boolean)"),
      Flag.atLeast(0),
    ),
    description: Flag.String("description").pipe(
      Flag.withDescription("What the flag is for"),
      Flag.optional,
    ),
    rollout: Flag.String("rollout").pipe(
      Flag.withDescription(
        "Turn it on in production right away for this share of end users, such as 10%",
      ),
      Flag.optional,
    ),
    ...outputOptions,
  },
  ({ description, json, key, project, quiet, rollout, type, variant }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const flagKey = yield* requireText(key, {
        flag: "--key",
        message: "Key, as your app asks for it",
        usage: CREATE_USAGE,
      });
      const flagType = Option.getOrElse(type, (): FeatureFlagType => "boolean");
      if (flagType === "boolean" && Arr.isReadonlyArrayNonEmpty(variant)) {
        return yield* Effect.fail(
          userError("A boolean flag is on or off; it has no variants.", {
            hint: "Pass --type string, number or json for variants.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      if (flagType !== "boolean" && Arr.isReadonlyArrayEmpty(variant)) {
        return yield* Effect.fail(
          userError(`A ${flagType} flag needs the values it hands out.`, {
            hint: `Pass --variant for each, such as: ${CREATE_USAGE}`,
            exitCode: ExitCode.usage,
          }),
        );
      }
      const share = yield* Effect.transposeOption(Option.map(rollout, parsePercent));
      const values = yield* Effect.forEach(variant, (input) => parseValue(flagType, input), {
        concurrency: 1,
      });
      // The generated client does not type JSON fields, so `value` travels beside `label`.
      const variants = values.map((value) => ({ value, label: undefined }));
      const created = yield* api
        .featureFlagsCreate(projectId, {
          key: flagKey,
          type: flagType,
          description: Option.getOrUndefined(description),
          ...(Arr.isReadonlyArrayEmpty(variants) ? {} : { variants }),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, { feature_flag_key_taken: keyTakenHint(flagKey) }),
          ),
        );
      const flag = Option.isSome(share)
        ? yield* api.featureFlagsSetEnvironment(projectId, created.id, "production", {
            ...environmentBody(created.environments.production),
            isEnabled: true,
            fallthrough: { rolloutPercentage: share.value },
          })
        : created;
      yield* printItem(
        mode,
        flag,
        [
          `Created ${flag.key}: ${flagState(flag)}.`,
          ...(flag.environments.production.isEnabled
            ? []
            : [
                "Next:",
                `  Try it yourself first: 'voidhash-cli flag override ${flag.key} <your email> on'`,
                `  Turn it on for test builds only: 'voidhash-cli flag enable ${flag.key} --rollout 100% --env test'`,
                `  Turn it on for some end users: 'voidhash-cli flag enable ${flag.key} --rollout 10%'`,
              ]),
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Create a feature flag, off until you turn it on."));

/**
 * Changes an environment's switch or the share everyone else gets, keeping its overrides and
 * rules. In production it confirms first when end users lose the flag: turning it off, or
 * lowering the share.
 */
const changeState = <E, R>(options: {
  readonly project: Option.Option<string>;
  readonly flag: Option.Option<string>;
  readonly env: FeatureFlagEnvironmentName;
  readonly usage: string;
  readonly yes: boolean;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly change: (
    config: FeatureFlagEnvironmentJsonEncoding,
  ) => Effect.Effect<{ readonly isEnabled: boolean; readonly rolloutPercentage: number }, E, R>;
}) =>
  Effect.gen(function* () {
    const mode = yield* outputModeOf(options);
    const api = yield* ApiClient;
    const context = yield* resolveProject(options.project);
    const projectId = context.project.id;
    const found = yield* requireFlag(projectId, options.flag, options.usage);
    if (found.experimentId !== null) {
      return yield* Effect.fail(
        userError(`${found.key} assigns the arms of experiment ${found.experimentId}.`, {
          hint: `Change it through the experiment: 'voidhash-cli experiment view ${found.experimentId}'.`,
        }),
      );
    }
    const before = environmentOf(found, options.env);
    const wanted = yield* options.change(before);
    const share = before.fallthrough.rolloutPercentage;
    // Production's end users are real ones; test's are whoever runs a build with a test key.
    if (options.env === "production" && before.isEnabled) {
      const where = projectKind(context.session).label(context.project);
      const alsoTest =
        found.environments.test === null ? " Test follows production, so it changes too." : "";
      if (!wanted.isEnabled) {
        yield* confirmChange({
          yes: options.yes,
          message: `Turn ${found.key} off in production in ${where}? Everyone who has it now loses it, overrides included.${alsoTest}`,
        });
      } else if (wanted.rolloutPercentage < share) {
        yield* confirmChange({
          yes: options.yes,
          message: `Lower ${found.key} from ${percent(share)} to ${percent(wanted.rolloutPercentage)} in production in ${where}? End users between the two lose it.${alsoTest}`,
        });
      }
    }
    if (before.isEnabled === wanted.isEnabled && share === wanted.rolloutPercentage) {
      return yield* printItem(
        mode,
        found,
        `${found.key} already is ${environmentState(before)} in ${options.env}; nothing changed.`,
      );
    }
    const updated = yield* api.featureFlagsSetEnvironment(projectId, found.id, options.env, {
      ...environmentBody(before),
      isEnabled: wanted.isEnabled,
      fallthrough: { ...before.fallthrough, rolloutPercentage: wanted.rolloutPercentage },
    });
    const after = environmentOf(updated, options.env);
    yield* printItem(
      mode,
      updated,
      [
        `${updated.key} in ${options.env}: ${environmentState(before)} → ${environmentState(after)}.`,
        ...(options.env === "test" && found.environments.test === null
          ? [testSplitsOff(found)]
          : []),
        ...(after.isEnabled &&
        after.fallthrough.rolloutPercentage === 0 &&
        Arr.isReadonlyArrayEmpty(after.rules)
          ? [
              `At 0% only end users with an override get it: 'voidhash-cli flag rollout ${updated.key} 10%${options.env === "test" ? " --env test" : ""}'`,
            ]
          : []),
      ].join("\n"),
    );
  });

/** `voidhash-cli flag enable <flag> [--rollout] [--env]` */
const flagEnableCommand = Command.make(
  "enable",
  {
    flag: flagArgument,
    project: projectOption,
    env: environmentOption,
    rollout: Flag.String("rollout").pipe(
      Flag.withDescription("The share of end users who get it, such as 25% (default: as it was)"),
      Flag.optional,
    ),
    yes: yesOption,
    ...outputOptions,
  },
  ({ env, flag, json, project, quiet, rollout, yes }) =>
    changeState({
      project,
      flag,
      env,
      yes,
      json,
      quiet,
      usage: "voidhash-cli flag enable <flag> [--rollout 25%] [--env test]",
      change: (config) =>
        Effect.map(Effect.transposeOption(Option.map(rollout, parsePercent)), (share) => ({
          isEnabled: true,
          rolloutPercentage: Option.getOrElse(share, () => config.fallthrough.rolloutPercentage),
        })),
    }),
).pipe(
  Command.withDescription(
    "Turn a flag on in production, or in test with --env test, optionally for a share of end users.",
  ),
);

/** `voidhash-cli flag disable <flag> [--env] [--yes]` */
const flagDisableCommand = Command.make(
  "disable",
  {
    flag: flagArgument,
    project: projectOption,
    env: environmentOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ env, flag, json, project, quiet, yes }) =>
    changeState({
      project,
      flag,
      env,
      yes,
      json,
      quiet,
      usage: "voidhash-cli flag disable <flag> --yes",
      change: (config) =>
        Effect.succeed({
          isEnabled: false,
          rolloutPercentage: config.fallthrough.rolloutPercentage,
        }),
    }),
).pipe(
  Command.withDescription(
    "Turn a flag off for everyone in an environment, overrides included. In production it asks first; --yes skips that.",
  ),
);

/** `voidhash-cli flag rollout <flag> <percent> [--env]` */
const flagRolloutCommand = Command.make(
  "rollout",
  {
    flag: flagArgument,
    share: Argument.String("percent").pipe(
      Argument.withDescription("The share of end users who get it, such as 25%"),
      Argument.optional,
    ),
    project: projectOption,
    env: environmentOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ env, flag, json, project, quiet, share, yes }) =>
    changeState({
      project,
      flag,
      env,
      yes,
      json,
      quiet,
      usage: "voidhash-cli flag rollout <flag> <percent>",
      change: (config) =>
        Effect.flatMap(
          requireText(share, {
            flag: "<percent>",
            message: "Share of end users, such as 25%",
            usage: "voidhash-cli flag rollout <flag> <percent>",
            initial: percent(config.fallthrough.rolloutPercentage),
          }),
          (input) =>
            Effect.map(parsePercent(input), (rolloutPercentage) => ({
              isEnabled: config.isEnabled,
              rolloutPercentage,
            })),
        ),
    }),
).pipe(
  Command.withDescription(
    "Set the share of end users no rule matches who get a flag. Lowering it in production asks first; a flag that is off stays off.",
  ),
);

/** `voidhash-cli flag edit <flag> [--key] [--description]` */
const flagEditCommand = Command.make(
  "edit",
  {
    flag: flagArgument,
    project: projectOption,
    key: Flag.String("key").pipe(Flag.withDescription("Its new key"), Flag.optional),
    description: Flag.String("description").pipe(
      Flag.withDescription("What it is for; an empty string clears it"),
      Flag.optional,
    ),
    yes: yesOption,
    ...outputOptions,
  },
  ({ description, flag, json, key, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      if (Option.isNone(key) && Option.isNone(description)) {
        return yield* Effect.fail(
          userError("Nothing to change.", {
            hint: "Pass --key or --description.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const found = yield* requireFlag(
        projectId,
        flag,
        "voidhash-cli flag edit <flag> --key <key>",
      );
      const newKey = Option.filter(key, (value) => value !== found.key);
      if (Option.isSome(newKey)) {
        yield* confirmChange({
          yes,
          message: `Change the key of ${found.key} to ${newKey.value}? Apps asking for ${found.key}, including versions already released, stop getting it.`,
        });
      }
      const updated = yield* api
        .featureFlagsUpdate(projectId, found.id, {
          key: Option.getOrUndefined(newKey),
          ...Option.match(description, {
            onNone: () => ({}),
            onSome: (text) => ({ description: text === "" ? null : text }),
          }),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              feature_flag_key_taken: keyTakenHint(Option.getOrElse(newKey, () => found.key)),
              feature_flag_managed_by_experiment: `Change it through its experiment: 'voidhash-cli experiment view ${found.experimentId ?? ""}'.`,
            }),
          ),
        );
      yield* printItem(mode, updated, `Updated ${updated.key}.`);
    }),
).pipe(Command.withDescription("Change a flag's key or description."));

/** `voidhash-cli flag variants set <flag> <value>…` */
const flagVariantsSetCommand = Command.make(
  "set",
  {
    flag: flagArgument,
    values: Argument.String("value").pipe(
      Argument.withDescription("Every value the flag should hand out"),
      Argument.atLeast(0),
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ flag, json, project, quiet, values, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli flag variants set <flag> <value>…";
      const found = yield* requireFlag(projectId, flag, usage);
      if (found.type === "boolean") {
        return yield* Effect.fail(
          userError(`${found.key} is a boolean flag, which has no variants.`, {
            hint: "Create a string, number or json flag for variants: 'voidhash-cli flag create --type string'.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      if (Arr.isReadonlyArrayEmpty(values)) {
        return yield* Effect.fail(
          userError("Missing the values.", {
            hint: `Run it as: ${usage}`,
            exitCode: ExitCode.usage,
          }),
        );
      }
      const current = yield* variantsOf(projectId, found.id);
      const parsed = yield* Effect.forEach(values, (input) => parseValue(found.type, input), {
        concurrency: 1,
      });
      // A variant whose value stays keeps its id, so its end users stay in it.
      const wanted = parsed.map((value) => {
        const kept = current.find(
          (variant) => formatValue(valueOf(variant)) === formatValue(value),
        );
        return {
          value,
          ...(kept === undefined ? { label: undefined } : { id: kept.id, label: kept.label }),
        };
      });
      const removed = current.filter(
        (variant) => !wanted.some((entry) => "id" in entry && entry.id === variant.id),
      );
      if (Arr.isReadonlyArrayNonEmpty(removed)) {
        yield* confirmChange({
          yes,
          message: `Remove ${removed.map(variantLabel).join(", ")} from ${found.key}? End users in ${removed.length === 1 ? "it" : "them"} move to the other variants.`,
        });
      }
      const after = yield* api.featureFlagsReplaceVariants(projectId, found.id, {
        variants: wanted,
      });
      if (mode === "json") return yield* printJson(after.data);
      if (mode === "quiet") return yield* printIds(after.data);
      yield* Console.log(
        `${found.key} now hands out ${after.data.map((variant) => `${variantLabel(variant)} ${percent(variant.weightPercentage)}`).join(", ")}, split evenly.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Set exactly the values a flag hands out; a value you keep keeps its end users. Removing one asks first.",
  ),
);

const flagVariantsCommand = Command.make("variants").pipe(
  Command.withDescription("The values a string, number or json flag hands out."),
  Command.withSubcommands([flagVariantsSetCommand]),
);

/** `voidhash-cli flag override <flag> <person> <on|off|variant|clear> [--env]` */
const flagOverrideCommand = Command.make(
  "override",
  {
    flag: flagArgument,
    person: personArgument,
    setting: Argument.String("setting").pipe(
      Argument.withDescription("on, off, a variant (its value, label or id), or clear"),
      Argument.optional,
    ),
    note: Flag.String("note").pipe(Flag.withDescription("Why, such as QA"), Flag.optional),
    env: environmentOption,
    project: projectOption,
    ...outputOptions,
  },
  ({ env, flag, json, note, person, project, quiet, setting }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli flag override <flag> <person> on|off|<variant>|clear";
      const found = yield* requireFlag(projectId, flag, usage);
      if (found.experimentId !== null && env === "test") {
        return yield* Effect.fail(
          userError(`${found.key} assigns the arms of experiment ${found.experimentId}.`, {
            hint: "An experiment has one configuration, which test follows; leave out --env.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const identity = yield* requirePerson(person, usage);
      const variants = found.type === "boolean" ? [] : yield* variantsOf(projectId, found.id);
      const chosen = yield* requireChoice(
        Option.map(setting, (value) => value.trim()),
        {
          flag: "<setting>",
          message: `What should ${identity.value} get in ${env}?`,
          usage,
          choices: [
            { title: "On", value: "on" },
            { title: "Off", value: "off" },
            ...variants.map((variant) => ({
              title: `On, ${variantLabel(variant)}`,
              value: variant.id,
            })),
            { title: "Clear the override", value: "clear" },
          ],
        },
      );
      const who = `${identity.type.replace("_", " ")} ${identity.value}`;
      const splitsTestOff = env === "test" && found.environments.test === null;
      if (chosen === "clear") {
        yield* api
          .featureFlagsRemoveOverride(projectId, found.id, identitySegment(identity), {
            environment: env,
          })
          .pipe(
            Effect.mapError((error) =>
              apiError(error, {
                feature_flag_override_not_found: `'voidhash-cli flag view ${found.key}' lists its overrides in each environment.`,
              }),
            ),
          );
        return yield* Console.log(
          `Cleared the ${env} override of ${who} on ${found.key}; the flag decides for them again there.`,
        );
      }
      const variant = findVariant(variants, chosen);
      if (chosen !== "on" && chosen !== "off" && variant === undefined) {
        return yield* Effect.fail(
          userError(`"${chosen}" is not on, off, clear or one of ${found.key}'s variants.`, {
            hint: Arr.match(variants, {
              onEmpty: () => "A boolean flag takes on, off or clear.",
              onNonEmpty: (some) => `Its variants: ${some.map(variantLabel).join(", ")}.`,
            }),
            exitCode: ExitCode.usage,
          }),
        );
      }
      const override = yield* api.featureFlagsUpsertOverride(
        projectId,
        found.id,
        identitySegment(identity),
        {
          params: { environment: env },
          payload: {
            isEnabled: chosen !== "off",
            variantKey: variant?.key ?? null,
            note: Option.getOrNull(note),
          },
        },
      );
      if (mode === "json") return yield* printJson(override);
      // An override has no id of its own: the flag's names where it lives.
      if (mode === "quiet") return yield* Console.log(found.id);
      yield* Console.log(
        [
          `${who} now always gets ${found.key} ${variant === undefined ? chosen : `on, ${variantLabel(variant)}`} in ${env}, whatever its rules and rollout say.`,
          ...(environmentOf(found, env).isEnabled
            ? []
            : [
                `${found.key} is off in ${env}, so it stays off for them too until 'voidhash-cli flag enable ${found.key}${env === "test" ? " --env test" : ""}'.`,
              ]),
          ...(splitsTestOff ? [testSplitsOff(found)] : []),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Fix a flag for one end user (on, off or a variant) in production, or in test with --env test, whatever its rules say; clear lets the flag decide again.",
  ),
);

/** A rule's id from its name, such as `beta-testers`, or its place in the list. */
const ruleIdFor = (name: Option.Option<string>, position: number) => {
  const slug = Option.getOrElse(name, () => "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug === "" ? `rule-${position}` : slug;
};

const RULE_ADD_USAGE =
  "voidhash-cli flag rule add <flag> [<person>…] [--when <condition>]… --rollout <percent> [--variant <variant>] [--name <name>]";

/** `voidhash-cli flag rule add <flag> <person>… --rollout <percent>` */
const flagRuleAddCommand = Command.make(
  "add",
  {
    flag: flagArgument,
    people: Argument.String("person").pipe(
      Argument.withDescription(
        "The end users the rule names: emails, distinct ids or person ids; prefix email:, distinct_id:, person_id: or external_id: to say which",
      ),
      Argument.atLeast(0),
    ),
    when: Flag.String("when").pipe(
      Flag.withDescription(
        "A condition the rule also matches everyone by, such as 'country in DE,AT', 'app_version >= 2.4', 'trait:plan in pro' or 'trait:beta is set'; repeat it, and all must hold. Compares platform, app_version, os_version, country, locale or trait:<key> with in, not in, >=, <, is set or is not set",
      ),
      Flag.atLeast(0),
    ),
    rollout: Flag.String("rollout").pipe(
      Flag.withDescription("The share of them who get the flag, such as 100%; 0% keeps them out"),
      Flag.optional,
    ),
    variant: Flag.String("variant").pipe(
      Flag.withDescription(
        "The variant they get (its value, label or id); left out, they are split across the variants",
      ),
      Flag.optional,
    ),
    name: Flag.String("name").pipe(
      Flag.withDescription("A name for the rule, such as Beta testers"),
      Flag.optional,
    ),
    id: Flag.String("id").pipe(
      Flag.withDescription("The rule's id (default: made from the name)"),
      Flag.optional,
    ),
    first: Flag.Boolean("first").pipe(
      Flag.withDescription("Read it before the other rules, not after them"),
      Flag.withDefault(false),
    ),
    env: environmentOption,
    project: projectOption,
    ...outputOptions,
  },
  ({ env, first, flag, id, json, name, people, project, quiet, rollout, variant, when }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireFlag(projectId, flag, RULE_ADD_USAGE);
      if (found.experimentId !== null) {
        return yield* Effect.fail(
          userError(`${found.key} assigns the arms of experiment ${found.experimentId}.`, {
            hint: `Change who is in it through the experiment: 'voidhash-cli experiment view ${found.experimentId}'.`,
          }),
        );
      }
      const conditions = yield* Effect.forEach(when, parseCondition, { concurrency: 1 });
      // A rule by conditions alone names nobody, so nobody is asked for.
      const named = Arr.isReadonlyArrayNonEmpty(people)
        ? people.map(parseIdentity)
        : Arr.isReadonlyArrayNonEmpty(conditions)
          ? []
          : [yield* requirePerson(Option.none(), RULE_ADD_USAGE)];
      const share = yield* Effect.flatMap(
        requireText(rollout, {
          flag: "--rollout",
          message: "Share of them who get it, such as 100%",
          usage: RULE_ADD_USAGE,
          initial: "100%",
        }),
        parsePercent,
      );
      const variants = found.type === "boolean" ? [] : yield* variantsOf(projectId, found.id);
      const served = Option.map(variant, (input) => ({
        input,
        found: findVariant(variants, input),
      }));
      if (Option.isSome(served) && served.value.found === undefined) {
        return yield* Effect.fail(
          userError(`"${served.value.input}" is not one of ${found.key}'s variants.`, {
            hint: Arr.match(variants, {
              onEmpty: () => "A boolean flag has no variants; leave out --variant.",
              onNonEmpty: (some) => `Its variants: ${some.map(variantLabel).join(", ")}.`,
            }),
            exitCode: ExitCode.usage,
          }),
        );
      }
      const before = environmentOf(found, env);
      const taken = (candidate: string) => before.rules.some((rule) => rule.id === candidate);
      if (Option.isSome(id) && taken(id.value)) {
        return yield* Effect.fail(
          userError(`${found.key} already has a rule ${id.value} in ${env}.`, {
            hint: `Choose another --id, or remove it first: 'voidhash-cli flag rule remove ${found.key} ${id.value}'.`,
            exitCode: ExitCode.usage,
          }),
        );
      }
      const base = Option.getOrElse(id, () => ruleIdFor(name, before.rules.length + 1));
      // A second rule of the same name takes a number.
      const ruleId = Arr.findFirst(
        [base, ...Arr.makeBy(before.rules.length + 1, (index) => `${base}-${index + 2}`)],
        (candidate) => !taken(candidate),
      ).pipe(Option.getOrElse(() => base));
      const rule: FeatureFlagRuleJsonEncoding = {
        id: ruleId,
        name: Option.getOrNull(name),
        identities: Arr.dedupeWith(
          named.map((identity) => ({
            identityType: identity.type,
            identityValue: identity.value,
          })),
          (left, right) =>
            left.identityType === right.identityType && left.identityValue === right.identityValue,
        ),
        conditions,
        serve: {
          rolloutPercentage: share,
          variantKey: Option.getOrNull(
            Option.flatMapNullishOr(served, ({ found: one }) => one?.key),
          ),
        },
      };
      const updated = yield* api
        .featureFlagsSetEnvironment(projectId, found.id, env, {
          ...environmentBody(before),
          rules: first ? [rule, ...before.rules] : [...before.rules, rule],
        })
        .pipe(Effect.mapError((error) => apiError(error, {})));
      yield* printItem(
        mode,
        updated,
        [
          `Added rule ${ruleLabel(rule)} to ${found.key} in ${env}: ${describeRuleMatch(rule)} → ${describeServe(rule.serve, variants)}.`,
          first || Arr.isReadonlyArrayEmpty(before.rules)
            ? "It is read first, after overrides."
            : `It is read after the ${plural(before.rules.length, "rule")} before it; --first puts a rule first.`,
          ...(before.isEnabled
            ? []
            : [
                `${found.key} is off in ${env}, so nobody gets it there until 'voidhash-cli flag enable ${found.key}${env === "test" ? " --env test" : ""}'.`,
              ]),
          ...(env === "test" && found.environments.test === null ? [testSplitsOff(found)] : []),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Add a rule: who it matches, and the share of them who get the flag. It matches the end users it names, and with --when everyone all its conditions hold for (their country, platform, app version, a trait). Rules are read in order after overrides; the first matching an end user decides.",
  ),
);

/** `voidhash-cli flag rule remove <flag> <rule> [--env] [--yes]` */
const flagRuleRemoveCommand = Command.make(
  "remove",
  {
    flag: flagArgument,
    rule: Argument.String("rule").pipe(
      Argument.withDescription("The rule's id or name; 'voidhash-cli flag view' lists them"),
      Argument.optional,
    ),
    env: environmentOption,
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ env, flag, json, project, quiet, rule, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const usage = "voidhash-cli flag rule remove <flag> <rule>";
      const found = yield* requireFlag(projectId, flag, usage);
      const before = environmentOf(found, env);
      const chosen = yield* requireChoice(
        Option.map(rule, (value) => value.trim()),
        {
          flag: "<rule>",
          message: `Which rule of ${found.key} in ${env}?`,
          usage,
          choices: before.rules.map((one) => ({ title: ruleLabel(one), value: one.id })),
        },
      );
      const removed = before.rules.find(
        (one) => one.id === chosen || one.name?.toLowerCase() === chosen.toLowerCase(),
      );
      if (removed === undefined) {
        return yield* Effect.fail(
          userError(`${found.key} has no rule "${chosen}" in ${env}.`, {
            hint: Arr.match(before.rules, {
              onEmpty: () => "It has no rules there.",
              onNonEmpty: (some) => `Its rules: ${some.map(ruleLabel).join(", ")}.`,
            }),
            exitCode: ExitCode.notFound,
          }),
        );
      }
      if (env === "production" && before.isEnabled) {
        yield* confirmChange({
          yes,
          message: `Remove rule ${ruleLabel(removed)} from ${found.key} in production in ${projectKind(context.session).label(context.project)}? ${Arr.isReadonlyArrayEmpty(removed.conditions) ? `The ${plural(removed.identities.length, "end user")} it names` : "The end users it matches"} then get what the rules after it or everyone else gets.`,
        });
      }
      const updated = yield* api.featureFlagsSetEnvironment(projectId, found.id, env, {
        ...environmentBody(before),
        rules: before.rules.filter((one) => one.id !== removed.id),
      });
      yield* printItem(
        mode,
        updated,
        [
          `Removed rule ${ruleLabel(removed)} from ${found.key} in ${env}.`,
          ...(env === "test" && found.environments.test === null ? [testSplitsOff(found)] : []),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Remove a rule, so the end users it matches get what later rules or everyone else gets. In production on a flag that is on, it asks first.",
  ),
);

const flagRuleCommand = Command.make("rule").pipe(
  Command.withAlias("rules"),
  Command.withDescription(
    "Rules say what share of the end users they match get the flag: those a rule names one by one, and everyone its --when conditions hold for; 'voidhash-cli flag view' shows them in the order they are read.",
  ),
  Command.withSubcommands([flagRuleAddCommand, flagRuleRemoveCommand]),
);

/** `voidhash-cli flag follow <flag> [--yes]` */
const flagFollowCommand = Command.make(
  "follow",
  { flag: flagArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ flag, json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireFlag(projectId, flag, "voidhash-cli flag follow <flag> --yes");
      const test = found.environments.test;
      if (test === null) {
        return yield* printItem(
          mode,
          found,
          `${found.key}'s test already follows production; nothing changed.`,
        );
      }
      yield* confirmChange({
        yes,
        message: `Make ${found.key}'s test follow production again? Test's own configuration (${environmentState(test)}, ${plural(test.overrides.length, "override")}) is dropped, and apps using a test key get production's answers (${environmentState(found.environments.production)}).`,
      });
      yield* api.featureFlagsClearEnvironment(projectId, found.id, "test").pipe(
        Effect.mapError((error) =>
          apiError(error, {
            feature_flag_managed_by_experiment: `An experiment's flag has one configuration: 'voidhash-cli experiment view ${found.experimentId ?? ""}'.`,
          }),
        ),
      );
      yield* printItem(
        mode,
        { ...found, environments: { ...found.environments, test: null } },
        `${found.key}: test follows production again (${environmentState(found.environments.production)}).`,
      );
    }),
).pipe(
  Command.withDescription(
    "Drop test's own configuration of a flag, so apps using a test key get production's answers again. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli flag promote <flag> [--yes]` */
const flagPromoteCommand = Command.make(
  "promote",
  { flag: flagArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ flag, json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireFlag(projectId, flag, "voidhash-cli flag promote <flag> --yes");
      const test = found.environments.test;
      if (test === null) {
        return yield* printItem(
          mode,
          found,
          `${found.key}'s test follows production, so there is nothing to apply.`,
        );
      }
      const production = found.environments.production;
      yield* confirmChange({
        yes,
        message: `Apply ${found.key}'s test configuration to production in ${projectKind(context.session).label(context.project)}? Production goes from ${environmentState(production)} to ${environmentState(test)}, and test's ${plural(test.overrides.length, "override")} and ${plural(test.rules.length, "rule")} replace production's. Test then follows production.`,
      });
      const applied = yield* api
        .featureFlagsSetEnvironment(projectId, found.id, "production", environmentBody(test))
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              feature_flag_managed_by_experiment: `An experiment's flag changes through it: 'voidhash-cli experiment view ${found.experimentId ?? ""}'.`,
            }),
          ),
        );
      yield* api.featureFlagsClearEnvironment(projectId, found.id, "test");
      yield* printItem(
        mode,
        { ...applied, environments: { ...applied.environments, test: null } },
        `${found.key} in production: ${environmentState(production)} → ${environmentState(applied.environments.production)}. Test follows production again.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Apply a flag's test configuration to production, then let test follow production again. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli flag evaluate <person> [--flag <flag>]… [--env]` */
const flagEvaluateCommand = Command.make(
  "evaluate",
  {
    person: personArgument,
    flag: Flag.String("flag").pipe(
      Flag.withDescription("Only this flag, by key; repeat for each"),
      Flag.atLeast(0),
    ),
    platform: Flag.String("platform").pipe(
      Flag.withDescription(
        "The platform their app runs on (ios, android or web), for rules that ask; left out, such a condition counts as not set",
      ),
      Flag.optional,
    ),
    appVersion: Flag.String("app-version").pipe(
      Flag.withDescription("Their app's version, such as 2.4.1, for rules that ask"),
      Flag.optional,
    ),
    osVersion: Flag.String("os-version").pipe(
      Flag.withDescription("Their operating system's version, such as 17.4, for rules that ask"),
      Flag.optional,
    ),
    country: Flag.String("country").pipe(
      Flag.withDescription("The two-letter country they are in, such as DE, for rules that ask"),
      Flag.optional,
    ),
    locale: Flag.String("locale").pipe(
      Flag.withDescription("Their locale, such as de-DE, for rules that ask"),
      Flag.optional,
    ),
    env: environmentOption,
    project: projectOption,
    ...outputOptions,
  },
  ({ appVersion, country, env, flag, json, locale, osVersion, person, platform, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const identity = yield* requirePerson(person, "voidhash-cli flag evaluate <person>");
      // A known person is evaluated with all their identities, as their app would be.
      const persons =
        identity.type === "person_id" || identity.type === "external_id"
          ? []
          : (yield* personsMatching(projectId, `${identity.type}:${identity.value}`)).persons;
      if (persons.length > 1) {
        return yield* Effect.fail(
          userError(
            `${identity.value} belongs to ${persons.length} persons:\n${persons.map((one) => `  ${one.name ?? one.distinctId}  ${one.id}`).join("\n")}`,
            {
              hint: "Name one by its person id.",
              exitCode: ExitCode.usage,
            },
          ),
        );
      }
      const known = persons[0];
      const result = yield* api.featureFlagsEvaluate(projectId, {
        personId: known?.id ?? (identity.type === "person_id" ? identity.value : undefined),
        distinctId:
          known?.distinctId ?? (identity.type === "distinct_id" ? identity.value : undefined),
        email: known?.email ?? (identity.type === "email" ? identity.value : undefined),
        externalIds: identity.type === "external_id" ? [identity.value] : undefined,
        environment: env,
        keys: Arr.isReadonlyArrayEmpty(flag) ? undefined : flag,
        // What their app would report, for rules with conditions on it.
        ...(Option.isNone(platform) &&
        Option.isNone(appVersion) &&
        Option.isNone(osVersion) &&
        Option.isNone(country) &&
        Option.isNone(locale)
          ? {}
          : {
              context: {
                platform: Option.getOrUndefined(platform),
                appVersion: Option.getOrUndefined(appVersion),
                osVersion: Option.getOrUndefined(osVersion),
                country: Option.getOrUndefined(country),
                locale: Option.getOrUndefined(locale),
              },
            }),
        // A look at one end user must not place them in an experiment that sets a flag.
        isPreview: true,
      });
      if (mode === "json") return yield* printJson(result.flags);
      if (mode === "quiet")
        return yield* Console.log(
          result.flags
            .filter((one) => one.isEnabled)
            .map((one) => one.key)
            .join("\n"),
        );
      const flags = yield* listFlags(projectId, false);
      /** Why a flag came out as it did, with the share its rule or everyone else gets. */
      const why = (one: (typeof result.flags)[number]) => {
        const config = Option.map(
          Arr.findFirst(flags, (candidate) => candidate.id === one.featureFlagId),
          (found) => environmentOf(found, env),
        );
        const within = (share: Option.Option<number>) =>
          `${one.isEnabled ? "inside" : "outside"} the ${Option.match(share, { onNone: () => "", onSome: (value) => `${percent(value)} ` })}`;
        return Match.value(one.reason).pipe(
          Match.when("disabled", () => `off in ${env}`),
          Match.when("override", () => "an override fixes it"),
          Match.when("experiment", () => "a running experiment sets it for their arm"),
          Match.when("rule", () => {
            const rule = Option.flatMap(config, ({ rules }) =>
              Arr.findFirst(rules, (candidate) => candidate.id === one.ruleId),
            );
            const share = Option.map(rule, ({ serve }) => serve.rolloutPercentage);
            return Option.contains(share, 0)
              ? `rule ${one.ruleId ?? ""} gives it to nobody`
              : `${within(share)}rule ${one.ruleId ?? ""} gives it to`;
          }),
          Match.when("default", () =>
            Option.match(config, {
              onNone: () => `${within(Option.none())}rollout`,
              onSome: ({ fallthrough, rules }) =>
                Arr.isReadonlyArrayEmpty(rules)
                  ? `${within(Option.some(fallthrough.rolloutPercentage))}rollout`
                  : `no rule matches them; ${within(Option.some(fallthrough.rolloutPercentage))}everyone else gets`,
            }),
          ),
          Match.when("no_identity", () => "no identity to place them by"),
          Match.exhaustive,
        );
      };
      if (known !== undefined)
        yield* Console.error(
          `${printable(known.name ?? known.email ?? known.distinctId)} (${known.id})`,
        );
      yield* printTable(
        [
          { header: "FLAG", cell: (one) => one.key },
          {
            header: "GETS",
            cell: (one) =>
              one.isEnabled
                ? one.variantKey === null
                  ? "on"
                  : `on, ${formatValue(valueOf(one))}`
                : "off",
          },
          { header: "WHY", cell: why },
        ],
        result.flags,
        "The project has no flags in use.",
      );
    }),
).pipe(
  Command.withDescription(
    "Show what one end user gets from each flag and why, as their app would see it in production, or in test with --env test. Rules that ask about the app read --platform, --app-version, --os-version, --country and --locale; without them such a condition counts as not set.",
  ),
);

/** `voidhash-cli flag archive <flag> [--yes]` */
const flagArchiveCommand = Command.make(
  "archive",
  { flag: flagArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ flag, json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        flagKind,
        yield* listFlags(projectId, false),
        flag,
        "voidhash-cli flag archive <flag> --yes",
      );
      if (found.environments.production.isEnabled || found.environments.test?.isEnabled === true) {
        yield* confirmChange({
          yes,
          message: `Archive ${found.key} in ${projectKind(context.session).label(context.project)}? It is ${flagState(found)} in production and test ${testState(found)}; apps stop receiving it, so everyone who has it loses it.`,
        });
      }
      const archived = yield* api.featureFlagsArchive(projectId, found.id);
      yield* printItem(
        mode,
        archived,
        `Archived ${archived.key}. Bring it back with 'voidhash-cli flag restore ${archived.key}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Archive a flag you no longer use: apps stop receiving it. Asks first when it is on.",
  ),
);

/** `voidhash-cli flag restore <flag>` */
const flagRestoreCommand = Command.make(
  "restore",
  { flag: flagArgument, project: projectOption, ...outputOptions },
  ({ flag, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        { ...flagKind, listCommand: "voidhash-cli flag list --archived" },
        yield* listFlags(projectId, true),
        flag,
        "voidhash-cli flag restore <flag>",
      );
      const restored = yield* api.featureFlagsUnarchive(projectId, found.id);
      yield* printItem(mode, restored, `Restored ${restored.key}: ${flagState(restored)}.`);
    }),
).pipe(Command.withDescription("Bring back an archived flag as it was."));

/** `voidhash-cli flag …` */
export const flagCommand = Command.make("flag").pipe(
  Command.withAlias("flags"),
  Command.withDescription(
    "Feature flags: turn features on for a share of end users in production or in test, fix them for testers, and see why someone gets what.",
  ),
  Command.withSubcommands([
    flagListCommand,
    flagViewCommand,
    flagCreateCommand,
    flagEnableCommand,
    flagDisableCommand,
    flagRolloutCommand,
    flagEditCommand,
    flagVariantsCommand,
    flagOverrideCommand,
    flagRuleCommand,
    flagFollowCommand,
    flagPromoteCommand,
    flagEvaluateCommand,
    flagArchiveCommand,
    flagRestoreCommand,
  ]),
);
