import * as Arr from "effect/Array";
import { orderFromCompare } from "./order-boundary.ts";
import { unsafeDefined } from "./runtime-boundary.ts";
import {
  MimicHost,
  MimicHostError,
  type MimicHostShape,
} from "@voidhash/core/services/paywalls/MimicHost";
import {
  createInitialPaywallDocumentInput,
  MIMIC_DATABASE_NAME as REGISTRY_DATABASE_NAME,
  MIMIC_PAYWALLS_COLLECTION_NAME as REGISTRY_COLLECTION_NAME,
  PaywallDesignerDocument,
  PresenceSchema,
} from "@voidhash/mimic-schema";
import { MimicSDK } from "@voidhash/mimic-server/effect";
import type { Value as MimicValue } from "@voidhash/mimic-core";
import { causeMessage } from "@voidhash/lib/lang";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { hasTag } from "./runtime-boundary.ts";
import { nativeFetch } from "./runtime-boundary.ts";

/** Logical mimic database every paywall designer document lives in. */
export const MIMIC_DATABASE_NAME = REGISTRY_DATABASE_NAME;

/** Collection holding one designer document per paywall (document id = paywall id). */
export const MIMIC_PAYWALLS_COLLECTION_NAME = REGISTRY_COLLECTION_NAME;

/** TTL requested for minted document edit tokens, mirrored into `expiresAt`. */
const EDIT_TOKEN_TTL_SECONDS = 300;
const AGENT_CONNECTION_LEASE_MS = 5 * 60 * 1000;

