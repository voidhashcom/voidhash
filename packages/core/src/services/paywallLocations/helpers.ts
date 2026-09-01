import {
  PaywallLocationShowingType,
  paywallLocationShowings,
  paywallReleases,
  paywalls,
  type PaywallLocationShowingTypeValue,
  type PaywallReleaseRuntimeConfig,
} from "@voidhash/db";
import * as Option from "effect/Option";

export type PaywallLocationShowingTypeLabel = "feature_flag" | "paywall_release";

/**
 * Drizzle row shape for `paywallLocationShowings` plus its eagerly loaded
 * `paywall` and `paywallRelease` relations. The joins are optional —
 * showings can reference a feature flag instead, in which case both
 * relations are represented as `Option.none`.
 */
export interface ShowingWithRelations {
  readonly id: string;
  readonly projectId: string;
  readonly paywallLocationId: string;
  readonly type: number;
  readonly paywallId: Option.Option<string>;
  readonly paywallReleaseId: Option.Option<string>;
  readonly featureFlagId: Option.Option<string>;
  readonly startedAt: Date;
  readonly endedAt: Option.Option<Date>;
  readonly createdByUserId: Option.Option<string>;
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
  readonly paywall: Option.Option<{
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }>;
  readonly paywallRelease: Option.Option<{
    readonly id: string;
    readonly version: number;
    readonly s3Key: string;
    readonly s3Bucket: string;
    readonly publishedAt: Option.Option<Date>;
    readonly contentHash: Option.Option<string>;
    readonly runtimeConfig: Option.Option<PaywallReleaseRuntimeConfig>;
  }>;
}

/**
 * Code-deploy runtime block surfaced through SDK resolve (deploy contract
 * §6). Absent on visual-editor releases.
 */
export interface PaywallReleaseRuntimeView {
  readonly contentHash: string;
  readonly productSlugs: ReadonlyArray<string>;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
}

export interface PaywallLocationShowingView {
  readonly id: string;
  readonly projectId: string;
  readonly paywallLocationId: string;
  readonly type: PaywallLocationShowingTypeLabel;
  readonly paywallId: Option.Option<string>;
  readonly paywallReleaseId: Option.Option<string>;
  readonly featureFlagId: Option.Option<string>;
  readonly startedAt: Date;
  readonly endedAt: Option.Option<Date>;
  readonly createdByUserId: Option.Option<string>;
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
  readonly paywall: Option.Option<{
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }>;
  readonly paywallRelease: Option.Option<{
    readonly releaseId: string;
    readonly version: number;
    readonly htmlUrl: string;
    readonly publishedAt: Option.Option<Date>;
    readonly runtime: Option.Option<PaywallReleaseRuntimeView>;
  }>;
}

export interface PaywallLocationWithActiveShowing {
  readonly id: string;
  readonly projectId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: Option.Option<string>;
  readonly archivedAt: Option.Option<Date>;
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
  readonly activeShowing: Option.Option<PaywallLocationShowingView>;
}

export interface ResolvedLocationShowingForSdk {
  readonly location: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  };
  readonly showing: PaywallLocationShowingView;
}

/**
 * The context the SDK serve path needs to emit an `$experiment.exposed` event
 * after resolving an experiment-backed showing. Absent for a plain
 * paywall-release showing or when a subject was served the control fallback
 * without being enrolled (not a real exposure).
 */
export interface ExperimentExposureContext {
  readonly experimentId: string;
  readonly variantKey: string;
  readonly personId: Option.Option<string>;
  readonly distinctId: Option.Option<string>;
}

/**
 * A resolved showing plus optional exposure context. Extends
 * {@link ResolvedLocationShowingForSdk} so existing consumers (which only read
 * `location` / `showing`) are unaffected.
 */
export interface ResolvedLocationShowingForSdkWithExposure extends ResolvedLocationShowingForSdk {
  readonly exposure: Option.Option<ExperimentExposureContext>;
}

type PaywallRelation = Pick<typeof paywalls.$inferSelect, "id" | "name" | "slug">;
type PaywallReleaseRelation = Pick<
  typeof paywallReleases.$inferSelect,
  "contentHash" | "id" | "publishedAt" | "runtimeConfig" | "s3Bucket" | "s3Key" | "version"
>;

