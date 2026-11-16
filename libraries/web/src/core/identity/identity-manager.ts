import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

import type { VoidhashTraits } from "../../types";
import {
  AD_DATA_SHARING_REVOCATIONS_KEY,
  AnalyticsConsentState,
} from "../analytics/analytics-consent";
import {
  forgetHeldTouches,
  type HeldTouches,
  LATEST_TOUCH_KEY,
  touchStateKey,
} from "../analytics/attribution";
import { CacheManager, digest } from "../caching/cache-manager";
import { Diagnostics } from "../diagnostics";
import { EventBusProvider } from "../event-bus";
import {
  ApiClient,
  SdkRequestError,
  type WebSdkHeaders,
  errorBodyOf,
  statusOf,
} from "../networking/api-client";
import { AuthGate } from "../networking/auth-gate";
import { CircuitBreaker } from "../networking/circuit-breaker";
import {
  REQUEST_TIMEOUT_MS,
  backoffMs,
  breakerKey,
  countsTowardsBreaker,
  isAuthStatus,
  isRefusal,
  isVoidhashError,
} from "../networking/network-policy";
import { SingleFlight } from "../networking/single-flight";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";
import { isJsonObject, isStringArray, isStringRecord } from "../json";
import { type PersonTraits, isPersonTraits, toPersonTraits } from "./person-traits";
import {
  deleteSharedAnonymousId,
  namesRetired,
  readSharedIdCookie,
  retiredWith,
  sharedIdCookieName,
  writeSharedAnonymousId,
} from "./shared-anonymous-id";

/** Storage key of the current identity; other tabs watch it to follow a switch. */
export const DISTINCT_ID_KEY = "identity:distinct-id";

/**
 * Storage key of the groups the end user belongs to, by group type, which every event carries
 * as `$groups`; other tabs watch it to follow a change. A reset clears it with the identity.
 */
export const GROUPS_KEY = "identity:groups";

/**
 * Storage key of what was last sent about each group the end user belongs to, by group type: a
 * digest of the group's key and properties, or an empty text when analytics consent kept the
 * `$groupidentify` out. `setGroups()` sends a group again only when it differs. Cleared with the
 * groups.
 */
const GROUP_DIGESTS_KEY = "identity:group-digests";

/**
 * Storage key of a digest of the user id and profile `identify()` last queued, so the same call
 * again sends nothing. A digest, as the profile holds the user's email. A reset clears it.
 */
const IDENTIFIED_PROFILE_KEY = "identity:identified-profile";

/** A digest of `subject` and `record` that does not depend on the order of the record's keys. */
export const recordDigest = (subject: string, record: Readonly<Record<string, unknown>>) =>
  digest(
    JSON.stringify([
      subject,
      Arr.sort(
        Arr.map(R.toEntries(record), (entry) => JSON.stringify(entry)),
        Str.Order,
      ),
    ]),
  );

/** The event that sets a group's properties. */
export const GROUP_IDENTIFY_EVENT = "$groupidentify";
/**
 * Identity writes not yet confirmed by Voidhash, oldest first. Shared by the
 * tabs of the site, so any of them can deliver a write another one queued.
 */
const OUTBOX_KEY = "identity:outbox";
/** Traits earlier releases kept on the device and never read; removed on start. */
const LEGACY_TRAITS_PREFIX = "identity:traits:";
const DELIVERY_SINGLE_FLIGHT_KEY = "identity:outbox";
const REVOCATION_OPERATION = "person.revokeAdDataSharing";
/**
 * Set once this device has put its anonymous id in the shared cookie or taken one
 * from it. Kept with the identity, so it lasts as long as the id does, withdrawals
 * included: see `reconcileSharedId`.
 */
const SHARED_ID_USED_KEY = "identity:shared-id-used";
/**
 * The anonymous id `getDistinctId()` last gave the app, which may have put it on
 * a payment. Voidhash cannot merge two anonymous ids, so this device keeps that id.
 */
const HANDED_OUT_ID_KEY = "identity:handed-out-id";
/**
 * Anonymous ids this device gave up for the shared one, whose agreement to sharing
 * with ad platforms can no longer be reached any other way. Ids a sign-in retired
 * are not among them: they may be someone else's by now.
 */
const GIVEN_UP_IDS_KEY = "identity:given-up-ids";
const MAX_GIVEN_UP_IDS = 5;
const EVICTED_REVOCATION_MESSAGE =
  "An ad data sharing revocation was dropped: too many were waiting.";
/**
 * Links kept while Voidhash cannot be reached. One per user, so a device
 * reaches it only after this many different users identified offline.
 */
const MAX_OUTBOX_ENTRIES = 20;

/**
 * Prefix of the anonymous ids the SDK creates, `vh_anon_<uuid>`: only letters,
 * digits, `_` and `-`, so the id fits any payment provider's field.
 */
export const ANONYMOUS_DISTINCT_ID_PREFIX = "vh_anon_";

/** Prefix of the anonymous ids earlier SDK builds created, which a stored id may still carry. */
export const LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX = "vh:anon:";

/**
 * Whether a distinct id is one the SDK made for an anonymous visitor: `vh_anon_<uuid>`, or the
 * `vh:anon:` form a browser may still hold from an earlier SDK build. `identify()` refuses both
 * as a user id.
 */
export const isAnonymousDistinctId = (distinctId: string) =>
  distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX) ||
  distinctId.startsWith(LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX);

/**
 * One identity link, the same write the native SDKs queue: it is sent as the
 * anonymous `alias`, and Voidhash merges the alias into the user `distinctId`
 * and applies the email, name, and traits to the user. An anonymous visitor
 * is its own alias. A user identified from another user, or again with new
 * profile values, gets a fresh alias nobody used, so two users are never
 * merged and the link can still create the user's person.
 *
 * An entry whose `alias` is its `distinctId` links nothing: it is a write of
 * the email, name, and traits to that person, anonymous or not, queued by
 * `setPersonAttributes()` while analytics consent is not granted.
 */
interface OutboxEntry {
  readonly alias: string;
  readonly distinctId: string;
  readonly email?: string;
  readonly id: string;
  readonly name?: string;
  readonly traits?: PersonTraits;
}

