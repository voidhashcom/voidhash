import {
  DurableEntityAlarmControl,
  type DurableEntityAddress,
  type DurableEntityContext,
  DurableEntityHost,
  type DurableEntityHostShape,
  type DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import { Duration, Effect, Layer, Semaphore } from "effect";
import { EntityId, Sharding } from "effect/unstable/cluster";
import { KeyValueStore } from "effect/unstable/persistence";

import {
  DurableEntityAlarmStore,
  type DurableEntityAlarmStoreShape,
  PgEntityAlarmStoreLive,
} from "./EntityAlarmStore.ts";
import { PgPlatformClientLive, type PgPlatformConfig } from "./Postgres.ts";
import { SingleNodeClusterLive } from "./Topology.ts";

const entityKey = (address: DurableEntityAddress): string => `${address.type}\u0000${address.id}`;

const valueKey = (address: DurableEntityAddress, key: string): string =>
  `voidhash/platform-selfhost/entity/${address.type}/${address.id}/kv/${key}`;

interface LocalEntityState {
  readonly lock: Semaphore.Semaphore;
  /**
   * Sessions are process-local by nature: a WebSocket is held open by one
   * process, so it is never restored from persistent storage.
   */
  readonly sessions: Map<string, DurableEntitySession>;
  /** Turns currently running or queued for this address. */
  turns: number;
}

/** Tuning for the cluster entity host's locality gate. */
export interface ClusterDurableEntityOptions {
  /**
   * How long `sessions.attach` waits for this runner to acquire the entity's
   * shard before it dies. Shards are assigned by a background loop, so a socket
   * that upgrades moments after boot is early, not misplaced.
   */
  readonly attachOwnershipTimeout?: Duration.Input;
}

const ownershipPollIntervalMillis = 25;

/**
 * Durable entity host backed by Effect Cluster.
 *
 * Sharding decides which runner owns an entity, a per-address semaphore
 * serializes that runner's turns, entity values live in the persistence
 * key-value store, and alarms live in an indexed store a scheduler can poll.
 * Sessions never enter the cluster mailbox — a socket cannot be serialized —
 * so they are only reachable on the runner that owns the entity's shard.
 */
export const makeClusterDurableEntityHost = (
  sharding: Sharding.Sharding["Service"],
  store: KeyValueStore.KeyValueStore,
  alarms: DurableEntityAlarmStoreShape,
  options?: ClusterDurableEntityOptions,
): DurableEntityHostShape => {
  const states = new Map<string, LocalEntityState>();

  const stateFor = (address: DurableEntityAddress): LocalEntityState => {
    const key = entityKey(address);
    let state = states.get(key);
    if (!state) {
      state = { lock: Semaphore.makeUnsafe(1), sessions: new Map(), turns: 0 };
      states.set(key, state);
    }
    return state;
  };

  // TODO: every entity is placed in the "default" shard group. A deployment
  // that puts entity types in their own groups has to thread the group through
  // the address before this check means anything for it.
  const isOwned = (address: DurableEntityAddress): boolean =>
    sharding.hasShardId(sharding.getShardId(EntityId.make(address.id), "default"));

  /**
   * Records when this runner does not own the entity's shard.
   *
   * The contract hands the host a closure, which cannot be forwarded to
   * another runner, so the host cannot reroute a misplaced call. Single-runner
   * topologies own every shard and never trip this; multi-runner deployments
   * must route entity work by address before calling in, and this leaves a
   * trace when they have not.
   */
  const warnIfNotOwned = (address: DurableEntityAddress) =>
    Effect.suspend(() =>
      isOwned(address)
        ? Effect.void
        : Effect.logDebug("durable entity is not assigned to this runner", {
            entityType: address.type,
            entityId: address.id,
          }),
    );

  const attachOwnershipTimeoutMillis = Duration.toMillis(
    options?.attachOwnershipTimeout ?? Duration.seconds(5),
  );

  /**
   * Refuses to attach a socket to an entity this runner does not own.
   *
   * Reads stay total because a stale registry is harmless, but a silently
   * misplaced attach is not: every later broadcast would skip the socket and
   * the client would look connected while receiving nothing.
   *
   * Shard assignment is computed by a background loop that has not run yet when
   * the process has just booted, so ownership is polled for a bounded window
   * before the attach is declared misplaced.
   */
  const requireOwnedForAttach = (address: DurableEntityAddress) => {
    const poll = (remainingMillis: number): Effect.Effect<void> =>
      Effect.suspend(() => {
        if (isOwned(address)) return Effect.void;
        if (remainingMillis <= 0) {
          return Effect.die(
            new Error(
              `Cannot attach a session to durable entity ${address.type}/${address.id}: this runner did not acquire its shard within ${attachOwnershipTimeoutMillis}ms`,
            ),
          );
        }
        return Effect.sleep(Duration.millis(ownershipPollIntervalMillis)).pipe(
          Effect.andThen(poll(remainingMillis - ownershipPollIntervalMillis)),
        );
      });
    return poll(attachOwnershipTimeoutMillis);
  };

  const readValue = (key: string) =>
    store.get(key).pipe(
      Effect.map((raw) => {
        if (raw === undefined) return undefined;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return undefined;
        }
      }),
      Effect.orDie,
    );

  /**
   * Drops the process-local record for an address once nothing references it.
   *
   * Without this, one entry per address ever touched would live for the
   * lifetime of the process — an unbounded leak on a host that addresses
   * entities by document or session id.
   */
  const releaseState = (address: DurableEntityAddress, state: LocalEntityState) =>
    Effect.sync(() => {
      state.turns -= 1;
      const key = entityKey(address);
      if (state.turns === 0 && state.sessions.size === 0 && states.get(key) === state) {
        states.delete(key);
      }
    });

  return DurableEntityHost.of({
    run: (address, operation) =>
      Effect.suspend(() => {
        const state = stateFor(address);
        state.turns += 1;
        const context: DurableEntityContext = {
          address,
          keyValue: {
            get: (key) => readValue(valueKey(address, key)),
            put: (key, value) =>
              store.set(valueKey(address, key), JSON.stringify(value ?? null)).pipe(Effect.orDie),
            delete: (key) => store.remove(valueKey(address, key)).pipe(Effect.orDie),
          },
          alarm: {
            get: alarms.get(address),
            set: (scheduledTime) => alarms.set(address, scheduledTime),
            delete: alarms.delete(address),
          },
          sessions: {
            get: (sessionId) => Effect.sync(() => state.sessions.get(sessionId)),
            list: Effect.sync(() => [...state.sessions.values()]),
            attach: (session) =>
              requireOwnedForAttach(address).pipe(
                Effect.andThen(Effect.sync(() => void state.sessions.set(session.id, session))),
              ),
            remove: (sessionId) => Effect.sync(() => void state.sessions.delete(sessionId)),
          },
        };
        return warnIfNotOwned(address).pipe(
          Effect.andThen(state.lock.withPermit(Effect.suspend(() => operation(context)))),
          Effect.ensuring(releaseState(address, state)),
        );
      }),
  });
};

