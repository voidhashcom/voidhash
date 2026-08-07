/**
 * Integration tests for {@link SdkService}, the orchestration hub for every
 * public SDK route. They run against the real backend stack provisioned once by
 * `test/_testing/globalSetup.ts` (live PlanetScale DB + ClickHouse + WorkOS;
 * only the project schema cache is an in-memory stub).
 *
 * `SdkService` owns no domain logic — it composes `PersonIdentityService`,
 * `PerkGrantService`, `PurchaseService`, `AppStorePaymentProviderService` and
 * the pure snapshot-builder. So these tests provide each collaborator's *real*
 * layer (all of which bottom out at harness services) plus
 * `IdentityProjectionPublisher.noop` (analytics fan-out is a no-op here).
 *  - `AppStorePaymentProviderService` is itself a stub tag in core (the Apple
 *    REST client / reconcile workflows live in `internal/`), so its layer is
 *    provided per-test to exercise both the success and failure branches of
 *    `submitPurchaseTransaction`.
 *
 * Conventions mirror `PerkService.integration.test.ts`:
 *  - The shared fixture project ({@link CoreTestFixture}) is reused; every test
 *    seeds its own persons / identities under it and removes them on exit via
 *    {@link withCleanup}. Distinct ids are namespaced + unique per call so a
 *    leftover row from a crashed run can't collide, and assertions stay
 *    membership-based.
 *  - SDK callers authenticate with a `publishable-key` session
 *    ({@link sdkSession}) carrying only `project:read`; the service elevates it
 *    internally for the `project:all`-gated delegated reads. `authenticate`
 *    comes only from {@link CoreAuthSession}.
 *  - Typed failures are asserted with `Effect.flip` + `instanceof`, paired with
 *    a DB-state assertion on the failure path.
 */
import { DateTime, Effect, Layer } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseService,
  SdkService,
  SdkServiceError,
} from "@voidhash/core/services";
import {
  type AppStoreSdkTransactionResult,
  AppStorePaymentProviderService,
  AppStorePaymentProviderServiceError,
} from "@voidhash/core/services/paymentProviders/AppStorePaymentProviderService";
import { GooglePlayPaymentProviderService } from "@voidhash/core/services/paymentProviders/GooglePlayPaymentProviderService";
import { AuthenticationError, type PublishableKeySession } from "@voidhash/core/domain/auth/Auth";
import {
  SdkPersonNotFoundError,
  SdkValidationError,
} from "@voidhash/core/domain/sdkPerson/SdkPerson";
import {
  Db,
  PersonIdentityKind,
  PersonOrigin,
  and,
  eq,
  inArray,
  personIdentities,
  personIdentityMigrationJobs,
  persons,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Wall-clock helper — the `DateTime` equivalent of `nowMillis()`. */
const nowMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());

/** Monotonic counter so distinct ids stay unique even within the same millisecond. */
let seq = 0;
const uniqueDistinctId = (label: string) => `it-sdk-${label}-${nowMillis()}-${seq++}`;
/** Anonymous distinct ids carry the SDK's `vh:anon:` prefix. */
const uniqueAnonId = (label: string) => `vh:anon:${uniqueDistinctId(label)}`;

// =============================================================================
// Collaborator wiring
// =============================================================================

/**
 * `AppStorePaymentProviderService` stub. The real Apple-backed implementation
 * lives in `internal/` and needs a signed JWS payload + REST client we don't
 * have in-process, so the boundary is faked at the tag level (core ships only
 * the abstract tag). `result` lets a test return a `personId` or fail with the
 * service's catch-all error.
 */
const appStoreStub = (
  result: () => Effect.Effect<AppStoreSdkTransactionResult, AppStorePaymentProviderServiceError>,
) =>
  Layer.succeed(AppStorePaymentProviderService, {
    acceptServerNotification: () =>
      Effect.die(new Error("acceptServerNotification not used in SdkService tests")),
    processSdkTransaction: result,
  });

