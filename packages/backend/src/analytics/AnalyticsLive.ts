import {
  analyticsIngestDlq,
  and,
  apiKeys,
  captureProjectPolicies,
  Db,
  eq,
  projects,
} from "@voidhash/db";
import {
  AnalyticsAuthorizer,
  AnalyticsAuthorizationDeniedError,
  AnalyticsConfig,
  AnalyticsDeadLetterStore,
  AnalyticsIdentityResolver,
  AnalyticsInlineLive,
  AnalyticsPortError,
  CLICKHOUSE_ANALYTICS_MIGRATIONS,
  ClickHouseAnalyticsClient,
  ClickHouseAnalyticsStoreLive,
  CaptureCredentialRepository,
  emptyEventAdmissionPolicy,
  extractInnerProperties,
  isTrustedInternalAnalyticsEventSource,
  parsePersonTraits,
  PolicyCounter,
  PostgresAnalyticsClient,
  PostgresAnalyticsStoreLive,
  ProcessorProjectRepository,
  type CapturedTransportRecord,
  type ClickHouseAnalyticsClientShape,
  type ClickHouseStatement,
  type PostgresAnalyticsClientShape,
  type PostgresStatement,
} from "@voidhash/core-v2";
import { createClient } from "@clickhouse/client-web";
import {
  PersonIdentityService,
  type IdentifyDistinctIdInput,
  type PersonIdentityEventV1,
  type PersonIdentityResult,
  type PersonSnapshotEventV1,
  type ResolveDistinctIdInput,
} from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { AuthSession } from "@voidhash/rpc";
import { Crypto, DateTime, Duration, Effect, Layer, PlatformError } from "effect";

const portError = (message: string) => (cause: unknown) =>
  new AnalyticsPortError({ cause, message });

/** Web Crypto implementation shared by Workers, Bun, and modern Node runtimes. */
export const WebCryptoLive = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (algorithm, data) =>
      Effect.tryPromise({
        try: () => globalThis.crypto.subtle.digest(algorithm, Uint8Array.from(data)),
        catch: (cause) =>
          PlatformError.systemError({
            _tag: "Unknown",
            cause,
            method: "digest",
            module: "WebCrypto",
          }),
      }).pipe(Effect.map((value) => new Uint8Array(value))),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  }),
);

const PostgresAnalyticsClientLive = Layer.effect(
  PostgresAnalyticsClient,
  Effect.gen(function* () {
    const db = yield* Db;
    return {
      query: <Row extends object>(statement: PostgresStatement) =>
        db.$client.unsafe<Row>(statement.text, statement.values),
    } satisfies PostgresAnalyticsClientShape;
  }),
);

const PostgresStoreLive = PostgresAnalyticsStoreLive.pipe(
  Layer.provide(PostgresAnalyticsClientLive),
);

const AnalyticsAuthorizerLive = Layer.succeed(AnalyticsAuthorizer, {
  organizationProjects: (organizationId) =>
    Effect.gen(function* () {
      const session = yield* AuthSession;
      const organization = session.organizations.find(
        (candidate) => candidate.id === organizationId,
      );
      if (!organization?.permissions.includes("organization:all")) {
        return yield* new AnalyticsAuthorizationDeniedError({
          message: "not authorized to query organization analytics",
        });
      }
      return session.projects
        .filter((project) => project.organizationId === organizationId)
        .map((project) => project.id);
    }),
  requireProject: (projectId) =>
    Effect.gen(function* () {
      const session = yield* AuthSession;
      const project = session.projects.find((candidate) => candidate.id === projectId);
      if (!project?.permissions.includes("project:all")) {
        return yield* new AnalyticsAuthorizationDeniedError({
          message: "not authorized to query project analytics",
        });
      }
    }),
});

const CaptureCredentialRepositoryLive = Layer.effect(
  CaptureCredentialRepository,
  Effect.gen(function* () {
    const db = yield* Db;
    return CaptureCredentialRepository.of({
      resolve: ({ isPublic, lookupKey }) =>
        Effect.gen(function* () {
          const [record] = yield* db
            .select({ organizationId: projects.organizationId, projectId: apiKeys.projectId })
            .from(apiKeys)
            .innerJoin(projects, eq(projects.id, apiKeys.projectId))
            .where(and(eq(apiKeys.isPublic, isPublic), eq(apiKeys.key, lookupKey)))
            .limit(1);
          if (!record) return undefined;
          const [policy] = yield* db
            .select({
              builtinEventOverrides: captureProjectPolicies.builtinEventOverrides,
              customEventBlocklist: captureProjectPolicies.customEventBlocklist,
              eventsPerDay: captureProjectPolicies.eventsPerDay,
              ingestEnabled: captureProjectPolicies.ingestEnabled,
              requestsPerMinute: captureProjectPolicies.requestsPerMinute,
            })
            .from(captureProjectPolicies)
            .where(eq(captureProjectPolicies.projectId, record.projectId))
            .limit(1);
          return {
            organizationId: record.organizationId,
            projectId: record.projectId,
            policy: {
              admission: policy ?? emptyEventAdmissionPolicy,
              eventsPerDay: policy?.eventsPerDay ?? undefined,
              ingestEnabled: policy?.ingestEnabled ?? true,
              projectId: record.projectId,
              requestsPerMinute: policy?.requestsPerMinute ?? undefined,
            },
          };
        }).pipe(Effect.mapError(portError("capture project lookup failed"))),
    });
  }),
);

