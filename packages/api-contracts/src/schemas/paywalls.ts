import * as Schema from "effect/Schema";

import { PageParams } from "../Pagination.ts";

/**
 * Boolean flags arrive as query strings, which have no native boolean form.
 * Accepting exactly `"true"` / `"false"` keeps a typo like `?includeArchived=1`
 * a 400 rather than a silent `false`.
 */
const BooleanParam = Schema.Literals(["true", "false"]);

// ========================================================
// Paywalls
// ========================================================

export class Paywall extends Schema.Class<Paywall>("Paywall")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
}) {}

/**
 * Query parameters for `GET /paywalls`. `projectId` may be omitted when the
 * credential resolves to exactly one project (always true for a secret key).
 * Archived paywalls are hidden unless `includeArchived=true`.
 */
export const PaywallListParams = Schema.Struct({
  ...PageParams.fields,
  includeArchived: Schema.optional(BooleanParam),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "PaywallListParams" });
export type PaywallListParams = typeof PaywallListParams.Type;

/**
 * Body for `POST /paywalls`. The `slug` is the stable serving/analytics key and
 * is immutable once created, so it is required here and absent from the patch.
 */
export class CreatePaywallBody extends Schema.Class<CreatePaywallBody>("CreatePaywallBody")({
  name: Schema.String.check(Schema.isMinLength(1)),
  projectId: Schema.optional(Schema.String),
  slug: Schema.String.check(Schema.isMinLength(1)),
}) {}

/**
 * Body for `PATCH /paywalls/:paywallId`. Only the human-facing name is
 * mutable; an empty body is a no-op that returns the current paywall.
 */
export class UpdatePaywallBody extends Schema.Class<UpdatePaywallBody>("UpdatePaywallBody")({
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
}) {}

// ========================================================
// Paywall releases
// ========================================================

export const PaywallReleaseStatus = Schema.Literals(["draft", "published"]);
export type PaywallReleaseStatus = typeof PaywallReleaseStatus.Type;

/**
 * A rendered snapshot of a paywall. A `draft` carries `createdAt` and its
 * preview `url`; publishing mints a `published` release whose `url` is the
 * immutable serving artifact.
 */
export class PaywallRelease extends Schema.Class<PaywallRelease>("PaywallRelease")({
  createdAt: Schema.NullOr(Schema.Date),
  paywallId: Schema.String,
  publishedAt: Schema.NullOr(Schema.Date),
  releaseId: Schema.String,
  status: PaywallReleaseStatus,
  url: Schema.String,
  version: Schema.Number,
}) {}

/**
 * Query parameters for `GET /paywalls/:paywallId/releases`. Only `status=draft`
 * is filterable today — the release service exposes the draft accessor alone —
 * and omitting `status` is equivalent. Widening the literal later is additive.
 */
export const PaywallReleaseListParams = Schema.Struct({
  ...PageParams.fields,
  status: Schema.optional(Schema.Literals(["draft"])),
}).annotate({ identifier: "PaywallReleaseListParams" });
export type PaywallReleaseListParams = typeof PaywallReleaseListParams.Type;

/**
 * Result of activating a published release. Activation flips the serving
 * pointer only, so the response carries the identity of the now-active release
 * rather than a full re-read.
 */
export class ActivatedPaywallRelease extends Schema.Class<ActivatedPaywallRelease>(
  "ActivatedPaywallRelease",
)({
  releaseId: Schema.String,
  version: Schema.Number,
}) {}

// ========================================================
// Paywall locations
// ========================================================

/**
 * Query parameters for `GET /paywall-locations`. Archived locations are
 * excluded unless `includeArchived=true`.
 */
export const PaywallLocationListParams = Schema.Struct({
  ...PageParams.fields,
  includeArchived: Schema.optional(BooleanParam),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "PaywallLocationListParams" });
export type PaywallLocationListParams = typeof PaywallLocationListParams.Type;

/**
 * Query parameters for location item reads. The location row is fetched
 * through the project-scoped listing, so the project must be resolvable —
 * omit `projectId` only when the credential already names exactly one project.
 */
export const PaywallLocationItemParams = Schema.Struct({
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "PaywallLocationItemParams" });
export type PaywallLocationItemParams = typeof PaywallLocationItemParams.Type;

/** Body for `POST /paywall-locations`. The `slug` is immutable once created. */
export class CreatePaywallLocationBody extends Schema.Class<CreatePaywallLocationBody>(
  "CreatePaywallLocationBody",
)({
  description: Schema.optional(Schema.String),
  name: Schema.String.check(Schema.isMinLength(1)),
  projectId: Schema.optional(Schema.String),
  slug: Schema.String.check(Schema.isMinLength(1)),
}) {}

