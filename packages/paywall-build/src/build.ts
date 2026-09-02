import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
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
export function buildPaywall(
  fs: BuildReadFs,
  entryPath: string,
  caps: BuildCapabilities,
): Promise<BuildResult> {
  return EffectRuntime.runPromise(buildPaywallEffect(fs, entryPath, caps));
}

/** The build pipeline as an Effect; {@link buildPaywall} runs it. */
function buildPaywallEffect(
  fs: BuildReadFs,
  entryPath: string,
  caps: BuildCapabilities,
): Effect.Effect<BuildResult> {
  return Effect.gen(function* () {
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
      diagnostics.push(
        ...typecheck(
          entryPath,
          imports.entrySource,
          imports.components,
          typecheckOptions(caps.typecheck),
        ),
      );
    } else {
      diagnostics.push(
        info(entryPath, "types", "Typecheck capability not enabled — types are not checked."),
      );
    }

    // Stage 3 — compile.
    const compileResult = yield* Effect.tryPromise(() =>
      compileComponents(imports.components, caps),
    ).pipe(Effect.orDie);
    diagnostics.push(...compileResult.diagnostics);

    // Stage 4 — extract manifests.
    const extractResult = yield* Effect.tryPromise(() =>
      extractManifests(compileResult.compiled, caps),
    ).pipe(Effect.orDie);
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
  });
}

/** The typecheck options a `true`/options capability value resolves to. */
function typecheckOptions(
  capability: NonNullable<BuildCapabilities["typecheck"]>,
): TypecheckOptions {
  if (P.isObject(capability)) return capability;
  return {};
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
  const byPath = HashMap.fromIterable(
    extracted.map((extractedComponent) => [extractedComponent.path, extractedComponent] as const),
  );
  return Arr.sort(
    imported.map((component): ComponentArtifact => {
      const e = HashMap.get(byPath, component.path).valueOrUndefined;
      return {
        path: component.path,
        source: component.source,
        sourceHash: e?.sourceHash ?? hashSource(component.source),
        manifest: e?.manifest ?? Option.none(),
        status: e?.status ?? "unknown",
      };
    }),
    Order.mapInput(Order.String, (artifact: ComponentArtifact) => artifact.path),
  );
}
