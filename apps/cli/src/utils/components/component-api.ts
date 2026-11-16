import type {
  ComponentWarning,
  PaywallComponentVersionDetailJsonEncoding,
  PaywallComponentVersionJsonEncoding,
} from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as P from "effect/Predicate";
import type { CliError } from "effect/cli";

import { type ApiFailure, apiError } from "../error-formatter";

/**
 * Translates a component API failure into the message shown to the user. The
 * server's message names every problem it found with a module or crate.
 */
export const componentApiUserError = (error: ApiFailure): CliError.UserError =>
  apiError(error, { consent_required: "Review it, then run the command again with --yes." });

/**
 * What each version warning means, and what to do about it. A warning a newer
 * server reports that this CLI does not know is printed as its code.
 */
export const WARNING_LABELS: Readonly<Record<string, string>> = {
  conformance_not_run:
    "Not run through the conformance suite, because the server had no component build service when it was stored. Run 'voidhash-cli test' on it.",
  panel_not_built:
    "The build returned no editor panel, so the editor shows the default panels. Publish the source again to build it.",
} satisfies Record<ComponentWarning, string>;

/** Prints the facts of version `version` of the project component `slug`, one aligned line each. */
export const printComponentVersion = (
  slug: string,
  version: PaywallComponentVersionJsonEncoding | PaywallComponentVersionDetailJsonEncoding,
) =>
  Console.log(
    [
      `${slug} v${version.version}`,
      `  Status:       ${version.status}`,
      `  Source:       ${version.sourceKind}`,
      `  Created:      ${version.createdAt}`,
      `  Built:        ${version.builtAt ?? "-"}`,
      `  Content hash: ${version.contentHash ?? "-"}`,
      `  Panel hash:   ${version.panelHash ?? "-"}`,
      `  Size:         ${P.isNumber(version.byteSize) ? `${version.byteSize} bytes` : "-"}`,
      `  Conformance:  ${version.conformance === null ? "not run" : version.conformance.hasPassed ? "passed" : "failed; it cannot be inserted"}`,
      ...(version.conformance?.checks ?? []).flatMap((check) =>
        check.status === "fail" ? check.errors.map((error) => `  ✗ ${check.name}: ${error}`) : [],
      ),
      ...version.warnings.map((warning) => `  ! ${WARNING_LABELS[warning] ?? warning}`),
    ].join("\n"),
  );

/** Prints a version's build log, noting when the server kept none. */
export const printBuildLog = (version: PaywallComponentVersionDetailJsonEncoding) =>
  Console.log(`\nBuild log:\n${version.buildLog?.trim() || "(empty)"}`);
