/**
 * The report periods and numbers the events, insights, analytics and ads
 * commands share. A period is a range of whole days: `--last 30d` is the 30
 * complete days before today (today is still accruing), `--from`/`--to` an
 * explicit range whose end defaults to today. "Today" is the date in the
 * report's time zone. The day arithmetic is `@voidhash/lib/report-period`,
 * which the MCP tools read periods with too.
 */
import { addDays, isDay, type ReportPeriod, trailingSpan } from "@voidhash/lib/report-period";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Flag } from "effect/cli";

import { ExitCode, userError } from "../../utils/error-formatter";

const UNITS = {
  d: ["day", "days"],
  w: ["week", "weeks"],
  m: ["month", "months"],
  y: ["year", "years"],
} as const;

const SPAN_UNITS = { d: "day", w: "week", m: "month", y: "year" } as const;

const LAST_PATTERN = /^(\d{1,4})\s*(d|days?|w|weeks?|m|mo|months?|y|years?)$/;

/** The days `--last <span>` names, ending yesterday; none when `span` is not a span. */
export const lastSpan = (span: string, today: string): Option.Option<ReportPeriod> => {
  const match = LAST_PATTERN.exec(span.trim().toLowerCase());
  const count = Number(match?.[1] ?? 0);
  const unit = match?.[2]?.[0];
  if (
    match === null ||
    count < 1 ||
    (unit !== "d" && unit !== "w" && unit !== "m" && unit !== "y")
  ) {
    return Option.none();
  }
  const [singular, plural] = UNITS[unit];
  return Option.some({
    ...trailingSpan(count, SPAN_UNITS[unit], today),
    label: `last ${count} ${count === 1 ? singular : plural}`,
  });
};

/** `--last`, `--from` and `--to`, the period flags every report takes. */
export const periodOptions = (defaultLast: string) => ({
  last: Flag.String("last").pipe(
    Flag.withDescription(
      `The complete days before today to report on, such as 7d, 4w, 3m or 1y (default: ${defaultLast})`,
    ),
    Flag.optional,
  ),
  from: Flag.String("from").pipe(
    Flag.withDescription("First day to report on, YYYY-MM-DD (instead of --last)"),
    Flag.optional,
  ),
  to: Flag.String("to").pipe(
    Flag.withDescription("Last day to report on, YYYY-MM-DD (default: today; with --from)"),
    Flag.optional,
  ),
});

const PERIOD_HINT = "Pass --last 30d (or 7d, 4w, 3m, 1y), or --from YYYY-MM-DD [--to YYYY-MM-DD].";

/**
 * The days the period flags name, with `today` in the report's time zone:
 * `--last`, else `--from`/`--to`, else `defaultLast`. Fails with a usage error
 * saying what to pass.
 */
export const periodOf = (
  flags: {
    readonly last: Option.Option<string>;
    readonly from: Option.Option<string>;
    readonly to: Option.Option<string>;
  },
  options: { readonly today: string; readonly defaultLast: string },
): Effect.Effect<ReportPeriod, ReturnType<typeof userError>> => {
  const usage = (message: string) =>
    Effect.fail(userError(message, { hint: PERIOD_HINT, exitCode: ExitCode.usage }));
  if (Option.isSome(flags.last)) {
    if (Option.isSome(flags.from) || Option.isSome(flags.to)) {
      return usage("--last cannot be combined with --from or --to.");
    }
    const span = flags.last.value;
    return Option.match(lastSpan(span, options.today), {
      onNone: () => usage(`"${span}" is not a span of days.`),
      onSome: Effect.succeed,
    });
  }
  if (Option.isNone(flags.from)) {
    if (Option.isSome(flags.to)) return usage("--to needs --from.");
    return Option.match(lastSpan(options.defaultLast, options.today), {
      onNone: () => usage(`"${options.defaultLast}" is not a span of days.`),
      onSome: Effect.succeed,
    });
  }
  const from = flags.from.value;
  const to = Option.getOrElse(flags.to, () => options.today);
  if (!isDay(from)) return usage(`--from ${from} is not a date.`);
  if (!isDay(to)) return usage(`--to ${to} is not a date.`);
  if (to < from) return usage(`--to ${to} is before --from ${from}.`);
  return Effect.succeed({ from, to, label: from === to ? from : `${from} to ${to}` });
};

/**
 * A day range as the instants the insights take: from the start of `from`
 * to the end of `to` (UTC), but not past `now`.
 */
export const instantsOf = (range: Pick<ReportPeriod, "from" | "to">, now: DateTime.DateTime) => ({
  start: `${range.from}T00:00:00.000Z`,
  end: DateTime.formatIso(
    DateTime.min(DateTime.makeUnsafe(`${addDays(range.to, 1)}T00:00:00Z`), now),
  ),
});

const counts = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** A count as people read it: "12,345". */
export const formatCount = (value: number) => counts.format(value);

/** A decimal rate as a percentage: `formatRate(0.0125)` is "1.25%"; "-" for none. */
export const formatRate = (rate: Option.Option<number>) =>
  Option.match(rate, {
    onNone: () => "-",
    onSome: (value) => `${counts.format(Math.round(value * 10_000) / 100)}%`,
  });

/** A return on spend, such as "1.49x"; "-" for none. */
export const formatRoas = (roas: Option.Option<number>) =>
  Option.match(roas, {
    onNone: () => "-",
    onSome: (value) => `${(Math.round(value * 100) / 100).toFixed(2)}x`,
  });

/** A relative change between two values: "+12.5%", or "-" when there is nothing to compare. */
export const formatChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? "no change" : "-";
  const change = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return `${change > 0 ? "+" : ""}${counts.format(change)}%`;
};
