import type { DraftHandle } from "@voidhash/mimic/client";
import { clearActiveDraft, setActiveDraft } from "@voidhash/mimic/zustand-commander";
import type { PaywallDesignerDocument } from "@voidhash/mimic-schema";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import type { PaywallDesignerStoreType } from "../state/designer-store";

export interface UseDesignerDraftReturn {
  readonly draft: DraftHandle<typeof PaywallDesignerDocument> | null;
  readonly begin: () => void;
  readonly commit: () => void;
  readonly discard: () => void;
}

/**
 * Designer-typed replica of `useDraft` from `@voidhash/mimic/zustand`.
 * The package hook types its store as `MimicSlice<TPrimitive, TPresence>`,
 * which collapses the presence INPUT type to the presence SNAPSHOT type —
 * the designer store keeps them distinct (`PresenceInput` writes vs decoded
 * `PresenceSnapshot` reads), so the package signature cannot accept it.
 * Behavior is identical: one active draft at a time, registered with the
 * commander so undoable actions write into it, discarded on unmount.
 */
export function useDesignerDraft(store: PaywallDesignerStoreType): UseDesignerDraftReturn {
  const draftRef = useRef<DraftHandle<typeof PaywallDesignerDocument> | null>(null);
  const versionRef = useRef(0);

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store],
  );

  const getSnapshot = useCallback(() => versionRef.current, []);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const bumpVersion = useCallback(() => {
    versionRef.current += 1;
  }, []);

  const begin = useCallback(() => {
    if (draftRef.current !== null) {
      throw new Error("A draft is already active. Commit or discard it first.");
    }
    const draft = store.getState().mimic.document.createDraft();
    draftRef.current = draft;
    setActiveDraft(store, draft);
    bumpVersion();
  }, [store, bumpVersion]);

  const commit = useCallback(() => {
    if (draftRef.current === null) {
      return;
    }
    clearActiveDraft(store);
    draftRef.current.commit();
    draftRef.current = null;
    bumpVersion();
  }, [store, bumpVersion]);

  const discard = useCallback(() => {
    if (draftRef.current === null) {
      return;
    }
    clearActiveDraft(store);
    draftRef.current.discard();
    draftRef.current = null;
    bumpVersion();
  }, [store, bumpVersion]);

  useEffect(
    () => () => {
      if (draftRef.current !== null) {
        try {
          clearActiveDraft(store);
          draftRef.current.discard();
        } catch {
          // Ignore stale draft cleanup errors.
        }
        draftRef.current = null;
      }
    },
    [store],
  );

  return {
    draft: draftRef.current,
    begin,
    commit,
    discard,
  };
}
