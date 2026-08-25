import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPerkGrantServiceError,
  ApiPersonNotFoundError,
  ApiPersonServiceError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  CreatePersonRequestBody,
  PersonListParams,
  UpdatePersonBody,
} from "../schemas/persons.ts";
import { Person, PersonEntitlementsResponse } from "../Schema.ts";

export const PersonsGroup = HttpApiGroup.make("persons")
  .add(
    /**
     * Creates a person, or returns the existing one when the distinct id is
     * already known. Accepts a user session, `x-api-key` or a secret key; a
     * publishable key is rejected.
     */
    HttpApiEndpoint.post("createPerson", "/", {
      payload: CreatePersonRequestBody,
      success: Person.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiPersonServiceError],
    }),
  )
  .add(
    /**
     * Lists the project's persons, newest first. `distinctId` and `email`
     * narrow the collection; an unmatched filter returns an empty page.
     * Accepts a user session, `x-api-key` or a secret key.
     */
    HttpApiEndpoint.get("listPersons", "/", {
      query: PersonListParams,
      success: paginated(Person),
      error: [ApiActionForbiddenError, ApiPersonServiceError],
    }),
  )
  .add(
    /**
     * Reads one person by id, following any merge chain to the canonical
     * person. Accepts a user session, `x-api-key` or a secret key.
     */
    HttpApiEndpoint.get("getPersonById", "/:personId", {
      params: { personId: Schema.String },
      success: Person,
      error: [ApiActionForbiddenError, ApiPersonNotFoundError, ApiPersonServiceError],
    }),
  )
  .add(
    /**
     * Writes attributes onto a person named by id. `traits` are `$set`
     * (newest write wins) and `setOnce` is `$set_once` (earliest write wins).
     * Accepts a user session, `x-api-key` or a secret key.
     */
    HttpApiEndpoint.patch("updatePerson", "/:personId", {
      params: { personId: Schema.String },
      payload: UpdatePersonBody,
      success: Person,
      error: [ApiActionForbiddenError, ApiPersonNotFoundError, ApiPersonServiceError],
    }),
  )
  .add(
    // Server-to-server entitlement check. Mirrors the grants the SDK's
    // `sdk.getPerson` returns, so a backend holding a secret key can ask
    // whether a person still has a perk without a publishable key.
    HttpApiEndpoint.get("getPersonEntitlements", "/:personId/entitlements", {
      params: { personId: Schema.String },
      success: PersonEntitlementsResponse,
      error: [
        ApiActionForbiddenError,
        ApiPerkGrantServiceError,
        ApiPersonNotFoundError,
        ApiPersonServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/persons");
