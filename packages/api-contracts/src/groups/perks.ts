import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPerkNotFoundError,
  ApiPerkServiceError,
  ApiPerkSlugAlreadyExistsError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import { CreatePerkBody, PerkListParams, UpdatePerkBody } from "../schemas/catalog.ts";
import { Perk } from "../Schema.ts";

export const PerksGroup = HttpApiGroup.make("perks")
  /**
   * Lists the perks of one project.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listPerks", "/", {
      query: PerkListParams,
      success: paginated(Perk),
      error: [ApiActionForbiddenError, ApiPerkServiceError],
    }),
  )
  /**
   * Creates a perk. Slugs are unique per project.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("createPerk", "/", {
      payload: CreatePerkBody,
      success: Perk.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiPerkServiceError, ApiPerkSlugAlreadyExistsError],
    }),
  )
  /**
   * Reads a single perk. The project is derived from the row.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getPerk", "/:perkId", {
      params: { perkId: Schema.String },
      success: Perk,
      error: [ApiActionForbiddenError, ApiPerkNotFoundError, ApiPerkServiceError],
    }),
  )
  /**
   * Renames a perk or changes its slug. A slug already taken by another perk in
   * the same project is rejected.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.patch("updatePerk", "/:perkId", {
      params: { perkId: Schema.String },
      payload: UpdatePerkBody,
      success: Perk,
      error: [
        ApiActionForbiddenError,
        ApiPerkNotFoundError,
        ApiPerkServiceError,
        ApiPerkSlugAlreadyExistsError,
      ],
    }),
  )
  /**
   * Deletes a perk along with its product links.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("deletePerk", "/:perkId", {
      params: { perkId: Schema.String },
      error: [ApiActionForbiddenError, ApiPerkNotFoundError, ApiPerkServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/perks");
