import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";
import { AuthSession, AuthenticationError } from "../../domain/auth/Auth.ts";
import {
  SdkPersonAlreadyIdentifiedError,
  SdkPersonNotFoundError,
  type SdkPersonSnapshot,
  SdkValidationError,
} from "../../domain/sdkPerson/SdkPerson.ts";
import { Db, PersonOrigin, type PersonOriginValue } from "@voidhash/db";
import { isAnonymousId } from "../../utils/sdk.ts";
import { AppStorePaymentProviderService } from "../paymentProviders/AppStorePaymentProviderService.ts";
import { GooglePlayPaymentProviderService } from "../paymentProviders/GooglePlayPaymentProviderService.ts";
import { PerkGrantService } from "../perkGrants/PerkGrantService.ts";
import { IdentityProjectionPublisher } from "../personIdentity/IdentityProjectionPublisher.ts";
import {
  type PersonIdentityResult,
  PersonIdentityService,
} from "../personIdentity/PersonIdentityService.ts";
import { PurchaseService } from "../purchases/PurchaseService.ts";
import { RequestEnvironmentMode } from "../requestEnvironment/RequestEnvironmentMode.ts";
import { elevateProjectAccess } from "./elevate-auth.ts";
import {
  ACTIVE_MIGRATION_STATUSES,
  type SubscriptionWithProduct,
  composeSnapshot,
  decideSnapshotScope,
} from "./snapshot-builder.ts";

/**
 * Per-call metadata supplied by the SDK on every `syncPersonAttributes`
 * request. Mirrors the SDK's request envelope so the service can write client
 * platform info into the person traits alongside the caller-supplied
 * application traits.
 */
export interface PersonMetadata {
  distinctId: string;
  publishableKey: string;
  platform: string;
  sdk: "react-native" | "web" | "ios" | "android";
  sdkVersion: string;
  platformFlavor: "native" | "browser";
  platformFlavorVersion?: string;
  platformVersion?: string;
  platformDevice?: string;
  platformBrand?: string;
  preferredLocales?: string;
  clientLocale?: string;
  clientVersion?: string;
  clientBundleId: string;
  observerMode: "true" | "false";
  nonce?: string;
  storefront?: string;
  isDebugBuild: "true" | "false";
  isBackgrounded: "false";
}

export interface PersonAttributesParams {
  name?: string;
  email?: string;
  personMetadata: PersonMetadata;
  /** `$set` traits — newest write wins per key. */
  traits?: Record<string, string | number | boolean | null>;
  /** `$set_once` traits — earliest write wins; loses to any `$set`. */
  setOnce?: Record<string, string | number | boolean | null>;
  /**
   * Stable client-supplied id used as the LWW tie-break (`eventId`). Lets a
   * synchronous write and its eventual async `$set` echo converge idempotently.
   */
  clientEventId?: string;
}

export interface SyncPersonAttributesResult {
  readonly snapshot: SdkPersonSnapshot;
  readonly identityResult: PersonIdentityResult;
}

/**
 * Catch-all service error. Wraps `DatabaseError`, infrastructural failures, and
 * cross-service errors at the public-method boundary so callers see one stable
 * error tag.
 */
export class SdkServiceError extends Schema.TaggedErrorClass<SdkServiceError>("SdkServiceError")(
  "SdkServiceError",
  { cause: Schema.String },
) {}

const CONFLICTING_IDENTIFIED_WARNING_FRAGMENT = "different identified person";

const eventIdPatch = (clientEventId: string | undefined): { eventId?: string } => {
  if (!clientEventId) return {};
  return { eventId: clientEventId };
};

const originFromPersonMetadata = (metadata: PersonMetadata): PersonOriginValue => {
  const platform = metadata.platform.toLowerCase();
  if (platform.includes("ios")) {
    return PersonOrigin.IOS;
  }
  if (platform.includes("android")) {
    return PersonOrigin.Android;
  }
  return PersonOrigin.API;
};