/** Converts a nullable Drizzle showing row and relations into the internal Option model. */
export const toShowingWithRelations = (
  showing: typeof paywallLocationShowings.$inferSelect,
  paywall: Option.Option<PaywallRelation>,
  paywallRelease: Option.Option<PaywallReleaseRelation>,
): ShowingWithRelations => ({
  createdAt: Option.fromNullishOr(showing.createdAt),
  createdByUserId: Option.fromNullishOr(showing.createdByUserId),
  endedAt: Option.fromNullishOr(showing.endedAt),
  featureFlagId: Option.fromNullishOr(showing.featureFlagId),
  id: showing.id,
  paywall,
  paywallId: Option.fromNullishOr(showing.paywallId),
  paywallLocationId: showing.paywallLocationId,
  paywallRelease: Option.map(paywallRelease, (release) => ({
    contentHash: Option.fromNullishOr(release.contentHash),
    id: release.id,
    publishedAt: Option.fromNullishOr(release.publishedAt),
    runtimeConfig: Option.fromNullishOr(release.runtimeConfig),
    s3Bucket: release.s3Bucket,
    s3Key: release.s3Key,
    version: release.version,
  })),
  paywallReleaseId: Option.fromNullishOr(showing.paywallReleaseId),
  projectId: showing.projectId,
  startedAt: showing.startedAt,
  type: showing.type,
  updatedAt: Option.fromNullishOr(showing.updatedAt),
});

export const toShowingTypeLabel = (type: number): PaywallLocationShowingTypeLabel => {
  if (type === PaywallLocationShowingType.featureFlag) return "feature_flag";
  return "paywall_release";
};

export const toDbShowingType = (
  type: PaywallLocationShowingTypeLabel,
): PaywallLocationShowingTypeValue => {
  if (type === "feature_flag") return PaywallLocationShowingType.featureFlag;
  return PaywallLocationShowingType.paywallRelease;
};

/**
 * Build the public HTML URL for a paywall release.
 *
 * - Current visual-editor and code-deployed releases (non-null `contentHash`)
 *   are served from the content-addressed public layout (deploy contract §5):
 *   `{publicBaseUrl}/{s3Key}` with `s3Key = "p/<contentHash>/index.html"`.
 * - Older visual-editor releases keep the legacy CDN format
 *   `{cdnUrl}/{s3Bucket}/{s3Key}` (duplicated from
 *   `internal/paywall-publishing/utils.ts`; owned jointly by
 *   paywall-publishing (writer) and paywall-locations (reader) — keep them
 *   in sync if the layout changes).
 */
const getPublicUrl = (
  release: {
    readonly s3Key: string;
    readonly s3Bucket: string;
    readonly contentHash: Option.Option<string>;
  },
  urlConfig: { cdnUrl: string; publicBaseUrl: string },
): string => {
  if (Option.isSome(release.contentHash)) return `${urlConfig.publicBaseUrl}/${release.s3Key}`;
  return `${urlConfig.cdnUrl}/${release.s3Bucket}/${release.s3Key}`;
};

/** Maps the stored `runtimeConfig` column onto the §6 resolve runtime block. */
const toRuntimeView = (release: {
  readonly contentHash: Option.Option<string>;
  readonly runtimeConfig: Option.Option<PaywallReleaseRuntimeConfig>;
}): Option.Option<PaywallReleaseRuntimeView> =>
  Option.flatMap(release.contentHash, (contentHash) =>
    Option.map(release.runtimeConfig, (runtimeConfig) => ({
      contentHash,
      productSlugs: runtimeConfig.productSlugs,
      variables: runtimeConfig.variables,
    })),
  );

/** Projects the joined paywall row, which is absent for release-only showings. */
const toShowingPaywallView = (
  paywall: ShowingWithRelations["paywall"],
): PaywallLocationShowingView["paywall"] => {
  return Option.map(paywall, (value) => ({ id: value.id, name: value.name, slug: value.slug }));
};

/** Projects the joined release row, which is absent until a showing is published. */
const toShowingReleaseView = (
  paywallRelease: ShowingWithRelations["paywallRelease"],
  urlConfig: { cdnUrl: string; publicBaseUrl: string },
): PaywallLocationShowingView["paywallRelease"] => {
  return Option.map(paywallRelease, (release) => ({
    htmlUrl: getPublicUrl(release, urlConfig),
    publishedAt: release.publishedAt,
    releaseId: release.id,
    runtime: toRuntimeView(release),
    version: release.version,
  }));
};

export const toShowingView = (
  showing: ShowingWithRelations,
  urlConfig: { cdnUrl: string; publicBaseUrl: string },
): PaywallLocationShowingView => ({
  createdAt: showing.createdAt,
  createdByUserId: showing.createdByUserId,
  endedAt: showing.endedAt,
  featureFlagId: showing.featureFlagId,
  id: showing.id,
  paywall: toShowingPaywallView(showing.paywall),
  paywallId: showing.paywallId,
  paywallLocationId: showing.paywallLocationId,
  paywallRelease: toShowingReleaseView(showing.paywallRelease, urlConfig),
  paywallReleaseId: showing.paywallReleaseId,
  projectId: showing.projectId,
  startedAt: showing.startedAt,
  type: toShowingTypeLabel(showing.type),
  updatedAt: showing.updatedAt,
});