/**
 * Full layer the SdkService-under-test needs: the service itself plus every
 * real collaborator (each bottoms out at harness `Db`/`AuthSession`).
 * `AppStorePaymentProviderService` is layered in per-test.
 */
/**
 * `GooglePlayPaymentProviderService` stub. SdkService now resolves this tag on
 * the Android purchase-submission path; these tests only exercise the Apple
 * path, so the stub dies if invoked.
 */
const googlePlayStub = Layer.succeed(GooglePlayPaymentProviderService, {
  acceptRtdnNotification: () =>
    Effect.die(new Error("acceptRtdnNotification not used in SdkService tests")),
  processSdkTransaction: () =>
    Effect.die(new Error("Google Play stub must not be called in these tests")),
});

const sdkLayer = (appStore: Layer.Layer<AppStorePaymentProviderService>) =>
  SdkService.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        PerkGrantService.layer,
        PurchaseService.layer,
        PersonIdentityService.layer.pipe(Layer.provide(IdentityProjectionPublisher.noop)),
        // SdkService itself now resolves the publisher (for the synchronous
        // person-attribute ClickHouse projection); tests use the no-op.
        IdentityProjectionPublisher.noop,
        appStore,
        googlePlayStub,
      ),
    ),
  );

/** SdkService layer with an App Store stub that should never be invoked. */
const sdkLayerNoAppStore = sdkLayer(
  appStoreStub(() => Effect.die(new Error("App Store stub must not be called"))),
);

// =============================================================================
// Auth sessions
// =============================================================================

/**
 * Realistic SDK principal: a `publishable-key` session bound to one distinct id
 * and carrying only `project:read` for the fixture project — exactly what
 * `bridgeAuthSession` hands `SdkService` upstream. The service elevates this to
 * `project:all` internally for the delegated reads.
 */
const sdkSession = (distinctId: string): PublishableKeySession => ({
  cookie: null,
  method: "publishable-key",
  name: "Integration SDK Client",
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:read"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: { distinctId },
  projects: [
    {
      id: CoreTestFixture.projectId,
      logo: null,
      name: CoreTestFixture.projectName,
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:read"],
      slug: CoreTestFixture.projectSlug,
    },
  ],
  user: null,
});

/** SDK session with a distinct id but no project granted — the no-access path. */
const sdkSessionWithoutProjectAccess = (distinctId: string): PublishableKeySession => ({
  ...sdkSession(distinctId),
  organizations: [],
  projects: [],
});

// =============================================================================
// Direct DB seed / read helpers (bypass the service)
// =============================================================================

/** Insert a person row under the fixture project; returns its id. */
const insertPerson = (
  id: string,
  overrides: { readonly email?: string | null; readonly name?: string | null } = {},
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(persons).values({
      email: overrides.email ?? null,
      id,
      name: overrides.name ?? null,
      origin: PersonOrigin.API,
      projectId,
    });
    return id;
  });

/** Map a distinct id to a person (anonymous or identified) under the project. */
const insertIdentity = (input: {
  readonly id: string;
  readonly distinctId: string;
  readonly personId: string;
  readonly kind: number;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(personIdentities).values({
      distinctId: input.distinctId,
      id: input.id,
      kind: input.kind,
      personId: input.personId,
      projectId,
    });
  });

/** Read a person identity row back by project + distinct id. */
const findIdentityRow = (distinctId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personIdentities.findFirst({
      where: { projectId, distinctId },
    });
  });

/** Read a person row back by id. */
const findPersonRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.persons.findFirst({ where: { id } });
  });

/** Reads a person row's JSON `traits` column as a plain record (empty when absent). */
const traitsOf = (row: { readonly traits?: unknown } | undefined): Record<string, unknown> => {
  const traits = row?.traits;
  if (traits === null || traits === undefined) return {};
  if (typeof traits !== "object") return {};
  return Object.fromEntries(Object.entries(traits));
};

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Wrap a test body so every person / identity it creates (directly or via the
 * service) is removed afterward, regardless of how the test exits. The body
 * tracks created person ids and the distinct ids it touched; the finalizer
 * deletes identities by distinct id, migration jobs by target person, then the
 * persons themselves (FK-dependents first), each `ignore`d so a missing row
 * never turns cleanup into a failure.
 */
