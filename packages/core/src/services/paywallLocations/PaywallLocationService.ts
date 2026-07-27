import { Context, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { PaywallNotFoundError } from "../../domain/paywall/Paywall.ts";
import {
  PaywallLocationNotFoundError,
  PaywallLocationShowingValidationError,
  PaywallLocationSlugAlreadyExistsError,
} from "../../domain/paywallLocation/PaywallLocation.ts";
import { PaywallAssetConfig } from "./PaywallAssetConfig.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  PaywallLocationShowingType,
  ReleaseStatus,
  and,
  eq,
  isNull,
  paywallLocationShowings,
  paywallLocations,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { ExperimentService } from "../experiments/ExperimentService.ts";
import { SchemaCacheInvalidationService } from "../schema/SchemaCacheInvalidationService.ts";
import {
  type PaywallLocationShowingTypeLabel,
  type PaywallLocationShowingView,
  type PaywallLocationWithActiveShowing,
  type ResolvedLocationShowingForSdk,
  type ResolvedLocationShowingForSdkWithExposure,
  type ShowingWithRelations,
  toDbShowingType,
  toShowingTypeLabel,
  toShowingView,
} from "./helpers.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` and other infrastructural
 * failures at the public-method boundary.
 */
export class PaywallLocationServiceError extends Schema.TaggedErrorClass<PaywallLocationServiceError>(
  "PaywallLocationServiceError",
)("PaywallLocationServiceError", { cause: Schema.String }) {}

/**
 * `PaywallLocationService` orchestrates the named "slot" through which an
 * SDK consumer requests a paywall ("checkout-page", "paywall-modal", …).
 * Eight operations:
 *
 * - `listLocations` / `listLocationShowings` — read-side
 * - `createLocation` / `updateLocation` / `archiveLocation` — slot CRUD
 * - `assignLocationShowing` / `clearLocationShowing` — what's currently shown
 * - `resolveLocationShowingForSdk` — public read used by the SDK runtime
 *
 * Multi-row writes (`assignLocationShowing`, `archiveLocation`) wrap their
 * operations in `db.transaction`.
 *
 * `AuditLogPort`, `PaywallAssetConfig`, `Db`, `AuthSession`, and
 * `SchemaCacheInvalidationService` are provided by the application root.
 */
export class PaywallLocationService extends Context.Service<PaywallLocationService>()(
  "PaywallLocationService",
  {
    make: Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const assetConfig = yield* PaywallAssetConfig;
      const schemaCache = yield* SchemaCacheInvalidationService;
      const db = yield* Db;
      const experimentService = yield* ExperimentService;

      const createLocation = Effect.fn("createLocation")(
        function* (input: {
          readonly projectId: string;
          readonly name: string;
          readonly slug: string;
          readonly description?: string | null;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", input.slug);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to create paywall locations for project ${input.projectId}`,
          );

          const existing = yield* db.query.paywallLocations.findFirst({
            where: { projectId: input.projectId, slug: input.slug },
          });
          if (existing) {
            return yield* Effect.fail(
              new PaywallLocationSlugAlreadyExistsError({ slug: input.slug }),
            );
          }

          const id = generateId("paywallLocation");
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", id);
          yield* db.insert(paywallLocations).values({
            description: input.description ?? null,
            id,
            name: input.name,
            projectId: input.projectId,
            slug: input.slug,
          });

          yield* auditLog
            .append({
              projectId: input.projectId,
              entityType: AuditLogEntityType.PaywallLocation,
              entityId: id,
              action: AuditLogAction.Created,
              changes: { snapshot: { name: input.name, slug: input.slug } },
            })
            .pipe(Effect.ignore);

          yield* schemaCache.invalidate(input.projectId);
          return { id };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const updateLocation = Effect.fn("updateLocation")(
        function* (input: {
          readonly locationId: string;
          readonly name?: string;
          readonly description?: string | null;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", input.locationId);
          const location = yield* db.query.paywallLocations.findFirst({
            where: { id: input.locationId },
          });
          if (!location) {
            return yield* Effect.fail(
              new PaywallLocationNotFoundError({
                message: `Paywall location not found: ${input.locationId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", location.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", location.slug);
          yield* checkProjectPermission(
            location.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update paywall location ${input.locationId}`,
          );

          if (input.name === undefined && input.description === undefined) {
            return { id: location.id };
          }

          yield* db
            .update(paywallLocations)
            .set({
              ...(input.description !== undefined ? { description: input.description } : {}),
              ...(input.name !== undefined ? { name: input.name } : {}),
            })
            .where(eq(paywallLocations.id, location.id));

          yield* auditLog
            .append({
              projectId: location.projectId,
              entityType: AuditLogEntityType.PaywallLocation,
              entityId: location.id,
              action: AuditLogAction.Updated,
              changes: { snapshot: { name: input.name, description: input.description } },
            })
            .pipe(Effect.ignore);

          yield* schemaCache.invalidate(location.projectId);
          return { id: location.id };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const archiveLocation = Effect.fn("archiveLocation")(
        function* (input: { readonly locationId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", input.locationId);
          const location = yield* db.query.paywallLocations.findFirst({
            where: { id: input.locationId },
          });
          if (!location) {
            return yield* Effect.fail(
              new PaywallLocationNotFoundError({
                message: `Paywall location not found: ${input.locationId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", location.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", location.slug);
          yield* checkProjectPermission(
            location.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to archive paywall location ${input.locationId}`,
          );

          const now = new Date();
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(paywallLocations)
                .set({ archivedAt: now })
                .where(eq(paywallLocations.id, location.id));
              yield* tx
                .update(paywallLocationShowings)
                .set({ endedAt: now })
                .where(
                  and(
                    eq(paywallLocationShowings.paywallLocationId, location.id),
                    isNull(paywallLocationShowings.endedAt),
                  ),
                );
            }),
          );

          yield* auditLog
            .append({
              projectId: location.projectId,
              entityType: AuditLogEntityType.PaywallLocation,
              entityId: location.id,
              action: AuditLogAction.Archived,
            })
            .pipe(Effect.ignore);

          yield* schemaCache.invalidate(location.projectId);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const listLocations = Effect.fn("listLocations")(
        function* (input: { readonly projectId: string; readonly includeArchived?: boolean }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list paywall locations for project ${input.projectId}`,
          );

          const locations = yield* db.query.paywallLocations.findMany({
            where: {
              projectId: input.projectId,
              ...(input.includeArchived ? {} : { archivedAt: { isNull: true } }),
            },
            orderBy: { createdAt: "desc" },
          });
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.count", locations.length);
          if (locations.length === 0) {
            return [] as PaywallLocationWithActiveShowing[];
          }

          const locationIds = locations.map((location) => location.id);
          const activeShowings =
            locationIds.length === 0
              ? ([] as ShowingWithRelations[])
              : ((yield* db.query.paywallLocationShowings.findMany({
                  where: {
                    paywallLocationId: { in: locationIds },
                    endedAt: { isNull: true },
                  },
                  with: { paywall: true, paywallRelease: true },
                })) as ShowingWithRelations[]);

          const activeShowingMap = new Map<string, PaywallLocationShowingView>();
          for (const showing of activeShowings) {
            if (!activeShowingMap.has(showing.paywallLocationId)) {
              activeShowingMap.set(showing.paywallLocationId, toShowingView(showing, assetConfig));
            }
          }

          return locations.map((location) => ({
            activeShowing: activeShowingMap.get(location.id) ?? null,
            archivedAt: location.archivedAt,
            createdAt: location.createdAt,
            description: location.description,
            id: location.id,
            name: location.name,
            projectId: location.projectId,
            slug: location.slug,
            updatedAt: location.updatedAt,
          })) satisfies PaywallLocationWithActiveShowing[];
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const listLocationShowings = Effect.fn("listLocationShowings")(
        function* (input: { readonly locationId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", input.locationId);
          const location = yield* db.query.paywallLocations.findFirst({
            where: { id: input.locationId },
          });
          if (!location) {
            return yield* Effect.fail(
              new PaywallLocationNotFoundError({
                message: `Paywall location not found: ${input.locationId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", location.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", location.slug);
          yield* checkProjectPermission(
            location.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list paywall showings for location ${input.locationId}`,
          );

          const showings = (yield* db.query.paywallLocationShowings.findMany({
            where: { paywallLocationId: location.id },
            orderBy: { startedAt: "desc" },
            with: { paywall: true, paywallRelease: true },
          })) as ShowingWithRelations[];
          return showings.map((showing) => toShowingView(showing, assetConfig));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const assignLocationShowing = Effect.fn("assignLocationShowing")(
        function* (input: {
          readonly locationId: string;
          readonly type: PaywallLocationShowingTypeLabel;
          readonly paywallId?: string;
          readonly featureFlagId?: string;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", input.locationId);
          yield* Effect.annotateCurrentSpan("voidhash.showing.type", input.type);
          const location = yield* db.query.paywallLocations.findFirst({
            where: { id: input.locationId },
          });
          if (!location) {
            return yield* Effect.fail(
              new PaywallLocationNotFoundError({
                message: `Paywall location not found: ${input.locationId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", location.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", location.slug);

          yield* checkProjectPermission(
            location.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to assign paywall showing for location ${input.locationId}`,
          );

          if (location.archivedAt) {
            return yield* Effect.fail(
              new PaywallLocationShowingValidationError({
                message: "Cannot assign showing to archived location",
              }),
            );
          }
          if (input.type === "feature_flag") {
            return yield* Effect.fail(
              new PaywallLocationShowingValidationError({
                message: "Feature flag showings are not supported yet",
              }),
            );
          }
          if (!input.paywallId) {
            return yield* Effect.fail(
              new PaywallLocationShowingValidationError({
                message: "paywallId is required for paywall_release showing",
              }),
            );
          }

          const paywallId = input.paywallId;
          yield* Effect.annotateCurrentSpan("voidhash.paywall.id", paywallId);
          const paywall = yield* db.query.paywalls.findFirst({ where: { id: paywallId } });
          if (!paywall || paywall.projectId !== location.projectId) {
            return yield* Effect.fail(
              new PaywallNotFoundError({ message: `Paywall not found: ${paywallId}` }),
            );
          }
          const activeRelease = yield* db.query.paywallReleases.findFirst({
            where: {
              paywallId,
              isActive: true,
              status: ReleaseStatus.released,
            },
          });
          if (!activeRelease) {
            return yield* Effect.fail(
              new PaywallLocationShowingValidationError({
                message: "Selected paywall has no active released version",
              }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.paywall_release.id", activeRelease.id);

          const showingId = generateId("paywallLocationShowing");
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location_showing.id", showingId);
          const now = new Date();

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(paywallLocationShowings)
                .set({ endedAt: now })
                .where(
                  and(
                    eq(paywallLocationShowings.paywallLocationId, location.id),
                    isNull(paywallLocationShowings.endedAt),
                  ),
                );
              yield* tx.insert(paywallLocationShowings).values({
                createdByUserId: session?.user?.id ?? null,
                featureFlagId: null,
                id: showingId,
                paywallId,
                paywallLocationId: location.id,
                paywallReleaseId: activeRelease.id,
                projectId: location.projectId,
                startedAt: now,
                type: toDbShowingType(input.type),
              });
            }),
          );

          yield* auditLog
            .append({
              projectId: location.projectId,
              entityType: AuditLogEntityType.PaywallLocation,
              entityId: location.id,
              action: AuditLogAction.Updated,
              changes: { paywallId, showingId },
            })
            .pipe(Effect.ignore);

          return { id: showingId };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const clearLocationShowing = Effect.fn("clearLocationShowing")(
        function* (input: { readonly locationId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
          if (session.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          if (session.person?.distinctId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          }
          if (session.organizations[0]?.id) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.id",
              session.organizations[0].id,
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", input.locationId);
          const location = yield* db.query.paywallLocations.findFirst({
            where: { id: input.locationId },
          });
          if (!location) {
            return yield* Effect.fail(
              new PaywallLocationNotFoundError({
                message: `Paywall location not found: ${input.locationId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", location.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", location.slug);
          yield* checkProjectPermission(
            location.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to clear paywall showing for location ${input.locationId}`,
          );

          yield* db
            .update(paywallLocationShowings)
            .set({ endedAt: new Date() })
            .where(
              and(
                eq(paywallLocationShowings.paywallLocationId, location.id),
                isNull(paywallLocationShowings.endedAt),
              ),
            );

          yield* auditLog
            .append({
              projectId: location.projectId,
              entityType: AuditLogEntityType.PaywallLocation,
              entityId: location.id,
              action: AuditLogAction.Updated,
              changes: { cleared: true },
            })
            .pipe(Effect.ignore);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const resolveLocationShowingForSdk = Effect.fn("resolveLocationShowingForSdk")(
        function* (input: {
          readonly projectId: string;
          readonly locationSlug: string;
          readonly personId?: string;
          readonly distinctId?: string;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.slug", input.locationSlug);
          const location = yield* db.query.paywallLocations.findFirst({
            where: {
              projectId: input.projectId,
              slug: input.locationSlug,
              archivedAt: { isNull: true },
            },
          });
          if (!location) {
            return null;
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall_location.id", location.id);
          const activeShowing = (yield* db.query.paywallLocationShowings.findFirst({
            where: {
              paywallLocationId: location.id,
              endedAt: { isNull: true },
            },
            with: { paywall: true, paywallRelease: true },
          })) as ShowingWithRelations | undefined;
          if (!activeShowing) {
            return null;
          }
          yield* Effect.annotateCurrentSpan(
            "voidhash.paywall_location_showing.id",
            activeShowing.id,
          );
          const showingLabel = toShowingTypeLabel(activeShowing.type);
          yield* Effect.annotateCurrentSpan("voidhash.showing.type", showingLabel);

          const locationView = { id: location.id, name: location.name, slug: location.slug };

          // Experiment-backed showing: evaluate the backing flag for this subject
          // and serve the assigned variant's paywall release at this location,
          // falling back to the control variant's release so the location is
          // never dark. Exposure is emitted by the caller (which has org/token/
          // runtime); we return the context it needs.
          if (showingLabel === "feature_flag") {
            if (!activeShowing.featureFlagId) {
              return null;
            }
            const assignment = yield* experimentService.assignVariant({
              projectId: input.projectId,
              featureFlagId: activeShowing.featureFlagId,
              personId: input.personId,
              distinctId: input.distinctId,
            });
            if (!assignment) {
              return null;
            }
            const entryFrom = (
              payload: unknown,
            ): { readonly paywallId?: string; readonly paywallReleaseId?: string } | undefined => {
              const byLocation = (
                payload as
                  | {
                      readonly byLocation?: Record<
                        string,
                        { readonly paywallId?: string; readonly paywallReleaseId?: string }
                      >;
                    }
                  | null
                  | undefined
              )?.byLocation;
              return byLocation?.[location.id];
            };

            const enrolled = assignment.assigned && assignment.variantKey !== null;
            let entry = enrolled ? entryFrom(assignment.payload) : undefined;
            // Only count a real assignment (control or treatment) as an exposure;
            // an unenrolled subject served the control fallback is NOT exposed.
            const exposure =
              entry && enrolled
                ? {
                    experimentId: assignment.experimentId,
                    variantKey: assignment.variantKey as string,
                    personId: input.personId ?? null,
                    distinctId: input.distinctId ?? null,
                  }
                : null;
            if (!entry) {
              entry = entryFrom(assignment.controlPayload);
            }
            if (!entry) {
              return null;
            }

            // Treatments name a paywall and the serve path follows its active
            // published release, so shipping a new version updates a running
            // test too. `paywallReleaseId` appears only in payloads compiled
            // before that change and stays pinned.
            const release = entry.paywallReleaseId
              ? yield* db.query.paywallReleases.findFirst({
                  where: { id: entry.paywallReleaseId },
                  with: { paywall: true },
                })
              : entry.paywallId
                ? yield* db.query.paywallReleases.findFirst({
                    where: {
                      paywallId: entry.paywallId,
                      isActive: true,
                      status: ReleaseStatus.released,
                    },
                    with: { paywall: true },
                  })
                : undefined;
            if (!release || !release.paywall || release.paywall.projectId !== input.projectId) {
              return null;
            }
            yield* Effect.annotateCurrentSpan("voidhash.paywall.id", release.paywall.id);
            yield* Effect.annotateCurrentSpan("voidhash.paywall_release.id", release.id);

            // Synthetic showing coerced to `paywall_release` so the SDK response
            // shape is identical to a normal release resolve.
            const synthetic: ShowingWithRelations = {
              ...activeShowing,
              type: PaywallLocationShowingType.paywallRelease,
              paywallId: release.paywall.id,
              paywallReleaseId: release.id,
              featureFlagId: activeShowing.featureFlagId,
              paywall: {
                id: release.paywall.id,
                name: release.paywall.name,
                slug: release.paywall.slug,
              },
              paywallRelease: {
                id: release.id,
                version: release.version,
                s3Key: release.s3Key,
                s3Bucket: release.s3Bucket,
                publishedAt: release.publishedAt,
                contentHash: release.contentHash,
                runtimeConfig: release.runtimeConfig,
              },
            };
            return {
              location: locationView,
              showing: toShowingView(synthetic, assetConfig),
              exposure,
            } satisfies ResolvedLocationShowingForSdkWithExposure;
          }

          if (showingLabel !== "paywall_release") {
            return null;
          }
          if (!activeShowing.paywall || !activeShowing.paywallRelease) {
            return null;
          }
          if (activeShowing.paywallId) {
            yield* Effect.annotateCurrentSpan("voidhash.paywall.id", activeShowing.paywallId);
          }
          if (activeShowing.paywallReleaseId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.paywall_release.id",
              activeShowing.paywallReleaseId,
            );
          }
          return {
            location: locationView,
            showing: toShowingView(activeShowing, assetConfig),
            exposure: null,
          } satisfies ResolvedLocationShowingForSdkWithExposure;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: String(error.cause) })),
              ExperimentServiceError: (error) =>
                Effect.fail(new PaywallLocationServiceError({ cause: error.cause })),
            }),
          ),
      );

      return {
        archiveLocation,
        assignLocationShowing,
        clearLocationShowing,
        createLocation,
        listLocationShowings,
        listLocations,
        resolveLocationShowingForSdk,
        updateLocation,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(PaywallLocationService)(PaywallLocationService.make);
}

export type {
  ExperimentExposureContext,
  PaywallLocationShowingTypeLabel,
  PaywallLocationShowingView,
  PaywallLocationWithActiveShowing,
  PaywallReleaseRuntimeView,
  ResolvedLocationShowingForSdk,
  ResolvedLocationShowingForSdkWithExposure,
} from "./helpers.ts";
