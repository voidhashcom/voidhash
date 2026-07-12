import {
  MimicHost,
  MimicHostError,
  type MimicHostShape,
} from "@voidhash/core/services/paywalls/MimicHost";
import {
  HostServiceTag,
  type HostService,
} from "@voidhash/mimic-db/app/hostService";
import { decodeTransactionEnvelope } from "@voidhash/mimic-db/document/transaction";
import { serializeSchema } from "@voidhash/mimic-core";
import {
  createInitialPaywallDocumentInput,
  PaywallDesignerDocument,
} from "@voidhash/mimic-schema";
import { Effect, Layer, Semaphore } from "effect";

const databaseName = "voidhash";
const collectionName = "paywalls";
const editTokenTtlSeconds = 300;

interface ProvisioningIds {
  readonly collectionId: string;
  readonly databaseId: string;
}

const hostError = (message: string, cause: unknown) =>
  new MimicHostError({
    cause: cause instanceof Error ? cause.message : String(cause),
    message,
  });

const errorTag = (cause: unknown): string | undefined =>
  typeof cause === "object" && cause !== null && "_tag" in cause
    ? String(cause._tag)
    : undefined;

const isNotFound = (cause: unknown): boolean => errorTag(cause) === "NotFoundError";
const isConflict = (cause: unknown): boolean => errorTag(cause) === "ConflictError";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};

const schemaEquals = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const connectionUrl = (
  publicBaseUrl: string,
  ids: ProvisioningIds,
  paywallId: string,
): string => {
  const base = new URL(publicBaseUrl);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `/ws/v1/databases/${encodeURIComponent(
    ids.databaseId,
  )}/collections/${encodeURIComponent(ids.collectionId)}/documents/${encodeURIComponent(
    paywallId,
  )}`;
  base.search = "";
  base.hash = "";
  return base.toString();
};

