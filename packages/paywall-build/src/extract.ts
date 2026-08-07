import { Effect } from "effect";
import { causeMessage, pick } from "@voidhash/lib/lang";
import { parseComponentManifest } from "@voidhash/paywalls/schema";
import type { ComponentManifest } from "@voidhash/paywalls/schema";
import type { CompiledComponent } from "./compile.ts";
import { hashSource } from "./hash.ts";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error } from "./diagnostics.ts";
import { staticExtractManifest } from "./static-manifest.ts";
import type {
  BuildCapabilities,
  BuildDiagnosticInput,
  CachedManifest,
  ComponentStatus,
  ExtractOutcome,
  ManifestCache,
} from "./types.ts";

/** The per-component result of the extract stage. */
export interface ExtractedComponent {
  readonly path: string;
  readonly source: string;
  readonly sourceHash: string;
  readonly manifest: ComponentManifest | null;
  readonly status: ComponentStatus;
}

/** The extract stage output. */
export interface ExtractResult {
  readonly extracted: readonly ExtractedComponent[];
  readonly diagnostics: readonly BuildDiagnostic[];
}

/** The 1-based position of a capability diagnostic, when it carries one. */
function positionOf(diagnostic: BuildDiagnosticInput): { line?: number; column?: number } {
  const position: { line?: number; column?: number } = {};
  if (diagnostic.line !== undefined) position.line = diagnostic.line;
  if (diagnostic.column !== undefined) position.column = diagnostic.column;
  return position;
}

/** Map a capability diagnostic to a `runtime`-phase build diagnostic. */
function fromCapability(path: string, diagnostic: BuildDiagnosticInput): BuildDiagnostic {
  return {
    path,
    phase: "runtime",
    severity: diagnostic.severity ?? "error",
    message: diagnostic.message,
    ...positionOf(diagnostic),
  };
}

/** Batch cache lookup by source hash — an absent cache resolves to no hits. */
function cacheLookup(
  cache: ManifestCache | undefined,
  hashes: readonly string[],
): Effect.Effect<Map<string, CachedManifest>> {
  if (!cache) return Effect.succeed(new Map());
  return Effect.promise(() => cache.get([...new Set(hashes)]));
}

/**
 * Stage 4 — extract manifests.
 *
 * For each component, resolve its §2 manifest in preference order:
 *   1. `manifestCache.get(hash)` — trust the cached manifest (may be null).
 *   2. the host `extractManifest` capability — runs the compiled code (the
 *      ground-truth extractor), when both a capability and compiled code exist.
 *   3. STATIC AST extraction from the component's source ({@link staticExtractManifest}).
 *
 * The static fallback is what lets a freshly-authored component reach `ready` on
 * a degraded runtime (workerd: no compile, no extract capability, no cache
 * entry) — its `defineComponent` grammar is derivable from the AST without
 * execution, so its composition bindings can still be validated this build.
 * Every source of a raw manifest (runtime OR static) is validated with
 * `parseComponentManifest` before it is trusted, and any freshly resolved valid
 * manifest is offered back to `manifestCache.record` best-effort — a cache error
 * NEVER fails the build.
 *
 * When the runtime path fails but static succeeds, the component is still
 * `ready` (the static manifest is derived from the same closed grammar), and
 * the runtime failure is surfaced as a non-blocking `warning` — a module that
 * crashes at eval must stay observable, not silently masked by the fallback.
 *
 * Degradation (⇒ `status: "unknown"`, `manifest: null`):
 * - Runtime extraction and static extraction both fail — the runtime's
 *   diagnostics AND the static extractor's diagnostics are surfaced (phase
 *   `runtime`) for that file.
 * - No compiled code, no cache, and static extraction fails — the static
 *   extractor's diagnostics are surfaced.
 */
export function extractManifests(
  compiled: readonly CompiledComponent[],
  caps: BuildCapabilities,
): Promise<ExtractResult> {
  return Effect.runPromise(extractManifestsEffect(compiled, caps));
}