const ProcessorProjectRepositoryLive = Layer.effect(
  ProcessorProjectRepository,
  Effect.gen(function* () {
    const db = yield* Db;
    return ProcessorProjectRepository.of({
      resolve: (event) =>
        Effect.gen(function* () {
          const trusted = isTrustedInternalAnalyticsEventSource({
            eventName: event.event,
            sourceTopic: event.sourceTopic,
            trustClass: event.trustClass,
          });
          let records: ReadonlyArray<{
            readonly organizationId: string;
            readonly projectId: string;
          }>;
          if (trusted) {
            records = yield* db
              .select({ organizationId: projects.organizationId, projectId: projects.id })
              .from(projects)
              .where(eq(projects.id, event.projectId))
              .limit(1);
          } else {
            records = yield* db
              .select({ organizationId: projects.organizationId, projectId: apiKeys.projectId })
              .from(apiKeys)
              .innerJoin(projects, eq(projects.id, apiKeys.projectId))
              .where(
                and(
                  eq(apiKeys.isPublic, event.token.startsWith("vh_pk_")),
                  eq(apiKeys.key, event.token),
                ),
              )
              .limit(1);
          }
          const record = records[0];
          if (!record) return undefined;
          const [policy] = yield* db
            .select({
              builtinEventOverrides: captureProjectPolicies.builtinEventOverrides,
              customEventBlocklist: captureProjectPolicies.customEventBlocklist,
              processorEnabled: captureProjectPolicies.processorEnabled,
            })
            .from(captureProjectPolicies)
            .where(eq(captureProjectPolicies.projectId, record.projectId))
            .limit(1);
          let admission = emptyEventAdmissionPolicy;
          if (policy) {
            admission = {
              builtinEventOverrides: policy.builtinEventOverrides,
              customEventBlocklist: policy.customEventBlocklist,
            };
          }
          return {
            organizationId: record.organizationId,
            policy: {
              admission,
              processorEnabled: policy?.processorEnabled ?? true,
            },
            projectId: record.projectId,
          };
        }).pipe(Effect.mapError(portError("processor project lookup failed"))),
    });
  }),
);

const firstString = (...values: ReadonlyArray<unknown>) =>
  values.find((value): value is string => typeof value === "string");

const personEvent = (event: PersonSnapshotEventV1) => ({
  changedAt: event.changedAt,
  personId: event.personId,
  ...(event.email && { email: event.email }),
  isArchived: event.isArchived,
  ...(event.mergedIntoPersonId && { mergedIntoPersonId: event.mergedIntoPersonId }),
  ...(event.name && { name: event.name }),
  ...(event.primaryDistinctId && { primaryDistinctId: event.primaryDistinctId }),
  projectId: event.projectId,
  schemaVersion: event.schemaVersion,
  traits: event.traits,
  version: event.version,
});

const identityEvent = (identityDistinctId: string, event: PersonIdentityEventV1) => {
  let previousDistinctId = event.previousDistinctId;
  if (!previousDistinctId && event.distinctId !== identityDistinctId) {
    previousDistinctId = event.distinctId;
  }
  let distinctId = event.distinctId;
  if (previousDistinctId) distinctId = identityDistinctId;
  return {
    changedAt: event.changedAt,
    personId: event.personId,
    distinctId,
    isDeleted: event.isDeleted,
    ...(previousDistinctId && { previousDistinctId }),
    projectId: event.projectId,
    schemaVersion: event.schemaVersion,
    version: event.version,
  };
};

const identityResolution = (result: PersonIdentityResult) => ({
  identity: result.identity,
  personEvents: result.personEvents.map(personEvent),
  personIdentityEvents: result.mappingEvents.map((event) =>
    identityEvent(result.identity.distinctId, event),
  ),
});

type IdentityCall =
  | {
      readonly kind: "identify";
      readonly input: IdentifyDistinctIdInput;
    }
  | {
      readonly kind: "resolve";
      readonly input: ResolveDistinctIdInput;
    };

