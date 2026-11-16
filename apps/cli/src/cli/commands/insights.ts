import type {
  AnalyticsFilterNode,
  AnalyticsInsightQuery,
  AnalyticsInsightQueryGranularityEnum,
  AnalyticsInsightQueryInsightId,
  AnalyticsInsightResponseItem,
} from "@voidhash/generated-clients";
import {
  daysIn,
  defaultGranularity,
  previousPeriod,
  type ReportPeriod,
  todayIn,
} from "@voidhash/lib/report-period";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { resolveProject } from "../context";
import { chooseItem, findItem, isInteractive, missingInput, type ItemKind } from "../input";
import { formatFields, formatMoney, printJson, printTable } from "../output";
import { projectOption } from "../shared-options";
import { formatChange, formatCount, instantsOf, periodOf, periodOptions } from "./analytics-period";
import { productKind } from "./catalog";

/** How an insight's summary combines its buckets. */
type Summary = "total" | "end" | "average" | "change";

interface Insight {
  readonly id: AnalyticsInsightQueryInsightId;
  readonly name: string;
  readonly unit: "money" | "percent" | "count";
  readonly summary: Summary;
  readonly description: string;
}

const insight = (
  id: AnalyticsInsightQueryInsightId,
  name: string,
  unit: Insight["unit"],
  summary: Summary,
  description: string,
): Insight => ({ id, name, unit, summary, description });

/** The built-in insights every project can run, as the CLI describes them. */
export const INSIGHTS: ReadonlyArray<Insight> = [
  insight("revenue", "Revenue", "money", "total", "Purchases and renewals minus refunds"),
  insight("mrr", "MRR", "money", "end", "Monthly recurring revenue"),
  insight("arr", "ARR", "money", "end", "Annual run rate, 12 × MRR"),
  insight("mrr_growth_rate", "MRR growth rate", "percent", "change", "Change in MRR"),
  insight(
    "new_mrr",
    "New MRR",
    "money",
    "total",
    "MRR added by new subscriptions, other than those of returning subscribers",
  ),
  insight("expansion_mrr", "Expansion MRR", "money", "total", "MRR added by upgrades"),
  insight("contraction_mrr", "Contraction MRR", "money", "total", "MRR lost to downgrades"),
  insight(
    "reactivation_mrr",
    "Reactivation MRR",
    "money",
    "total",
    "MRR from returning subscribers",
  ),
  insight(
    "churned_revenue",
    "Churned revenue",
    "money",
    "total",
    "MRR lost to subscriptions that ended",
  ),
  insight(
    "net_new_mrr",
    "Net new MRR",
    "money",
    "total",
    "New, expansion and reactivation minus lost MRR",
  ),
  insight(
    "active_subscriptions",
    "Active subscriptions",
    "count",
    "end",
    "Paid subscriptions active",
  ),
  insight("new_subscriptions", "New subscriptions", "count", "total", "Paid subscriptions started"),
  insight(
    "churned_subscriptions",
    "Churned subscriptions",
    "count",
    "total",
    "Subscriptions that ended",
  ),
  insight(
    "active_subscribers_growth",
    "Subscriber growth",
    "percent",
    "average",
    "Change in active paid subscriptions",
  ),
  insight(
    "churn_rate",
    "Churn rate",
    "percent",
    "average",
    "Paid subscriptions that ended, of those active",
  ),
  insight("retention", "Retention", "percent", "average", "Paid subscriptions that did not end"),
  insight("active_trials", "Active trials", "count", "end", "Subscriptions in a free trial"),
  insight("trials", "Trials", "count", "total", "Free trials started"),
  insight(
    "trial_conversions",
    "Trial conversions",
    "count",
    "total",
    "Trials that converted to paid",
  ),
  insight(
    "trial_conversion_rate",
    "Trial conversion rate",
    "percent",
    "average",
    "Trial conversions of trials started",
  ),
  insight("arpu", "ARPU", "money", "total", "Revenue per active person"),
  insight("arppu", "ARPPU", "money", "total", "Revenue per paying person"),
  insight(
    "subscriber_lifetime_value",
    "Subscriber lifetime value",
    "money",
    "total",
    "ARPU divided by churn rate",
  ),
  insight("person_count", "Persons", "count", "end", "Persons ever seen"),
  insight("new_persons", "New persons", "count", "total", "Persons seen for the first time"),
];

const SUMMARY_LABELS: Readonly<Record<Summary, string>> = {
  total: "total",
  end: "at the end",
  average: "average",
  change: "change",
};

/** Insights without a store environment: persons are counted wherever they come from. */
const WITHOUT_ENVIRONMENT = HashSet.make("person_count", "new_persons");

