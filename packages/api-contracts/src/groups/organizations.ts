import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiOrganizationNotFoundError,
  ApiOrganizationServiceError,
  ApiProjectServiceError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { PageParams, paginated } from "../Pagination.ts";
import { UpdateOrganizationBody } from "../schemas/tenancy.ts";
import { CreateOrganizationBody, Organization, Project } from "../Schema.ts";

export const OrganizationsGroup = HttpApiGroup.make("organizations")
  /**
   * Creates an organization and makes the calling user its first member. The
   * organization is created in the identity provider first, so a failure there
   * leaves no local state behind.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.post("createOrganization", "/", {
      payload: CreateOrganizationBody,
      success: Organization.pipe(HttpApiSchema.status(201)),
      error: [ApiOrganizationServiceError],
    }),
  )
  /**
   * Lists the organizations the calling user belongs to. Membership is carried
   * by the session itself, so this never widens reach: a secret key is scoped
   * to a single project and is rejected outright.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.get("listOrganizations", "/", {
      query: PageParams,
      success: paginated(Organization),
      error: [ApiActionForbiddenError],
    }),
  )
  /**
   * Reads a single organization the caller is a member of.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.get("getOrganization", "/:organizationId", {
      params: { organizationId: Schema.String },
      success: Organization,
      error: [ApiActionForbiddenError, ApiOrganizationNotFoundError, ApiOrganizationServiceError],
    }),
  )
  /**
   * Renames an organization. The rename is mirrored into the identity provider
   * first, so a failure there leaves both sides unchanged.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.patch("updateOrganization", "/:organizationId", {
      params: { organizationId: Schema.String },
      payload: UpdateOrganizationBody,
      success: Organization,
      error: [ApiActionForbiddenError, ApiOrganizationNotFoundError, ApiOrganizationServiceError],
    }),
  )
  /**
   * Lists the projects inside an organization. This is the RESTful replacement
   * for `GET /projects/:organizationId`, which reads as a single-project fetch
   * and blocks the `/projects/:projectId` slot.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.get("listOrganizationProjects", "/:organizationId/projects", {
      params: { organizationId: Schema.String },
      query: PageParams,
      success: paginated(Project),
      error: [ApiActionForbiddenError, ApiProjectServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/organizations");