/** Reads a stored outbox entry; other fields are dropped. */
const decodeOutboxEntry = (value: unknown): Option.Option<OutboxEntry> => {
  if (!isJsonObject(value)) return Option.none();
  const { alias, distinctId, email, id, name, traits } = value;
  if (
    !P.isString(alias) ||
    !P.isString(distinctId) ||
    !P.isString(id) ||
    (email !== undefined && !P.isString(email)) ||
    (name !== undefined && !P.isString(name)) ||
    (traits !== undefined && !isPersonTraits(traits))
  ) {
    return Option.none();
  }
  return Option.some({
    alias,
    distinctId,
    ...(email !== undefined && { email }),
    id,
    ...(name !== undefined && { name }),
    ...(traits !== undefined && { traits }),
  });
};

/**
 * Taking back a person's agreement to sharing with ad platforms. Voidhash may
 * have no such person yet, while the agreement that creates them is still on its
 * way through ingest, so a revocation it has no person for is tried again for
 * {@link REVOCATION_LIFETIME_MS} from `queuedAt`, not before `retryAt`.
 */
interface AdDataSharingRevocation {
  readonly distinctId: string;
  readonly queuedAt: number;
  readonly retryAt: number;
}

const isAdDataSharingRevocation = (value: unknown): value is AdDataSharingRevocation =>
  isJsonObject(value) &&
  P.isString(value.distinctId) &&
  P.isNumber(value.queuedAt) &&
  P.isNumber(value.retryAt);

const REVOCATION_LIFETIME_MS = 48 * 60 * 60 * 1000;

/**
 * A stored revocation as of `now`. Its times came from this device's clock, so a
 * time in the future says the clock ran ahead: it is due now rather than stuck
 * for as long as the clock was wrong. No wait outlasts its lifetime either.
 */
const clampRevocation = (
  revocation: AdDataSharingRevocation,
  now: number,
): AdDataSharingRevocation =>
  revocation.queuedAt > now
    ? { ...revocation, queuedAt: now, retryAt: now }
    : {
        ...revocation,
        retryAt: Math.min(revocation.retryAt, revocation.queuedAt + REVOCATION_LIFETIME_MS),
      };

/** Only an answer that Voidhash has no such person moves `retryAt` past `queuedAt`. */
const hadNoPerson = (revocation: AdDataSharingRevocation) =>
  revocation.retryAt > revocation.queuedAt;

/**
 * The shortest wait before asking again for a person Voidhash does not have. Each
 * wait then lasts as long as the revocation has waited so far, as most visitors
 * who decline never had a person: about 15 requests over its lifetime at most.
 */
const REVOCATION_MIN_WAIT_MS = 30_000;

/** What one delivery attempt of an entry came to. */
type DeliveryOutcome = "absent" | "delivered" | "refused" | "retry";

const hasProfile = (profile: { email?: string; name?: string; traits?: PersonTraits }) =>
  profile.email !== undefined || profile.name !== undefined || profile.traits !== undefined;

/** Email, name, and traits of an identify call, split the way the API takes them. */
const profileOf = (traits?: VoidhashTraits | Readonly<Record<string, unknown>>) => {
  if (!traits) return {};
  const personTraits = toPersonTraits(traits);
  return {
    ...(P.isString(traits.email) && { email: traits.email }),
    ...(P.isString(traits.name) && { name: traits.name }),
    ...(!R.isEmptyRecord(personTraits) && { traits: personTraits }),
  };
};

const buildPersonAttributesPayload = (input: {
  email?: string;
  name?: string;
  traits?: VoidhashTraits;
}) => {
  const traits = input.traits ? toPersonTraits(input.traits) : {};
  return {
    ...(input.email !== undefined && { email: input.email }),
    ...(input.name !== undefined && { name: input.name }),
    ...(!R.isEmptyRecord(traits) && { traits }),
  };
};

