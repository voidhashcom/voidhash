import type {
  AcquisitionCohortsResultJsonEncoding,
  AcquisitionReportResultJsonEncoding,
} from "@voidhash/generated-clients";
import { chartResultLines } from "@voidhash/lib/analytics-chart-text";
import { analyticsChart, ANALYTICS_CHART_IDS } from "@voidhash/lib/analytics-charts";
import { todayIn } from "@voidhash/lib/report-period";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { resolveProject } from "../context";
import { formatFields, formatMoney, formatTimeAgo, printJson, printTable } from "../output";
import { projectOption } from "../shared-options";
import { formatCount, formatRate, instantsOf, periodOf, periodOptions } from "./analytics-period";
import { alertsCommand } from "./analytics-alerts";
import { ExitCode, userError } from "../../utils/error-formatter";
import { printable } from "../../utils/printable";

const jsonOption = Flag.Boolean("json").pipe(
  Flag.withDescription("Print the API report as JSON, for scripts"),
  Flag.withDefault(false),
);

const reportOptions = {
  network: Flag.String("network").pipe(
    Flag.withDescription("Only people whose credited touch came from this network, such as meta"),
    Flag.optional,
  ),
  campaign: Flag.String("campaign").pipe(
    Flag.withDescription("Only people whose credited touch carried this campaign id"),
    Flag.optional,
  ),
  adset: Flag.String("adset").pipe(
    Flag.withDescription("Only people whose credited touch carried this ad set id"),
    Flag.optional,
  ),
  attributionWindowDays: Flag.Int("attribution-window-days").pipe(
    Flag.withDescription(
      "Days before a signup a campaign touch may be credited with it, 1 to 90 (default: the project's setting)",
    ),
    Flag.optional,
  ),
  currency: Flag.String("currency").pipe(
    Flag.withDescription("ISO 4217 code money is reported in (default: USD)"),
    Flag.optional,
  ),
  timezone: Flag.String("timezone").pipe(
    Flag.withDescription("IANA time zone days are cut in, such as Europe/Prague (default: UTC)"),
    Flag.optional,
  ),
  environment: Flag.Literals("environment", ["production", "sandbox", "test"]).pipe(
    Flag.withDescription(
      "Purchases revenue is read from: production (default), sandbox (App Store and Google Play sandbox) or test (debug builds' simulated purchases and test modes such as Stripe's)",
    ),
    Flag.optional,
  ),
};

/** The name of an acquisition group at its level. */
const groupName = (group: AcquisitionReportResultJsonEncoding["groups"][number]) =>
  group.adName ??
  group.adsetName ??
  group.campaignName ??
  group.surface ??
  group.network ??
  "(no network)";