/** The extract stage as an Effect; {@link extractManifests} runs it. */
function extractManifestsEffect(
  compiled: readonly CompiledComponent[],
  caps: BuildCapabilities,
): Effect.Effect<ExtractResult> {
  return Effect.gen(function* () {
    const diagnostics: BuildDiagnostic[] = [];
    const cache = caps.manifestCache;
    const extractManifest = caps.extractManifest;

    // Batch cache lookup by source hash (misses simply absent from the map).
    const hashByComponent = compiled.map((c) => hashSource(c.component.source));
    const cacheHits = yield* cacheLookup(cache, hashByComponent);

    const extracted: ExtractedComponent[] = [];
    for (let i = 0; i < compiled.length; i += 1) {
      const { component, code } = compiled[i]!;
      const sourceHash = hashByComponent[i]!;
      const base = { path: component.path, source: component.source, sourceHash };

      // 1. Cache hit — trust the cached manifest (may be null ⇒ known-unknown).
      const cached = cacheHits.get(sourceHash);
      if (cached) {
        extracted.push({
          ...base,
          manifest: cached.manifest,
          status: pick(cached.manifest !== null, "ready", "unknown"),
        });
        continue;
      }

      let manifest: ComponentManifest | null = null;
      // Runtime diagnostics deferred until the static outcome is known: on a
      // static success they downgrade to non-blocking warnings (the build
      // proceeds on the static manifest, but a module that crashes at eval must
      // stay observable); only when static ALSO fails do they surface at their
      // original severity.
      const deferred: BuildDiagnostic[] = [];

      // 2. Runtime extract + validate (ground truth), when possible.
      if (extractManifest && code !== null) {
        manifest = yield* Effect.tryPromise({
          try: () => extractManifest(code),
          catch: (cause) => cause,
        }).pipe(
          Effect.match({
            onSuccess: (outcome) => validateOutcome(component.path, outcome, deferred),
            onFailure: (cause) => {
              deferred.push(error(component.path, "runtime", causeMessage(cause)));
              return null;
            },
          }),
        );
      }

      // 3. Static AST fallback — the only manifest source on a degraded runtime.
      //    Runs whenever the runtime path did not resolve a manifest (including
      //    the `code === null` short-circuit workerd hits).
      if (!manifest) {
        const staticDiagnostics: BuildDiagnostic[] = [];
        const staticManifest = validateOutcome(
          component.path,
          staticExtractManifest(component.source, component.path),
          staticDiagnostics,
        );
        if (staticManifest) {
          manifest = staticManifest;
          for (const diagnostic of deferred) {
            diagnostics.push({
              ...diagnostic,
              severity: "warning",
              message: `Manifest resolved statically, but the runtime extractor failed: ${diagnostic.message}`,
            });
          }
        } else {
          // Both paths failed: surface the runtime's diagnostics (if any) AND the
          // static extractor's, so the author sees why the manifest is unavailable.
          diagnostics.push(...deferred, ...staticDiagnostics);
        }
      }

      // 4. Record fresh valid manifests best-effort (cache errors never fail).
      const fresh = manifest;
      if (fresh && cache) {
        // Intentionally ignored — the cache is an optimization, not a gate.
        yield* Effect.tryPromise({
          try: () => cache.record({ sourceHash, manifest: fresh }),
          catch: (cause) => cause,
        }).pipe(Effect.ignore);
      }

      extracted.push({
        ...base,
        manifest,
        status: pick(manifest !== null, "ready", "unknown"),
      });
    }

    return { extracted, diagnostics };
  });
}

/**
 * Validate a raw {@link ExtractOutcome} (runtime OR static) into a typed
 * manifest, or push its diagnostics to `sink` and return `null`. Capability
 * diagnostics map to the `runtime` phase; an invalid manifest is a `runtime`
 * error naming the schema failures.
 */
function validateOutcome(
  path: string,
  outcome: ExtractOutcome,
  sink: BuildDiagnostic[],
): ComponentManifest | null {
  if ("diagnostics" in outcome) {
    for (const diagnostic of outcome.diagnostics) {
      sink.push(fromCapability(path, diagnostic));
    }
    return null;
  }
  const parsed = parseComponentManifest(outcome.manifest);
  if (parsed.ok) return parsed.value;
  sink.push(error(path, "runtime", `Invalid component manifest: ${parsed.errors.join("; ")}`));
  return null;
}