const makeIdentityCall = (record: typeof CapturedTransportRecord.Type) => {
  const event = record.capturedEvent;
  const properties = extractInnerProperties(event.properties);
  const traits = parsePersonTraits(properties);
  if (!traits.ok) {
    return Effect.fail(new AnalyticsPortError({ cause: traits.message, message: traits.message }));
  }
  const name = firstString(traits.value.set.name, traits.value.setOnce.name);
  const email = firstString(traits.value.set.email, traits.value.setOnce.email);
  const setAttributes = Object.fromEntries(
    Object.entries(traits.value.set).filter(([key]) => key !== "email" && key !== "name"),
  );
  const setOnceAttributes = Object.fromEntries(
    Object.entries(traits.value.setOnce).filter(([key]) => key !== "email" && key !== "name"),
  );
  const common = {
    distinctId: event.distinctId,
    email,
    eventId: event.clientEventId ?? event.captureId,
    eventTimestamp: DateTime.toDateUtc(DateTime.makeUnsafe(event.eventTimestamp)),
    name,
    projectId: event.projectId,
    setAttributes,
    setOnceAttributes,
  };
  if (event.event === "$identify") {
    return Effect.succeed({
      kind: "identify",
      input: { ...common, previousDistinctId: String(properties.$previous_distinct_id) },
    } satisfies IdentityCall);
  }
  const configured = event.properties.$process_person_profile;
  let shouldCreatePerson = !event.distinctId.startsWith("vh:anon:");
  if (typeof configured === "boolean") shouldCreatePerson = configured;
  return Effect.succeed({
    kind: "resolve",
    input: {
      ...common,
      shouldCreatePerson,
    },
  } satisfies IdentityCall);
};

const AnalyticsIdentityResolverLive = Layer.effect(
  AnalyticsIdentityResolver,
  Effect.gen(function* () {
    const identities = yield* PersonIdentityService;
    const db = yield* Db;
    return AnalyticsIdentityResolver.of({
      resolve: (record) =>
        Effect.gen(function* () {
          const call = yield* makeIdentityCall(record);
          let result: PersonIdentityResult;
          if (call.kind === "identify") {
            result = yield* identities
              .identifyDistinctId(call.input)
              .pipe(Effect.provideService(Db, db));
          } else {
            result = yield* identities
              .resolveDistinctId(call.input)
              .pipe(Effect.provideService(Db, db));
          }
          return identityResolution(result);
        }).pipe(Effect.mapError(portError("identity resolution failed"))),
    });
  }),
);

const AnalyticsDeadLetterStoreLive = Layer.effect(
  AnalyticsDeadLetterStore,
  Effect.gen(function* () {
    const db = yield* Db;
    return AnalyticsDeadLetterStore.of({
      write: (events) => {
        if (events.length === 0) return Effect.void;
        return db
          .insert(analyticsIngestDlq)
          .values(
            events.map((event) => ({
              attemptCount: 0,
              captureId: event.captureId,
              distinctId: event.distinctId,
              failureClass: event.failureClass,
              failureMessage: event.failureMessage,
              id: event.failureId,
              payloadJson: event,
              projectId: event.projectId ?? "unknown",
              sourceSequence: Number(event.sourceOffset) || 0,
              sourceShard: `${event.sourceTopic}:${event.sourcePartition}`,
            })),
          )
          .onConflictDoNothing()
          .pipe(
            Effect.asVoid,
            Effect.mapError(portError("failed to persist analytics dead letter")),
          );
      },
    });
  }),
);

/** Database-backed application ports shared by PostgreSQL and ClickHouse runtimes. */
export const AnalyticsDbPortsLive = Layer.mergeAll(
  AnalyticsAuthorizerLive,
  AnalyticsDeadLetterStoreLive,
  AnalyticsIdentityResolverLive,
  CaptureCredentialRepositoryLive,
  ProcessorProjectRepositoryLive,
);

const PostgresAnalyticsLive = AnalyticsInlineLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      AnalyticsDbPortsLive,
      Layer.succeed(AnalyticsConfig, { edition: "oss", providerEnvironments: [1, 2] }),
      Layer.succeed(PolicyCounter, {
        checkRequest: () => Effect.succeed({ allowed: true }),
        reserveEvents: ({ count }) =>
          Effect.succeed({ commit: () => Effect.void, reserved: count }),
      }),
      PostgresStoreLive,
      WebCryptoLive,
    ),
  ),
);

/** Complete self-hosted analytics runtime. PostgreSQL is the default storage backend. */
export const makePostgresAnalyticsLive = () => PostgresAnalyticsLive;

export interface ClickHouseAnalyticsConnectionOptions {
  readonly database: string;
  readonly password: string;
  readonly url: string;
  readonly username: string;
}

