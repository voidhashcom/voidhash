import {
  MimicHost,
  MimicHostError,
  type MimicHostShape,
} from "@voidhash/core/services/paywalls/MimicHost";
import { HostServiceTag, type HostService } from "@voidhash/mimic-db/app/hostService";
import { decodeTransactionEnvelope } from "@voidhash/mimic-db/document/transaction";
import {
  createInitialPaywallDocumentInput,
  MIMIC_DATABASE_NAME,
  MIMIC_PAYWALLS_COLLECTION_NAME,
  PaywallDesignerDocument,
  PresenceSchema,
} from "@voidhash/mimic-schema";
import { Effect, Layer, Semaphore } from "effect";

const editTokenTtlSeconds = 300;
const agentConnectionLeaseMs = 5 * 60 * 1000;

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
  typeof cause === "object" && cause !== null && "_tag" in cause ? String(cause._tag) : undefined;

const isNotFound = (cause: unknown): boolean => errorTag(cause) === "NotFoundError";
const isConflict = (cause: unknown): boolean => errorTag(cause) === "ConflictError";

const connectionUrl = (publicBaseUrl: string, ids: ProvisioningIds, paywallId: string): string => {
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
  const provisioningLock = Semaphore.makeUnsafe(1);
  let cachedIds: ProvisioningIds | undefined;

  const resolveDatabase = Effect.gen(function* () {
    const listed = yield* host.listDatabases();
    const existing = listed.find((database) => database.name === MIMIC_DATABASE_NAME);
    return existing
      ? existing.id
      : yield* Effect.fail(new Error(`Missing registry database ${MIMIC_DATABASE_NAME}`));
  });

  const resolveCollection = (databaseId: string) =>
    Effect.gen(function* () {
      const listed = yield* host.listCollections(databaseId);
      const existing = listed.find(
        (collection) => collection.name === MIMIC_PAYWALLS_COLLECTION_NAME,
      );
      return existing
        ? existing.id
        : yield* Effect.fail(
            new Error(`Missing registry collection ${MIMIC_PAYWALLS_COLLECTION_NAME}`),
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

  const toPaywallDocument = (document: { readonly value: unknown; readonly version: number }) => {
    const roots = PaywallDesignerDocument.decode(document.value as never);
    return {
      root: roots?.[0],
      tree: document.value,
      version: document.version,
    };
  };

  return {
    createPaywallEditToken: ({ paywallId }) =>
      provision.pipe(
        Effect.flatMap((ids) =>
          host
            .createDocumentAuthToken(ids.collectionId, paywallId, "write", [], editTokenTtlSeconds)
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
    getPaywallDocument: (paywallId) => getDocument(paywallId).pipe(Effect.map(toPaywallDocument)),
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
    openPaywallConnection: ({ paywallId, connectionId, presence }) =>
      provision.pipe(
        Effect.flatMap(({ collectionId }) =>
          host.attachConnection(
            collectionId,
            paywallId,
            connectionId,
            "write",
            undefined,
            PresenceSchema.encode({
              participant: {
                editSessionId: presence.editSessionId,
                kind: "agent",
                source: presence.source,
              },
              selectedNodeIds: [],
              user: { color: "#7c3aed", name: presence.name },
            }),
            agentConnectionLeaseMs,
          ),
        ),
        Effect.map(toPaywallDocument),
        Effect.mapError((cause) =>
          hostError(`Failed to open a connection for paywall ${paywallId}`, cause),
        ),
      ),
    getConnectedPaywallDocument: ({ paywallId, connectionId }) =>
      provision.pipe(
        Effect.flatMap(({ collectionId }) =>
          host.getConnectionDocument(collectionId, paywallId, connectionId, agentConnectionLeaseMs),
        ),
        Effect.map(toPaywallDocument),
        Effect.mapError((cause) =>
          hostError(`Failed to read connected paywall ${paywallId}`, cause),
        ),
      ),
    heartbeatPaywallConnection: ({ paywallId, connectionId }) =>
      provision.pipe(
        Effect.flatMap(({ collectionId }) =>
          host.heartbeatConnection(collectionId, paywallId, connectionId, agentConnectionLeaseMs),
        ),
        Effect.mapError((cause) =>
          hostError(`Failed to renew the connection for paywall ${paywallId}`, cause),
        ),
      ),
    closePaywallConnection: ({ paywallId, connectionId }) =>
      provision.pipe(
        Effect.flatMap(({ collectionId }) =>
          host.detachConnection(collectionId, paywallId, connectionId),
        ),
        Effect.mapError((cause) =>
          hostError(`Failed to close the connection for paywall ${paywallId}`, cause),
        ),
      ),
    submitConnectedPaywallTransaction: (paywallId, connectionId, input) =>
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
              host.submitConnectionTransaction(
                collectionId,
                paywallId,
                connectionId,
                transaction,
                agentConnectionLeaseMs,
              ),
            ),
          ),
        ),
        Effect.map((result) => ({ accepted: result.accepted, version: result.version })),
        Effect.mapError((cause) =>
          cause instanceof MimicHostError
            ? cause
            : hostError(`Failed to update connected paywall ${paywallId}`, cause),
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
