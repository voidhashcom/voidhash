import { buildPaywall } from "./build.ts";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { MemoryFs } from "./memory-fs.ts";
import type { BuildCapabilities, BuildResult } from "./types.ts";

/** Build a paywall from a `{ path → content }` map over a fresh {@link MemoryFs}. */
export function buildFromFiles(
  files: Record<string, string>,
  caps: BuildCapabilities,
  entryPath = "/paywall.tsx",
): Promise<BuildResult> {
  const fs = MemoryFs.fromFiles(
    Object.entries(files).map(([path, content]) => ({ path, content })),
  );
  return buildPaywall(fs, entryPath, caps);
}

/** Diagnostics of a given phase. */
export function ofPhase(
  result: BuildResult,
  phase: BuildDiagnostic["phase"],
): readonly BuildDiagnostic[] {
  return result.diagnostics.filter((d) => d.phase === phase);
}

/** Error-severity diagnostics. */
export function errorsOf(result: BuildResult): readonly BuildDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === "error");
}

/** Warning-severity diagnostics. */
export function warningsOf(result: BuildResult): readonly BuildDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === "warning");
}