const makeMimicHost = (host: HostService, publicBaseUrl: string): MimicHostShape => {
  const schema = serializeSchema(PaywallDesignerDocument.schema);
  const provisioningLock = Semaphore.makeUnsafe(1);
  let cachedIds: ProvisioningIds | undefined;

  const resolveDatabase = Effect.gen(function* () {
    const listed = yield* host.listDatabases();
    const existing = listed.find((database) => database.name === databaseName);
    if (existing) return existing.id;
    return yield* host.createDatabase(databaseName, "Voidhash paywall documents").pipe(
      Effect.map((database) => database.id),
      Effect.catch((cause) =>
        isConflict(cause)
          ? host.listDatabases().pipe(
              Effect.flatMap((databases) => {
                const database = databases.find((candidate) => candidate.name === databaseName);
                return database
                  ? Effect.succeed(database.id)
                  : Effect.fail(cause);
              }),
            )
          : Effect.fail(cause),
      ),
    );
  });

  const resolveCollection = (databaseId: string) =>
    Effect.gen(function* () {
      const listed = yield* host.listCollections(databaseId);
      const existing = listed.find((collection) => collection.name === collectionName);
      if (existing) {
        if (!schemaEquals(existing.schema, schema)) {
          yield* host.updateCollectionSchema(existing.id, schema);
        }
        return existing.id;
      }
      return yield* host.createCollection(databaseId, collectionName, schema).pipe(
        Effect.map((collection) => collection.id),
        Effect.catch((cause) =>
          isConflict(cause)
            ? host.listCollections(databaseId).pipe(
                Effect.flatMap((collections) => {
                  const collection = collections.find(
                    (candidate) => candidate.name === collectionName,
                  );
                  return collection
                    ? Effect.succeed(collection.id)
                    : Effect.fail(cause);
                }),
              )
            : Effect.fail(cause),
        ),
      );
    });

  const provision = provisioningLock.withPermit(
    Effect.suspend(() => {
      if (cachedIds) return Effect.succeed(cachedIds);
      return resolveDatabase.pipe(
        Effect.flatMap((databaseId) =>
          resolveCollection(databaseId).pipe(
            Effect.map((collectionId) => ({ collectionId, databaseId })),
          ),
        ),
        Effect.tap((ids) => Effect.sync(() => void (cachedIds = ids))),
        Effect.mapError((cause) => hostError("Failed to provision the mimic paywall store", cause)),
      );
    }),
  );

  const ensurePaywallDocument: MimicHostShape["ensurePaywallDocument"] = (paywallId) =>
    provision.pipe(
      Effect.flatMap(({ collectionId }) =>
        host.getDocument(collectionId, paywallId).pipe(
          Effect.asVoid,
          Effect.catch((cause) =>
            isNotFound(cause)
              ? host
                  .createDocument(
                    collectionId,
                    paywallId,
                    PaywallDesignerDocument.encode(createInitialPaywallDocumentInput()),
                  )
                  .pipe(
                  Effect.asVoid,
                  Effect.catch((createCause) =>
                    isConflict(createCause) ? Effect.void : Effect.fail(createCause),
                  ),
                )
              : Effect.fail(cause),
          ),
        ),
      ),
      Effect.mapError((cause) =>
        cause instanceof MimicHostError
          ? cause
          : hostError(`Failed to ensure paywall document ${paywallId}`, cause),
      ),
    );

  const getDocument = (paywallId: string) =>
    provision.pipe(
      Effect.flatMap(({ collectionId }) => host.getDocument(collectionId, paywallId)),
      Effect.mapError((cause) => hostError(`Failed to read paywall document ${paywallId}`, cause)),
    );

  return {
    createPaywallEditToken: ({ paywallId }) =>
      provision.pipe(
        Effect.flatMap((ids) =>
          host
            .createDocumentAuthToken(
              ids.collectionId,
              paywallId,
              "write",
              [],
              editTokenTtlSeconds,
            )
            .pipe(
            Effect.map(({ token }) => ({
              expiresAt: new Date(Date.now() + editTokenTtlSeconds * 1000),
              token,
              url: connectionUrl(publicBaseUrl, ids, paywallId),
            })),
          ),
        ),
        Effect.mapError((cause) => hostError(`Failed to mint a token for ${paywallId}`, cause)),
      ),
    ensurePaywallDocument,
    getPaywallDocument: (paywallId) =>
      getDocument(paywallId).pipe(
        Effect.map((document) => {
          const roots = PaywallDesignerDocument.decode(document.value);
          return {
            root: roots?.[0],
            tree: document.value,
            version: document.version,
          };
        }),
      ),
    getPaywallSnapshot: (paywallId) =>
      getDocument(paywallId).pipe(
        Effect.map((document) => PaywallDesignerDocument.decode(document.value)?.[0]),
      ),
    submitPaywallTransaction: (paywallId, input) =>
      provision.pipe(
        Effect.flatMap(({ collectionId }) =>
          Effect.try({
            try: () =>
              decodeTransactionEnvelope({
                baseVersion: input.baseVersion,
                commands: input.commands,
                id: crypto.randomUUID(),
              }),
            catch: (cause) => hostError("Invalid mimic transaction", cause),
          }).pipe(
            Effect.flatMap((transaction) =>
              host.submitTransaction(collectionId, paywallId, transaction),
            ),
          ),
        ),
        Effect.map((result) => ({ accepted: result.accepted, version: result.version })),
        Effect.mapError((cause) =>
          cause instanceof MimicHostError
            ? cause
            : hostError(`Failed to update paywall document ${paywallId}`, cause),
        ),
      ),
  };
};

/** In-process bridge from the local mimic host to the backend paywall port. */
export const makeBackendMimicHostLive = (
  publicBaseUrl: string,
): Layer.Layer<MimicHost, never, HostServiceTag> =>
  Layer.effect(
    MimicHost,
    Effect.map(HostServiceTag, (host) => makeMimicHost(host, publicBaseUrl)),
  );
