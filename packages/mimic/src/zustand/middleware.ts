import type { StateCreator, StoreMutatorIdentifier } from "zustand";
import type { Primitive } from "@voidhash/mimic-core";

import type { ClientDocument } from "../client/types.js";
import type { MimicMiddlewareOptions, MimicObject, MimicSlice } from "./types.js";

type MimicMiddleware = <
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
  T extends object = object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  document: ClientDocument<TPrimitive, TPresence, TPresenceInput>,
  config: StateCreator<T & MimicSlice<TPrimitive, TPresence, TPresenceInput>, Mps, Mcs, T>,
  options?: MimicMiddlewareOptions,
) => StateCreator<
  T & MimicSlice<TPrimitive, TPresence, TPresenceInput>,
  Mps,
  Mcs,
  T & MimicSlice<TPrimitive, TPresence, TPresenceInput>
>;

const createMimicObject = <
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
>(
  document: ClientDocument<TPrimitive, TPresence, TPresenceInput>,
): MimicObject<TPrimitive, TPresence, TPresenceInput> => ({
  document,
  snapshot: document.getSnapshot(),
  presence: document.presence
    ? {
        selfId: document.presence.selfId(),
        self: document.presence.self(),
        others: new Map(document.presence.others()),
        all: new Map(document.presence.all()),
      }
    : undefined,
  isConnected: document.isConnected(),
  isReady: document.isReady(),
  pendingCount: document.getPendingCount(),
  hasPendingChanges: document.hasPendingChanges(),
  activeDraftIds: document.getActiveDraftIds(),
});

const mimicImpl: MimicMiddleware = (document, config, options = {}) => {
  const { autoSubscribe = true, autoConnect = true } = options;
  return (set, get, api) => {
    const updateMimicState = () => {
      set(
        (state) => ({
          ...state,
          mimic: createMimicObject(document),
        }),
        false,
      );
    };

    if (autoSubscribe) {
      document.subscribe({
        onStateChange: updateMimicState,
        onConnectionChange: updateMimicState,
        onReady: updateMimicState,
        onDraftChange: updateMimicState,
      });

      document.presence?.subscribe({
        onPresenceChange: updateMimicState,
      });
    }

    if (autoConnect) {
      void document.connect();
    }

    const userState = config(set, get, api);
    return {
      ...userState,
      mimic: createMimicObject(document),
    };
  };
};

export const mimic = mimicImpl;
