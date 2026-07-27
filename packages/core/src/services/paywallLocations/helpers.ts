import {
  PaywallLocationShowingType,
  type PaywallLocationShowingTypeValue,
  type PaywallReleaseRuntimeConfig,
} from "@voidhash/db";

export type PaywallLocationShowingTypeLabel = "feature_flag" | "paywall_release";

/**
 * Drizzle row shape for `paywallLocationShowings` plus its eagerly loaded
 * `paywall` and `paywallRelease` relations. The joins are optional —
 * showings can reference a feature flag instead, in which case both
 * relations come back as `null`.
 */
export interface ShowingWithRelations {
  readonly id: string;
  readonly projectId: string;
  readonly paywallLocationId: string;
  readonly type: number;
  readonly paywallId: string | null;
  readonly paywallReleaseId: string | null;
  readonly featureFlagId: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
  readonly paywall:
    | { readonly id: string; readonly name: string; readonly slug: string }
    | null
    | undefined;
  readonly paywallRelease:
    | {
        readonly id: string;
        readonly version: number;
        readonly s3Key: string;
        readonly s3Bucket: string;
        readonly publishedAt: Date | null;
        readonly contentHash: string | null;
        readonly runtimeConfig: PaywallReleaseRuntimeConfig | null;
      }
    | null
    | undefined;
}

/**
 * Code-deploy runtime block surfaced through SDK resolve (deploy contract
 * §6). `null` on visual-editor releases.
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
  readonly paywallId: string | null;
  readonly paywallReleaseId: string | null;
  readonly featureFlagId: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
  readonly paywall: null | {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  };
  readonly paywallRelease: null | {
    readonly releaseId: string;
    readonly version: number;
    readonly htmlUrl: string;
    readonly publishedAt: Date | null;
    readonly runtime: PaywallReleaseRuntimeView | null;
  };
}

export interface PaywallLocationWithActiveShowing {
  readonly id: string;
  readonly projectId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
  readonly activeShowing: PaywallLocationShowingView | null;
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
 * after resolving an experiment-backed showing. `null` for a plain
 * paywall-release showing or when a subject was served the control fallback
 * without being enrolled (not a real exposure).
 */
export interface ExperimentExposureContext {
  readonly experimentId: string;
  readonly variantKey: string;
  readonly personId: string | null;
  readonly distinctId: string | null;
}

/**
 * A resolved showing plus optional exposure context. Extends
 * {@link ResolvedLocationShowingForSdk} so existing consumers (which only read
 * `location` / `showing`) are unaffected.
 */
export interface ResolvedLocationShowingForSdkWithExposure extends ResolvedLocationShowingForSdk {
  readonly exposure: ExperimentExposureContext | null;
}

export const toShowingTypeLabel = (type: number): PaywallLocationShowingTypeLabel => {
  switch (type) {
    case PaywallLocationShowingType.featureFlag:
      return "feature_flag";
    default:
      return "paywall_release";
  }
};

export const toDbShowingType = (
  type: PaywallLocationShowingTypeLabel,
): PaywallLocationShowingTypeValue => {
  switch (type) {
    case "feature_flag":
      return PaywallLocationShowingType.featureFlag;
    default:
      return PaywallLocationShowingType.paywallRelease;
  }
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
    readonly contentHash: string | null;
  },
  urlConfig: { cdnUrl: string; publicBaseUrl: string },
): string =>
  release.contentHash !== null
    ? `${urlConfig.publicBaseUrl}/${release.s3Key}`
    : `${urlConfig.cdnUrl}/${release.s3Bucket}/${release.s3Key}`;

/** Maps the stored `runtimeConfig` column onto the §6 resolve runtime block. */
const toRuntimeView = (release: {
  readonly contentHash: string | null;
  readonly runtimeConfig: PaywallReleaseRuntimeConfig | null;
}): PaywallReleaseRuntimeView | null =>
  release.contentHash !== null && release.runtimeConfig !== null
    ? {
        contentHash: release.contentHash,
        productSlugs: release.runtimeConfig.productSlugs,
        variables: release.runtimeConfig.variables,
      }
    : null;

export const toShowingView = (
  showing: ShowingWithRelations,
  urlConfig: { cdnUrl: string; publicBaseUrl: string },
): PaywallLocationShowingView => ({
  createdAt: showing.createdAt,
  createdByUserId: showing.createdByUserId,
  endedAt: showing.endedAt,
  featureFlagId: showing.featureFlagId,
  id: showing.id,
  paywall:
    showing.paywall === null || showing.paywall === undefined
      ? null
      : {
          id: showing.paywall.id,
          name: showing.paywall.name,
          slug: showing.paywall.slug,
        },
  paywallId: showing.paywallId,
  paywallLocationId: showing.paywallLocationId,
  paywallRelease:
    showing.paywallRelease === null || showing.paywallRelease === undefined
      ? null
      : {
          htmlUrl: getPublicUrl(showing.paywallRelease, urlConfig),
          publishedAt: showing.paywallRelease.publishedAt,
          releaseId: showing.paywallRelease.id,
          runtime: toRuntimeView(showing.paywallRelease),
          version: showing.paywallRelease.version,
        },
  paywallReleaseId: showing.paywallReleaseId,
  projectId: showing.projectId,
  startedAt: showing.startedAt,
  type: toShowingTypeLabel(showing.type),
  updatedAt: showing.updatedAt,
});
