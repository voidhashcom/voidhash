import type { Command, Primitive, Value } from "@voidhash/mimic-core";

import type { DocumentTransport } from "./Transport.js";

export interface PresenceConfig<TPresence, TPresenceInput = TPresence> {
  readonly primitive: Primitive.Primitive<TPresenceInput, TPresence, any>;
  readonly initial?: TPresenceInput;
}

export interface PresenceEntry<TPresence> {
  readonly data: TPresence;
  readonly userId?: string;
}

export interface PresenceListener {
  readonly onPresenceChange?: () => void;
}

export interface ClientPresence<TPresence, TPresenceInput = TPresence> {
  selfId(): string | undefined;
  self(): TPresence | undefined;
  others(): ReadonlyMap<string, PresenceEntry<TPresence>>;
  all(): ReadonlyMap<string, PresenceEntry<TPresence>>;
  set(data: TPresenceInput): void;
  clear(): void;
  subscribe(listener: PresenceListener): () => void;
}

export interface DraftHandle<TPrimitive extends Primitive.AnyPrimitive> {
  readonly id: string;
  readonly root: Primitive.InferProxy<TPrimitive>;
  getValue(): Value | undefined;
  getSnapshot(): Primitive.InferSnapshot<TPrimitive> | undefined;
  transaction<R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R;
  update(fn: (root: Primitive.InferProxy<TPrimitive>) => void): void;
  commit(): void;
  discard(): void;
}

export interface ClientDocumentListener<TPrimitive extends Primitive.AnyPrimitive> {
  readonly onStateChange?: (snapshot: Primitive.InferSnapshot<TPrimitive> | undefined) => void;
  readonly onConnectionChange?: (connected: boolean) => void;
  readonly onReady?: () => void;
  readonly onDraftChange?: () => void;
}

export interface ClientDocumentOptions<
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
> {
  readonly primitive: TPrimitive;
  readonly transport: DocumentTransport;
  readonly initialValue?: Value;
  readonly initialVersion?: number;
  readonly presence?: PresenceConfig<TPresence, TPresenceInput>;
  readonly onStateChange?: (snapshot: Primitive.InferSnapshot<TPrimitive> | undefined) => void;
  readonly onConnectionChange?: (connected: boolean) => void;
  readonly onReady?: () => void;
  readonly onRejection?: (transactionId: string, reason: string) => void;
}

export interface ClientDocument<
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
> {
  readonly primitive: TPrimitive;
  readonly root: Primitive.InferProxy<TPrimitive>;
  readonly presence?: ClientPresence<TPresence, TPresenceInput>;
  getValue(): Value | undefined;
  getServerValue(): Value | undefined;
  getSnapshot(): Primitive.InferSnapshot<TPrimitive> | undefined;
  getServerSnapshot(): Primitive.InferSnapshot<TPrimitive> | undefined;
  getServerVersion(): number;
  getPendingCount(): number;
  hasPendingChanges(): boolean;
  isConnected(): boolean;
  isReady(): boolean;
  transaction<R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R;
  /**
   * Apply a precomputed CRDT command batch as a single transaction. The commands
   * flow through the same enqueue → replay → validate → flush path as a proxy
   * `transaction`, so an invalid batch rolls back and rethrows without poisoning
   * the pending queue, and an empty batch is a no-op. Used by the paywall
   * composition round-trip, which computes its own minimal merge-safe batch via
   * `reconcile` rather than through proxy mutations.
   */
  applyCommands(commands: readonly Command[]): void;
  connect(): Promise<void>;
  disconnect(): void;
  resync(): Promise<void>;
  createDraft(): DraftHandle<TPrimitive>;
  getActiveDraftIds(): readonly string[];
  subscribe(listener: ClientDocumentListener<TPrimitive>): () => void;
}
