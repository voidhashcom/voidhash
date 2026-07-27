/**
 * `@voidhash/paywall-build` — the build system for paywall code
 * components.
 *
 * Takes an entry `paywall.tsx` plus its component files and runs the pipeline:
 * resolve imports → typecheck e2e (real cross-file TypeScript) → compile
 * components → extract §2 manifests → cross-validate → emit artifacts (the
 * component set + validated manifests). The isolation-owning, environment-
 * specific work (esbuild transform, sandboxed evaluation, typecheck lib assets)
 * is threaded in via {@link BuildCapabilities}, so this package stays pure.
 *
 * HARD BOUNDARY: zero mimic imports — no `mimic-core`, `mimic-schema`, or
 * `paywall-workspace`. The only paywall dependency is the OSS SDK
 * `@voidhash/paywalls` (`/schema`, `/sandbox-dts`). The Node build capabilities
 * (native esbuild + real-FS) live behind the `./node` subpath so
 * `node:fs`/`esbuild` never land in a browser/workerd bundle of this entry.
 */

// Orchestration.
export { buildPaywall } from "./build.ts";

// Filesystem seam + in-memory implementation.
export { MemoryFs } from "./memory-fs.ts";
export type { BuildFileEntry, BuildFs, BuildReadFs } from "./fs.ts";

// Diagnostics.
export {
  error,
  hasErrors,
  info,
  warning,
  type BuildDiagnostic,
  type BuildPhase,
  type BuildSeverity,
} from "./diagnostics.ts";

// Content-address hashing (SHA-256 hex; compatible with paywall-workspace).
export { hashSource } from "./hash.ts";

// Core contract types.
export type {
  BuildArtifacts,
  BuildCapabilities,
  BuildDiagnosticInput,
  BuildResult,
  CachedManifest,
  CompileOutcome,
  ComponentArtifact,
  ComponentStatus,
  ExtractOutcome,
  ManifestCache,
  ManifestCacheRow,
  TypecheckOptions,
} from "./types.ts";

// Re-exported OSS artifact types (so consumers stay on one specifier).
export type { ComponentManifest } from "@voidhash/paywalls/schema";