const insightKind: ItemKind<Insight> = {
  noun: "insight",
  label: (item) => `${item.name} (${item.id})`,
  listCommand: "voidhash-cli insights list",
  keys: (item) => [item.id.replaceAll("_", "-")],
  names: (item) => [item.name],
};

/**
 * The stored purchase environment each `--environment` counts: production (1),
 * store sandbox (2) or test (3); `all` leaves them unfiltered.
 */
const ENVIRONMENTS = {
  production: [1],
  sandbox: [2],
  test: [3],
  all: [],
} as const;

const GRANULARITIES = [
  ["hour", "hour"],
  ["day", "day"],
  ["week", "week"],
  ["month", "month"],
  ["quarter", "quarter"],
  ["year", "year"],
] as const satisfies ReadonlyArray<readonly [string, AnalyticsInsightQueryGranularityEnum]>;

/** `voidhash-cli insights list` */
const insightsListCommand = Command.make(
  "list",
  {
    json: Flag.Boolean("json").pipe(
      Flag.withDescription("Print the insights as JSON"),
      Flag.withDefault(false),
    ),
  },
  ({ json }) =>
    json
      ? printJson(INSIGHTS)
      : printTable(
          [
            { header: "INSIGHT", cell: (item: Insight) => item.id },
            { header: "NAME", cell: (item: Insight) => item.name },
            { header: "UNIT", cell: (item: Insight) => item.unit },
            { header: "SUMMARY", cell: (item: Insight) => SUMMARY_LABELS[item.summary] },
            { header: "MEASURES", cell: (item: Insight) => item.description },
          ],
          INSIGHTS,
          "",
        ),
).pipe(Command.withDescription("List the built-in insights 'voidhash-cli insights run' takes."));

/** A value of `item` as people read it. */
const formatValue = (item: Insight, value: number, currency: Option.Option<string>) => {
  if (item.unit === "money")
    return formatMoney(
      value,
      Option.getOrElse(currency, () => "USD"),
    );
  if (item.unit === "percent") return `${formatCount(Math.round(value * 100) / 100)}%`;
  return formatCount(value);
};

const pointsOf = (result: AnalyticsInsightResponseItem["result"]) =>
  "sparkline" in result ? result.sparkline : "series" in result ? result.series : [];