const withCleanup = <E, R>(
  body: (track: {
    person: (id: string) => void;
    distinctId: (id: string) => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const personIds = new Set<string>();
  const distinctIds: string[] = [];
  const noPersonIdRows: ReadonlyArray<{ personId: string }> = [];
  const cleanup = Effect.gen(function* () {
    const db = yield* Db;
    // The identify / sync flows mint persons whose ids the test never sees
    // directly; discover them from the identity rows of the distinct ids it
    // touched, so cleanup catches every person the service created too.
    if (distinctIds.length > 0) {
      const rows = yield* db
        .select({ personId: personIdentities.personId })
        .from(personIdentities)
        .where(
          and(
            eq(personIdentities.projectId, projectId),
            inArray(personIdentities.distinctId, distinctIds),
          ),
        )
        .pipe(Effect.orElseSucceed(() => noPersonIdRows));
      for (const row of rows) {
        personIds.add(row.personId);
      }
      yield* db
        .delete(personIdentities)
        .where(
          and(
            eq(personIdentities.projectId, projectId),
            inArray(personIdentities.distinctId, distinctIds),
          ),
        )
        .pipe(Effect.ignore);
    }
    const ids = [...personIds];
    if (ids.length > 0) {
      yield* db
        .delete(personIdentityMigrationJobs)
        .where(inArray(personIdentityMigrationJobs.targetPersonId, ids))
        .pipe(Effect.ignore);
      // Identity rows the service created against these persons, then the
      // persons themselves (FK-dependents first).
      yield* db
        .delete(personIdentities)
        .where(inArray(personIdentities.personId, ids))
        .pipe(Effect.ignore);
      yield* db.delete(persons).where(inArray(persons.id, ids)).pipe(Effect.ignore);
    }
  });
  return body({
    distinctId: (id) => {
      distinctIds.push(id);
    },
    person: (id) => {
      personIds.add(id);
    },
  }).pipe(Effect.ensuring(cleanup));
};

// =============================================================================
// getPerson
// =============================================================================

describe("SdkService.getPerson", () => {
  // `getPerson` looks up the canonical person by the *session's* distinct id
  // (`session.person.distinctId`), so the seeded identity mapping and the
  // authenticated session must share one distinct id. Capture it (and the
  // derived person ids) once, outside the lazy test body, so the eagerly-built
  // `sdkSession(...)` in the `.pipe()` and the in-body seed agree.
  const getHappyDistinctId = uniqueDistinctId("get-happy");
  const getHappyPersonId = `person_${getHappyDistinctId}`;

  test(
    "returns a snapshot for the canonical person mapped to the session distinct id",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.person(getHappyPersonId);
        track.distinctId(getHappyDistinctId);

        yield* insertPerson(getHappyPersonId, { email: "get@voidhash.test", name: "Getter" });
        yield* insertIdentity({
          distinctId: getHappyDistinctId,
          id: `person_dist_${getHappyDistinctId}`,
          kind: PersonIdentityKind.Identified,
          personId: getHappyPersonId,
        });

        const snapshot = yield* sdk.getPerson();
        expect(snapshot.personId).toBe(getHappyPersonId);
        expect(snapshot.distinctId).toBe(getHappyDistinctId);
        expect(snapshot.email).toBe("get@voidhash.test");
        expect(snapshot.name).toBe("Getter");
        // No subscriptions / purchases / grants seeded → empty histories.
        expect(snapshot.subscriptions.history.length).toBe(0);
        expect(snapshot.purchases.history.length).toBe(0);
        expect(snapshot.entitlements.grants.length).toBe(0);
        expect(snapshot.snapshotContext.mode).toBe("persisted");
        expect(snapshot.snapshotContext.includedPersonIds).toContain(getHappyPersonId);
      }),
    ).pipe(Effect.provide(sdkLayerNoAppStore), (effect) =>
      CoreAuthSession.authenticate(sdkSession(getHappyDistinctId))(effect),
    ),
  );

  const getMergeDistinctId = uniqueDistinctId("get-merge");
  const getMergeOldPersonId = `person_old_${getMergeDistinctId}`;
  const getMergeSurvivorPersonId = `person_new_${getMergeDistinctId}`;

  test(
    "follows merged-into chains to the surviving canonical person",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.person(getMergeOldPersonId);
        track.person(getMergeSurvivorPersonId);
        track.distinctId(getMergeDistinctId);

        yield* insertPerson(getMergeSurvivorPersonId, { name: "Survivor" });
        yield* insertPerson(getMergeOldPersonId, { name: "Merged Away" });
        // Point the old person at the survivor and map the distinct id to the old one.
        const db = yield* Db;
        yield* db
          .update(persons)
          .set({ mergedIntoPersonId: getMergeSurvivorPersonId })
          .where(eq(persons.id, getMergeOldPersonId));
        yield* insertIdentity({
          distinctId: getMergeDistinctId,
          id: `person_dist_${getMergeDistinctId}`,
          kind: PersonIdentityKind.Identified,
          personId: getMergeOldPersonId,
        });

        const snapshot = yield* sdk.getPerson();
        expect(snapshot.personId).toBe(getMergeSurvivorPersonId);
        expect(snapshot.name).toBe("Survivor");
      }),
    ).pipe(Effect.provide(sdkLayerNoAppStore), (effect) =>
      CoreAuthSession.authenticate(sdkSession(getMergeDistinctId))(effect),
    ),
  );

  test(
    "fails with SdkValidationError when the session carries no distinct id",
    // A `user` session has `person: null`, so no distinct id is present.
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(sdk.getPerson());
      expect(error).toBeInstanceOf(SdkValidationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      // Default fixture session is a `user` session (person: null).
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with AuthenticationError when the session grants no project",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(sdk.getPerson());
      expect(error).toBeInstanceOf(AuthenticationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(
        sdkSessionWithoutProjectAccess(uniqueDistinctId("get-noaccess")),
      ),
    ),
  );

  test(
    "fails with SdkPersonNotFoundError when no person is mapped to the distinct id",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(sdk.getPerson());
      expect(error).toBeInstanceOf(SdkPersonNotFoundError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(uniqueDistinctId("get-missing"))),
    ),
  );
});

