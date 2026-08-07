import type { ComponentManifest } from "@voidhash/paywalls/schema";
import type { BuildDiagnostic } from "./diagnostics.ts";

/**
 * A component's manifest as returned by the cache: the validated §2 manifest,
 * keyed by source hash. `manifest: null` records a known-but-unextractable
 * component (so a cache hit can still degrade a status to `unknown` explicitly).
 */
export interface CachedManifest {
  readonly manifest: ComponentManifest | null;
}

/** A row the build offers to the manifest cache after a fresh extraction. */
export interface ManifestCacheRow {
  readonly sourceHash: string;
  readonly manifest: ComponentManifest;
}

/**
 * The result of a `compile` capability call: either the compiled CJS code or a
 * set of compile diagnostics (positions are 1-based when present).
 */
export type CompileOutcome =
  | { readonly code: string }
  | { readonly diagnostics: readonly BuildDiagnosticInput[] };

/**
 * The result of an `extractManifest` capability call: either an extracted
 * (still unvalidated) manifest value or extraction diagnostics.
 */
export type ExtractOutcome =
  | { readonly manifest: unknown }
  | { readonly diagnostics: readonly BuildDiagnosticInput[] };

/**
 * A capability-supplied diagnostic. Only the message is required; the build
 * attributes the `path`/`phase` and fills a default severity of `error`.
 */
export interface BuildDiagnosticInput {
  readonly message: string;
  readonly severity?: BuildDiagnostic["severity"];
  readonly line?: number;
  readonly column?: number;
}

/** The optional manifest cache seam. */
export interface ManifestCache {
  /** Resolve cached manifests for a set of source hashes (misses omitted). */
  get(hashes: readonly string[]): Promise<Map<string, CachedManifest>>;
  /** Record a freshly extracted manifest. Best-effort — never fails the build. */
  record(row: ManifestCacheRow): Promise<void>;
}

/** Options passed to the typecheck stage when it is enabled. */
export interface TypecheckOptions {
  /**
   * Extra lib d.ts assets to add to the compiler host, as `{ name → contents }`.
   * Merged on top of (and overriding) the package's built-in lib set. Absent ⇒
   * the built-in set only.
   */
  readonly libs?: Readonly<Record<string, string>>;
}

/**
 * The host-provided build capabilities. Every field is optional: a stage whose
 * capability is absent is SKIPPED (recorded with an `info` diagnostic), so a
 * pure build (no capabilities) still runs imports + grammar + validate.
 *
 * The `compile`/`extractManifest` seams keep the isolation-owning, environment-
 * specific work (esbuild transform, sandboxed evaluation) OUT of this pure
 * package — the Node test capability wires them via `./node`, a browser/worker
 * host wires its own sandbox.
 */
export interface BuildCapabilities {
  /** Compile a single component's `.tsx` source to CJS. */
  compile?: (source: string) => Promise<CompileOutcome>;
  /** Evaluate compiled CJS in isolation and extract its raw manifest value. */
  extractManifest?: (compiledCode: string) => Promise<ExtractOutcome>;
  /** Optional manifest cache, consulted before `extractManifest`. */
  manifestCache?: ManifestCache;
  /**
   * Enable the e2e typecheck stage. `true` uses defaults; an options object
   * supplies extra libs. Absent/`false` ⇒ the stage is skipped (info diagnostic).
   */
  typecheck?: boolean | TypecheckOptions;
}

/** The status of a component in the build's artifact set. */
export type ComponentStatus = "ready" | "unknown";

/** A single component in the build result. */
export interface ComponentArtifact {
  /** Canonical document-relative path (`components/<basename>.tsx`). */
  readonly path: string;
  /** The component's `.tsx` source. */
  readonly source: string;
  /** SHA-256 hex of `source`. */
  readonly sourceHash: string;
  /** The validated §2 manifest, or `null` when unknown. */
  readonly manifest: ComponentManifest | null;
  /** `ready` ⇒ manifest resolved; `unknown` ⇒ not extractable this build. */
  readonly status: ComponentStatus;
}

/** The successful build artifacts (present only when `ok`). */
export interface BuildArtifacts {
  /** Every component in the build (imported and library), ordered by path. */
  readonly components: readonly ComponentArtifact[];
}

/** The result of {@link buildPaywall}. */
export interface BuildResult {
  /** True when no `error`-severity diagnostic was produced. */
  readonly ok: boolean;
  /** Present only when `ok` — the produced component set. */
  readonly artifacts?: BuildArtifacts;
  /** Every diagnostic from every stage, in stage order. */
  readonly diagnostics: readonly BuildDiagnostic[];
}