/** `voidhash-cli analytics acquisition` */
const acquisitionCommand = Command.make(
  "acquisition",
  {
    project: projectOption,
    ...periodOptions("30d"),
    by: Flag.Literals("by", ["network", "campaign", "adset", "ad", "surface"]).pipe(
      Flag.withDescription("What people are grouped by (default: campaign)"),
      Flag.withDefault("campaign" as const),
    ),
    ...reportOptions,
    ad: Flag.String("ad").pipe(
      Flag.withDescription("Only people whose credited touch carried this ad id"),
      Flag.optional,
    ),
    keyConversion: Flag.Literals("key-conversion", ["signup", "trial", "payer"]).pipe(
      Flag.withDescription("The conversion counted as KEY (default: the project's setting)"),
      Flag.optional,
    ),
    json: jsonOption,
  },
  (flags) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(flags.project)).project.id;
      const now = yield* DateTime.now;
      const period = yield* periodOf(flags, {
        today: todayIn(
          now,
          Option.getOrElse(flags.timezone, () => "UTC"),
        ),
        defaultLast: "30d",
      });
      const report = yield* api.analyticsReportAcquisition(projectId, {
        from: period.from,
        to: period.to,
        level: flags.by,
        network: Option.getOrUndefined(flags.network),
        campaignId: Option.getOrUndefined(flags.campaign),
        adsetId: Option.getOrUndefined(flags.adset),
        adId: Option.getOrUndefined(flags.ad),
        currency: Option.getOrUndefined(flags.currency),
        timezone: Option.getOrUndefined(flags.timezone),
        environment: Option.getOrUndefined(flags.environment),
        keyConversion: Option.getOrUndefined(flags.keyConversion),
        attributionWindowDays: Option.getOrUndefined(flags.attributionWindowDays),
      });
      if (flags.json) return yield* printJson(report);
      const money = (amount: number) => formatMoney(amount, report.currency);
      yield* Console.log(
        `People acquired ${period.label} (${report.from} to ${report.to}, ${report.timezone}), by ${report.level}, ${report.environment} revenue, ${report.attributionWindowDays}-day attribution window:\n`,
      );
      yield* printTable(
        [
          { header: report.level.toUpperCase(), cell: groupName },
          { header: "VISITS", cell: (group) => formatCount(group.visits) },
          { header: "PEOPLE", cell: (group) => formatCount(group.peopleAcquired) },
          { header: "TRIALS", cell: (group) => formatCount(group.trialStarters) },
          { header: "PAYERS", cell: (group) => formatCount(group.payingPeople) },
          {
            header: `KEY (${report.keyConversion})`,
            cell: (group) => formatCount(group.keyConversions),
          },
          { header: "NET REVENUE", cell: (group) => money(group.netRevenue) },
          {
            header: "ID",
            cell: (group) => group.adId ?? group.adsetId ?? group.campaignId ?? "-",
          },
        ],
        report.groups,
        "No signup was credited to a campaign touch in this period.",
      );
      const { totals, coverage } = report;
      yield* Console.log(
        `\n${formatFields([
          [
            "Total",
            `${formatCount(totals.peopleAcquired)} people, ${formatCount(totals.payingPeople)} payers, ${money(totals.netRevenue)} net revenue`,
          ],
          ...(report.unattributed === null
            ? []
            : ([
                [
                  "Unattributed",
                  `${formatCount(report.unattributed.peopleAcquired)} people, ${money(report.unattributed.netRevenue)} net revenue`,
                ],
              ] as const)),
          [
            "Coverage",
            `${formatRate(Option.fromNullishOr(coverage.share))} of ${money(coverage.totalRevenue)} revenue came from people whose signup was credited to a touch`,
          ],
        ])}`,
      );
    }),
).pipe(
  Command.withDescription(
    "Report the people each network, campaign, ad set, ad or surface brought in, and what they went on to pay.",
  ),
);

const COHORT_DAYS = [0, 7, 30, 90, 180, 365] as const;

/**
 * A cohort's cumulative net revenue by `day`: measured once the cohort
 * completed it, otherwise projected ("~", "+" when partial) or measured so
 * far ("*"), and "-" before it got there without a projection.
 */
const revenueBy = (
  cohort: AcquisitionCohortsResultJsonEncoding["total"][number],
  day: number,
  currency: string,
) => {
  const cell = cohort.cells.find((candidate) => candidate.day === day);
  const projection = cohort.projections.find((candidate) => candidate.day === day);
  if (projection !== undefined) {
    return `~${formatMoney(projection.netRevenue, currency)}${projection.isPartial ? "+" : ""}`;
  }
  if (cell === undefined) return "-";
  return `${formatMoney(cell.netRevenue, currency)}${cell.maturity === "maturing" ? "*" : ""}`;
};

/** `voidhash-cli analytics cohorts` */
const cohortsCommand = Command.make(
  "cohorts",
  {
    project: projectOption,
    ...periodOptions("13w"),
    by: Flag.Literals("by", ["surface", "network", "campaign", "adset"]).pipe(
      Flag.withDescription("What the groups are (default: network)"),
      Flag.withDefault("network" as const),
    ),
    ...reportOptions,
    json: jsonOption,
  },
  (flags) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(flags.project)).project.id;
      const now = yield* DateTime.now;
      const period = yield* periodOf(flags, {
        today: todayIn(
          now,
          Option.getOrElse(flags.timezone, () => "UTC"),
        ),
        defaultLast: "13w",
      });
      const report = yield* api.analyticsReportAcquisitionCohorts(projectId, {
        from: period.from,
        to: period.to,
        groupBy: flags.by,
        network: Option.getOrUndefined(flags.network),
        campaignId: Option.getOrUndefined(flags.campaign),
        adsetId: Option.getOrUndefined(flags.adset),
        currency: Option.getOrUndefined(flags.currency),
        timezone: Option.getOrUndefined(flags.timezone),
        environment: Option.getOrUndefined(flags.environment),
        attributionWindowDays: Option.getOrUndefined(flags.attributionWindowDays),
      });
      if (flags.json) return yield* printJson(report);
      yield* Console.log(
        `Weekly cohorts acquired ${period.label} (${report.from} to ${report.to}, ${report.timezone}, ${report.attributionWindowDays}-day attribution window): cumulative net revenue by day since the credited touch.\n`,
      );
      yield* printTable(
        [
          { header: "WEEK", cell: (cohort: (typeof report.total)[number]) => cohort.week },
          { header: "PEOPLE", cell: (cohort) => formatCount(cohort.people) },
          ...COHORT_DAYS.map((day) => ({
            header: `DAY ${day}`,
            cell: (cohort: (typeof report.total)[number]) =>
              revenueBy(cohort, day, report.currency),
          })),
        ],
        report.total,
        "No signup was credited to a campaign touch in this period.",
      );
      yield* Arr.match(report.groups, {
        onEmpty: () => Effect.void,
        onNonEmpty: (groups) =>
          Console.log(
            `\nBy ${report.groupBy}: ${groups
              .map(
                (group) =>
                  // A visitor chooses the campaign name a link they followed carries.
                  `${printable(group.campaignName ?? group.adsetName ?? group.surface ?? group.network ?? "(none)")} ${formatCount(group.cohorts.reduce((sum, cohort) => sum + cohort.people, 0))} people`,
              )
              .join(", ")}. --json has each group's cohorts.`,
          ),
      });
      yield* Console.error(
        report.projection === null
          ? "* still maturing: some of the cohort's people are not that many days in yet."
          : "* still maturing: some of the cohort's people are not that many days in yet.\n~ projected from the project's renewal and trial history; --json has each 80% range.\n+ partial: some renewals cannot be projected yet, so likely low.",
      );
    }),
).pipe(
  Command.withDescription(
    "Show how revenue from people acquired each week grows by day 0, 7, 30, 90, 180 and 365 after the touch credited with their signup, projected for days the cohort has not reached.",
  ),
);

