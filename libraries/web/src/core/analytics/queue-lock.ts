import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";

import { CacheAdapter } from "../caching/cache-adapter";

/** How long a lease is honored before another tab may steal it. */
const LEASE_MS = 15_000;

/** How often the holder extends its lease while the work runs. */
const RENEW_EVERY_MS = 5_000;

const Lease = Schema.Struct({
  expiresAt: Schema.Number,
  owner: Schema.String,
  state: Schema.Literals(["candidate", "held"]),
});
type Lease = typeof Lease.Type;

const LeaseFromJson = Schema.fromJsonString(Lease);
const decodeLease = Schema.decodeUnknownEffect(LeaseFromJson);
const encodeLease = Schema.encodeSync(LeaseFromJson);

/** Reads a stored lease. A corrupt one is treated as no lease at all. */
const parseLease = (raw: string) => Effect.option(decodeLease(raw));

const storageLeaseKey = (name: string, owner: string) => `${name}:lease:${owner}`;

const loadStorageLeases = (name: string, now: number) =>
  Effect.gen(function* loadStorageLeases() {
    const cache = yield* CacheAdapter;
    const prefix = `${name}:lease:`;
    const keys = yield* cache.keys();
    const leases = yield* Effect.forEach(
      Arr.filter(keys, (key) => key.startsWith(prefix)),
      (key) =>
        Effect.gen(function* loadStorageLease() {
          const raw = yield* cache.get(key, { refresh: true });
          if (Option.isNone(raw)) return Option.none<Lease>();
          const lease = yield* parseLease(raw.value);
          if (Option.isNone(lease) || lease.value.expiresAt <= now) {
            yield* cache.delete(key);
            return Option.none<Lease>();
          }
          return lease;
        }),
      { concurrency: 1 },
    );

    return Arr.getSomes(leases);
  });

interface LockManager {
  readonly request: (
    name: string,
    options: { readonly ifAvailable: boolean },
    callback: (lock: unknown) => Promise<unknown>,
  ) => Promise<unknown>;
}

/**
 * Feature-detects the Web Locks API. This is the browser boundary: the lock
 * manager only exists as an ambient global.
 */
const getLockManager = (): Option.Option<LockManager> => {
  if (P.isUndefined(navigator) || !("locks" in navigator)) {
    return Option.none();
  }
  const locks = Option.fromNullishOr(
    // oxlint-disable-next-line effect/casting-awareness -- `navigator.locks` is absent from the DOM lib version in use; this narrows the ambient global to the slice actually called.
    (navigator as Navigator & { locks?: LockManager }).locks,
  );
  return Option.filter(locks, (manager) => P.isFunction(manager.request));
};

/**
 * Takes the Web Locks lease if it is free. Resolves to the release callback, or
 * `None` when another tab holds it. The lock is held until the callback runs,
 * while the caller's work stays in the caller's own runtime.
 */
const acquireWebLock = (locks: LockManager, name: string) =>
  Effect.callback<Option.Option<() => void>>((resume) => {
    let release = Option.none<() => void>();
    const held = new Promise<void>((resolve) => {
      release = Option.some(resolve);
    });

    void locks
      .request(name, { ifAvailable: true }, async (lock) => {
        if (Option.isNone(Option.fromNullishOr(lock))) {
          resume(Effect.succeed(Option.none()));
          return;
        }
        resume(Effect.succeed(release));
        await held;
      })
      .catch(() => {
        resume(Effect.succeed(Option.none()));
      });
  });

/** Holds a Web Lock until the returned release callback runs. */
export const holdQueueOwnerLock = (name: string): Effect.Effect<Option.Option<() => void>> => {
  const lockManager = getLockManager();
  return Option.match(lockManager, {
    onNone: () => Effect.succeed(Option.none()),
    onSome: (locks) => acquireWebLock(locks, name),
  });
};

/**
 * Checks whether another page still holds `name`. `None` means Web Locks are
 * unavailable, in which case callers must not infer death from elapsed time.
 */
