import { Effect } from "effect";

import { managedRuntime, VoidhashRpc } from "@/features/studio/lib/effect-query";

import type { CompileDiagnostic } from "../state/designer-store-state";
import type { PipelineResult } from "./compile-pipeline";

/**
 * Source hashes already uploaded (or in flight) this session, so we never fire a
 * second `RecordComponentManifest` for a source we've already recorded. Manifests
 * are content-addressed (pure derivations of source), so one upload per distinct
 * hash per tab is sufficient — the server row is idempotent regardless.
 */
const uploadedHashes = new Set<string>();

/**
 * Fire-and-forget upload of a finished compile's manifest/diagnostics to the
 * server manifest cache, keyed by `sourceHash`. This is what makes any component
 * ever compiled in a designer session server-resolvable (so the document-first
 * AI/MCP tools can resolve its props/actions server-side).
 *
 * Deliberately non-blocking and silent-on-failure: the compile path must never
 * wait on or fail from this. It runs at most once per `sourceHash` per session
 * (idempotent server-side too), and logs — never throws — on error.
 */
export function uploadComponentManifest(sourceHash: string, result: PipelineResult): void {
  if (uploadedHashes.has(sourceHash)) {
    return;
  }
  uploadedHashes.add(sourceHash);

  const payload = result.ok
    ? { sourceHash, status: "ready" as const, manifest: result.manifest }
    : {
        sourceHash,
        status: "error" as const,
        diagnostics: result.diagnostics.map(toWireDiagnostic),
      };

  void managedRuntime
    .runPromise(VoidhashRpc.use((rpc) => rpc.RecordComponentManifest(payload)))
    .catch((error: unknown) => {
      // Best-effort: a failed upload just means a later server read may miss this
      // manifest and degrade the projection. Roll back the dedup so a retry is
      // possible on the next compile.
      uploadedHashes.delete(sourceHash);
      console.warn(`Failed to upload component manifest ${sourceHash}`, error);
    });
}

function toWireDiagnostic(diagnostic: CompileDiagnostic): {
  message: string;
  phase?: string;
  line?: number;
  column?: number;
} {
  return {
    message: diagnostic.message,
    phase: diagnostic.phase,
    line: diagnostic.line,
    column: diagnostic.column,
  };
}
