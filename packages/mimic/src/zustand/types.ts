import type { StateCreator, StoreMutatorIdentifier } from "zustand";
import type { Primitive } from "@voidhash/mimic-core";

import type { ClientDocument, PresenceEntry } from "../client/types.js";

export interface MimicPresence<TPresence> {
  readonly selfId: string | undefined;
  readonly self: TPresence | undefined;
  readonly others: ReadonlyMap<string, PresenceEntry<TPresence>>;
  readonly all: ReadonlyMap<string, PresenceEntry<TPresence>>;
}

export interface MimicObject<
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
> {
  readonly document: ClientDocument<TPrimitive, TPresence, TPresenceInput>;
  readonly snapshot: Primitive.InferSnapshot<TPrimitive> | undefined;
  readonly presence: MimicPresence<TPresence> | undefined;
  readonly isConnected: boolean;
  readonly isReady: boolean;
  readonly pendingCount: number;
  readonly hasPendingChanges: boolean;
  readonly activeDraftIds: readonly string[];
}

export interface MimicSlice<
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
> {
  readonly mimic: MimicObject<TPrimitive, TPresence, TPresenceInput>;
}

export type MimicStateCreator<
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence,
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  TPresenceInput = TPresence,
> = StateCreator<T & MimicSlice<TPrimitive, TPresence, TPresenceInput>, Mps, Mcs, T>;

export interface MimicMiddlewareOptions {
  readonly autoSubscribe?: boolean;
  readonly autoConnect?: boolean;
}