// =============================================================================
// identifyPerson
// =============================================================================

describe("SdkService.identifyPerson", () => {
  // The session's distinct id IS the (anonymous) source `previousDistinctId`
  // that identify promotes — captured outside so the session and assertions
  // share the same value.
  const anonSourceDistinctId = uniqueAnonId("identify-src");
  const identifyTargetDistinctId = uniqueDistinctId("identify-dst");

  test(
    "promotes an anonymous source to a new identified distinct id and persists the mapping",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.distinctId(anonSourceDistinctId);
        track.distinctId(identifyTargetDistinctId);

        // identifyDistinctId lazily mints the canonical person for the target
        // (and the source) — no pre-seed needed.
        const snapshot = yield* sdk.identifyPerson({
          distinctId: identifyTargetDistinctId,
          email: "identified@voidhash.test",
          name: "Identified",
          traits: { plan: "pro" },
        });
        track.person(snapshot.personId);

        expect(snapshot.distinctId).toBe(identifyTargetDistinctId);
        expect(snapshot.personId.startsWith("person_")).toBe(true);

        // The identify wrote a target identity mapping for the new distinct id.
        const targetIdentity = yield* findIdentityRow(identifyTargetDistinctId);
        expect(targetIdentity).toBeDefined();
        expect(targetIdentity?.personId).toBe(snapshot.personId);
        expect(targetIdentity?.kind).toBe(PersonIdentityKind.Identified);

        // The anonymous source distinct id was re-parented onto the surviving
        // person synchronously in the identify transaction (no async migration
        // job in the order-agnostic design).
        const sourceIdentity = yield* findIdentityRow(anonSourceDistinctId);
        expect(sourceIdentity).toBeDefined();
        expect(sourceIdentity?.personId).toBe(snapshot.personId);
      }),
    ).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(anonSourceDistinctId)),
    ),
  );

  test(
    "is a no-op returning the target snapshot when the source is already identified",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        // Source session distinct id is identified (non-anonymous) and target
        // already exists → already-identified no-op returning the target snapshot.
        const targetDistinctId = uniqueDistinctId("identify-existing");
        const targetPersonId = `person_${targetDistinctId}`;
        track.person(targetPersonId);
        track.distinctId(targetDistinctId);
        yield* insertPerson(targetPersonId, { name: "Existing Target" });
        yield* insertIdentity({
          distinctId: targetDistinctId,
          id: `person_dist_${targetDistinctId}`,
          kind: PersonIdentityKind.Identified,
          personId: targetPersonId,
        });

        const snapshot = yield* sdk.identifyPerson({
          distinctId: targetDistinctId,
          email: null,
          name: null,
        });
        expect(snapshot.personId).toBe(targetPersonId);
        expect(snapshot.distinctId).toBe(targetDistinctId);
      }),
    ).pipe(
      // Session distinct id is non-anonymous → "already identified" branch.
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(uniqueDistinctId("identify-existing-src"))),
    ),
  );

  test(
    "fails with SdkPersonNotFoundError when an identified source targets an unknown distinct id",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.identifyPerson({
          distinctId: uniqueDistinctId("identify-unknown-target"),
          email: null,
          name: null,
        }),
      );
      expect(error).toBeInstanceOf(SdkPersonNotFoundError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      // Non-anonymous session distinct id with an unmapped target.
      CoreAuthSession.authenticate(sdkSession(`it-sdk-identify-srcid-${nowMillis()}-z`)),
    ),
  );

  test(
    "fails with SdkValidationError when the identify target uses the anonymous prefix",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.identifyPerson({
          distinctId: uniqueAnonId("identify-bad-target"),
          email: null,
          name: null,
        }),
      );
      expect(error).toBeInstanceOf(SdkValidationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      // Anonymous session source so we reach the target-prefix validation.
      CoreAuthSession.authenticate(sdkSession(uniqueAnonId("identify-src2"))),
    ),
  );

  test(
    "fails with AuthenticationError when the session grants no project",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.identifyPerson({
          distinctId: uniqueDistinctId("identify-noaccess-target"),
          email: null,
          name: null,
        }),
      );
      expect(error).toBeInstanceOf(AuthenticationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(
        sdkSessionWithoutProjectAccess(uniqueAnonId("identify-noaccess")),
      ),
    ),
  );

  vitestTest.todo(
    "identifyPerson: conflicting-identified warning from PersonIdentityService maps to SdkPersonAlreadyIdentifiedError — deferred: reproducing the 'different identified person' warning requires seeding a previousDistinctId already mapped to a *second* identified person and racing the identify transaction; the precise warning text is an internal contract of PersonIdentityService / IdentityMutationService better asserted in a PersonIdentityService integration test, then exercised end-to-end here once that seam is stable.",
  );

  vitestTest.todo(
    "identifyPerson: delegated PerkGrantService/PurchaseService failure is caught and wrapped in SdkServiceError — deferred: the collaborators run against the real DB and cannot be made to fail without a hand-rolled fault-injecting double (forbidden at the integration tier); the catchTags wrapping is covered structurally and would need a unit-level fault layer to assert.",
  );
});

