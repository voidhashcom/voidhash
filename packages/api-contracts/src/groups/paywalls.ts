import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPaywallDeployServiceError,
  ApiPaywallDeployValidationError,
  ApiPaywallNotFoundError,
  ApiPaywallPublishError,
  ApiPaywallReleaseError,
  ApiPaywallReleaseNotFoundError,
  ApiPaywallServiceError,
  ApiPaywallSlugAlreadyExistsError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  ActivatedPaywallRelease,
  CreatePaywallBody,
  Paywall,
  PaywallListParams,
  PaywallRelease,
  PaywallReleaseListParams,
  UpdatePaywallBody,
} from "../schemas/paywalls.ts";

export const PaywallsGroup = HttpApiGroup.make("paywalls")
  /**
   * Lists the paywalls of a project, newest first. Archived paywalls are
   * excluded unless `includeArchived=true`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listPaywalls", "/", {
      query: PaywallListParams,
      success: paginated(Paywall),
      error: [ApiActionForbiddenError, ApiPaywallServiceError],
    }),
  )
  /**
   * Creates an empty paywall. The slug must be unique inside the project and
   * is immutable afterwards.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("createPaywall", "/", {
      payload: CreatePaywallBody,
      success: Paywall.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiPaywallServiceError, ApiPaywallSlugAlreadyExistsError],
    }),
  )
  /**
   * Reads a single paywall, archived or not.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getPaywall", "/:paywallId", {
      params: { paywallId: Schema.String },
      success: Paywall,
      error: [ApiActionForbiddenError, ApiPaywallNotFoundError, ApiPaywallServiceError],
    }),
  )
  /**
   * Renames a paywall. The slug is deliberately not patchable: serving and
   * analytics key off it.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.patch("updatePaywall", "/:paywallId", {
      params: { paywallId: Schema.String },
      payload: UpdatePaywallBody,
      success: Paywall,
      error: [ApiActionForbiddenError, ApiPaywallNotFoundError, ApiPaywallServiceError],
    }),
  )
  /**
   * Archives a paywall. This is a soft delete: the paywall drops out of the
   * default listing but keeps serving any release already assigned to a
   * location, and stays restorable. Hard delete is not exposed.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("archivePaywall", "/:paywallId", {
      params: { paywallId: Schema.String },
      error: [ApiActionForbiddenError, ApiPaywallNotFoundError, ApiPaywallServiceError],
    }),
  )
  /**
   * Restores an archived paywall.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("restorePaywall", "/:paywallId/restore", {
      params: { paywallId: Schema.String },
      success: Paywall,
      error: [ApiActionForbiddenError, ApiPaywallNotFoundError, ApiPaywallServiceError],
    }),
  )
  /**
   * Lists a paywall's releases. Today the only readable slice is the open
   * draft, so the page holds at most one item; `status=draft` and no `status`
   * behave identically.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listPaywallReleases", "/:paywallId/releases", {
      params: { paywallId: Schema.String },
      query: PaywallReleaseListParams,
      success: paginated(PaywallRelease),
      error: [ApiActionForbiddenError, ApiPaywallNotFoundError, ApiPaywallReleaseError],
    }),
  )
  /**
   * Snapshots the paywall's current document into a draft release and renders
   * its preview HTML. Re-running against an open draft overwrites that draft
   * rather than creating a second one.
   *
   * Credential: user (a release records its author).
   */
  .add(
    HttpApiEndpoint.post("createPaywallRelease", "/:paywallId/releases", {
      params: { paywallId: Schema.String },
      success: PaywallRelease.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiPaywallNotFoundError, ApiPaywallReleaseError],
    }),
  )
  /**
   * Publishes a draft release, promoting its artifact to the paywall's active
   * released version.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("publishPaywallRelease", "/:paywallId/releases/:releaseId/publish", {
      params: { paywallId: Schema.String, releaseId: Schema.String },
      success: PaywallRelease,
      error: [
        ApiActionForbiddenError,
        ApiPaywallNotFoundError,
        ApiPaywallPublishError,
        ApiPaywallReleaseNotFoundError,
      ],
    }),
  )
  /**
   * Points serving at an already-published release — the rollback/roll-forward
   * switch for code-deployed paywalls. Activating a release that is not in the
   * `released` state is a 422.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("activatePaywallRelease", "/:paywallId/releases/:releaseId/activate", {
      params: { paywallId: Schema.String, releaseId: Schema.String },
      success: ActivatedPaywallRelease,
      error: [
        ApiActionForbiddenError,
        ApiPaywallDeployServiceError,
        ApiPaywallDeployValidationError,
        ApiPaywallReleaseNotFoundError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/paywalls");
