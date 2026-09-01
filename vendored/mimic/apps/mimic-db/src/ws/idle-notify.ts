import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

/**
 * Wire message emitted when an edited document becomes idle. The sequence is
 * the dirty document revision used by consumers for monotonic deduplication.
 */
export const MimicDocumentIdleMessage = Schema.Struct({
  collectionId: Schema.String,
  documentId: Schema.String,
  seq: Schema.Number,
});
export type MimicDocumentIdleMessage = typeof MimicDocumentIdleMessage.Type;

export type MimicDocumentIdleMessageType = typeof MimicDocumentIdleMessage.Type;

/**
 * Persisted sequence numbers backing the idle-notification debounce. Both live
 * under the entity's key-value storage, namespaced away from document state.
 */
export const IDLE_DIRTY_SEQ_KEY = "idleNotify:dirtySeq";
export const IDLE_NOTIFIED_SEQ_KEY = "idleNotify:notifiedSeq";

/**
 * The entity storage subset the idle-notify logic needs.
 */
export interface IdleNotifyStorage {
  readonly get: (key: string) => Effect.Effect<Option.Option<number>>;
  readonly put: (key: string, value: number) => Effect.Effect<void>;
  readonly setAlarm: (scheduledTime: number) => Effect.Effect<void>;
}

/**
 * Everything {@link makeIdleNotifier} needs from its entity host. The document
 * identity is fixed for the entity's lifetime; `authenticatedCount` reads
 * the live session registry; `publish` sends one idle message to the queue.
 */
export interface IdleNotifyDeps {
  readonly collectionId: string;
  readonly documentId: string;
  readonly storage: IdleNotifyStorage;
  readonly debounceMs: number;
  readonly now: () => number;
  /** Count of currently-connected authenticated sockets. */
  readonly authenticatedCount: () => number;
  /**
   * Publish the idle message. Failures are expected to be surfaced as the error
   * channel; the alarm handler logs them and leaves `notifiedSeq` unpersisted so
   * the next disconnect retries.
   */
  readonly publish: (message: MimicDocumentIdleMessageType) => Effect.Effect<void, unknown>;
}

export interface IdleNotifier {
  /** Records that the document advanced to `seq` after an accepted transaction. */
  readonly recordDirty: (seq: number) => Effect.Effect<void>;
  /**
   * Called after the last authenticated socket disconnected: arms the debounce
   * alarm when there is unnotified work. A no-op when the document is not dirty
   * beyond what was already notified.
   */
  readonly onLastAuthenticatedClose: () => Effect.Effect<void>;
  /**
   * Runs when the debounce alarm fires. Re-checks emptiness + dirty>notified,
   * publishes, and persists `notifiedSeq`. Resilient: a publish failure logs and
   * leaves `notifiedSeq` unpersisted (the next disconnect retries).
   */
  readonly onAlarm: () => Effect.Effect<void>;
}

/**
 * Idle-notification trigger for a single document entity.
 *
 * When the last authenticated collaborator disconnects and the document has
 * been edited since the last notification, a debounce alarm is scheduled. When
 * the alarm fires and no authenticated socket has reconnected, the current
 * dirty sequence is published to the idle queue and recorded as notified. The
 * publish is best-effort: a failure leaves `notifiedSeq` unpersisted so the
 * next disconnect re-triggers.
 */
export const makeIdleNotifier = (deps: IdleNotifyDeps): IdleNotifier => {
  const recordDirty = (seq: number): Effect.Effect<void> =>
    deps.storage.put(IDLE_DIRTY_SEQ_KEY, seq);

  const readSeqs = Effect.fn("readSeqs")(function* () {
    const dirty = Option.getOrElse(yield* deps.storage.get(IDLE_DIRTY_SEQ_KEY), () => 0);
    const notified = Option.getOrElse(yield* deps.storage.get(IDLE_NOTIFIED_SEQ_KEY), () => 0);
    return { dirty, notified };
  });

  const onLastAuthenticatedClose = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      if (deps.authenticatedCount() > 0) return;
      const { dirty, notified } = yield* readSeqs();
      if (dirty <= notified) return;
      // Overwrites any existing alarm — the latest disconnect wins, coalescing
      // rapid connect/disconnect churn into a single debounced notification.
      yield* deps.storage.setAlarm(deps.now() + deps.debounceMs);
    });

  const onAlarm = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      // A collaborator reconnected during the debounce window; their eventual
      // disconnect re-arms the alarm, so do nothing now.
      if (deps.authenticatedCount() > 0) return;
      const { dirty, notified } = yield* readSeqs();
      if (dirty <= notified) return;

      const published = yield* Effect.result(
        deps.publish({
          collectionId: deps.collectionId,
          documentId: deps.documentId,
          seq: dirty,
        }),
      );
      if (Result.isFailure(published)) {
        yield* Effect.logError(
          `mimic idle-notify publish failed for ${deps.collectionId}:${deps.documentId}`,
          published.failure,
        ).pipe(
          Effect.annotateLogs({
            "voidhash.mimic.operation": "idleNotify.publish",
            "voidhash.mimic.collection_id": deps.collectionId,
            "voidhash.mimic.document_id": deps.documentId,
          }),
        );
        return;
      }
      yield* deps.storage.put(IDLE_NOTIFIED_SEQ_KEY, dirty);
    });

  return { recordDirty, onLastAuthenticatedClose, onAlarm };
};