// =============================================================================
// syncPersonAttributes
// =============================================================================

const personMetadata = (distinctId: string) =>
  constant({
    clientBundleId: "com.voidhash.test",
    distinctId,
    isBackgrounded: "false",
    isDebugBuild: "false",
    observerMode: "false",
    platform: "ios",
    platformFlavor: "native",
    publishableKey: "pk_test",
    sdk: "react-native",
    sdkVersion: "1.0.0",
  });

describe("SdkService.syncPersonAttributes", () => {
  // `syncPersonAttributes` resolves the *session's* distinct id (the metadata
  // distinct id is informational), so the session and the asserted id match.
  const syncAnonDistinctId = uniqueAnonId("sync-anon");

  test(
    "resolves an anonymous person, persists the identity, and returns a snapshot + identity result",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.distinctId(syncAnonDistinctId);

        const result = yield* sdk.syncPersonAttributes({
          email: "sync@voidhash.test",
          name: "Synced",
          personMetadata: personMetadata(syncAnonDistinctId),
          traits: { tier: "gold" },
        });
        track.person(result.snapshot.personId);

        expect(result.snapshot.distinctId).toBe(syncAnonDistinctId);
        expect(result.identityResult.identity.distinctId).toBe(syncAnonDistinctId);
        expect(result.identityResult.identity.personId).toBe(result.snapshot.personId);

        // resolveDistinctId(shouldCreatePerson: true) wrote an identity mapping.
        const identity = yield* findIdentityRow(syncAnonDistinctId);
        expect(identity).toBeDefined();
        expect(identity?.personId).toBe(result.snapshot.personId);

        // Platform metadata merged into the new person's traits.
        const personRow = yield* findPersonRow(result.snapshot.personId);
        expect(personRow).toBeDefined();
        expect(traitsOf(personRow).platform).toBe("ios");
        expect(traitsOf(personRow).tier).toBe("gold");
      }),
    ).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(syncAnonDistinctId)),
    ),
  );

  const syncIdentifiedDistinctId = uniqueDistinctId("sync-identified");
  const syncIdentifiedPersonId = `person_${syncIdentifiedDistinctId}`;

  test(
    "syncs an existing identified person and returns the updated snapshot",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.person(syncIdentifiedPersonId);
        track.distinctId(syncIdentifiedDistinctId);
        yield* insertPerson(syncIdentifiedPersonId, { name: "Before Sync" });
        yield* insertIdentity({
          distinctId: syncIdentifiedDistinctId,
          id: `person_dist_${syncIdentifiedDistinctId}`,
          kind: PersonIdentityKind.Identified,
          personId: syncIdentifiedPersonId,
        });

        const result = yield* sdk.syncPersonAttributes({
          name: "After Sync",
          personMetadata: personMetadata(syncIdentifiedDistinctId),
          traits: { device: "phone" },
        });
        expect(result.snapshot.personId).toBe(syncIdentifiedPersonId);
        expect(result.snapshot.distinctId).toBe(syncIdentifiedDistinctId);

        const personRow = yield* findPersonRow(syncIdentifiedPersonId);
        expect(traitsOf(personRow).device).toBe("phone");
      }),
    ).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(syncIdentifiedDistinctId)),
    ),
  );

  test(
    "fails with SdkPersonNotFoundError when an identified distinct id has no person",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const distinctId = uniqueDistinctId("sync-unknown");
      const error = yield* Effect.flip(
        sdk.syncPersonAttributes({
          personMetadata: personMetadata(distinctId),
        }),
      );
      expect(error).toBeInstanceOf(SdkPersonNotFoundError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(`it-sdk-sync-unknown-${nowMillis()}-v`)),
    ),
  );

  test(
    "fails with SdkValidationError when the session carries no distinct id",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.syncPersonAttributes({
          personMetadata: personMetadata(uniqueDistinctId("sync-nodistinct")),
        }),
      );
      expect(error).toBeInstanceOf(SdkValidationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      // `user` session → person: null.
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with AuthenticationError when the session grants no project",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const distinctId = uniqueAnonId("sync-noaccess");
      const error = yield* Effect.flip(
        sdk.syncPersonAttributes({
          personMetadata: personMetadata(distinctId),
        }),
      );
      expect(error).toBeInstanceOf(AuthenticationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSessionWithoutProjectAccess(uniqueAnonId("sync-noaccess"))),
    ),
  );

  // Person-on-demand: an empty payload (as the removed init-time auto-sync used
  // to send) must NOT materialize a person and must surface a clean validation
  // error rather than dying or creating an empty row.
  const syncEmptyAnonId = uniqueAnonId("sync-empty");
  test(
    "fails with SdkValidationError and creates no person for an empty payload on an anonymous id",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.distinctId(syncEmptyAnonId);
        const error = yield* Effect.flip(
          sdk.syncPersonAttributes({ personMetadata: personMetadata(syncEmptyAnonId) }),
        );
        expect(error).toBeInstanceOf(SdkValidationError);
        const identity = yield* findIdentityRow(syncEmptyAnonId);
        expect(identity?.personId ?? null).toBeNull();
      }),
    ).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(syncEmptyAnonId)),
    ),
  );

  // `$set_once` is earliest-wins: a later sync for the same key must not win.
  const syncSetOnceAnonId = uniqueAnonId("sync-setonce");
  test(
    "applies setOnce attributes with earliest-wins semantics",
    withCleanup((track) =>
      Effect.gen(function* () {
        const sdk = yield* SdkService;
        track.distinctId(syncSetOnceAnonId);
        const first = yield* sdk.syncPersonAttributes({
          personMetadata: personMetadata(syncSetOnceAnonId),
          setOnce: { signupSource: "organic" },
        });
        track.person(first.snapshot.personId);
        yield* sdk.syncPersonAttributes({
          personMetadata: personMetadata(syncSetOnceAnonId),
          setOnce: { signupSource: "paid" },
        });
        const personRow = yield* findPersonRow(first.snapshot.personId);
        expect(traitsOf(personRow).signupSource).toBe("organic");
      }),
    ).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(syncSetOnceAnonId)),
    ),
  );
});

