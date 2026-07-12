import { compileComponents } from "./compile.ts";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error, hasErrors, info } from "./diagnostics.ts";
import { extractManifests, type ExtractedComponent } from "./extract.ts";
import type { BuildReadFs } from "./fs.ts";
import { hashSource } from "./hash.ts";
import { resolveImports } from "./imports.ts";
import { typecheck } from "./typecheck.ts";
import type {
  BuildArtifacts,
  BuildCapabilities,
  BuildResult,
  ComponentArtifact,
  TypecheckOptions,
} from "./types.ts";
import { validate } from "./validate.ts";

/**
 * Build a paywall's code components from its entry `.tsx` and component files.
 *
 * The build system for paywall code: entry `paywall.tsx` → resolve imports →
 * typecheck e2e → compile components → extract manifests → cross-validate →
 * component artifacts. It is mimic-free (no mimic-core / mimic-schema /
 * paywall-workspace imports) and side-effect-free with respect to the entry:
 * the import/typecheck stages parse the entry but NEVER execute it.
 *
 * Every stage accumulates diagnostics; later stages still run where meaningful
 * so one bad file does not hide the rest. `ok` is true iff no `error`-severity
 * diagnostic was produced; `artifacts` is present only when `ok`.
 *
 * @param fs   the read side of the {@link BuildFs} (read/list/exists)
 * @param entryPath absolute POSIX path of the entry `paywall.tsx`
 * @param caps host build capabilities (compile/extract/typecheck/cache seams)
 */
export async function buildPaywall(
  fs: BuildReadFs,
  entryPath: string,
  caps: BuildCapabilities,
): Promise<BuildResult> {
  const diagnostics: BuildDiagnostic[] = [];

  // Missing entry is the ONLY error and short-circuits everything.
  if (!fs.exists(entryPath)) {
    return {
      ok: false,
      diagnostics: [error(entryPath, "validate", `Entry file "${entryPath}" does not exist.`)],
    };
  }

  // Stage 1 — imports.
  const imports = resolveImports(fs, entryPath);
  diagnostics.push(...imports.diagnostics);

  // Stage 2 — typecheck (capability-gated).
  if (caps.typecheck) {
    const options: TypecheckOptions =
      typeof caps.typecheck === "object" ? caps.typecheck : {};
    diagnostics.push(
      ...typecheck(entryPath, imports.entrySource, imports.components, options),
    );
  } else {
    diagnostics.push(
      info(entryPath, "types", "Typecheck capability not enabled — types are not checked."),
    );
  }

  // Stage 3 — compile.
  const compileResult = await compileComponents(imports.components, caps);
  diagnostics.push(...compileResult.diagnostics);

  // Stage 4 — extract manifests.
  const extractResult = await extractManifests(compileResult.compiled, caps);
  diagnostics.push(...extractResult.diagnostics);

  // Stage 5 — cross-validate.
  diagnostics.push(...validate(imports.components));

  const ok = !hasErrors(diagnostics);
  if (!ok) {
    return { ok, diagnostics };
  }

  const artifacts: BuildArtifacts = {
    components: toComponentArtifacts(imports.components, extractResult.extracted),
  };
  return { ok, artifacts, diagnostics };
}

/**
 * Assemble the ordered component artifact list from the imports set (source of
 * truth for the full component set + source) joined with the extract results
 * (manifest + status). Ordered by canonical path for determinism.
 */
function toComponentArtifacts(
  imported: ReturnType<typeof resolveImports>["components"],
  extracted: readonly ExtractedComponent[],
): readonly ComponentArtifact[] {
  const byPath = new Map(extracted.map((e) => [e.path, e]));
  return imported
    .map((component): ComponentArtifact => {
      const e = byPath.get(component.path);
      return {
        path: component.path,
        source: component.source,
        sourceHash: e?.sourceHash ?? hashSource(component.source),
        manifest: e?.manifest ?? null,
        status: e?.status ?? "unknown",
      };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
