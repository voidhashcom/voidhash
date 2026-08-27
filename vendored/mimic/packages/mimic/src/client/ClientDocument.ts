import {
  Primitive,
  applyBatch,
  createGenerator,
  validate as validateSchema,
  validateValue,
  type Command,
  type Path,
  type Schema,
  type Value,
} from "@voidhash/mimic-core";

import { randomUuid, shortId } from "../shared/ids.js";
import { DraftHandleImpl } from "./Draft.js";
import { InvalidStateError, SnapshotValidationError, TransactionRejectedError } from "./errors.js";
import type { PendingTransaction } from "./pending.js";
import { toEnvelope } from "./pending.js";
import { PresenceManager } from "./presence.js";
import { replayPending } from "./state.js";
import type {
  ErrorMessage,
  PresenceRemoveMessage,
  PresenceSnapshotMessage,
  PresenceUpdateMessage,
  SnapshotMessage,
  TransactionMessage,
} from "./protocol.js";
import type { DocumentTransport } from "./Transport.js";
import type { ClientDocument, ClientDocumentListener, ClientDocumentOptions } from "./types.js";

interface ClientDocumentState {
  serverValue: Value | undefined;
  optimisticValue: Value | undefined;
  serverVersion: number;
  pending: PendingTransaction[];
  connected: boolean;
  ready: boolean;
}

const createDocumentSession = (
  current: () => Value,
  emit: (commands: readonly Command[]) => void,
): Primitive.CommandSession => {
  const generator = createGenerator();
  return {
    current,
    emit,
    generator: {
      nextArrayItemId: (_path: Path) => randomUuid(),
      // Node ids appear in printed composition source, so they are short.
      nextTreeNodeId: (_path: Path) => shortId(),
      between: (lower?: string, upper?: string) => generator.between(lower, upper),
    },
  };
};

