import type { SessionReport } from "./types";
import { renderViolation } from "./server/verify";

/** Renders a session report as a human-readable failure description. */
export const renderReport = (report: SessionReport): string => {
  if (report.pass) {
    return `conformance suite "${report.suite}" passed (${report.totalSteps} steps, ${report.executedExchanges} exchanges)`;
  }

  const lines = [
    `conformance suite "${report.suite}" FAILED: ${report.violations.length} violation(s) over ${report.executedExchanges} exchange(s)`,
  ];
  for (const exchange of report.exchanges) {
    const stepLabel = exchange.stepId ?? "<no expected step>";
    lines.push(`  [${exchange.index}] ${exchange.method} ${exchange.path} (step: ${stepLabel})`);
    for (const violation of exchange.violations) {
      lines.push(`      ${renderViolation(violation).replace(/\n/g, "\n      ")}`);
    }
  }
  return lines.join("\n");
};