const buildSyncSetAttributes = (
  metadata: PersonMetadata,
  traits: Record<string, string | number | boolean | null> | undefined,
) => ({
  ...traits,
  platform: metadata.platform,
  sdk: metadata.sdk,
  sdkVersion: metadata.sdkVersion,
  platformFlavor: metadata.platformFlavor,
  platformFlavorVersion: metadata.platformFlavorVersion,
  platformVersion: metadata.platformVersion,
  platformDevice: metadata.platformDevice,
  platformBrand: metadata.platformBrand,
  preferredLocales: metadata.preferredLocales,
  clientLocale: metadata.clientLocale,
  clientVersion: metadata.clientVersion,
  storefront: metadata.storefront,
});

/**
 * `SdkService` is the orchestration entry point for the public SDK API
 * routes — `getPerson`, `identifyPerson`, `syncPersonAttributes`,
 * `submitPurchaseTransaction`. It owns none of the underlying domain
 * operations: it composes other services (`PersonIdentityService`,
 * `PerkGrantService`, `PurchaseService`, `AppStorePaymentProviderService`)
 * and the SDK-specific snapshot composition logic in `snapshot-builder.ts`.
 *
 * The two delegated services (`PerkGrantService.getPersonUnlockedPerks`,
 * `PurchaseService.getPersonPurchases`) require `project:all` permission
 * internally; SDK callers carry only `project:read`. The publishable-key
 * auth has already been validated upstream by `bridgeAuthSession` against
 * the requested project, so SDK provides an elevated `AuthSession` (via
 * `elevate-auth.ts`) for those delegated calls only.
 *
 * `AuthSession`, `Db`, `PerkGrantService`, `PurchaseService`,
 * `PersonIdentityService`, and `AppStorePaymentProviderService` are provided
 * by the application root.
 */