export const makeIdentityManager = Effect.fnUntraced(function* makeIdentityManager() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;
  const authGate = yield* AuthGate;
  const breaker = yield* CircuitBreaker;
  const consent = yield* AnalyticsConsentState;
  const diagnostics = yield* Diagnostics;
  const eventBus = yield* EventBusProvider;
  const platform = yield* PlatformProvider;
  const config = yield* SdkConfiguration;
  const singleFlight = yield* SingleFlight;

  const apiBreakerKey = breakerKey("api", config.baseUrl);
  const sharedIdCookie = sharedIdCookieName(config.publishableKey);
  /** The cookie of `crossSubdomainIdentity` is read and written only while consent is granted. */
  const mayUseSharedId = () => config.crossSubdomainIdentity && consent.current() === "granted";

  let currentDistinctId = Option.none<string>();
  let currentGroups: Readonly<Record<string, string>> = {};
  // The scheduled retry of the outbox and how many attempts in a row failed.
  let retryFiber = Option.none<Fiber.Fiber<void>>();
  let failedAttempts = 0;
  // The delivery started in the background, so `stop` can interrupt it, and
  // whether another pass was asked for while it ran.
  let deliveryFiber = Option.none<Fiber.Fiber<void>>();
  // Waits for the next revocation to come due.
  let revocationWakeFiber = Option.none<Fiber.Fiber<void>>();
  let isSharedIdRefusalReported = false;
  // Touches seen while consent is pending, for the person behind this identity.
  const heldTouches: HeldTouches = { state: {} };
  // Saves a write on every `getDistinctId()` of the same id.
  let handedOutId = Option.none<string>();
  let deliveryRequested = false;
  // Set by `stop`: nothing is delivered or scheduled from then on.
  let isStopped = false;

  const getDistinctId = () => currentDistinctId;

  /** The groups the end user belongs to, by group type. */
  const getGroups = () => currentGroups;

  /** What the device stores by group type under `key`; nothing when it is not that. */
  const readByGroupType = (key: string) =>
    Effect.map(cacheManager.get<unknown>(key, { refresh: true }), (hit) =>
      Option.getOrElse(
        Option.filter(
          Option.map(hit, ({ value }) => value),
          isStringRecord,
        ),
        (): Readonly<Record<string, string>> => ({}),
      ),
    );

  /** Stores `next` under `key` unless the device holds the same, as a write wakes every other tab. */
  const storeByGroupType = (key: string, next: Readonly<Record<string, string>>) =>
    Effect.gen(function* storeByGroupType() {
      const stored = yield* readByGroupType(key);
      if (
        R.size(stored) === R.size(next) &&
        R.every(next, (value, type) => stored[type] === value)
      ) {
        return;
      }
      yield* R.isEmptyRecord(next) ? cacheManager.delete(key) : cacheManager.set(key, next);
    });

  /** The groups stored on the device; none when what is stored is not groups. */
  const readGroups = () => readByGroupType(GROUPS_KEY);

  /** See {@link GROUP_DIGESTS_KEY}. */
  const readGroupDigests = () => readByGroupType(GROUP_DIGESTS_KEY);

  /** Replaces what {@link GROUP_DIGESTS_KEY} holds. */
  const storeGroupDigests = (digests: Readonly<Record<string, string>>) =>
    storeByGroupType(GROUP_DIGESTS_KEY, digests);

  /** Replaces the groups the end user belongs to, in one write. */
  const replaceGroups = (groups: Readonly<Record<string, string>>) =>
    Effect.suspend(() => {
      currentGroups = groups;
      return storeByGroupType(GROUPS_KEY, groups);
    });

  /** Puts the end user in `groupKey` of `groupType`; whether that changed their group. */
  const setGroup = (groupType: string, groupKey: string) =>
    Effect.gen(function* setGroup() {
      if (currentGroups[groupType] === groupKey) return false;
      currentGroups = { ...currentGroups, [groupType]: groupKey };
      yield* cacheManager.set(GROUPS_KEY, currentGroups);
      return true;
    });

  /** Takes the end user out of every group. */
  const resetGroups = () =>
    Effect.gen(function* resetGroups() {
      currentGroups = {};
      yield* cacheManager.delete(GROUPS_KEY);
      yield* cacheManager.delete(GROUP_DIGESTS_KEY);
    });

  /** Follows groups another tab of the site changed. */
  const syncGroupsFromStorage = () =>
    Effect.map(readGroups(), (groups) => {
      currentGroups = groups;
    });

  const buildHeaders = (distinctId: string): WebSdkHeaders => ({
    ...platform.getSdkHeaders(config.publishableKey),
    "x-distinct-id": distinctId,
  });

  const newAnonymousId = () => `${ANONYMOUS_DISTINCT_ID_PREFIX}${platform.randomId()}`;

  const readGivenUpIds = () =>
    Effect.map(
      cacheManager.get<unknown>(GIVEN_UP_IDS_KEY, { refresh: true }),
      (hit): ReadonlyArray<string> =>
        Option.getOrElse(
          Option.filter(
            Option.map(hit, ({ value }) => value),
            isStringArray,
          ),
          () => [],
        ),
    );

  /** Remembers that the app was given the current anonymous id; see {@link HANDED_OUT_ID_KEY}. */
  const markHandedOut = () =>
    Effect.suspend(() => {
      const distinctId = Option.filter(currentDistinctId, isAnonymousDistinctId);
      if (Option.isNone(distinctId) || Option.contains(handedOutId, distinctId.value)) {
        return Effect.void;
      }
      handedOutId = distinctId;
      return Effect.asVoid(cacheManager.set(HANDED_OUT_ID_KEY, distinctId.value));
    });

  /** The retired list the cookie holds, which every write of it passes on. */
  const retiredInCookie = () =>
    Option.match(readSharedIdCookie(sharedIdCookie), {
      onNone: (): ReadonlyArray<string> => [],
      onSome: ({ retired }) => retired,
    });

  /**
   * Reads the outbox from storage, not memory: other tabs append to it.
   * Entries that do not decode are dropped rather than retried forever.
   */
  const readOutbox = () =>
    Effect.map(cacheManager.get<unknown>(OUTBOX_KEY, { refresh: true }), (hit) =>
      Option.match(hit, {
        onNone: (): ReadonlyArray<OutboxEntry> => [],
        onSome: ({ value }) =>
          P.isIterable(value)
            ? Arr.getSomes(Arr.map(Arr.fromIterable(value), (entry) => decodeOutboxEntry(entry)))
            : [],
      }),
    );

  /**
   * Queues a link. A link with a fresh alias only carries profile values, so
   * when the user has a link queued already it is merged into that one, with
   * the newer values over the older ones: identifying on every page load while
   * offline does not pile up copies. A link from an anonymous visitor merges
   * that visitor, so it is always queued on its own. The merged link takes a
   * new id: a delivery of the older one that is in flight removes only that.
   * Past {@link MAX_OUTBOX_ENTRIES} the oldest link is dropped and reported.
   *
   * This is a read-modify-write over storage shared with other tabs. Two tabs
   * writing in the same instant can lose one write; links are idempotent and
   * rare, so a lost one costs at most a repeat on the next identify.
   */
  const appendToOutbox = (entry: OutboxEntry, options: { readonly hasFreshAlias: boolean }) =>
    Effect.gen(function* appendToOutbox() {
      const entries = yield* readOutbox();
      const queued = options.hasFreshAlias
        ? Arr.findLast(entries, (other) => other.distinctId === entry.distinctId)
        : Option.none<OutboxEntry>();
      const merged = Option.match(queued, {
        onNone: () => [...entries, entry],
        onSome: (other) =>
          Arr.map(entries, (candidate) =>
            candidate === other
              ? {
                  ...other,
                  id: entry.id,
                  ...(entry.email !== undefined && { email: entry.email }),
                  ...(entry.name !== undefined && { name: entry.name }),
                  ...((other.traits !== undefined || entry.traits !== undefined) && {
                    traits: { ...other.traits, ...entry.traits },
                  }),
                }
              : candidate,
          ),
      });
      const dropped = Math.max(0, merged.length - MAX_OUTBOX_ENTRIES);
      if (dropped > 0) {
        yield* diagnostics.report({
          code: "IDENTITY_WRITE_DROPPED",
          kind: "eviction",
          message: `The identity outbox is full; the oldest ${dropped} link was dropped.`,
          operation: "identity.link",
          retryable: false,
        });
      }
      yield* cacheManager.set(OUTBOX_KEY, merged.slice(dropped));
    });

  const removeFromOutbox = (entryId: string) =>
    Effect.flatMap(readOutbox(), (entries) => {
      const remaining = Arr.filter(entries, (entry) => entry.id !== entryId);
      return Arr.isReadonlyArrayEmpty(remaining)
        ? cacheManager.delete(OUTBOX_KEY)
        : cacheManager.set(OUTBOX_KEY, remaining);
    });

  const sendEntry = (entry: OutboxEntry) => {
    const profile = {
      ...(entry.email !== undefined && { email: entry.email }),
      ...(entry.name !== undefined && { name: entry.name }),
      ...(entry.traits !== undefined && { traits: entry.traits }),
    };
    const headers = buildHeaders(entry.alias);
    return entry.alias === entry.distinctId
      ? // A retry of the same write is applied once.
        apiClient.sdk.syncPersonAttributes({
          headers,
          payload: { ...profile, clientEventId: entry.id },
        })
      : apiClient.sdk.identify({ headers, payload: { distinctId: entry.distinctId, ...profile } });
  };

  /**
   * Queues a write of what the app says about the person `distinctId` names,
   * for while analytics consent is not granted: sent as its own request, as
   * analytics events are not, stored and retried like a link, and merged into a
   * link or write already queued for that person. Agreeing to sharing with ad
   * platforms needs consent, so `$ad_data_sharing` is left out unless it takes
   * the agreement back. Does nothing when no attribute is left.
   */
  const queuePersonWrite = (distinctId: string, attributes: Readonly<Record<string, unknown>>) =>
    Effect.gen(function* queuePersonWrite() {
      const profile = profileOf(
        R.filter(attributes, (value, key) => key !== "$ad_data_sharing" || value === false),
      );
      if (!hasProfile(profile)) return;
      yield* appendToOutbox(
        { alias: distinctId, distinctId, id: platform.randomId(), ...profile },
        { hasFreshAlias: true },
      );
      yield* deliverInBackground();
    });

  /** Reads the revocations from storage: other tabs and earlier pages add to them. */
  const readRevocations = () =>
    Effect.gen(function* readRevocations() {
      const now = yield* Clock.currentTimeMillis;
      const hit = yield* cacheManager.get<unknown>(AD_DATA_SHARING_REVOCATIONS_KEY, {
        refresh: true,
      });
      const stored = Option.match(hit, {
        onNone: (): ReadonlyArray<AdDataSharingRevocation> => [],
        onSome: ({ value }) =>
          P.isIterable(value) ? Arr.filter(Arr.fromIterable(value), isAdDataSharingRevocation) : [],
      });
      return Arr.map(stored, (revocation) => clampRevocation(revocation, now));
    });

  const reportRevocationDropped = (message: string) =>
    diagnostics.report({
      code: "AD_DATA_SHARING_REVOCATION_DROPPED",
      kind: "eviction",
      message,
      operation: REVOCATION_OPERATION,
      retryable: false,
    });

  const removeRevocation = (distinctId: string) =>
    Effect.flatMap(readRevocations(), (revocations) => {
      const remaining = Arr.filter(revocations, (revoked) => revoked.distinctId !== distinctId);
      return Arr.isReadonlyArrayEmpty(remaining)
        ? cacheManager.delete(AD_DATA_SHARING_REVOCATIONS_KEY)
        : cacheManager.set(AD_DATA_SHARING_REVOCATIONS_KEY, remaining);
    });

  /**
   * Voidhash has no such person: asks again later, also from a later page, as
   * they may still be on their way. Past the lifetime, nothing will come of it.
   */
  const postponeRevocation = (revocation: AdDataSharingRevocation) =>
    Effect.gen(function* postponeRevocation() {
      const now = yield* Clock.currentTimeMillis;
      const lastAttemptAt = revocation.queuedAt + REVOCATION_LIFETIME_MS;
      if (now >= lastAttemptAt) {
        yield* reportRevocationDropped(
          "An ad data sharing revocation was dropped: Voidhash had no such person for 48 hours.",
        );
        return yield* removeRevocation(revocation.distinctId);
      }
      const wait = Math.max(REVOCATION_MIN_WAIT_MS, now - revocation.queuedAt);
      const revocations = yield* readRevocations();
      yield* cacheManager.set(
        AD_DATA_SHARING_REVOCATIONS_KEY,
        Arr.map(revocations, (other) =>
          other.distinctId === revocation.distinctId
            ? { ...other, retryAt: Math.min(now + wait, lastAttemptAt) }
            : other,
        ),
      );
    });

  /**
   * One attempt at one queued write, under the same rules as every other
   * request: the authentication pause, the circuit breaker, and the request
   * timeout. Never fails; the outcome says whether to drop it or try again.
   */
  const attemptDelivery = (
    operation: string,
    request: Effect.Effect<unknown, SdkRequestError>,
  ): Effect.Effect<DeliveryOutcome> =>
    Effect.gen(function* attemptDelivery() {
      const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
      if (authGate.isPaused() && !authProbe) return "retry";

      if (!(yield* breaker.canAttempt(apiBreakerKey, operation))) {
        if (authProbe) yield* authGate.completeProbe(false);
        return "retry";
      }

      const outcome = yield* Effect.result(request.pipe(Effect.timeout(REQUEST_TIMEOUT_MS)));
      if (Result.isSuccess(outcome)) {
        if (authProbe) yield* authGate.completeProbe(true);
        yield* breaker.recordSuccess(apiBreakerKey);
        return "delivered";
      }

      const status = statusOf(outcome.failure);
      const body = errorBodyOf(outcome.failure);
      if (authProbe) {
        yield* authGate.completeProbe(Option.exists(status, (code) => !isAuthStatus(code)));
      }
      const authStatus = Option.filter(status, isAuthStatus);
      if (Option.isSome(authStatus)) {
        yield* authGate.pause({ httpStatus: authStatus.value, operation });
        return "retry";
      }
      if (
        operation === REVOCATION_OPERATION &&
        Option.contains(status, 404) &&
        isVoidhashError(body, "api")
      ) {
        return "absent";
      }

      // Only Voidhash's own refusal drops the link: an edge answering 530, or
      // a proxy answering 404, must not cost the visitor's merge.
      const retryable = !Option.exists(status, (code) => isRefusal(code, body, "api"));
      if (Option.isNone(status) || countsTowardsBreaker(status.value, body, "api")) {
        yield* breaker.recordFailure(apiBreakerKey, operation, Option.isSome(status));
      }
      yield* diagnostics.report({
        code: retryable ? "TRANSPORT_FAILED" : "IDENTITY_WRITE_REFUSED",
        ...Option.match(status, { onNone: () => ({}), onSome: (httpStatus) => ({ httpStatus }) }),
        kind: "transport",
        message: retryable
          ? "An identity write could not be delivered; it stays queued and is retried."
          : "Voidhash refused an identity write, so it was dropped. The device keeps its identity.",
        operation,
        retryable,
      });
      return retryable ? "retry" : "refused";
    }).pipe(Effect.ensuring(breaker.releaseProbe(apiBreakerKey)));

  // The retry only waits; the pass it starts is the tracked background
  // delivery, so `stop` can always interrupt whatever is running.
  const scheduleRetry = () =>
    Effect.gen(function* scheduleRetry() {
      if (isStopped || Option.isSome(retryFiber)) return;
      failedAttempts += 1;
      const delay = yield* backoffMs(failedAttempts);
      retryFiber = Option.some(
        yield* Effect.forkDetach(
          Effect.andThen(Effect.sleep(delay), () =>
            Effect.suspend(() => {
              retryFiber = Option.none();
              return deliverInBackground();
            }),
          ),
        ),
      );
    });

  /** Delivers again when the next revocation comes due, on this page if it stays open. */
  const wakeForNextRevocation = () =>
    Effect.gen(function* wakeForNextRevocation() {
      yield* Option.match(revocationWakeFiber, {
        onNone: () => Effect.void,
        onSome: (fiber) => Fiber.interrupt(fiber),
      });
      revocationWakeFiber = Option.none();
      const now = yield* Clock.currentTimeMillis;
      // One still due failed just now, and its retry has a backoff of its own.
      const waiting = Arr.filter(
        yield* readRevocations(),
        (revocation) => revocation.retryAt > now,
      );
      if (isStopped || Arr.isReadonlyArrayEmpty(waiting)) return;
      const nextAt = Math.min(...Arr.map(waiting, (revocation) => revocation.retryAt));
      revocationWakeFiber = Option.some(
        yield* Effect.forkDetach(
          Effect.andThen(Effect.sleep(Math.max(nextAt - now, 0)), () =>
            Effect.suspend(() => {
              revocationWakeFiber = Option.none();
              return deliverInBackground();
            }),
          ),
        ),
      );
    });

  /**
   * Sends each revocation that is due, once. One that must be retried holds back
   * no other, as the failure may be its own; in an outage, the circuit breaker
   * stops the attempts after a few.
   */
  const deliverDueRevocations = () =>
    Effect.gen(function* deliverDueRevocations() {
      const now = yield* Clock.currentTimeMillis;
      const due = Arr.filter(yield* readRevocations(), (revocation) => revocation.retryAt <= now);
      yield* Effect.forEach(
        due,
        (revocation) =>
          Effect.gen(function* deliverRevocation() {
            const outcome = yield* attemptDelivery(
              REVOCATION_OPERATION,
              apiClient.sdk.syncPersonAttributes({
                headers: buildHeaders(revocation.distinctId),
                payload: { traits: { $ad_data_sharing: false } },
              }),
            );
            if (outcome === "retry") return yield* scheduleRetry();
            yield* outcome === "absent"
              ? postponeRevocation(revocation)
              : removeRevocation(revocation.distinctId);
          }),
        { concurrency: 1, discard: true },
      );
      yield* wakeForNextRevocation();
    });

  /**
   * One pass over what is queued, read again before each write, so writes other
   * tabs or a concurrent call queued meanwhile are sent in the same pass. Links
   * go first: a revocation names an id a link may have to create or merge. A link
   * that must be retried holds back the links after it, but not the revocations,
   * as one that keeps failing must not leave sharing on: at worst, Voidhash
   * has no such person yet, and the revocation waits for that.
   */
  const deliverRemaining = (): Effect.Effect<number> =>
    Effect.gen(function* deliverRemainingEntries() {
      const link = Arr.head(yield* readOutbox());
      if (Option.isSome(link)) {
        const outcome = yield* attemptDelivery("identity.link", sendEntry(link.value));
        if (outcome !== "retry") {
          yield* removeFromOutbox(link.value.id);
          failedAttempts = 0;
          return yield* deliverRemaining();
        }
        yield* scheduleRetry();
      }
      yield* deliverDueRevocations();
      if (Option.isNone(retryFiber)) failedAttempts = 0;
      return Arr.length(yield* readOutbox()) + Arr.length(yield* readRevocations());
    });

  /**
   * Sends the outbox in order, one entry at a time, so a link always reaches
   * Voidhash before the writes queued after it. Stops at the first entry that
   * must be retried and schedules the retry. Resolves with the number of
   * entries still queued. Concurrent calls join the delivery in progress.
   */
  const deliverOutbox = () => singleFlight.run(deliverRemaining(), DELIVERY_SINGLE_FLIGHT_KEY);

  /**
   * Delivers the outbox in the background. A request made while a delivery
   * runs is remembered and served by another pass, so a write queued as the
   * running pass finishes is never left waiting for the next trigger.
   */
  const deliverInBackground = () =>
    Effect.gen(function* deliverInBackground() {
      if (isStopped) return;
      deliveryRequested = true;
      if (Option.isSome(deliveryFiber)) return;
      const passes: Effect.Effect<void> = Effect.suspend(() => {
        if (!deliveryRequested) return Effect.void;
        deliveryRequested = false;
        return Effect.andThen(deliverOutbox(), passes);
      });
      // Not started immediately: a pass over an empty outbox completes
      // synchronously, and its cleanup must run after the fiber is recorded.
      const fiber = yield* Effect.forkDetach(
        passes.pipe(
          Effect.ensuring(
            Effect.sync(() => {
              if (Option.contains(deliveryFiber, fiber)) deliveryFiber = Option.none();
            }),
          ),
        ),
      );
      deliveryFiber = Option.some(fiber);
    });

  /**
   * Puts an anonymous id in the cookie of `crossSubdomainIdentity`. A browser that
   * refuses it on every domain of the page leaves this option doing nothing, which
   * nothing else would show.
   */
  const shareId = (anonymousId: string, retired: ReadonlyArray<string>) =>
    Effect.gen(function* shareId() {
      if (writeSharedAnonymousId(sharedIdCookie, anonymousId, retired)) {
        if (Option.isNone(yield* cacheManager.get<unknown>(SHARED_ID_USED_KEY))) {
          yield* cacheManager.set(SHARED_ID_USED_KEY, true);
        }
        return;
      }
      if (isSharedIdRefusalReported) return;
      isSharedIdRefusalReported = true;
      yield* diagnostics.report({
        code: "SHARED_ID_COOKIE_REFUSED",
        kind: "cache",
        message: "crossSubdomainIdentity could not set its cookie on any domain of this page.",
        operation: "identity.shareId",
        retryable: false,
      });
    });

  /**
   * Switches the device to `distinctId` and queues the link Voidhash needs.
   * Nothing here waits for the network.
   *
   * - From an anonymous visitor, the visitor is linked into the user.
   * - From another user, a fresh alias is linked, so the two users stay
   *   apart, as in the native SDKs; the switch records no sign-out.
   * - For the current user, a link is queued only for profile values other than
   *   the last ones queued for them.
   *
   * Resolves with whether it did anything.
   */
  const switchTo = (distinctId: string, traits?: VoidhashTraits) =>
    Effect.gen(function* switchTo() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }
      const previousDistinctId = currentDistinctId.value;
      const profile = profileOf(traits);
      const profileDigest = Option.map(Option.fromUndefinedOr(profile.traits), (values) =>
        recordDigest(distinctId, values),
      );
      if (previousDistinctId === distinctId) {
        const queued = yield* cacheManager.get<unknown>(IDENTIFIED_PROFILE_KEY, { refresh: true });
        const isRepeat = Option.exists(profileDigest, (value) =>
          Option.exists(queued, (hit) => hit.value === value),
        );
        if (!hasProfile(profile) || isRepeat) return false;
      }

      // The link is queued before the switch, so an interrupted page never
      // leaves the device on the user without the link that merges the visitor.
      const isFromVisitor = isAnonymousDistinctId(previousDistinctId);
      yield* appendToOutbox(
        {
          alias: isFromVisitor ? previousDistinctId : newAnonymousId(),
          distinctId,
          id: platform.randomId(),
          ...profile,
        },
        { hasFreshAlias: !isFromVisitor },
      );
      yield* Option.match(profileDigest, {
        onNone: () => cacheManager.delete(IDENTIFIED_PROFILE_KEY),
        onSome: (value) => cacheManager.set(IDENTIFIED_PROFILE_KEY, value),
      });
      if (previousDistinctId === distinctId) return true;
      yield* cacheManager.set(DISTINCT_ID_KEY, distinctId);
      currentDistinctId = Option.some(distinctId);
      // The id the cookie holds now leads to this user's subscriptions and
      // perks, so it must not stay readable on every subdomain. A pending answer
      // of the app counts here: the cookie stands until the answer comes.
      if (
        isFromVisitor &&
        config.crossSubdomainIdentity &&
        config.analytics.enabled &&
        consent.choice() === "granted"
      ) {
        yield* shareId(newAnonymousId(), retiredWith(retiredInCookie(), previousDistinctId));
      }
      eventBus.emit("identity-changed", {
        distinctId,
        previousDistinctId,
      });
      return true;
    });

  /**
   * With `crossSubdomainIdentity`, while consent is granted, lines an anonymous
   * device up with the id the site's subdomains share: it takes the cookie's id,
   * unless it holds a touch or handed its id out, as taking another would orphan
   * the campaign recorded under its own, or a purchase. An identified device never
   * reads the cookie here: its identity is decided already.
   *
   * The cookie's expiry is renewed only for the id it holds. Beyond that, a device
   * writes its own id only if it never used the cookie. Another subdomain may have
   * linked that id to a user since, so writing it back, over the fresh id that
   * sign-in left or after the cookie ran out, would hand that user's subscriptions
   * and perks to the next visitor on this browser.
   *
   * A device whose own id the cookie names as retired gives it up, touch or not,
   * for the same reason. Nothing is lost: what it recorded under that id went to
   * Voidhash and merged with the user. With `retiredOnly`, that is all it does, for
   * a page that is not starting. Resolves with the id the device had, when it changed.
   */
  const reconcileSharedId = (options?: { readonly retiredOnly: boolean }) =>
    Effect.gen(function* reconcileSharedId() {
      if (
        !mayUseSharedId() ||
        Option.isNone(currentDistinctId) ||
        !isAnonymousDistinctId(currentDistinctId.value)
      ) {
        return Option.none<string>();
      }
      const previousDistinctId = currentDistinctId.value;
      const retired = retiredInCookie();
      const isRetired = namesRetired(retired, previousDistinctId);
      const storedGivenUp = yield* readGivenUpIds();
      // One the cookie names was linked to someone by a sign-in, whose sharing is
      // not for whoever uses this device next to take back.
      const givenUp = Arr.filter(storedGivenUp, (id) => !namesRetired(retired, id));
      if (givenUp.length < storedGivenUp.length) {
        yield* cacheManager.set(GIVEN_UP_IDS_KEY, givenUp);
      }
      if (options?.retiredOnly && !isRetired) return Option.none<string>();
      const cookieId = Option.map(readSharedIdCookie(sharedIdCookie), (held) => held.anonymousId);
      const handedOut = yield* cacheManager.get<unknown>(HANDED_OUT_ID_KEY, { refresh: true });
      const keepsOwnId =
        Option.isSome(yield* cacheManager.get<unknown>(LATEST_TOUCH_KEY, { refresh: true })) ||
        Option.exists(handedOut, ({ value }) => value === previousDistinctId);
      const hasUsedCookie = Option.isSome(
        yield* cacheManager.get<unknown>(SHARED_ID_USED_KEY, { refresh: true }),
      );
      const sharedId = Option.getOrElse(
        Option.filter(cookieId, () => isRetired || !keepsOwnId),
        () => previousDistinctId,
      );
      if (Option.contains(cookieId, sharedId) || (Option.isNone(cookieId) && !hasUsedCookie)) {
        yield* shareId(sharedId, retired);
      }
      if (sharedId === previousDistinctId) return Option.none<string>();
      if (isRetired) {
        yield* cacheManager.delete(LATEST_TOUCH_KEY);
        forgetHeldTouches(touchStateKey(config.publishableKey), heldTouches);
      } else {
        if (givenUp.length >= MAX_GIVEN_UP_IDS) {
          yield* reportRevocationDropped(EVICTED_REVOCATION_MESSAGE);
        }
        yield* cacheManager.set(
          GIVEN_UP_IDS_KEY,
          [...givenUp, previousDistinctId].slice(-MAX_GIVEN_UP_IDS),
        );
      }
      yield* cacheManager.set(DISTINCT_ID_KEY, sharedId);
      // Flags are cached per id, and nothing reads this id's again.
      yield* cacheManager.clearPrefix(`feature-flags:${previousDistinctId}:`);
      currentDistinctId = Option.some(sharedId);
      eventBus.emit("identity-changed", {
        distinctId: sharedId,
        previousDistinctId,
      });
      return Option.some(previousDistinctId);
    });

  /** Takes the shared id off the device when the end user withdraws consent. */
  const forgetSharedId = () => {
    if (config.crossSubdomainIdentity) deleteSharedAnonymousId(sharedIdCookie);
  };

  /**
   * Restores the identity saved on the device. A `distinctId` seed is used
   * as is on a device without one; on a device with another identity, a user
   * id seed is identified, and an anonymous one is ignored, because two
   * anonymous visitors cannot be merged.
   */
  const initialize = (initialDistinctId?: string) =>
    Effect.gen(function* initialize() {
      // Earlier releases kept identify traits, email included, on the device.
      yield* cacheManager.clearPrefix(LEGACY_TRAITS_PREFIX);

      const stored = Option.map(
        yield* cacheManager.get<string>(DISTINCT_ID_KEY),
        (hit) => hit.value,
      );
      const seed = Option.fromNullishOr(initialDistinctId);
      const restored = Option.getOrElse(
        Option.orElse(stored, () => seed),
        newAnonymousId,
      );
      currentDistinctId = Option.some(restored);
      currentGroups = yield* readGroups();
      // Written only when it changed: a write fires the storage event in every
      // other tab, and could overwrite an identify another tab just made.
      if (!Option.contains(stored, restored)) {
        yield* cacheManager.set(DISTINCT_ID_KEY, restored);
      }

      const userSeed = Option.filter(
        seed,
        (value) =>
          !isAnonymousDistinctId(value) && Option.exists(stored, (storedId) => storedId !== value),
      );
      if (Option.isSome(userSeed)) {
        yield* switchTo(userSeed.value);
      }
      yield* reconcileSharedId();

      // Writes queued on an earlier page that could not be delivered then.
      yield* deliverInBackground();
      return currentDistinctId;
    });

  const queueRevocation = (distinctId: string) =>
    Effect.gen(function* queueRevocation() {
      const revocations = yield* readRevocations();
      // One already queued keeps its age and its wait, whoever asks again.
      if (Arr.some(revocations, (revocation) => revocation.distinctId === distinctId)) return;
      const now = yield* Clock.currentTimeMillis;
      // Past the limit, one Voidhash has answered it has no person for goes
      // first, then an anonymous one: a site calling this on every load makes a
      // new id per page without storage, which must not push out a signed-in
      // user who is waiting out an outage.
      const evicted =
        Arr.length(revocations) < MAX_OUTBOX_ENTRIES
          ? Option.none<AdDataSharingRevocation>()
          : Option.firstSomeOf([
              Arr.findFirst(revocations, hadNoPerson),
              Arr.findFirst(revocations, (revocation) =>
                isAnonymousDistinctId(revocation.distinctId),
              ),
              Arr.head(revocations),
            ]);
      if (Option.isSome(evicted)) yield* reportRevocationDropped(EVICTED_REVOCATION_MESSAGE);
      yield* cacheManager.set(AD_DATA_SHARING_REVOCATIONS_KEY, [
        ...Arr.filter(
          revocations,
          (revocation) =>
            !Option.exists(evicted, (other) => other.distinctId === revocation.distinctId),
        ),
        { distinctId, queuedAt: now, retryAt: now },
      ]);
    });

  /**
   * Queues taking back the agreement to sharing with ad platforms of the current
   * person and of the ids this device gave up for the shared one. It is stored and
   * retried like a link, so analytics consent cannot block or discard it and a
   * failed request does not leave sharing on.
   */
  const revokeAdDataSharing = () =>
    Effect.gen(function* revokeAdDataSharing() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }
      const givenUp = yield* readGivenUpIds();
      yield* Effect.forEach([currentDistinctId.value, ...givenUp], queueRevocation, {
        concurrency: 1,
        discard: true,
      });
      if (Arr.isReadonlyArrayNonEmpty(givenUp)) yield* cacheManager.delete(GIVEN_UP_IDS_KEY);
      yield* deliverInBackground();
    });

  /**
   * Drops the current person's revocation still queued, as they agreed again:
   * delivered after their new agreement, it would take that back as well.
   */
  const cancelAdDataSharingRevocation = () =>
    Option.match(currentDistinctId, {
      onNone: () => Effect.void,
      onSome: removeRevocation,
    });

  const identify = (distinctId: string, traits?: VoidhashTraits) =>
    Effect.gen(function* identify() {
      const isApplied = yield* switchTo(distinctId, traits);
      yield* deliverInBackground();
      return isApplied;
    });

  const reset = () =>
    Effect.gen(function* reset() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }

      const previousDistinctId = currentDistinctId.value;
      const nextAnonymousId = newAnonymousId();
      yield* cacheManager.set(DISTINCT_ID_KEY, nextAnonymousId);
      currentDistinctId = Option.some(nextAnonymousId);
      // The next person on this device has nothing to do with what the last one held.
      yield* resetGroups();
      yield* cacheManager.delete(IDENTIFIED_PROFILE_KEY);
      yield* cacheManager.delete(GIVEN_UP_IDS_KEY);
      yield* cacheManager.delete(HANDED_OUT_ID_KEY);
      if (mayUseSharedId()) yield* shareId(nextAnonymousId, retiredInCookie());
      eventBus.emit("identity-changed", {
        distinctId: nextAnonymousId,
        previousDistinctId,
      });
    });

  /**
   * Follows an identity another tab of the site switched to, so this tab does
   * not keep recording under a user who signed out there. The other tab has
   * queued the link already. Resolves with the id this tab used before, when
   * it changed.
   */
  const syncFromStorage = () =>
    Effect.gen(function* syncFromStorage() {
      const stored = Option.map(
        yield* cacheManager.get<string>(DISTINCT_ID_KEY, { refresh: true }),
        (hit) => hit.value,
      );
      if (Option.isNone(stored) || Option.isNone(currentDistinctId)) return Option.none<string>();
      const previousDistinctId = currentDistinctId.value;
      if (stored.value === previousDistinctId) return Option.none<string>();
      // A reset there took the end user out of their groups as well.
      yield* syncGroupsFromStorage();
      currentDistinctId = stored;
      eventBus.emit("identity-changed", {
        distinctId: stored.value,
        previousDistinctId,
      });
      return Option.some(previousDistinctId);
    });

  /**
   * Retries the outbox now, after the browser came back online or the page
   * became visible: the backoff is cleared and delivery starts at once.
   */
  const retryNow = () =>
    Effect.gen(function* retryNow() {
      yield* Option.match(retryFiber, {
        onNone: () => Effect.void,
        onSome: (fiber) => Fiber.interrupt(fiber),
      });
      retryFiber = Option.none();
      failedAttempts = 0;
      yield* deliverInBackground();
    });

  /** Stops background delivery; queued writes stay on the device for the next page. */
  const stop = () =>
    Effect.gen(function* stop() {
      isStopped = true;
      const fibers = Arr.getSomes([retryFiber, deliveryFiber, revocationWakeFiber]);
      retryFiber = Option.none();
      deliveryFiber = Option.none();
      revocationWakeFiber = Option.none();
      yield* Fiber.interruptAll(fibers);
    });

  /**
   * A request whose caller waits for the answer, under the rules of every
   * other request: refused at once while traffic is paused after an
   * authentication failure or the circuit is open, rather than waiting out
   * the request timeout of an unreachable Voidhash, and counted towards the
   * circuit breaker.
   */
  const sendAwaited = <A>(
    operation: string,
    request: Effect.Effect<A, SdkRequestError>,
  ): Effect.Effect<A, SdkRequestError | Cause.TimeoutError> =>
    Effect.gen(function* sendAwaited() {
      // While paused, a request may still be the one that tries the key again.
      const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
      if (authGate.isPaused() && !authProbe) {
        return yield* new SdkRequestError({
          cause: "Requests are paused after an authentication failure.",
          operation,
          status: Option.none(),
        });
      }
      if (!(yield* breaker.canAttempt(apiBreakerKey, operation))) {
        if (authProbe) yield* authGate.completeProbe(false);
        return yield* new SdkRequestError({
          cause: "Voidhash is unreachable; requests wait for the circuit to close.",
          operation,
          status: Option.none(),
        });
      }
      // Admitted: the probe slot, if this took it, is freed however it ends.
      return yield* Effect.gen(function* attemptAwaited() {
        const outcome = yield* Effect.exit(request.pipe(Effect.timeout(REQUEST_TIMEOUT_MS)));
        if (Exit.isSuccess(outcome)) {
          if (authProbe) yield* authGate.completeProbe(true);
          yield* breaker.recordSuccess(apiBreakerKey);
          return outcome.value;
        }
        const failure = Cause.squash(outcome.cause);
        const status = statusOf(failure);
        if (authProbe) {
          yield* authGate.completeProbe(Option.exists(status, (code) => !isAuthStatus(code)));
        }
        const authStatus = Option.filter(status, isAuthStatus);
        if (Option.isSome(authStatus)) {
          yield* authGate.pause({ httpStatus: authStatus.value, operation });
        } else if (
          Option.isNone(status) ||
          countsTowardsBreaker(status.value, errorBodyOf(failure), "api")
        ) {
          yield* breaker.recordFailure(apiBreakerKey, operation, Option.isSome(status));
        }
        return yield* Effect.failCause(outcome.cause);
      }).pipe(Effect.ensuring(breaker.releaseProbe(apiBreakerKey)));
    });

  /**
   * Synchronously persists person attributes to the server and returns the
   * resulting person snapshot. Reserved `email`/`name` are sent as dedicated
   * fields; everything else is forwarded as `traits`.
   */
  const setPersonAttributesSync = (input: {
    email?: string;
    name?: string;
    traits?: VoidhashTraits;
  }) =>
    Effect.gen(function* setPersonAttributesSync() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }

      return yield* sendAwaited(
        "person.setAttributes",
        apiClient.sdk.syncPersonAttributes({
          headers: buildHeaders(currentDistinctId.value),
          payload: buildPersonAttributesPayload(input),
        }),
      );
    });

  /** Reads the current person without changing it. */
  const getPerson = () =>
    Effect.gen(function* getPerson() {
      if (Option.isNone(currentDistinctId)) {
        return yield* Effect.die("Distinct id has not been initialized.");
      }

      return yield* sendAwaited(
        "person.get",
        apiClient.sdk.getPerson({ headers: buildHeaders(currentDistinctId.value) }),
      );
    });

  return {
    cancelAdDataSharingRevocation,
    deliverOutbox,
    forgetSharedId,
    getDistinctId,
    getGroups,
    getPerson,
    heldTouches,
    identify,
    initialize,
    markHandedOut,
    queuePersonWrite,
    readGroupDigests,
    reconcileSharedId,
    replaceGroups,
    reset,
    resetGroups,
    revokeAdDataSharing,
    retryNow,
    setGroup,
    setPersonAttributesSync,
    stop,
    storeGroupDigests,
    syncFromStorage,
    syncGroupsFromStorage,
  };
});

export class IdentityManager extends Context.Service<
  IdentityManager,
  Effect.Success<ReturnType<typeof makeIdentityManager>>
>()("web-voidhash/IdentityManager") {}
