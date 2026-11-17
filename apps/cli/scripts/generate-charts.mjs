#!/usr/bin/env node
// Writes the chart catalog the CLI embeds, internal/cmd/analytics/charts.json,
// from its source of truth, packages/lib/src/analytics-charts.ts: one object
// per chart, its id first, in catalog order, without the charts of the
// "system" section, which the dashboard keeps for itself.
//
//   node scripts/generate-charts.mjs           write the file
//   node scripts/generate-charts.mjs --check   fail when it is out of date
//
// The catalog module has no imports, so Node loads it as it is (Node 24
// strips the types by itself).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(cli, "..", "..", "packages", "lib", "src", "analytics-charts.ts");
const target = join(cli, "internal", "cmd", "analytics", "charts.json");

const { ANALYTICS_CHARTS } = await import(pathToFileURL(source).href);
const charts = Object.entries(ANALYTICS_CHARTS)
  .filter(([, chart]) => chart.section !== "system")
  .map(([id, chart]) => ({ id, ...chart }));

// Laid out as the repository's formatter lays JSON out, so a format check
// passes on the written file: two spaces, and a list of plain values on one
// line while that line fits in 100 columns.
const generated =
  JSON.stringify(charts, null, 2).replace(
    /^( *(?:"[^"]*": )?)\[\n((?: +(?:"(?:[^"\\]|\\.)*"|-?[\d.eE+-]+|true|false|null),?\n)+) *\](,?)$/gm,
    (whole, start, items, end) => {
      const line = `${start}[${items.trim().split(/,\n */).join(", ")}]${end}`;
      return line.length <= 100 ? line : whole;
    },
  ) + "\n";

if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== generated) {
    console.error(
      "internal/cmd/analytics/charts.json is out of date; run 'node scripts/generate-charts.mjs' in apps/cli.",
    );
    process.exit(1);
  }
} else {
  writeFileSync(target, generated);
  console.log(`Wrote ${charts.length} charts to internal/cmd/analytics/charts.json.`);
}