// =============================================================================
// submitPurchaseTransaction
// =============================================================================

describe("SdkService.submitPurchaseTransaction", () => {
  // Capture a stable id graph once so the App Store stub and the seeded rows
  // agree without depending on mutation order of the `seq` counter.
  const submitDistinctId = uniqueDistinctId("submit-apple");
  const submitPersonId = `person_submit_${submitDistinctId}`;

  test(
    "submits a valid Apple transaction and returns the resulting person snapshot",
    withCleanup((track) =>
      Effect.gen(function* () {
        track.person(submitPersonId);
        track.distinctId(submitDistinctId);
        yield* insertPerson(submitPersonId, { name: "Buyer" });
        yield* insertIdentity({
          distinctId: submitDistinctId,
          id: `person_dist_${submitDistinctId}`,
          kind: PersonIdentityKind.Identified,
          personId: submitPersonId,
        });

        const sdk = yield* SdkService;
        const snapshot = yield* sdk.submitPurchaseTransaction({
          bundleId: "com.voidhash.test",
          providerId: "apple-app-store",
          transactionId: "tx_123",
        });
        expect(snapshot.personId).toBe(submitPersonId);
        expect(snapshot.distinctId).toBe(submitDistinctId);
      }),
    ).pipe(
      // App Store stub resolves to the seeded person id.
      Effect.provide(sdkLayer(appStoreStub(() => Effect.succeed({ personId: submitPersonId })))),
      CoreAuthSession.authenticate(sdkSession(submitDistinctId)),
    ),
  );

  // Capture a stable id graph for the Google Play delegation test so the stub
  // and the seeded rows agree.
  const submitGoogleDistinctId = uniqueDistinctId("submit-google");
  const submitGooglePersonId = `person_submit_google_${submitGoogleDistinctId}`;

  test(
    "submits a valid Google Play transaction and returns the resulting person snapshot",
    (() => {
      let capturedInput:
        | {
            distinctId: string;
            packageName: string;
            productId: string;
            projectId: string;
            purchaseToken: string;
          }
        | undefined;
      return withCleanup((track) =>
        Effect.gen(function* () {
          track.person(submitGooglePersonId);
          track.distinctId(submitGoogleDistinctId);
          yield* insertPerson(submitGooglePersonId, { name: "Android Buyer" });
          yield* insertIdentity({
            distinctId: submitGoogleDistinctId,
            id: `person_dist_${submitGoogleDistinctId}`,
            kind: PersonIdentityKind.Identified,
            personId: submitGooglePersonId,
          });

          const sdk = yield* SdkService;
          const snapshot = yield* sdk.submitPurchaseTransaction({
            packageName: "com.voidhash.test",
            productId: "yearly_sub",
            providerId: "google-play",
            purchaseToken: "token_123",
          });
          expect(snapshot.personId).toBe(submitGooglePersonId);
          expect(snapshot.distinctId).toBe(submitGoogleDistinctId);
          expect(capturedInput).toMatchObject({
            distinctId: submitGoogleDistinctId,
            packageName: "com.voidhash.test",
            productId: "yearly_sub",
            purchaseToken: "token_123",
          });
        }),
      ).pipe(
        // Google Play stub resolves to the seeded person id; App Store stub must
        // not be called on the Android path.
        Effect.provide(
          SdkService.layer.pipe(
            Layer.provideMerge(
              Layer.mergeAll(
                PerkGrantService.layer,
                PurchaseService.layer,
                PersonIdentityService.layer.pipe(Layer.provide(IdentityProjectionPublisher.noop)),
                IdentityProjectionPublisher.noop,
                appStoreStub(() => Effect.die(new Error("App Store stub must not be called"))),
                Layer.succeed(GooglePlayPaymentProviderService, {
                  acceptRtdnNotification: () =>
                    Effect.die(new Error("acceptRtdnNotification not used in SdkService tests")),
                  processSdkTransaction: (input) => {
                    capturedInput = input;
                    return Effect.succeed({ personId: submitGooglePersonId });
                  },
                }),
              ),
            ),
          ),
        ),
        CoreAuthSession.authenticate(sdkSession(submitGoogleDistinctId)),
      );
    })(),
  );

  test(
    "fails with SdkValidationError when a Google Play submission omits purchaseToken or packageName",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.submitPurchaseTransaction({
          packageName: "com.voidhash.test",
          providerId: "google-play",
        }),
      );
      expect(error).toBeInstanceOf(SdkValidationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(uniqueDistinctId("submit-google-missing"))),
    ),
  );

  test(
    "fails with SdkValidationError when transactionId or bundleId is missing",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.submitPurchaseTransaction({
          providerId: "apple-app-store",
          transactionId: "tx_only",
        }),
      );
      expect(error).toBeInstanceOf(SdkValidationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(sdkSession(uniqueDistinctId("submit-missing"))),
    ),
  );

  test(
    "fails with SdkValidationError when the session carries no distinct id",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.submitPurchaseTransaction({
          bundleId: "com.voidhash.test",
          providerId: "apple-app-store",
          transactionId: "tx_123",
        }),
      );
      expect(error).toBeInstanceOf(SdkValidationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      // `user` session → person: null.
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with AuthenticationError when the session grants no project",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.submitPurchaseTransaction({
          bundleId: "com.voidhash.test",
          providerId: "apple-app-store",
          transactionId: "tx_123",
        }),
      );
      expect(error).toBeInstanceOf(AuthenticationError);
    }).pipe(
      Effect.provide(sdkLayerNoAppStore),
      CoreAuthSession.authenticate(
        sdkSessionWithoutProjectAccess(uniqueDistinctId("submit-noaccess")),
      ),
    ),
  );

  test(
    "wraps an AppStorePaymentProviderService failure in SdkServiceError",
    Effect.gen(function* () {
      const sdk = yield* SdkService;
      const error = yield* Effect.flip(
        sdk.submitPurchaseTransaction({
          bundleId: "com.voidhash.test",
          providerId: "apple-app-store",
          transactionId: "tx_boom",
        }),
      );
      expect(error).toBeInstanceOf(SdkServiceError);
      if (error instanceof SdkServiceError) {
        expect(error.cause).toContain("apple boom");
      }
    }).pipe(
      Effect.provide(
        sdkLayer(
          appStoreStub(() =>
            Effect.fail(new AppStorePaymentProviderServiceError({ cause: "apple boom" })),
          ),
        ),
      ),
      CoreAuthSession.authenticate(sdkSession(uniqueDistinctId("submit-fail"))),
    ),
  );
});