/** `voidhash-cli analytics health` */
const healthCommand = Command.make(
  "health",
  { project: projectOption, json: jsonOption },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const health = yield* api.analyticsReportTrackingHealth(projectId);
      if (json) return yield* printJson(health);
      const now = yield* DateTime.now;
      const sdks = (versions: typeof health.web.sdkVersions) =>
        Arr.match(versions, {
          onEmpty: () => "",
          onNonEmpty: (some) =>
            ` (${some.map(({ sdk, version }) => `${sdk ?? "SDK"} ${version ?? "?"}`).join(", ")})`,
        });
      const web =
        health.web.lastEventAt === null
          ? "no events"
          : `last event ${formatTimeAgo(health.web.lastEventAt, now)}${sdks(health.web.sdkVersions)}`;
      const apps = Arr.match(health.apps, {
        onEmpty: () => "no events",
        onNonEmpty: (some) =>
          some
            .map(
              (app) =>
                `${app.platform === "ios" ? "iOS" : "Android"} ${formatCount(app.events)} events, last ${formatTimeAgo(app.lastEventAt, now)}${sdks(app.sdkVersions)}`,
            )
            .join("; "),
      });
      yield* Console.log(
        `Tracking over the last 7 days (${health.start.slice(0, 10)} to ${health.end.slice(0, 10)}):`,
      );
      yield* Console.log(
        formatFields([
          ["Web", web],
          [
            "Web hosts",
            Arr.match(health.web.hosts, {
              onEmpty: () => "none with page views",
              onNonEmpty: (hosts) =>
                hosts
                  .map(({ host, pageviews }) => `${host} (${formatCount(pageviews)} page views)`)
                  .join("\n"),
            }),
          ],
          ["Apps", apps],
          [
            "Web to app",
            `${formatCount(health.handoff.webFirstPeople)} of ${formatCount(health.handoff.appPeople)} app users came from the web (${formatRate(Option.fromNullishOr(health.handoff.share))})`,
          ],
        ]),
      );
      const next = [
        ...(health.web.lastEventAt === null && Arr.isReadonlyArrayEmpty(health.apps)
          ? [
              "No SDK sent events this week: set up the SDK in your app ('voidhash-cli init' in its root), then open the app.",
            ]
          : []),
        ...(health.web.lastEventAt !== null && Arr.isReadonlyArrayEmpty(health.web.hosts)
          ? [
              "The web SDK sends events but no page views: call its page view tracking on each page.",
            ]
          : []),
      ];
      yield* Arr.match(next, {
        onEmpty: () => Console.error("Watch events arrive with 'voidhash-cli events tail'."),
        onNonEmpty: (some) => Console.log(`\nNext:\n${some.map((line) => `  ${line}`).join("\n")}`),
      });
    }),
).pipe(
  Command.withDescription(
    "Check what measuring ads relies on: web page views by host, app SDKs and versions, and how many app users came from the web.",
  ),
);