/** `voidhash-cli insights run <insight…> [--last] [--from] [--to] [--by] [--product]… [--environment] [--compare]` */
const insightsRunCommand = Command.make(
  "run",
  {
    insights: Argument.String("insight").pipe(
      Argument.withDescription('Insights to run, such as mrr or "trial conversion rate"'),
      Argument.variadic(),
    ),
    project: projectOption,
    ...periodOptions("30d"),
    by: Flag.ChoiceWithValue("by", GRANULARITIES).pipe(
      Flag.withDescription("Bucket width of the series (default: by the period's length)"),
      Flag.optional,
    ),
    product: Flag.String("product").pipe(
      Flag.withDescription("Only purchases of this product: its slug, name or id; repeat for each"),
      Flag.atLeast(0),
    ),
    environment: Flag.Literals("environment", ["production", "sandbox", "test", "all"]).pipe(
      Flag.withDescription(
        "Purchases counted: production (default), sandbox (App Store and Google Play sandbox), test (debug builds' simulated purchases and test modes such as Stripe's) or all",
      ),
      Flag.withDefault("production"),
    ),
    compare: Flag.Boolean("compare").pipe(
      Flag.withDescription("Also run the period of the same length before it"),
      Flag.withDefault(false),
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDescription("Print the API results as JSON, for scripts"),
      Flag.withDefault(false),
    ),
  },
  ({ by, compare, environment, from, insights, json, last, product, project, to }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const chosen = yield* Arr.match(insights, {
        onNonEmpty: (names) =>
          Effect.forEach(names, (name) => findItem(insightKind, INSIGHTS, name), {
            concurrency: 1,
          }),
        onEmpty: () =>
          Effect.gen(function* () {
            if (!(yield* isInteractive)) {
              return yield* Effect.fail(
                missingInput("the insight", "voidhash-cli insights run <insight> --last 30d"),
              );
            }
            return [yield* chooseItem(insightKind, INSIGHTS)];
          }),
      });
      const now = yield* DateTime.now;
      const period = yield* periodOf(
        { last, from, to },
        { today: todayIn(now, "UTC"), defaultLast: "30d" },
      );
      const products = Arr.isReadonlyArrayEmpty(product)
        ? []
        : yield* Effect.flatMap(
            readAll((query) => api.productsList(projectId, query)),
            (all) =>
              Effect.forEach(product, (input) => findItem(productKind, all, input), {
                concurrency: 1,
              }),
          );
      const granularity = Option.getOrElse(by, () => defaultGranularity(daysIn(period)));

      const productIds = products.map(({ id }) => id);
      /** The filter of `item`'s query: the environment it counts, and the products. */
      const filterFor = (item: Insight): AnalyticsInsightQuery["filter"] => {
        const predicates: ReadonlyArray<AnalyticsFilterNode> = [
          ...(environment === "all" || HashSet.has(WITHOUT_ENVIRONMENT, item.id)
            ? []
            : [
                {
                  type: "predicate",
                  field: "provider.environment",
                  op: "in",
                  value: [...ENVIRONMENTS[environment]],
                } as const,
              ]),
          ...Arr.match(productIds, {
            onEmpty: () => [],
            onNonEmpty: (ids) => [
              { type: "predicate", field: "product.id", op: "in", value: ids } as const,
            ],
          }),
        ];
        return Arr.match(predicates, {
          onEmpty: () => undefined,
          onNonEmpty: ([only, ...more]) =>
            Arr.isReadonlyArrayEmpty(more) ? only : { type: "and", filters: predicates },
        });
      };
      const queryFor = (
        item: Insight,
        range: Pick<ReportPeriod, "from" | "to">,
        key: string,
      ): AnalyticsInsightQuery => ({
        key,
        insightId: item.id,
        granularity,
        timeRange: { preset: "custom", ...instantsOf(range, now) },
        filter: filterFor(item),
      });
      const previous = previousPeriod(period);
      const report = yield* api.analyticsReportInsights(projectId, {
        queries: chosen.flatMap((item) => [
          queryFor(item, period, item.id),
          ...(compare ? [queryFor(item, previous, `${item.id}:previous`)] : []),
        ]),
      });
      if (json) return yield* printJson(report.results);

      const scope = Arr.match(products, {
        onEmpty: () => "",
        onNonEmpty: (some) => `, ${some.map(({ slug }) => slug).join(", ")}`,
      });
      const summaryOf = (key: string) =>
        Option.flatMap(
          Arr.findFirst(report.results, (result) => result.key === key),
          (result) => Option.fromNullishOr(result.result.summary),
        );
      yield* Effect.forEach(
        chosen,
        (item) =>
          Effect.gen(function* () {
            const result = Arr.findFirst(report.results, ({ key }) => key === item.id);
            if (Option.isNone(result)) return;
            const summary = summaryOf(item.id);
            const currency = Option.flatMap(summary, ({ currency }) =>
              Option.fromNullishOr(currency),
            );
            const value = Option.match(summary, { onNone: () => 0, onSome: (some) => some.value });
            const before = summaryOf(`${item.id}:previous`);
            yield* Console.log(
              `${item.name}, ${period.label} (${period.from} to ${period.to} UTC${HashSet.has(WITHOUT_ENVIRONMENT, item.id) ? "" : `, ${environment}`}${scope})`,
            );
            yield* Console.log(
              formatFields([
                [SUMMARY_LABELS[item.summary], formatValue(item, value, currency)],
                ...Arr.fromOption(
                  Option.map(
                    before,
                    (earlier) =>
                      [
                        "previous",
                        `${formatValue(item, earlier.value, currency)} (${previous.from} to ${previous.to}), ${formatChange(value, earlier.value)}`,
                      ] as const,
                  ),
                ),
              ]),
            );
            const points = pointsOf(result.value.result);
            yield* Console.log("");
            yield* printTable(
              [
                {
                  header: granularity.toUpperCase(),
                  cell: (point: (typeof points)[number]) =>
                    granularity === "hour"
                      ? point.timestamp.slice(0, 16).replace("T", " ")
                      : point.timestamp.slice(0, 10),
                },
                { header: "VALUE", cell: (point) => formatValue(item, point.value, currency) },
              ],
              points,
              "  No data in this period.",
            );
            yield* Console.log("");
          }),
        { concurrency: 1, discard: true },
      );
    }),
).pipe(
  Command.withDescription(
    "Run built-in insights over a period, such as 'insights run mrr churn-rate --last 90d --by week'. Counts production purchases unless --environment says otherwise.",
  ),
);

/** `voidhash-cli insights …` */
export const insightsCommand = Command.make("insights").pipe(
  Command.withAlias("insight"),
  Command.withDescription(
    "Revenue, subscription, trial and churn metrics: list and run the built-in insights.",
  ),
  Command.withSubcommands([insightsListCommand, insightsRunCommand]),
);