export interface ClickHouseAnalyticsClientLiveOptions {
  /** Lazy one-time initializer run before the first query or insert. */
  readonly initialize?: Effect.Effect<void, unknown>;
}

/**
 * Scoped ClickHouse client that closes with its layer. An optional initializer
 * is memoized after success and invalidated after failure, so unavailable
 * infrastructure fails analytics operations without failing application boot.
 */
export const makeClickHouseAnalyticsClientLive = (
  input: ClickHouseAnalyticsConnectionOptions,
  options: ClickHouseAnalyticsClientLiveOptions = {},
) =>
  Layer.effect(
    ClickHouseAnalyticsClient,
    Effect.gen(function* () {
      const client = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createClient({
            application: "voidhash-analytics",
            database: input.database,
            password: input.password,
            url: input.url,
            username: input.username,
          }),
        ),
        (client) => Effect.promise(() => client.close()),
      );
      const [initialize, invalidate] = yield* Effect.cachedInvalidateWithTTL(
        options.initialize ?? Effect.void,
        Duration.infinity,
      );
      const ensureInitialized = initialize.pipe(
        Effect.tapError((cause) =>
          Effect.logError("ClickHouse analytics initialization failed", { cause }).pipe(
            Effect.andThen(invalidate),
          ),
        ),
      );

      return {
        insert: ({ deduplicationToken, table, values }) =>
          ensureInitialized.pipe(
            Effect.andThen(
              Effect.tryPromise(() =>
                client.insert({
                  table,
                  values: [...values],
                  format: "JSONEachRow",
                  ...(deduplicationToken && {
                    clickhouse_settings: {
                      insert_deduplication_token: deduplicationToken,
                    },
                  }),
                }),
              ).pipe(Effect.asVoid),
            ),
          ),
        query: <Row extends object>(statement: ClickHouseStatement) =>
          ensureInitialized.pipe(
            Effect.andThen(
              Effect.tryPromise(() =>
                client.query({
                  query: statement.sql,
                  query_id: statement.queryId,
                  query_params: { ...statement.params },
                  format: "JSONEachRow",
                  ...(statement.quotaKey && {
                    clickhouse_settings: { quota_key: statement.quotaKey },
                  }),
                }),
              ).pipe(Effect.flatMap((result) => Effect.tryPromise(() => result.json<Row>()))),
            ),
          ),
      } satisfies ClickHouseAnalyticsClientShape;
    }),
  );

const buildClickHouseAnalyticsLive = (input: ClickHouseAnalyticsConnectionOptions) => {
  const clientLive = makeClickHouseAnalyticsClientLive(input, {
    initialize: migrateClickHouseAnalytics(input),
  });
  return AnalyticsInlineLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        AnalyticsDbPortsLive,
        Layer.succeed(AnalyticsConfig, { edition: "oss", providerEnvironments: [1, 2] }),
        ClickHouseAnalyticsStoreLive.pipe(Layer.provide(clientLive)),
        Layer.succeed(PolicyCounter, {
          checkRequest: () => Effect.succeed({ allowed: true }),
          reserveEvents: ({ count }) =>
            Effect.succeed({ commit: () => Effect.void, reserved: count }),
        }),
        WebCryptoLive,
      ),
    ),
  );
};

const ClickHouseAnalyticsLiveCache = new Map<
  string,
  ReturnType<typeof buildClickHouseAnalyticsLive>
>();

/** Complete self-hosted analytics runtime backed by an operator-managed ClickHouse cluster. */
export const makeClickHouseAnalyticsLive = (input: ClickHouseAnalyticsConnectionOptions) => {
  const key = [input.url, input.database, input.username, input.password]
    .map((value) => `${value.length}:${value}`)
    .join("");
  const cached = ClickHouseAnalyticsLiveCache.get(key);
  if (cached) return cached;
  const live = buildClickHouseAnalyticsLive(input);
  ClickHouseAnalyticsLiveCache.set(key, live);
  return live;
};

/** Create the idempotent analytics tables in an operator-managed ClickHouse database. */
export const migrateClickHouseAnalytics = (input: {
  readonly database: string;
  readonly password: string;
  readonly url: string;
  readonly username: string;
}) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      createClient({
        application: "voidhash-analytics-migrations",
        database: input.database,
        password: input.password,
        url: input.url,
        username: input.username,
      }),
    ),
    (client) =>
      Effect.forEach(
        CLICKHOUSE_ANALYTICS_MIGRATIONS.flatMap((migration) => migration.statements),
        (query) => Effect.tryPromise(() => client.command({ query })),
        { discard: true },
      ),
    (client) => Effect.promise(() => client.close()),
  );
