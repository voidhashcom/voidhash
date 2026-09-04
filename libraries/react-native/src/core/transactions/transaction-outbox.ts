import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

import { type CacheReadFailed } from "../caching/cache-adapter";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { backoffMs, QUEUE_BACKOFF_CAP_MS } from "../network/policy";

/** Cache key of the persisted transaction outbox. */
export const TRANSACTION_OUTBOX_STORAGE_KEY = "transactions:outbox";

/** One receipt waiting to be accepted by the server. */
export interface OutboxEntry {
  /** Attempts made so far, used for the backoff. */
  readonly attempts: number;
  /** Epoch millis before which the entry must not be retried. */
  readonly availableAt: number;
  /** Identity active when the store transaction was observed. */
  readonly distinctId: string;
  /** Stable identity of the store transaction (`platform:id:purchaseDate`). */
  readonly key: string;
  /** The store transaction, as observed. */
  readonly transaction: Record<string, unknown>;
}

const finiteOrZero = (value: unknown) => (P.isNumber(value) && Number.isFinite(value) ? value : 0);

/**
 * Decodes one persisted entry. A receipt written by an older release, or one
 * whose counters were damaged on disk, is kept with its scheduling fields
 * reset to "due now" rather than dropped: the receipt is the part that
 * cannot be recreated.
 */
export const decodeOutboxEntry = (value: unknown): Option.Option<OutboxEntry> =>
  P.hasProperty(value, "key") &&
  P.isString(value.key) &&
  P.hasProperty(value, "transaction") &&
  P.isObject(value.transaction)
    ? Option.some({
        attempts: finiteOrZero(P.hasProperty(value, "attempts") ? value.attempts : undefined),
        availableAt: finiteOrZero(
          P.hasProperty(value, "availableAt") ? value.availableAt : undefined,
        ),
        distinctId:
          P.hasProperty(value, "distinctId") && P.isString(value.distinctId)
            ? value.distinctId
            : "",
        key: value.key,
        transaction: value.transaction,
      })
    : Option.none();

const decodeOutbox = (value: unknown): ReadonlyArray<OutboxEntry> =>
  // `getSomes(map(...))`, not `filterMap`: this Effect release's
  // `Array.filterMap` keeps `Result`s, so an `Option` callback would drop
  // every receipt and a restart would come back empty.
  Array.isArray(value) ? Arr.getSomes(Arr.map(value, decodeOutboxEntry)) : [];