export const isQueueOwnerAlive = (name: string): Effect.Effect<Option.Option<boolean>> => {
  const lockManager = getLockManager();
  if (Option.isNone(lockManager)) return Effect.succeed(Option.none());

  return Effect.callback<Option.Option<boolean>>((resume) => {
    void lockManager.value
      .request(name, { ifAvailable: true }, async (lock) => {
        resume(Effect.succeed(Option.some(Option.isNone(Option.fromNullishOr(lock)))));
      })
      .catch(() => {
        resume(Effect.succeed(Option.none()));
      });
  });
};

const acquireStorageLease = (name: string, owner: string) =>
  Effect.gen(function* acquireStorageLease() {
    const cache = yield* CacheAdapter;
    const now = yield* Clock.currentTimeMillis;
    const key = storageLeaseKey(name, owner);
    const candidate = yield* cache.set(
      key,
      encodeLease({ expiresAt: now + LEASE_MS, owner, state: "candidate" }),
    );
    if (!candidate) {
      yield* cache.delete(key);
      return false;
    }

    const contenders = yield* loadStorageLeases(name, now);
    if (contenders.some((lease) => lease.owner !== owner && lease.state === "held")) {
      yield* cache.delete(key);
      return false;
    }

    const promoted = yield* cache.set(
      key,
      encodeLease({ expiresAt: now + LEASE_MS, owner, state: "held" }),
    );
    if (!promoted) {
      yield* cache.delete(key);
      return false;
    }

    // Require this owner to be the only holder. If simultaneous contenders
    // both promoted, at least one observes the other's distinct record and
    // backs off; unlike a shared read/write/read key, neither can overwrite
    // the evidence that the other is contending.
    const confirmed = yield* loadStorageLeases(name, now);
    if (confirmed.some((lease) => lease.owner !== owner && lease.state === "held")) {
      yield* cache.delete(key);
      return false;
    }
    return true;
  });

const renewStorageLease = (name: string, owner: string) =>
  Effect.gen(function* renewStorageLease() {
    const cache = yield* CacheAdapter;
    const now = yield* Clock.currentTimeMillis;
    const key = storageLeaseKey(name, owner);
    const existing = yield* cache.get(key, { refresh: true });
    const lease = yield* Option.match(existing, {
      onNone: () => Effect.succeed(Option.none<Lease>()),
      onSome: parseLease,
    });
    if (
      Option.isSome(lease) &&
      lease.value.owner === owner &&
      lease.value.state === "held" &&
      lease.value.expiresAt > now
    ) {
      yield* cache.set(key, encodeLease({ expiresAt: now + LEASE_MS, owner, state: "held" }));
    }
  });

/**
 * Runs `work` while holding an exclusive cross-tab lease named `name`, so two
 * tabs sharing one storage never perform the same maintenance twice. Prefers
 * the Web Locks API; where it is missing, a storage lease is used and renewed
 * while the work runs. When the lock is already held elsewhere, `work` is
 * skipped and `onSkipped` is returned. `work` runs in the caller's runtime, so
 * its failures and interruptions propagate normally.
 */
export const withQueueLock = <A, E, R>(input: {
  readonly name: string;
  readonly onSkipped: A;
  readonly owner: string;
  readonly work: Effect.Effect<A, E, R>;
}): Effect.Effect<A, E, R | CacheAdapter> =>
  Effect.gen(function* withQueueLock() {
    const lockManager = getLockManager();

    if (Option.isSome(lockManager)) {
      const release = yield* acquireWebLock(lockManager.value, input.name);
      if (Option.isNone(release)) {
        return input.onSkipped;
      }
      return yield* Effect.ensuring(
        input.work,
        Effect.sync(() => release.value()),
      );
    }

    const cache = yield* CacheAdapter;
    const acquired = yield* acquireStorageLease(input.name, input.owner);
    if (!acquired) {
      return input.onSkipped;
    }

    const renewal = yield* Effect.forkDetach(
      Effect.forever(
        Effect.flatMap(Effect.sleep(RENEW_EVERY_MS), () =>
          renewStorageLease(input.name, input.owner).pipe(
            Effect.provideService(CacheAdapter, cache),
          ),
        ),
      ),
    );

    return yield* Effect.ensuring(
      input.work,
      Effect.flatMap(Fiber.interrupt(renewal), () =>
        cache.delete(storageLeaseKey(input.name, input.owner)),
      ),
    );
  });