/**
 * Body for `PATCH /paywall-locations/:locationId`. `description: null` clears
 * the description; omitting it leaves the stored value untouched. `projectId`
 * scopes the re-read of the updated row.
 */
export class UpdatePaywallLocationBody extends Schema.Class<UpdatePaywallLocationBody>(
  "UpdatePaywallLocationBody",
)({
  description: Schema.optional(Schema.NullOr(Schema.String)),
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  projectId: Schema.optional(Schema.String),
}) {}

export const PaywallLocationShowingType = Schema.Literals(["paywall_release", "feature_flag"]);
export type PaywallLocationShowingType = typeof PaywallLocationShowingType.Type;

const PaywallLocationShowingPaywall = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});

const PaywallLocationShowingRelease = Schema.Struct({
  htmlUrl: Schema.String,
  publishedAt: Schema.NullOr(Schema.Date),
  releaseId: Schema.String,
  version: Schema.Number,
});

/**
 * One entry in a location's showing history. The active showing is the row
 * whose `endedAt` is `null`; assigning a new showing ends the previous one.
 */
export class PaywallLocationShowing extends Schema.Class<PaywallLocationShowing>(
  "PaywallLocationShowing",
)({
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  endedAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.NullOr(Schema.String),
  id: Schema.String,
  paywall: Schema.NullOr(PaywallLocationShowingPaywall),
  paywallId: Schema.NullOr(Schema.String),
  paywallLocationId: Schema.String,
  paywallRelease: Schema.NullOr(PaywallLocationShowingRelease),
  paywallReleaseId: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  startedAt: Schema.Date,
  type: PaywallLocationShowingType,
  updatedAt: Schema.NullOr(Schema.Date),
}) {}

/**
 * Body for `PUT /paywall-locations/:locationId/showing`. Send `paywallId` with
 * `type: "paywall_release"` to serve a paywall's active release, or
 * `featureFlagId` with `type: "feature_flag"` to serve a flag-driven variant.
 */
export class SetPaywallLocationShowingBody extends Schema.Class<SetPaywallLocationShowingBody>(
  "SetPaywallLocationShowingBody",
)({
  featureFlagId: Schema.optional(Schema.String),
  paywallId: Schema.optional(Schema.String),
  type: PaywallLocationShowingType,
}) {}

// ========================================================
// Paywall deploys (read side)
// ========================================================

export const PaywallDeployStatus = Schema.Literals(["pending", "ready"]);
export type PaywallDeployStatus = typeof PaywallDeployStatus.Type;

const PaywallDeployPaywallSummary = Schema.Struct({
  contentHash: Schema.String,
  releaseId: Schema.NullOr(Schema.String),
  slug: Schema.String,
  version: Schema.NullOr(Schema.Number),
});

const PaywallDeployComponentSummary = Schema.Struct({
  componentId: Schema.NullOr(Schema.String),
  contentHash: Schema.String,
  slug: Schema.String,
  version: Schema.NullOr(Schema.Number),
});

/**
 * A code deploy as stored after `POST /paywall-deploys`. `status` is `pending`
 * until every declared blob has been uploaded and the deploy finalized.
 */
export class PaywallDeploy extends Schema.Class<PaywallDeploy>("PaywallDeploy")({
  cliVersion: Schema.String,
  components: Schema.Array(PaywallDeployComponentSummary),
  createdAt: Schema.Date,
  createdByName: Schema.String,
  id: Schema.String,
  paywalls: Schema.Array(PaywallDeployPaywallSummary),
  runtimeVersion: Schema.String,
  schemaVersion: Schema.Number,
  status: PaywallDeployStatus,
}) {}

/** Query parameters for `GET /paywall-deploys`. */
export const PaywallDeployListParams = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
  status: Schema.optional(PaywallDeployStatus),
}).annotate({ identifier: "PaywallDeployListParams" });
export type PaywallDeployListParams = typeof PaywallDeployListParams.Type;

/**
 * Query parameters for `GET /paywall-deploys/:deployId`. The deploy is read
 * out of the project-scoped listing, so the project must be resolvable.
 */
export const PaywallDeployItemParams = Schema.Struct({
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "PaywallDeployItemParams" });
export type PaywallDeployItemParams = typeof PaywallDeployItemParams.Type;
