import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand";
import type { Primitive } from "@voidhash/mimic-core";

import { clearActiveDraft, setActiveDraft } from "../zustand-commander/commander.js";
import type { CommanderSlice } from "../zustand-commander/types.js";
import type { DraftHandle } from "../client/types.js";
import type { MimicSlice } from "./types.js";

export interface UseDraftReturn<TPrimitive extends Primitive.AnyPrimitive> {
  readonly draft: DraftHandle<TPrimitive> | null;
  readonly begin: () => void;
  readonly commit: () => void;
  readonly discard: () => void;
}

export const useDraft = <TPrimitive extends Primitive.AnyPrimitive, TPresence = unknown>(
  store: StoreApi<MimicSlice<TPrimitive, TPresence> & CommanderSlice>,
): UseDraftReturn<TPrimitive> => {
  const draftRef = useRef<DraftHandle<TPrimitive> | null>(null);
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
};
