/**
 * How commands print what they did. People get aligned tables and short
 * summaries; `--json` prints the API objects, the stable shape for scripts;
 * `--quiet` prints only ids, one per line, for piping into another command.
 * Color appears only on a terminal, and never when `NO_COLOR` is set.
 *
 * A list command reads:
 *
 * ```ts
 * const mode = yield* outputModeOf({ json, quiet });
 * if (mode === "json") return yield* printJson(products);
 * if (mode === "quiet") return yield* printIds(products);
 * // Only people see the perks, so only they wait for them.
 * yield* printTable(columns, products, "No products yet. Create one with 'voidhash-cli product create'.");
 * ```
 */
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stdio from "effect/Stdio";

import { ExitCode, userError } from "../utils/error-formatter";
import { printable, printableLines } from "../utils/printable";

/** How a command prints its result. */
export type OutputMode = "human" | "json" | "quiet";

/** The {@link OutputMode} the `--json` and `--quiet` flags ask for; both at once is a usage error. */
export const outputModeOf = (flags: { readonly json: boolean; readonly quiet: boolean }) =>
  flags.json && flags.quiet
    ? Effect.fail(
        userError("--json and --quiet cannot be combined.", {
          hint: "Pass --json for the objects, or --quiet for their ids.",
          exitCode: ExitCode.usage,
        }),
      )
    : Effect.succeed<OutputMode>(flags.json ? "json" : flags.quiet ? "quiet" : "human");

const PrettyJson = Schema.fromJsonString(Schema.Unknown, { space: 2 });
const encodePrettyJson = Schema.encodeSync(PrettyJson);

/** Prints `value` as indented JSON. */
export const printJson = (value: unknown) => Console.log(encodePrettyJson(value));

/** Text styles that render only when standard output is a terminal and `NO_COLOR` is unset. */
export interface Style {
  readonly bold: (text: string) => string;
  readonly dim: (text: string) => string;
  readonly green: (text: string) => string;
  readonly yellow: (text: string) => string;
  readonly red: (text: string) => string;
}

const ansi = (code: number) => (text: string) => `\u001B[${code}m${text}\u001B[0m`;
const plain = (text: string) => text;

/** The {@link Style} for this run. */
export const terminalStyle = Effect.gen(function* () {
  const isTerminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal;
  const noColor = yield* Config.String("NO_COLOR").pipe(
    Config.withDefault(""),
    Effect.orElseSucceed(() => ""),
  );
  return isTerminal && noColor === ""
    ? { bold: ansi(1), dim: ansi(2), green: ansi(32), yellow: ansi(33), red: ansi(31) }
    : { bold: plain, dim: plain, green: plain, yellow: plain, red: plain };
}) satisfies Effect.Effect<Style, never, Stdio.Stdio>;

/** A table column: its header and each row's cell. */
export interface Column<A> {
  readonly header: string;
  readonly cell: (item: A) => string;
}

/**
 * `items` as rows under `columns`, each padded to its widest cell. Cells are
 * {@link printable}, since they show what end users and teammates named things.
 */
export const formatTable = <A>(
  columns: ReadonlyArray<Column<A>>,
  items: ReadonlyArray<A>,
  style: Pick<Style, "bold"> = { bold: plain },
): string => {
  const rows = [
    columns.map((column) => column.header),
    ...items.map((item) => columns.map((column) => printable(column.cell(item)))),
  ];
  const widths = columns.map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );
  const lines = rows.map((row) =>
    row
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join("  ")
      .trimEnd(),
  );
  return [style.bold(lines[0] ?? ""), ...lines.slice(1)].join("\n");
};

/** Prints the ids of `items`, one per line, for `--quiet`. */
export const printIds = (items: ReadonlyArray<{ readonly id: string }>) =>
  Arr.match(items, {
    onEmpty: () => Effect.void,
    onNonEmpty: (some) => Console.log(some.map((item) => item.id).join("\n")),
  });

/**
 * Prints `items` as a table for people, or `empty` when there are none; say
 * there how to create the first one.
 */
export const printTable = <A>(
  columns: ReadonlyArray<Column<A>>,
  items: ReadonlyArray<A>,
  empty: string,
) =>
  Arr.match(items, {
    onEmpty: () => Console.log(printableLines(empty)),
    onNonEmpty: (some) =>
      Effect.flatMap(terminalStyle, (style) => Console.log(formatTable(columns, some, style))),
  });

/**
 * Prints one object the way `mode` asks: `human` for people, as
 * {@link printable} lines, the object as JSON, or its id.
 */
export const printItem = <A extends { readonly id: string }>(
  mode: OutputMode,
  item: A,
  human: string,
) => {
  if (mode === "json") return printJson(item);
  if (mode === "quiet") return Console.log(item.id);
  return Console.log(printableLines(human));
};

/**
 * `label: value` lines with the values aligned, for a summary of one object;
 * each line of a value is {@link printable}.
 */
export const formatFields = (fields: ReadonlyArray<readonly [label: string, value: string]>) => {
  const width = Math.max(...fields.map(([label]) => label.length));
  return fields
    .flatMap(([label, value]) =>
      value
        .split("\n")
        .map((line, index) =>
          `  ${(index === 0 ? label : "").padEnd(width)}  ${printable(line)}`.trimEnd(),
        ),
    )
    .join("\n");
};

/** An ISO time as people read it, in their time zone: "Oct 28, 2026, 2:05 PM". */
export const formatDate = (iso: string) =>
  Option.match(DateTime.make(iso), {
    onNone: () => iso,
    onSome: DateTime.formatLocal({ locale: "en-US", dateStyle: "medium", timeStyle: "short" }),
  });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long before `now` an ISO time was: "just now", "5 minutes ago", "3 days ago", or the date. */
export const formatTimeAgo = (iso: string, now: DateTime.DateTime) =>
  Option.match(DateTime.make(iso), {
    onNone: () => iso,
    onSome: (time) => {
      const elapsed = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(time);
      const count = (unit: number, name: string) => {
        const amount = Math.floor(elapsed / unit);
        return `${amount} ${name}${amount === 1 ? "" : "s"} ago`;
      };
      if (elapsed < MINUTE) return "just now";
      if (elapsed < HOUR) return count(MINUTE, "minute");
      if (elapsed < DAY) return count(HOUR, "hour");
      if (elapsed < 30 * DAY) return count(DAY, "day");
      return DateTime.formatLocal(time, { locale: "en-US", dateStyle: "medium" });
    },
  });

/**
 * An amount of money as people read it: `amount` minor units (cents for USD,
 * yen for JPY) of the ISO 4217 `currency`, so `formatMoney(999, "USD")` is
 * "$9.99".
 */
export const formatMoney = (amount: number, currency: string) => {
  const format = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
};
