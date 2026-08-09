"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand/react";

import { CompilePipeline } from "../code-mode/compile-pipeline";
import { hashSource } from "../code-mode/hash";
import { uploadComponentManifest } from "../code-mode/manifest-upload";
import {
  pruneCodeComponentsCompiled,
  setCodeComponentCompiled,
} from "../state/actions/code-component-editor-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import {
  codeComponentDefinitions,
  selectCodeComponentNodes,
} from "../state/utils/code-components";

/**
 * Watches the paywall's code-component definitions and compiles each in-browser
 * (esbuild-wasm → sandbox render) whenever its source changes, dispatching the
 * validated artifact into the store. The pipeline (worker + iframe) is created
 * lazily on the first compile and destroyed on unmount. Mount once inside the
 * designer, alongside `usePaywallComponentCatalog`.
 */
export function useCodeComponentCompilation(): void {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const nodes = useStore(store, selectCodeComponentNodes);
  const definitions = useMemo(() => codeComponentDefinitions(nodes), [nodes]);

  const pipelineRef = useRef<CompilePipeline | null>(null);
  const compiledHashes = useRef(new Map<string, string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    // Reset on (re)mount — React StrictMode runs mount→cleanup→mount in dev, and
    // the cleanup flips this false; without re-arming it, every compile result
    // would be dropped and the component would stick on "compiling".
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
      compiledHashes.current.clear();
    };
  }, []);

  useEffect(() => {
    const liveIds = new Set(definitions.map((definition) => definition.id));

    // Forget compile state for deleted definitions so a re-created id recompiles
    // and instances of the deleted definition drop to the "deleted" placeholder.
    for (const id of compiledHashes.current.keys()) {
      if (!liveIds.has(id)) {
        compiledHashes.current.delete(id);
      }
    }
    dispatch(pruneCodeComponentsCompiled)({ keepIds: [...liveIds] });

    for (const definition of definitions) {
      const sourceHash = hashSource(definition.source);
      if (compiledHashes.current.get(definition.id) === sourceHash) {
        continue;
      }
      compiledHashes.current.set(definition.id, sourceHash);

      pipelineRef.current ??= new CompilePipeline();
      const pipeline = pipelineRef.current;

      dispatch(setCodeComponentCompiled)({
        compiled: { sourceHash, status: "compiling" },
        id: definition.id,
      });

      const definitionId = definition.id;
      const applyError = (message: string) => {
        if (!mountedRef.current || compiledHashes.current.get(definitionId) !== sourceHash) {
          return;
        }
        dispatch(setCodeComponentCompiled)({
          compiled: { diagnostics: [{ message, phase: "runtime" }], error: message, sourceHash, status: "error" },
          id: definitionId,
        });
      };

      pipeline
        .compile(definition.source)
        .then((result) => {
          // Upload the manifest/diagnostics to the server cache (fire-and-forget,
          // deduped per sourceHash). Keyed by content, so it is valid regardless
          // of whether this run is still current — do it before the staleness
          // guard below so a superseded-but-finished compile still contributes.
          uploadComponentManifest(sourceHash, result);

          // Apply unless unmounted or superseded — a compile started in a prior
          // effect run (e.g. before a rename re-ran this effect) must still land,
          // guarded only by the source-hash staleness check, never by a per-run
          // cancellation flag (which would strand it in "compiling").
          if (!mountedRef.current || compiledHashes.current.get(definitionId) !== sourceHash) {
            return;
          }
          if (result.ok) {
          dispatch(setCodeComponentCompiled)({
            compiled: {
              artifact: {
                code: result.hasPanel ? result.code : undefined,
                hasPanel: result.hasPanel,
                manifest: result.manifest,
                previewTrees: result.previewTrees,
              },
              sourceHash,
              status: "ready",
            },
            id: definition.id,
          });
        } else {
          dispatch(setCodeComponentCompiled)({
            compiled: {
              diagnostics: result.diagnostics,
              error: result.diagnostics.map((diagnostic) => diagnostic.message).join("; "),
              sourceHash,
              status: "error",
            },
            id: definitionId,
          });
        }
        })
        // A rejection would otherwise strand the component on "compiling"; the
        // pipeline is designed never to reject, but guard defensively.
        .catch((error: unknown) => {
          applyError(error instanceof Error ? error.message : String(error));
        });
    }
  }, [definitions, dispatch]);
}