/** Cluster-backed durable entity host layer. */
export const ClusterDurableEntityHostLive: Layer.Layer<
  DurableEntityHost,
  never,
  Sharding.Sharding | KeyValueStore.KeyValueStore | DurableEntityAlarmStore
> = Layer.effect(
  DurableEntityHost,
  Effect.gen(function* () {
    const sharding = yield* Sharding.Sharding;
    const store = yield* KeyValueStore.KeyValueStore;
    const alarms = yield* DurableEntityAlarmStore;
    return makeClusterDurableEntityHost(sharding, store, alarms);
  }),
);

/**
 * Alarm control plane for the cluster host: the scheduler that fires entity
 * alarms polls this for the addresses whose scheduled time has passed.
 */
export const ClusterDurableEntityControlLive: Layer.Layer<
  DurableEntityAlarmControl,
  never,
  DurableEntityAlarmStore
> = Layer.effect(
  DurableEntityAlarmControl,
  Effect.gen(function* () {
    const alarms = yield* DurableEntityAlarmStore;
    return DurableEntityAlarmControl.of({ listDueAlarms: alarms.listDue });
  }),
);

/**
 * Self-contained cluster entity host over Postgres, including its own
 * single-node topology.
 *
 * A process that also runs cluster queues, workflows, or cron jobs must build
 * one topology and share it with this host instead, because two runners in one
 * process compete for the same shard leases. This factory is for compositions
 * that host nothing but entities — and for tests.
 */
export const PgClusterDurableEntityLive = (
  config: PgPlatformConfig,
): Layer.Layer<DurableEntityHost | DurableEntityAlarmControl> => {
  const sql = PgPlatformClientLive(config).pipe(Layer.orDie);
  return Layer.mergeAll(ClusterDurableEntityHostLive, ClusterDurableEntityControlLive).pipe(
    Layer.provide(PgEntityAlarmStoreLive),
    Layer.provide(KeyValueStore.layerSql().pipe(Layer.orDie)),
    Layer.provide(SingleNodeClusterLive({ runnerStorage: "memory" }).pipe(Layer.orDie)),
    Layer.provide(sql),
  );
};
