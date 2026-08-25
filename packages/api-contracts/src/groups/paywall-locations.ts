import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPaywallLocationNotFoundError,
  ApiPaywallLocationServiceError,
  ApiPaywallLocationShowingValidationError,
  ApiPaywallLocationSlugAlreadyExistsError,
  ApiPaywallNotFoundError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { PageParams, paginated } from "../Pagination.ts";
import {
  CreatePaywallLocationBody,
  PaywallLocationItemParams,
  PaywallLocationListParams,
  PaywallLocationShowing,
  SetPaywallLocationShowingBody,
  UpdatePaywallLocationBody,
} from "../schemas/paywalls.ts";
import { PaywallLocation } from "../Schema.ts";

export const PaywallLocationsGroup = HttpApiGroup.make("paywall_locations")
  /**
   * Lists a project's paywall locations. Archived locations are excluded
   * unless `includeArchived=true`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listPaywallLocations", "/", {
      query: PaywallLocationListParams,
      success: paginated(PaywallLocation),
      error: [ApiActionForbiddenError, ApiPaywallLocationServiceError],
    }),
  )
  /**
   * Creates a location — the named slot an app asks for at runtime. The slug
   * is what the SDK passes and is immutable once created.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("createPaywallLocation", "/", {
      payload: CreatePaywallLocationBody,
      success: PaywallLocation.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationServiceError,
        ApiPaywallLocationSlugAlreadyExistsError,
      ],
    }),
  )
  /**
   * Reads a single location.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getPaywallLocation", "/:locationId", {
      params: { locationId: Schema.String },
      query: PaywallLocationItemParams,
      success: PaywallLocation,
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationNotFoundError,
        ApiPaywallLocationServiceError,
      ],
    }),
  )
  /**
   * Updates a location's name or description. The slug is not patchable.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.patch("updatePaywallLocation", "/:locationId", {
      params: { locationId: Schema.String },
      payload: UpdatePaywallLocationBody,
      success: PaywallLocation,
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationNotFoundError,
        ApiPaywallLocationServiceError,
      ],
    }),
  )
  /**
   * Archives a location. Soft delete: the slot stops appearing in the default
   * listing, and any open showing is ended by the service.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("archivePaywallLocation", "/:locationId", {
      params: { locationId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationNotFoundError,
        ApiPaywallLocationServiceError,
      ],
    }),
  )
  /**
   * Sets what the location serves. The active showing is a singleton
   * sub-resource, so this is a `PUT`: it ends the previous showing and opens a
   * new one in a single step.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.put("setPaywallLocationShowing", "/:locationId/showing", {
      params: { locationId: Schema.String },
      payload: SetPaywallLocationShowingBody,
      success: PaywallLocationShowing,
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationNotFoundError,
        ApiPaywallLocationServiceError,
        ApiPaywallLocationShowingValidationError,
        ApiPaywallNotFoundError,
      ],
    }),
  )
  /**
   * Clears the active showing, leaving the location serving nothing.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("clearPaywallLocationShowing", "/:locationId/showing", {
      params: { locationId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationNotFoundError,
        ApiPaywallLocationServiceError,
      ],
    }),
  )
  /**
   * Lists the location's showing history, most recently started first. The
   * open showing is the entry whose `endedAt` is `null`.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listPaywallLocationShowings", "/:locationId/showings", {
      params: { locationId: Schema.String },
      query: PageParams,
      success: paginated(PaywallLocationShowing),
      error: [
        ApiActionForbiddenError,
        ApiPaywallLocationNotFoundError,
        ApiPaywallLocationServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/paywall-locations");