const SECTIONS = [
  ["overview", "overview"],
  ["revenue", "revenue"],
  ["subscribers", "subscribers"],
  ["trials", "trials"],
  ["churn", "churn"],
  ["audience", "audience"],
  ["paywalls", "paywalls"],
  ["acquisition", "acquisition"],
  ["web", "web"],
  ["app", "app"],
  ["locations", "locations"],
  ["push", "push"],
  ["health", "health"],
] as const;

const GRANULARITIES = [
  ["hour", "hour"],
  ["day", "day"],
  ["week", "week"],
  ["month", "month"],
] as const;

const chartsCommand = Command.make(
  "charts",
  {
    section: Flag.ChoiceWithValue("section", SECTIONS).pipe(
      Flag.withDescription("Only the charts of one Studio page"),
      Flag.optional,
    ),
    json: jsonOption,
  },
  ({ json, section }) => {
    const charts = ANALYTICS_CHART_IDS.filter((id) => {
      const chart = analyticsChart(id);
      return (
        chart.section !== "system" &&
        Option.getOrElse(section, () => chart.section) === chart.section
      );
    });
    return json
      ? printJson(charts.map((id) => ({ id, ...analyticsChart(id) })))
      : printTable(
          [
            { header: "CHART", cell: (id) => id },
            { header: "PAGE", cell: (id) => analyticsChart(id).section },
            { header: "TITLE", cell: (id) => analyticsChart(id).title },
          ],
          charts,
          "No charts.",
        );
  },
).pipe(
  Command.withDescription(
    "List the charts Studio shows, by what they answer. 'voidhash-cli analytics chart <id>' runs one.",
  ),
);

const chartCommand = Command.make(
  "chart",
  {
    id: Argument.String("chart").pipe(
      Argument.withDescription("The chart, as 'analytics charts' lists it"),
    ),
    project: projectOption,
    ...periodOptions("30d"),
    by: Flag.ChoiceWithValue("by", GRANULARITIES).pipe(
      Flag.withDescription("Bucket width of a time series (default: day)"),
      Flag.optional,
    ),
    dimension: Flag.String("dimension").pipe(
      Flag.withDescription("What a chart with dimensions groups by"),
      Flag.optional,
    ),
    metric: Flag.String("metric").pipe(
      Flag.withDescription("What a chart with metrics shows"),
      Flag.optional,
    ),
    timezone: Flag.String("timezone").pipe(
      Flag.withDescription("IANA time zone days are cut in, such as Europe/Prague (default: UTC)"),
      Flag.optional,
    ),
    json: jsonOption,
  },
  ({ by, dimension, from, id, json, last, metric, project, timezone, to }) =>
    Effect.gen(function* () {
      const chartId = ANALYTICS_CHART_IDS.find(
        (candidate) => candidate === id && analyticsChart(candidate).section !== "system",
      );
      if (chartId === undefined) {
        return yield* userError(`There is no chart ${id}.`, {
          hint: "List them with 'voidhash-cli analytics charts'.",
          exitCode: ExitCode.usage,
        });
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const now = yield* DateTime.now;
      const timeZone = Option.getOrElse(timezone, () => "UTC");
      const period = yield* periodOf(
        { from, last, to },
        { defaultLast: "30d", today: todayIn(DateTime.toEpochMillis(now), timeZone) },
      );
      const { results } = yield* api.analyticsReportCharts(projectId, {
        queries: [
          {
            chartId,
            key: chartId,
            timeRange: { preset: "custom", ...instantsOf(period, now) },
            timezone: timeZone,
            ...(Option.isSome(by) && { granularity: by.value }),
            options: {
              ...(Option.isSome(dimension) && { dimension: dimension.value }),
              ...(Option.isSome(metric) && { metric: metric.value }),
            },
          },
        ],
      });
      const [item] = results;
      if (json) return yield* printJson(item);
      const chart = analyticsChart(chartId);
      yield* Console.log(`${chart.title}, ${chart.isCurrentState ? "as of now" : period.label}:`);
      const lines =
        item === undefined ? [] : chartResultLines(chartId, item.result, item.currency ?? null);
      yield* Console.log(
        Arr.isReadonlyArrayEmpty(lines)
          ? "  No data in this period."
          : lines.map((line) => `  ${line}`).join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Run one of the charts Studio shows: retention, paywalls, web traffic, installs, countries and more.",
  ),
);

/** `voidhash-cli analytics …` */
export const analyticsCommand = Command.make("analytics").pipe(
  Command.withDescription(
    "Who your campaigns and other touches brought in, how their revenue grows, whether tracking works, and every chart Studio shows.",
  ),
  Command.withSubcommands([
    acquisitionCommand,
    cohortsCommand,
    healthCommand,
    chartsCommand,
    chartCommand,
    alertsCommand,
  ]),
);