export class ClientDocumentImpl<
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
> implements ClientDocument<TPrimitive, TPresence, TPresenceInput> {
  readonly primitive: TPrimitive;
  readonly root: Primitive.InferProxy<TPrimitive>;
  readonly presence?: ReturnType<
    ClientDocumentImpl<TPrimitive, TPresence, TPresenceInput>["createPresenceApi"]
  >;

  private readonly schema: Schema;
  private readonly listeners = new Set<ClientDocumentListener<TPrimitive>>();
  private readonly drafts = new Map<string, DraftHandleImpl<TPrimitive>>();
  private readonly transport: DocumentTransport;
  private readonly presenceManager?: PresenceManager<TPresence, TPresenceInput>;
  private readonly resyncWaiters = new Set<{
    readonly resolve: () => void;
    readonly reject: (error: Error) => void;
  }>();
  private readonly state: ClientDocumentState;
  private awaitingSnapshot = false;
  private activePendingId: string | undefined;

  constructor(
    private readonly options: ClientDocumentOptions<TPrimitive, TPresence, TPresenceInput>,
  ) {
    this.primitive = options.primitive;
    this.schema = options.primitive.schema;
    this.transport = options.transport;
    this.presenceManager = options.presence
      ? new PresenceManager(options.presence.primitive)
      : undefined;
    this.presence = this.presenceManager ? this.createPresenceApi(this.presenceManager) : undefined;

    const initialValue = options.initialValue
      ? this.sanitizeValue(options.initialValue)
      : undefined;
    const initialVersion = options.initialVersion ?? 0;

    this.state = {
      serverValue: initialValue,
      optimisticValue: initialValue,
      serverVersion: initialVersion,
      pending: [],
      connected: false,
      ready: initialValue !== undefined,
    };

    this.root = this.primitive.createProxy(
      createDocumentSession(
        () => this.requireOptimisticValue(),
        (commands) => this.enqueueCommands(commands),
      ),
      [],
    ) as Primitive.InferProxy<TPrimitive>;

    this.transport.subscribe((message) => {
      switch (message.type) {
        case "snapshot":
          this.handleSnapshot(message);
          return;
        case "transaction":
          this.handleTransaction(message);
          return;
        case "error":
          this.handleError(message);
          return;
        case "presence_snapshot":
          this.handlePresenceSnapshot(message);
          return;
        case "presence_update":
          this.handlePresenceUpdate(message);
          return;
        case "presence_remove":
          this.handlePresenceRemove(message);
          return;
      }
    });

    this.transport.subscribeConnection((connected) => {
      this.state.connected = connected;
      this.options.onConnectionChange?.(connected);
      for (const listener of this.listeners) {
        listener.onConnectionChange?.(connected);
      }
      if (connected) {
        this.awaitingSnapshot = true;
      } else {
        this.activePendingId = undefined;
        this.presenceManager?.resetConnectionState();
      }
    });

    if (options.presence?.initial !== undefined && this.presenceManager) {
      this.presenceManager.encode(options.presence.initial);
    }
  }

  getValue(): Value | undefined {
    return this.state.optimisticValue;
  }

  getServerValue(): Value | undefined {
    return this.state.serverValue;
  }

  getSnapshot(): Primitive.InferSnapshot<TPrimitive> | undefined {
    return this.primitive.decode(this.state.optimisticValue);
  }

  getServerSnapshot(): Primitive.InferSnapshot<TPrimitive> | undefined {
    return this.primitive.decode(this.state.serverValue);
  }

  getServerVersion(): number {
    return this.state.serverVersion;
  }

  getPendingCount(): number {
    return this.state.pending.length;
  }

  hasPendingChanges(): boolean {
    return this.state.pending.length > 0;
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  isReady(): boolean {
    return this.state.ready;
  }

  transaction<R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R {
    const baseValue = this.requireOptimisticValue();
    let result!: R;
    const commands = Primitive.commands(this.primitive, baseValue, (root) => {
      result = fn(root);
    });
    this.enqueueCommands(commands);
    return result;
  }

  applyCommands(commands: readonly Command[]): void {
    this.enqueueCommands(commands);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  disconnect(): void {
    this.transport.disconnect();
  }

  async resync(): Promise<void> {
    if (!this.state.connected) {
      throw new InvalidStateError("Cannot resync while disconnected");
    }
    this.awaitingSnapshot = true;
    return new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      this.resyncWaiters.add(waiter);
      try {
        this.transport.requestSnapshot();
      } catch (error) {
        this.resyncWaiters.delete(waiter);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  createDraft(): DraftHandleImpl<TPrimitive> {
    const baseValue = this.requireOptimisticValue();
    const draft = new DraftHandleImpl(
      this.primitive,
      baseValue,
      (commands) => this.enqueueCommands(commands),
      (id) => this.removeDraft(id),
    );
    this.drafts.set(draft.id, draft);
    this.notifyDraftChange();
    return draft;
  }

  getActiveDraftIds(): readonly string[] {
    return [...this.drafts.keys()];
  }

  subscribe(listener: ClientDocumentListener<TPrimitive>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private enqueueCommands(commands: readonly Command[]): void {
    if (commands.length === 0) {
      return;
    }

    const pending: PendingTransaction = {
      id: randomUuid(),
      commands,
      submittedAt: new Date().toISOString(),
      sentAt: Date.now(),
    };
    this.state.pending.push(pending);
    try {
      this.recomputeOptimisticValue();
    } catch (error) {
      // A write that fails validation must not poison the pending queue:
      // drop the transaction that was just pushed and restore the previous
      // optimistic value before rethrowing to the caller.
      this.state.pending.pop();
      this.recomputeOptimisticValue();
      throw error;
    }
    this.emitStateChange();
    this.flushPending();
  }

  private flushPending(): void {
    if (!this.state.connected || this.awaitingSnapshot || this.activePendingId) {
      return;
    }
    const next = this.state.pending[0];
    if (!next) {
      return;
    }
    this.activePendingId = next.id;
    this.transport.submit(toEnvelope(next, this.state.serverVersion));
  }

  private handleSnapshot(message: SnapshotMessage): void {
    const sanitized = this.sanitizeValue(message.value);
    this.state.serverValue = sanitized;
    this.state.serverVersion = message.version;
    this.state.ready = true;
    this.awaitingSnapshot = false;
    this.activePendingId = undefined;
    this.recomputeOptimisticValueDroppingConflicts();
    this.emitStateChange();
    this.options.onReady?.();
    for (const listener of this.listeners) {
      listener.onReady?.();
    }
    this.resolveResyncWaiters();
    const encodedPresence = this.presenceManager?.storedEncodedValue();
    if (encodedPresence !== undefined) {
      this.transport.setPresence(encodedPresence);
    }
    this.flushPending();
  }

  private handleTransaction(message: TransactionMessage): void {
    if (this.state.serverValue === undefined) {
      this.requestResync();
      return;
    }

    try {
      const nextServerValue = this.sanitizeValue(
        applyBatch(this.state.serverValue, message.transaction.commands),
      );
      this.state.serverValue = nextServerValue;
      this.state.serverVersion = message.version;
      if (this.state.pending[0]?.id === message.transaction.id) {
        this.state.pending.shift();
        this.activePendingId = undefined;
      }
      this.recomputeOptimisticValue();
      this.emitStateChange();
      this.flushPending();
    } catch {
      this.requestResync();
    }
  }

  private handleError(message: ErrorMessage): void {
    const transactionId = message.transactionId;
    if (!transactionId) {
      return;
    }
    if (this.state.pending[0]?.id === transactionId) {
      this.state.pending.shift();
      this.activePendingId = undefined;
    } else {
      this.state.pending = this.state.pending.filter((pending) => pending.id !== transactionId);
    }
    this.options.onRejection?.(transactionId, message.reason);
    void this.resync().catch(() => {
      throw new TransactionRejectedError(transactionId, message.reason);
    });
  }

  private handlePresenceSnapshot(message: PresenceSnapshotMessage): void {
    this.presenceManager?.applySnapshot(message.selfId, message.presences);
  }

  private handlePresenceUpdate(message: PresenceUpdateMessage): void {
    this.presenceManager?.applyUpdate(message.id, message.data, message.userId);
  }

  private handlePresenceRemove(message: PresenceRemoveMessage): void {
    this.presenceManager?.applyRemove(message.id);
  }

  private recomputeOptimisticValue(): void {
    if (this.state.serverValue === undefined) {
      this.state.optimisticValue = undefined;
      return;
    }
    this.state.optimisticValue = replayPending(
      this.schema,
      this.state.serverValue,
      this.state.pending,
    );
  }

  /**
   * Recompute used after a snapshot lands: a snapshot may already contain an
   * accepted-but-unacked pending transaction (reconnect race), making replay
   * of the pending head fail forever (e.g. a duplicate tree-node insert).
   * Conflicting heads are dropped — their effect is already in the snapshot —
   * until replay succeeds.
   */
  private recomputeOptimisticValueDroppingConflicts(): void {
    for (;;) {
      try {
        this.recomputeOptimisticValue();
        return;
      } catch (error) {
        if (this.state.pending.length === 0) {
          throw error;
        }
        this.state.pending.shift();
      }
    }
  }

  private sanitizeValue(value: Value): Value {
    try {
      validateValue(value);
      const sanitized = validateSchema(this.schema, value);
      if (sanitized === undefined) {
        throw new InvalidStateError("Document schema sanitized to undefined");
      }
      return sanitized;
    } catch (error) {
      throw new SnapshotValidationError("Failed to validate document value", error);
    }
  }

  private requireOptimisticValue(): Value {
    const value = this.state.optimisticValue;
    if (value === undefined) {
      throw new InvalidStateError("Document has no current value");
    }
    return value;
  }

  private emitStateChange(): void {
    const snapshot = this.getSnapshot();
    this.options.onStateChange?.(snapshot);
    for (const listener of this.listeners) {
      listener.onStateChange?.(snapshot);
    }
  }

  private notifyDraftChange(): void {
    for (const listener of this.listeners) {
      listener.onDraftChange?.();
    }
  }

  private removeDraft(id: string): void {
    this.drafts.delete(id);
    this.notifyDraftChange();
  }

  private resolveResyncWaiters(): void {
    const waiters = [...this.resyncWaiters];
    this.resyncWaiters.clear();
    for (const waiter of waiters) {
      waiter.resolve();
    }
  }

  private requestResync(): void {
    if (this.state.connected) {
      this.awaitingSnapshot = true;
      this.transport.requestSnapshot();
    }
  }

  private createPresenceApi(manager: PresenceManager<TPresence, TPresenceInput>) {
    return {
      selfId: () => manager.selfId(),
      self: () => manager.self(),
      others: () => manager.others(),
      all: () => manager.all(),
      set: (data: TPresenceInput) => {
        const encoded = manager.encode(data);
        this.transport.setPresence(encoded);
      },
      clear: () => {
        manager.clearLocal();
        this.transport.clearPresence();
      },
      subscribe: (listener: { readonly onPresenceChange?: () => void }) =>
        manager.subscribe(listener),
    };
  }
}

export const createClientDocument = <
  TPrimitive extends Primitive.AnyPrimitive,
  TPresence = unknown,
  TPresenceInput = TPresence,
>(
  options: ClientDocumentOptions<TPrimitive, TPresence, TPresenceInput>,
): ClientDocument<TPrimitive, TPresence, TPresenceInput> => new ClientDocumentImpl(options);