export class SdkService extends Context.Service<SdkService>()("SdkService", {
  make: Effect.gen(function* () {
    const personIdentityService = yield* PersonIdentityService;
    const perkGrantService = yield* PerkGrantService;
    const purchaseService = yield* PurchaseService;
    const identityProjectionPublisher = yield* IdentityProjectionPublisher;
    const db = yield* Db;

    const findCanonicalPersonByDistinctId = (input: {
      readonly distinctId: string;
      readonly projectId: string;
    }) =>
      Effect.gen(function* () {
        const mapping = yield* db.query.personIdentities.findFirst({
          where: { projectId: input.projectId, distinctId: input.distinctId },
        });
        if (!mapping) {
          return undefined;
        }
        let current = yield* db.query.persons.findFirst({
          where: { id: mapping.personId },
        });
        while (current?.mergedIntoPersonId) {
          const mergedIntoPerson = yield* db.query.persons.findFirst({
            where: { id: current.mergedIntoPersonId },
          });
          if (!mergedIntoPerson) {
            return current;
          }
          current = mergedIntoPerson;
        }
        return current;
      });

    /**
     * Fans out to `PerkGrantService.getPersonUnlockedPerks` per id with an
     * elevated session so the inner `project:all` check passes. Returns the
     * flattened result.
     */
    const loadGrantsForPersonIds = Effect.fn("loadGrantsForPersonIds")(function* (
      personIds: ReadonlyArray<string>,
      projectId: string,
      session: typeof AuthSession.Service,
    ) {
      yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
      yield* Effect.annotateCurrentSpan("voidhash.person.ids.count", personIds.length);
      const elevated = elevateProjectAccess(session, projectId);
      const perGroup = yield* Effect.all(
        personIds.map((personId) =>
          perkGrantService
            .getPersonUnlockedPerks(personId)
            .pipe(Effect.provideService(AuthSession, elevated)),
        ),
        { concurrency: "unbounded" },
      );
      return perGroup.flat();
    });

    /**
     * Fans out to `PurchaseService.getPersonPurchases` per id with an
     * elevated session.
     */
    const loadPurchasesForPersonIds = Effect.fn("loadPurchasesForPersonIds")(function* (
      personIds: ReadonlyArray<string>,
      projectId: string,
      session: typeof AuthSession.Service,
    ) {
      yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
      yield* Effect.annotateCurrentSpan("voidhash.person.ids.count", personIds.length);
      const elevated = elevateProjectAccess(session, projectId);
      const perGroup = yield* Effect.all(
        personIds.map((personId) =>
          purchaseService
            .getPersonPurchases(personId)
            .pipe(Effect.provideService(AuthSession, elevated)),
        ),
        { concurrency: "unbounded" },
      );
      return perGroup.flat();
    });

    const buildSnapshot = Effect.fn("buildSnapshot")(function* (input: {
      readonly projectId: string;
      readonly distinctId: string;
      readonly personId: string;
      readonly previousDistinctId?: string;
      readonly identityResult?: PersonIdentityResult;
    }) {
      const session = yield* AuthSession;
      const environmentMode = yield* RequestEnvironmentMode;

      yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
      yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
      yield* Effect.annotateCurrentSpan("voidhash.person.id", input.personId);
      if (input.previousDistinctId) {
        yield* Effect.annotateCurrentSpan(
          "voidhash.person.previous_distinct_id",
          input.previousDistinctId,
        );
      }
      const organizationId = session?.projects[0]?.organizationId;
      if (organizationId) {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
      }

      const sourceMapping = yield* Effect.gen(function* () {
        if (!input.previousDistinctId || input.previousDistinctId === input.distinctId) {
          return undefined;
        }
        return yield* db.query.personIdentities.findFirst({
          where: { projectId: input.projectId, distinctId: input.previousDistinctId },
        });
      });

      const activeJob = yield* db.query.personIdentityMigrationJobs.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          projectId: input.projectId,
          targetPersonId: input.personId,
          distinctId: input.distinctId,
          status: { in: [...ACTIVE_MIGRATION_STATUSES] },
        },
      });

      const scope = decideSnapshotScope({
        activeJob,
        distinctId: input.distinctId,
        identityResult: input.identityResult,
        personId: input.personId,
        previousDistinctId: input.previousDistinctId,
        sourceMapping,
      });

      yield* Effect.annotateCurrentSpan("voidhash.snapshot.mode", scope.mode);
      if (scope.migrationJobId) {
        yield* Effect.annotateCurrentSpan("voidhash.migration_job.id", scope.migrationJobId);
      }
      yield* Effect.annotateCurrentSpan(
        "voidhash.person.ids.count",
        scope.includedPersonIds.length,
      );

      const personRows = yield* Effect.gen(function* () {
        if (scope.includedPersonIds.length === 0) return [];
        return yield* db.query.persons.findMany({
          where: { id: { in: [...scope.includedPersonIds] } },
        });
      });
      const targetPerson = personRows.find((person) => person.id === input.personId);
      if (!targetPerson) {
        return yield* Effect.fail(
          new SdkServiceError({
            cause: `Target person ${input.personId} not found while building SDK snapshot`,
          }),
        );
      }

      const existingPersonIds = personRows.map((person) => person.id);

      const [subscriptionRows, purchaseRows, unlockedPerkRows] = yield* Effect.all(
        [
          Effect.gen(function* () {
            const empty: ReadonlyArray<SubscriptionWithProduct> = [];
            if (existingPersonIds.length === 0) return empty;
            const rows: ReadonlyArray<SubscriptionWithProduct> =
              yield* db.query.subscriptions.findMany({
                where: {
                  personId: { in: [...existingPersonIds] },
                  providerEnvironment: { in: [...environmentMode.providerEnvironments] },
                },
                with: {
                  paymentProviderConfigurationProduct: true,
                },
              });
            return rows;
          }),
          loadPurchasesForPersonIds(existingPersonIds, input.projectId, session),
          loadGrantsForPersonIds(existingPersonIds, input.projectId, session),
        ],
        { concurrency: "unbounded" },
      );

      const purchaseConfigurationProductIds = [
        ...new Set(purchaseRows.map((purchase) => purchase.paymentProviderConfigurationProductId)),
      ];
      const purchaseConfigurationProducts = yield* Effect.gen(function* () {
        if (purchaseConfigurationProductIds.length === 0) return [];
        return yield* db.query.paymentProviderConfigurationProducts.findMany({
          where: { id: { in: [...purchaseConfigurationProductIds] } },
        });
      });
      const purchaseProductIdLookup = new Map<string, string>();
      for (const product of purchaseConfigurationProducts) {
        purchaseProductIdLookup.set(product.id, product.productId);
      }

      return composeSnapshot({
        distinctId: input.distinctId,
        grants: unlockedPerkRows,
        identityResult: input.identityResult,
        now: yield* DateTime.nowAsDate,
        personId: input.personId,
        purchaseProductIdLookup,
        purchases: purchaseRows,
        scope,
        subscriptions: subscriptionRows,
        targetPerson,
      });
    });

    const getPerson = Effect.fn("getPerson")(
      function* () {
        const session = yield* AuthSession;

        const distinctId = session?.person?.distinctId;
        if (!distinctId) {
          return yield* Effect.fail(new SdkValidationError({ message: "Distinct ID not found" }));
        }

        const projectId = session?.projects[0]?.id;
        if (!projectId) {
          return yield* Effect.fail(
            new AuthenticationError({
              cause:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
              message:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
            }),
          );
        }

        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);
        const organizationId = session?.projects[0]?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }

        const canonicalPerson = yield* findCanonicalPersonByDistinctId({
          distinctId,
          projectId,
        });
        if (!canonicalPerson) {
          return yield* Effect.fail(new SdkPersonNotFoundError({ message: "Person not found" }));
        }

        yield* Effect.annotateCurrentSpan("voidhash.person.id", canonicalPerson.id);

        return yield* buildSnapshot({
          distinctId,
          personId: canonicalPerson.id,
          projectId,
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PerkGrantServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PurchaseServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PersonNotFoundError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Person ${error.id} not found while loading SDK snapshot`,
                }),
              ),
            ActionForbiddenError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Permission denied during SDK snapshot composition: ${error.message}`,
                }),
              ),
          }),
        ),
    );

    const identifyPerson = Effect.fn("identifyPerson")(
      function* (input: {
        distinctId: string;
        name: string | null;
        email: string | null;
        traits?: Record<string, string | number | boolean | null>;
      }) {
        const session = yield* AuthSession;

        const projectId = session?.projects[0]?.id;
        if (!projectId) {
          return yield* Effect.fail(
            new AuthenticationError({
              cause:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
              message:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
            }),
          );
        }

        const currentDistinctId = session?.person?.distinctId;
        if (!currentDistinctId) {
          return yield* Effect.fail(
            new AuthenticationError({
              cause: "No SDK person identity was found in the authentication session.",
              message: "No SDK person identity was found in the authentication session.",
            }),
          );
        }

        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
        yield* Effect.annotateCurrentSpan(
          "voidhash.person.previous_distinct_id",
          currentDistinctId,
        );
        const organizationId = session?.projects[0]?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }

        if (!isAnonymousId(currentDistinctId)) {
          const canonicalPerson = yield* findCanonicalPersonByDistinctId({
            distinctId: input.distinctId,
            projectId,
          });
          if (!canonicalPerson) {
            return yield* Effect.fail(
              new SdkPersonNotFoundError({
                message:
                  "Cannot identify from an already-identified person to an unknown distinct id",
              }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.person.id", canonicalPerson.id);

          yield* Effect.log(
            `identifyPerson no-op for already-identified source ${currentDistinctId}; returning snapshot for ${input.distinctId} (person ${canonicalPerson.id})`,
          );

          return yield* buildSnapshot({
            distinctId: input.distinctId,
            personId: canonicalPerson.id,
            projectId,
          });
        }

        if (isAnonymousId(input.distinctId)) {
          return yield* Effect.fail(
            new SdkValidationError({
              message: "Identify target distinct ID cannot use the anonymous prefix.",
            }),
          );
        }

        const result = yield* personIdentityService.identifyDistinctId({
          previousDistinctId: currentDistinctId,
          email: input.email ?? undefined,
          eventTimestamp: yield* DateTime.nowAsDate,
          distinctId: input.distinctId,
          name: input.name ?? undefined,
          projectId,
          setAttributes: input.traits ?? {},
          setOnceAttributes: {},
        });
        if (
          result.warnings.some((warning) =>
            warning.includes(CONFLICTING_IDENTIFIED_WARNING_FRAGMENT),
          )
        ) {
          return yield* Effect.fail(
            new SdkPersonAlreadyIdentifiedError({ distinctId: input.distinctId }),
          );
        }
        if (!result.identity.personId) {
          return yield* Effect.die(new Error("identifyDistinctId resolved without a personId"));
        }

        yield* Effect.annotateCurrentSpan("voidhash.person.id", result.identity.personId);

        yield* Effect.log(
          `Identified person ${result.identity.personId} for distinct id ${input.distinctId}`,
        );

        return yield* buildSnapshot({
          distinctId: input.distinctId,
          identityResult: result,
          personId: result.identity.personId,
          previousDistinctId: currentDistinctId,
          projectId,
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PersonServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PerkGrantServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PurchaseServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PersonNotFoundError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Person ${error.id} not found while loading SDK snapshot`,
                }),
              ),
            ActionForbiddenError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Permission denied during SDK snapshot composition: ${error.message}`,
                }),
              ),
          }),
        ),
    );

    const syncPersonAttributes = Effect.fn("syncPersonAttributes")(
      function* (input: PersonAttributesParams) {
        const session = yield* AuthSession;

        const distinctId = session?.person?.distinctId;
        if (!distinctId) {
          return yield* Effect.fail(new SdkValidationError({ message: "Distinct ID not found" }));
        }

        const projectId = session?.projects[0]?.id;
        if (!projectId) {
          return yield* Effect.fail(
            new AuthenticationError({
              cause:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
              message:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
            }),
          );
        }

        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);
        const organizationId = session?.projects[0]?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }
        yield* Effect.annotateCurrentSpan("voidhash.sdk.platform", input.personMetadata.platform);
        yield* Effect.annotateCurrentSpan("voidhash.sdk.name", input.personMetadata.sdk);
        yield* Effect.annotateCurrentSpan("voidhash.sdk.version", input.personMetadata.sdkVersion);
        if (input.personMetadata.clientBundleId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.app.bundle_id",
            input.personMetadata.clientBundleId,
          );
        }

        if (!isAnonymousId(distinctId)) {
          const existing = yield* findCanonicalPersonByDistinctId({ distinctId, projectId });
          if (!existing) {
            return yield* Effect.fail(
              new SdkPersonNotFoundError({
                message:
                  "Cannot sync attributes for an unknown identified person. Identified persons must be created through the identify flow.",
              }),
            );
          }
        }

        // `buildSyncSetAttributes` always injects platform/sdk metadata, so
        // `setAttributes` is never truly empty — guard person creation on the
        // *caller-supplied* payload instead. This keeps an attribute-less
        // request (no longer issued at SDK init) from materializing a person.
        const hasExplicitPayload =
          (input.traits && Object.keys(input.traits).length > 0) ||
          (input.setOnce && Object.keys(input.setOnce).length > 0) ||
          input.email !== undefined ||
          input.name !== undefined;

        const setAttributes = buildSyncSetAttributes(input.personMetadata, input.traits);

        const identityResult = yield* personIdentityService.resolveDistinctId({
          distinctId,
          email: input.email,
          ...eventIdPatch(input.clientEventId),
          eventTimestamp: yield* DateTime.nowAsDate,
          name: input.name,
          origin: originFromPersonMetadata(input.personMetadata),
          projectId,
          setAttributes,
          setOnceAttributes: input.setOnce ?? {},
          shouldCreatePerson: hasExplicitPayload,
        });
        if (!identityResult.identity.personId) {
          // With no explicit payload we asked `resolveDistinctId` not to create a
          // person, so an anonymous id with no prior person resolves personless.
          // There is nothing to snapshot and nothing was created — surface a
          // clean validation error instead of dying.
          if (!hasExplicitPayload) {
            return yield* Effect.fail(
              new SdkValidationError({
                message:
                  "No attributes to sync. Provide at least one of email, name, traits, or setOnce.",
              }),
            );
          }
          return yield* Effect.die(new Error("resolveDistinctId resolved without a personId"));
        }

        yield* Effect.annotateCurrentSpan("voidhash.person.id", identityResult.identity.personId);

        // Publish the identity projection after the durable person write. The
        // Community publisher is a no-op; hosted runtimes may maintain an
        // analytics-side identity model. Projection failures never roll back
        // the operational PostgreSQL write.
        yield* identityProjectionPublisher
          .publishIdentityResult({
            identity: { distinctId },
            mappingEvents: identityResult.mappingEvents,
            personEvents: identityResult.personEvents,
          })
          .pipe(
            Effect.catch((error) =>
              Effect.logError(
                "Failed to project synchronous person-attribute write to analytics; PostgreSQL is updated and a later event may retry the projection",
                { cause: error, distinctId, personId: identityResult.identity.personId, projectId },
              ),
            ),
            Effect.provideService(Db, db),
          );

        const snapshot = yield* buildSnapshot({
          distinctId,
          identityResult,
          personId: identityResult.identity.personId,
          projectId,
        });

        return { identityResult, snapshot } satisfies SyncPersonAttributesResult;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PersonServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PerkGrantServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PurchaseServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PersonNotFoundError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Person ${error.id} not found while loading SDK snapshot`,
                }),
              ),
            ActionForbiddenError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Permission denied during SDK snapshot composition: ${error.message}`,
                }),
              ),
          }),
        ),
    );

    const submitPurchaseTransaction = Effect.fn("submitPurchaseTransaction")(
      function* (input: {
        readonly providerId: "apple-app-store" | "google-play";
        readonly transactionId?: string;
        readonly purchaseToken?: string;
        readonly bundleId?: string;
        readonly packageName?: string;
        /**
         * Optional Google Play product hint. The authoritative product id is
         * derived server-side from the purchase token, so this is only a
         * last-resort fallback and may be omitted.
         */
        readonly productId?: string;
      }) {
        const session = yield* AuthSession;
        const distinctId = session?.person?.distinctId;
        if (!distinctId) {
          return yield* Effect.fail(new SdkValidationError({ message: "Distinct ID not found" }));
        }

        const projectId = session?.projects[0]?.id;
        if (!projectId) {
          return yield* Effect.fail(
            new AuthenticationError({
              cause:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
              message:
                "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
            }),
          );
        }

        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);
        yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", input.providerId);
        const organizationId = session?.projects[0]?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }
        if (input.transactionId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.transaction.provider_transaction_id",
            input.transactionId,
          );
        }
        if (input.bundleId) {
          yield* Effect.annotateCurrentSpan("voidhash.app.bundle_id", input.bundleId);
        }

        if (input.providerId === "google-play") {
          if (!input.purchaseToken || !input.packageName) {
            return yield* Effect.fail(
              new SdkValidationError({
                message: "Google Play purchase submission requires purchaseToken and packageName.",
              }),
            );
          }
          const googlePlayPaymentProviderService = yield* GooglePlayPaymentProviderService;
          const googleResult = yield* googlePlayPaymentProviderService.processSdkTransaction({
            distinctId,
            packageName: input.packageName,
            productId: input.productId ?? "",
            projectId,
            purchaseToken: input.purchaseToken,
            receivedAt: yield* DateTime.nowAsDate,
          });
          yield* Effect.annotateCurrentSpan("voidhash.person.id", googleResult.personId);
          return yield* buildSnapshot({
            distinctId,
            personId: googleResult.personId,
            projectId,
          });
        }

        if (!input.transactionId || !input.bundleId) {
          return yield* Effect.fail(
            new SdkValidationError({
              message: "App Store purchase submission requires transactionId and bundleId.",
            }),
          );
        }

        const appStorePaymentProviderService = yield* AppStorePaymentProviderService;
        const result = yield* appStorePaymentProviderService.processSdkTransaction({
          bundleId: input.bundleId,
          distinctId,
          projectId,
          receivedAt: yield* DateTime.nowAsDate,
          transactionId: input.transactionId,
        });

        yield* Effect.annotateCurrentSpan("voidhash.person.id", result.personId);

        return yield* buildSnapshot({
          distinctId,
          personId: result.personId,
          projectId,
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            AppStorePaymentProviderServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: error.cause })),
            GooglePlayPaymentProviderServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: error.cause })),
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PerkGrantServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PurchaseServiceError: (error) =>
              Effect.fail(new SdkServiceError({ cause: String(error.cause) })),
            PersonNotFoundError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Person ${error.id} not found while loading SDK snapshot`,
                }),
              ),
            ActionForbiddenError: (error) =>
              Effect.fail(
                new SdkServiceError({
                  cause: `Permission denied during SDK snapshot composition: ${error.message}`,
                }),
              ),
          }),
        ),
    );

    return constant({
      getPerson,
      identifyPerson,
      submitPurchaseTransaction,
      syncPersonAttributes,
    });
  }),
}) {
  static layer = Layer.effect(SdkService)(SdkService.make);
}