const make = Effect.fn("makeTransactionOutbox")(function* effect() {
  const cacheManager = yield* CacheManager;
  const diagnostics = yield* Diagnostics;

  /**
   * Loads the persisted outbox. `None` means the store could not be read —
   * distinct from an empty outbox, because a store we could not read must
   * not be overwritten with what little we hold in memory.
   */
  const load = Effect.fn("TransactionOutbox.load")(function* () {
    return yield* cacheManager.tryGet<ReadonlyArray<unknown>>(TRANSACTION_OUTBOX_STORAGE_KEY).pipe(
      Effect.map((hit) =>
        Option.some(
          Option.match(hit, {
            onNone: () => Arr.empty<OutboxEntry>(),
            onSome: (entry) => decodeOutbox(entry.value),
          }),
        ),
      ),
      Effect.catch((failure: CacheReadFailed) =>
        Effect.as(
          diagnostics.emit({
            code: DIAGNOSTIC_CODES.CACHE_READ_FAILED,
            kind: "cache",
            message: `Could not read the transaction outbox: ${failure.message}`,
            operation: "syncTransaction",
            retryable: true,
          }),
          Option.none<ReadonlyArray<OutboxEntry>>(),
        ),
      ),
    );
  });

  const restored = yield* load();
  const entriesRef = yield* Ref.make(Option.getOrElse(restored, () => Arr.empty<OutboxEntry>()));
  const restoreFailed = MutableRef.make(Option.isNone(restored));
  const mutationMutex = yield* Semaphore.make(1);

  /**
   * Writes the outbox to storage. While the boot-time load has failed, the
   * write first retries the load and merges what is on disk in front of the
   * in-memory entries; until that succeeds nothing is written, so a store
   * that was briefly unreadable never loses the receipts it already holds.
   */
  const persistUnlocked = Effect.fn("TransactionOutbox.persistUnlocked")(function* () {
    if (MutableRef.get(restoreFailed)) {
      const reloaded = yield* load();
      if (Option.isNone(reloaded)) return;
      MutableRef.set(restoreFailed, false);
      yield* Ref.update(entriesRef, (entries) => [
        ...reloaded.value.filter((entry) => !entries.some((held) => held.key === entry.key)),
        ...entries,
      ]);
    }
    const entries = yield* Ref.get(entriesRef);
    yield* cacheManager.set(TRANSACTION_OUTBOX_STORAGE_KEY, entries);
  });

  const persist = Effect.fn("TransactionOutbox.persist")(
    function* () {
      yield* persistUnlocked();
    },
    (effect) => mutationMutex.withPermits(1)(effect),
  );

  /**
   * Records a receipt before any network call, so a transaction observed while
   * the app was about to die is still delivered on the next launch. Writing
   * the same key twice keeps the earlier attempt count.
   */
  const enqueue = Effect.fn("TransactionOutbox.enqueue")(
    function* (key: string, transaction: Record<string, unknown>, distinctId = "") {
      const now = yield* Clock.currentTimeMillis;
      yield* Ref.update(entriesRef, (entries) =>
        entries.some((entry) => entry.key === key)
          ? entries
          : [...entries, { attempts: 0, availableAt: now, distinctId, key, transaction }],
      );
      yield* persistUnlocked();
    },
    (effect) => mutationMutex.withPermits(1)(effect),
  );

  /** Removes a receipt the server accepted. */
  const ack = Effect.fn("TransactionOutbox.ack")(
    function* (key: string) {
      yield* Ref.update(entriesRef, (entries) => entries.filter((entry) => entry.key !== key));
      yield* persistUnlocked();
    },
    (effect) => mutationMutex.withPermits(1)(effect),
  );

  /** Bumps the attempt count and schedules the next try with jittered backoff. */
  const postpone = Effect.fn("TransactionOutbox.postpone")(
    function* (key: string) {
      const now = yield* Clock.currentTimeMillis;
      const entries = yield* Ref.get(entriesRef);
      const attempts = (entries.find((entry) => entry.key === key)?.attempts ?? 0) + 1;
      const delayMs = yield* backoffMs(attempts, QUEUE_BACKOFF_CAP_MS);
      yield* Ref.update(entriesRef, (current) =>
        current.map((entry) =>
          entry.key === key ? { ...entry, attempts, availableAt: now + delayMs } : entry,
        ),
      );
      yield* persistUnlocked();
    },
    (effect) => mutationMutex.withPermits(1)(effect),
  );

  /** Receipts whose cool-down has elapsed, oldest first. */
  const due = Effect.fn("TransactionOutbox.due")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const entries = yield* Ref.get(entriesRef);
    return entries.filter((entry) => entry.availableAt <= now);
  });

  const pending = () => Ref.get(entriesRef);

  const isEmpty = Effect.fn("TransactionOutbox.isEmpty")(function* () {
    const entries = yield* Ref.get(entriesRef);
    return Arr.isReadonlyArrayEmpty(entries);
  });

  return { ack, due, enqueue, isEmpty, pending, persist, postpone } as const;
});

/**
 * Durable record of store receipts that still have to reach the server. The
 * receipt is written before the first sync attempt and removed only once the
 * server accepts it, so an outage — or the app being killed mid-purchase —
 * costs delivery latency rather than a purchase.
 */
export class TransactionOutbox extends Context.Service<
  TransactionOutbox,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/TransactionOutbox") {
  static readonly layer = Layer.effect(TransactionOutbox, make());
}