const compareKeys = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (P.isObject(value) && value !== null) {
    return R.fromEntries(
      Arr.sort(
        R.toEntries(value),
        orderFromCompare<[string, unknown]>(([left], [right]) => compareKeys(left, right)),
      )
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * Canonical JSON encoding with recursively sorted object keys, so two
 * structurally equal schema-JSON documents stringify identically regardless
 * of key insertion order.
 */
export const stableJsonStringify = (value: unknown): string => encodeJson(canonicalize(value));

/** Structural (key-order-insensitive) equality of two schema-JSON values. */
export const schemaJsonEquals = (left: unknown, right: unknown): boolean =>
  stableJsonStringify(left) === stableJsonStringify(right);

const stringProp = (value: unknown, key: string): string | typeof Schema.Undefined.Type => {
  if (P.hasProperty(value, key)) {
    const property = value[key];
    if (P.isString(property)) {
      return property;
    }
  }
  return undefined;
};

/**
 * Whether a mimic SDK failure means "the resource already exists": the
 * engine's `ConflictError`, or a raced MySQL unique violation surfacing as a
 * generic error mentioning a duplicate/unique key.
 */
export const isConflictError = (error: unknown): boolean =>
  stringProp(error, "_tag") === "ConflictError" ||
  stringProp(error, "code") === "conflict" ||
  /duplicate entry|already exists|unique constraint/i.test(stringProp(error, "message") ?? "");

/** Whether a mimic SDK failure is the engine's `NotFoundError`. */
export const isNotFoundError = (error: unknown): boolean =>
  stringProp(error, "_tag") === "NotFoundError" || stringProp(error, "code") === "not_found";

const toHostError = (message: string, error: unknown): MimicHostError =>
  new MimicHostError({
    cause: causeMessage(error),
    message,
  });

/**
 * Unwraps a decoded paywall document snapshot (the engine's roots array from
 * `Primitive.Tree`) to its single root node — the renderer `SnapshotNode`
 * (`roots[0]`, matching the designer's `documentRootFromSnapshot` convention).
 * A well-formed paywall document always has exactly one root; anything else
 * returns `undefined`, which the thumbnail renderer treats as an empty paywall.
 */
export const rootFromDocumentSnapshot = (snapshot: unknown): unknown => {
  if (Array.isArray(snapshot)) return snapshot[0];
  return undefined;
};

/**
 * Marks a post-provisioning failure the engine classified as NotFound where
 * a missing document cannot explain it (document create, token minting): the
 * cached database/collection ids are stale — e.g. the collection was deleted
 * out of band — and one fresh provisioning pass should be attempted.
 */
export class StaleProvisioningIdsError {
  readonly _tag = "StaleProvisioningIdsError";
  // No TS parameter property: the alchemy CLI evaluates this file in Node's
  // strip-only TypeScript mode, which rejects that syntax.
  readonly hostError: MimicHostError;

  constructor(hostError: MimicHostError) {
    this.hostError = hostError;
  }
}

/**
 * Maps a raw post-provisioning failure: the engine's NotFound becomes the
 * stale-ids marker, anything else the plain host error.
 */
export const classifyPostProvisioningError =
  (message: string) =>
  (error: unknown): MimicHostError | StaleProvisioningIdsError => {
    if (isNotFoundError(error)) return new StaleProvisioningIdsError(toHostError(message, error));
    return toHostError(message, error);
  };

const unwrapStale = (error: MimicHostError | StaleProvisioningIdsError): MimicHostError => {
  if (hasTag(error, "StaleProvisioningIdsError")) return error.hostError;
  return error;
};

/**
 * Applies the single stale-ids retry to a post-provisioning operation: a
 * {@link StaleProvisioningIdsError} failure calls `invalidate` (dropping the
 * cached provisioning ids) and re-runs `op` once, which re-resolves the
 * collection through a fresh provisioning pass. A second failure — stale or
 * not — surfaces as the plain host error.
 */
export const retryOnceOnStaleIds = <A>(
  op: Effect.Effect<A, MimicHostError | StaleProvisioningIdsError>,
  invalidate: () => void,
): Effect.Effect<A, MimicHostError> =>
  op.pipe(
    Effect.catch((error) => {
      if (hasTag(error, "StaleProvisioningIdsError")) {
        return Effect.suspend(() => {
          invalidate();
          return op.pipe(Effect.mapError(unwrapStale));
        });
      }
      return Effect.fail(error);
    }),
  );

/**
 * Every mimic engine value is a `{ kind }`-tagged union member; documents come
 * off the raw collection typed as `unknown`, so this is the single structural
 * narrowing between the transport and the schema decoder.
 */
const isMimicValue = (value: unknown): value is MimicValue =>
  P.hasProperty(value, "kind") && P.isString(value.kind);

/**
 * Decodes a raw document value into the designer snapshot. Anything that is not
 * a mimic tree value decodes to `undefined`, exactly as the primitive's own
 * `kind !== "tree"` guard does.
 */
const decodeDocumentValue = (value: unknown) => {
  if (!isMimicValue(value)) return undefined;
  return PaywallDesignerDocument.decode(value);
};

/** Resolved control-plane ids cached after a successful provisioning pass. */
export interface MimicProvisioningIds {
  readonly databaseId: string;
  readonly collectionId: string;
}

/**
 * Structural subset of the mimic SDK the provisioning flow needs. Kept as a
 * narrow port so {@link ensureProvisioned} is unit-testable against a fake;
 * the live mapping over `MimicSDK` lives in {@link makeMimicHostLive}.
 * Registry provisioning happens in the document service; this adapter only
 * resolves the resulting resource ids.
 */
export interface MimicProvisioningOps {
  readonly listDatabases: () => Effect.Effect<
    ReadonlyArray<{ readonly id: string; readonly name: string }>,
    unknown
  >;
  readonly listCollections: (
    databaseId: string,
  ) => Effect.Effect<
    ReadonlyArray<{ readonly id: string; readonly name: string; readonly schema: unknown }>,
    unknown
  >;
}

const ensureDatabase = (ops: MimicProvisioningOps): Effect.Effect<string, MimicHostError> => {
  const find = ops.listDatabases().pipe(
    Effect.mapError((error) => toHostError("listing mimic databases failed", error)),
    Effect.map((databases) => databases.find((database) => database.name === MIMIC_DATABASE_NAME)),
  );

  return find.pipe(
    Effect.flatMap((existing) => {
      if (existing !== undefined) return Effect.succeed(existing.id);
      return Effect.fail(
        new MimicHostError({
          cause: `registry database ${MIMIC_DATABASE_NAME} is missing`,
          message: "mimic registry provisioning is incomplete",
        }),
      );
    }),
  );
};

const ensureCollection = (
  ops: MimicProvisioningOps,
  databaseId: string,
): Effect.Effect<string, MimicHostError> => {
  const find = ops.listCollections(databaseId).pipe(
    Effect.mapError((error) => toHostError("listing mimic collections failed", error)),
    Effect.map((collections) =>
      collections.find((collection) => collection.name === MIMIC_PAYWALLS_COLLECTION_NAME),
    ),
  );

  return find.pipe(
    Effect.flatMap((existing) => {
      if (existing !== undefined) return Effect.succeed(existing.id);
      return Effect.fail(
        new MimicHostError({
          cause: `registry collection ${MIMIC_PAYWALLS_COLLECTION_NAME} is missing`,
          message: "mimic registry provisioning is incomplete",
        }),
      );
    }),
  );
};

/**
 * Resolves the database and collection created by the deployed registry.
 */
export const ensureProvisioned = (
  ops: MimicProvisioningOps,
): Effect.Effect<MimicProvisioningIds, MimicHostError> =>
  ensureDatabase(ops).pipe(
    Effect.flatMap((databaseId) =>
      ensureCollection(ops, databaseId).pipe(
        Effect.map((collectionId) => ({ collectionId, databaseId })),
      ),
    ),
  );

/**
 * Structural subset of the typed `CollectionHandle` that
 * {@link ensureDocument} needs — narrow so the get-or-create decision is
 * unit-testable against a fake.
 */
export interface PaywallDocumentOps {
  readonly getDocument: (documentId: string) => Effect.Effect<unknown, unknown>;
  readonly createDocument: (documentId: string) => Effect.Effect<unknown, unknown>;
}

/**
 * Get-or-create for one paywall document: `GetDocument`; on the engine's
 * NotFound create the document (seeded by the caller's `createDocument`
 * closure). A create Conflict usually means another isolate won the race —
 * but it can also mean a corrupt index entry (the id is reserved while every
 * read reports NotFound, e.g. a row orphaned by an out-of-band collection
 * deletion), so the conflict path re-reads to verify the document is actually
 * readable and fails descriptively otherwise. A create NotFound cannot mean
 * "document missing" — the database/collection behind the cached ids is gone
 * — and fails with the {@link StaleProvisioningIdsError} marker so callers
 * can re-provision.
 */
export const ensureDocument = (
  ops: PaywallDocumentOps,
  documentId: string,
): Effect.Effect<void, MimicHostError | StaleProvisioningIdsError> =>
  ops.getDocument(documentId).pipe(
    Effect.asVoid,
    Effect.catch((error) => {
      if (!isNotFoundError(error)) {
        return Effect.fail(
          toHostError(`loading the paywall document "${documentId}" failed`, error),
        );
      }
      return ops.createDocument(documentId).pipe(
        Effect.asVoid,
        Effect.catch((createError) => {
          if (!isConflictError(createError)) {
            return Effect.fail(
              classifyPostProvisioningError(`creating the paywall document "${documentId}" failed`)(
                createError,
              ),
            );
          }
          return ops.getDocument(documentId).pipe(
            Effect.asVoid,
            Effect.mapError((verifyError) =>
              toHostError(
                `the paywall document "${documentId}" exists (create conflicts) but cannot be read — its index entry is likely orphaned`,
                verifyError,
              ),
            ),
          );
        }),
      );
    }),
  );

interface ServiceBindingFetcher {
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const isServiceBindingFetcher = (value: unknown): value is ServiceBindingFetcher =>
  P.hasProperty(value, "fetch") && P.isFunction(value.fetch);

const readEnvString = (
  env: Record<string, unknown> | typeof Schema.Undefined.Type,
  name: string,
): string | typeof Schema.Undefined.Type => {
  const value = env?.[name];
  if (P.isString(value) && Str.isNonEmpty(value)) return value;
  return undefined;
};

/**
 * Whether a mimic-db base URL points at the local loopback (localhost,
 * 127.0.0.0/8, [::1], 0.0.0.0) — local dev, where mimic-db is reached
 * directly on its pinned dev port via the global fetch.
 */
export const isLoopbackUrl = (url: string): boolean => {
  if (!URL.canParse(url)) return false;
  const hostname = new URL(url).hostname;
  return (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    /^127(\.\d{1,3}){3}$/.test(hostname)
  );
};

/**
 * Resolves the fetch implementation used to reach mimic-db: loopback URLs
 * (local dev) use the global fetch; every other URL MUST go through the
 * `MIMIC_HOST` service binding — a deployed worker missing the binding is
 * deploy drift and fails loudly instead of silently using the public
 * network.
 */
export const resolveMimicFetch = (
  url: string,
  host: unknown,
): Effect.Effect<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  MimicHostError
> =>
  Effect.suspend(() => {
    if (isLoopbackUrl(url)) {
      return Effect.succeed(
        (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
          nativeFetch(input, init),
      );
    }
    if (isServiceBindingFetcher(host)) {
      return Effect.succeed(
        (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
          host.fetch(input, init),
      );
    }
    return Effect.fail(
      new MimicHostError({
        cause: `MIMIC_DB_URL "${url}" is not a loopback URL but the MIMIC_HOST service binding is missing`,
        message: "mimic host service binding is missing for a deployed mimic-db URL",
      }),
    );
  });

/**
 * Live mimic-db adapter for the core {@link MimicHost} port, built over the
 * typed `MimicSDK` from `@voidhash/mimic-server`.
 *
 * `env` is the Worker's runtime environment captured at init (`undefined` at
 * plan time, where bindings are absent). Construction is plan-phase safe:
 * nothing dereferences `env` until a request actually uses the port — the
 * SDK is then built lazily from `MIMIC_DB_URL` + `MIMIC_ROOT_PASSWORD` and
 * routed through the `MIMIC_HOST` service binding via a wrapper closure (a
 * detached `.fetch` reference throws "Illegal invocation" in workerd). The
 * global fetch is used only for loopback `MIMIC_DB_URL`s (local dev hitting
 * the pinned mimic-db port directly); a deployed URL without the binding
 * fails loudly instead of silently bypassing it (see {@link resolveMimicFetch}).
 *
 * Registry id resolution (see {@link ensureProvisioned}) runs lazily on first
 * use and its resolved ids
 * are cached in this factory's closure — the Worker init calls the factory
 * once, so the cache spans every request of the isolate while the per-request
 * layer rebuilds stay cheap.
 */
export const makeMimicHostLive = (
  env: Record<string, unknown> | typeof Schema.Undefined.Type,
): Layer.Layer<MimicHost> => {
  let sdkCache: MimicSDK | typeof Schema.Undefined.Type;
  let idsCache: MimicProvisioningIds | typeof Schema.Undefined.Type;

  const resolveSdk = Effect.suspend(() => {
    if (sdkCache !== undefined) {
      return Effect.succeed(sdkCache);
    }
    const url = readEnvString(env, "MIMIC_DB_URL");
    const password = readEnvString(env, "MIMIC_ROOT_PASSWORD");
    if (url === undefined || password === undefined) {
      return Effect.fail(
        new MimicHostError({
          cause: "MIMIC_DB_URL and/or MIMIC_ROOT_PASSWORD env bindings are missing",
          message: "mimic host is not configured in this worker",
        }),
      );
    }
    // Route through the MIMIC_HOST service binding except in local dev, where
    // MIMIC_DB_URL is the pinned localhost port and the binding has no workerd
    // route (mimic-db hosts Durable Objects, which the alchemy dev sidecar
    // never evaluates cross-script) — there the global fetch hits the dev
    // server directly. A deployed URL without the binding fails (deploy drift).
    return resolveMimicFetch(url, env?.["MIMIC_HOST"]).pipe(
      Effect.map((rawFetch) => {
        // Bun's lib types extend `typeof fetch` with a `preconnect` member;
        // attach a no-op so the wrapper satisfies every consumer tsconfig
        // without a cast.
        const fetchImpl: typeof globalThis.fetch = Object.assign(rawFetch, {
          preconnect: () => {},
        });
        sdkCache = new MimicSDK({ url, username: "root", password, fetch: fetchImpl });
        return sdkCache;
      }),
    );
  });

  const provisioningOps = (sdk: MimicSDK): MimicProvisioningOps => ({
    listCollections: (databaseId) => sdk.database(databaseId).listCollections(),
    listDatabases: () => sdk.listDatabases(),
  });

  const resolveCollection = Effect.fn("resolveCollection")(function* () {
    const sdk = yield* resolveSdk;
    if (idsCache === undefined) {
      idsCache = yield* ensureProvisioned(provisioningOps(sdk));
    }
    return sdk
      .database(idsCache.databaseId)
      .collection(idsCache.collectionId, PaywallDesignerDocument);
  })();

  const resolveRawCollection = Effect.fn("resolveRawCollection")(function* () {
    const sdk = yield* resolveSdk;
    yield* resolveCollection;
    return sdk.database(unsafeDefined(idsCache).databaseId).collectionRaw(unsafeDefined(idsCache).collectionId);
  })();

  const paywallDocumentFromRaw = (document: {
    readonly value: unknown;
    readonly version: number;
  }) => {
    const snapshot = decodeDocumentValue(document.value);
    return {
      tree: document.value,
      version: document.version,
      root: rootFromDocumentSnapshot(snapshot),
    };
  };

  // Stale-ids recovery: a NotFound from a post-provisioning op means the
  // cached database/collection ids no longer resolve (out-of-band deletion);
  // drop the cache and retry once through a fresh ensureProvisioned.
  const invalidateIds = () => {
    idsCache = undefined;
  };

  const ensurePaywallDocument: MimicHostShape["ensurePaywallDocument"] = (paywallId) =>
    retryOnceOnStaleIds(
      resolveCollection.pipe(
        Effect.flatMap((collection) =>
          ensureDocument(
            {
              createDocument: (documentId) =>
                collection.create(createInitialPaywallDocumentInput(), { id: documentId }),
              getDocument: (documentId) => collection.get(documentId),
            },
            paywallId,
          ),
        ),
      ),
      invalidateIds,
    );

  const getPaywallSnapshot: MimicHostShape["getPaywallSnapshot"] = (paywallId) =>
    retryOnceOnStaleIds(
      resolveCollection.pipe(
        Effect.flatMap((collection) =>
          collection
            .get(paywallId)
            .pipe(
              Effect.mapError(
                classifyPostProvisioningError(
                  `reading the snapshot for paywall "${paywallId}" failed`,
                ),
              ),
            ),
        ),
        // The engine document is a roots array (`Primitive.Tree`); the renderer
        // and designer both consume exactly one root (`roots[0]`, the
        // `SnapshotNode`). Returning the raw root keeps this port renderer-type
        // agnostic — its consumer narrows structurally.
        Effect.map((document) => rootFromDocumentSnapshot(document.snapshot)),
      ),
      invalidateIds,
    );

  const getPaywallDocument: MimicHostShape["getPaywallDocument"] = (paywallId) =>
    retryOnceOnStaleIds(
      resolveCollection.pipe(
        Effect.flatMap((collection) =>
          collection
            .get(paywallId)
            .pipe(
              Effect.mapError(
                classifyPostProvisioningError(
                  `reading the document for paywall "${paywallId}" failed`,
                ),
              ),
            ),
        ),
        // The typed snapshot carries the encoded document value (the raw
        // `Primitive.Tree` value = the `TreeValue` the write path reconciles
        // against), the optimistic-concurrency version, AND the decoded root
        // (`roots[0]`, the renderer `SnapshotNode`) — all from ONE read, so a
        // caller needing both the version and the printed files derives them
        // atomically (never straddling a concurrent write).
        Effect.map((document) => ({
          tree: document.value,
          version: document.version,
          root: rootFromDocumentSnapshot(document.snapshot),
        })),
      ),
      invalidateIds,
    );

  const submitPaywallTransaction: MimicHostShape["submitPaywallTransaction"] = (
    paywallId,
    { baseVersion, commands },
  ) =>
    retryOnceOnStaleIds(
      resolveSdk.pipe(
        Effect.flatMap((sdk) =>
          resolveCollection.pipe(
            // resolveCollection populates idsCache; a granular submit needs the
            // RAW collection handle (the typed handle only exposes whole-value
            // setDocumentRaw). idsCache is defined here — resolveCollection just
            // set it — so read it back for the raw handle.
            Effect.flatMap(() =>
              sdk
                .database(unsafeDefined(idsCache).databaseId)
                .collectionRaw(unsafeDefined(idsCache).collectionId)
                .submitTransaction(paywallId, { baseVersion, commands })
                .pipe(
                  Effect.mapError(
                    classifyPostProvisioningError(
                      `submitting a transaction for paywall "${paywallId}" failed`,
                    ),
                  ),
                ),
            ),
          ),
        ),
        Effect.map((result) => ({ accepted: result.accepted, version: result.version })),
      ),
      invalidateIds,
    );

  const openPaywallConnection: MimicHostShape["openPaywallConnection"] = ({
    paywallId,
    connectionId,
    presence,
  }) =>
    retryOnceOnStaleIds(
      resolveRawCollection.pipe(
        Effect.flatMap((collection) =>
          collection
            .openDocumentConnection(paywallId, {
              connectionId,
              leaseMs: AGENT_CONNECTION_LEASE_MS,
              presence: PresenceSchema.encode({
                participant: {
                  editSessionId: presence.editSessionId,
                  kind: "agent",
                  source: presence.source,
                },
                selectedNodeIds: [],
                user: { color: "#7c3aed", name: presence.name },
              }),
            })
            .pipe(
              Effect.mapError(
                classifyPostProvisioningError(
                  `opening a connection for paywall "${paywallId}" failed`,
                ),
              ),
            ),
        ),
        Effect.map(paywallDocumentFromRaw),
      ),
      invalidateIds,
    );

  const getConnectedPaywallDocument: MimicHostShape["getConnectedPaywallDocument"] = ({
    paywallId,
    connectionId,
  }) =>
    resolveRawCollection.pipe(
      Effect.flatMap((collection) =>
        collection.getConnectedDocument(paywallId, connectionId, AGENT_CONNECTION_LEASE_MS),
      ),
      Effect.map(paywallDocumentFromRaw),
      Effect.mapError((error) =>
        toHostError(`reading connected paywall "${paywallId}" failed`, error),
      ),
    );

  const heartbeatPaywallConnection: MimicHostShape["heartbeatPaywallConnection"] = ({
    paywallId,
    connectionId,
  }) =>
    resolveRawCollection.pipe(
      Effect.flatMap((collection) =>
        collection.heartbeatDocumentConnection(paywallId, connectionId, AGENT_CONNECTION_LEASE_MS),
      ),
      Effect.mapError((error) =>
        toHostError(`renewing the connection for paywall "${paywallId}" failed`, error),
      ),
    );

  const closePaywallConnection: MimicHostShape["closePaywallConnection"] = ({
    paywallId,
    connectionId,
  }) =>
    resolveRawCollection.pipe(
      Effect.flatMap((collection) => collection.closeDocumentConnection(paywallId, connectionId)),
      Effect.mapError((error) =>
        toHostError(`closing the connection for paywall "${paywallId}" failed`, error),
      ),
    );

  const submitConnectedPaywallTransaction: MimicHostShape["submitConnectedPaywallTransaction"] = (
    paywallId,
    connectionId,
    { baseVersion, commands },
  ) =>
    resolveRawCollection.pipe(
      Effect.flatMap((collection) =>
        collection.submitConnectedTransaction(paywallId, {
          baseVersion,
          commands,
          connectionId,
          leaseMs: AGENT_CONNECTION_LEASE_MS,
        }),
      ),
      Effect.map((result) => ({ accepted: result.accepted, version: result.version })),
      Effect.mapError((error) =>
        toHostError(`submitting a connected transaction for paywall "${paywallId}" failed`, error),
      ),
    );

  const createPaywallEditToken: MimicHostShape["createPaywallEditToken"] = ({ paywallId }) =>
    retryOnceOnStaleIds(
      resolveCollection.pipe(
        Effect.flatMap((collection) =>
          collection
            .setupDocumentAuthentication({
              documentId: paywallId,
              expiresInSeconds: EDIT_TOKEN_TTL_SECONDS,
              origins: [],
              permission: "write",
            })
            .pipe(
              Effect.mapError(
                classifyPostProvisioningError(
                  `minting an edit token for paywall "${paywallId}" failed`,
                ),
              ),
            ),
        ),
        // mimic-db returns only `{token, url}`; the expiry is synthesized
        // locally from the TTL this adapter requested.
        Effect.flatMap((setup) =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            return {
              expiresAt: DateTime.toDateUtc(
                DateTime.makeUnsafe(now + EDIT_TOKEN_TTL_SECONDS * 1000),
              ),
              token: setup.token,
              url: setup.url,
            };
          }),
        ),
      ),
      invalidateIds,
    );

  return Layer.succeed(MimicHost, {
    closePaywallConnection,
    createPaywallEditToken,
    ensurePaywallDocument,
    getConnectedPaywallDocument,
    getPaywallDocument,
    getPaywallSnapshot,
    heartbeatPaywallConnection,
    openPaywallConnection,
    submitConnectedPaywallTransaction,
    submitPaywallTransaction,
  });
};
