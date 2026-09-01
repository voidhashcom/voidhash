import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiAuthenticationError,
  ApiProjectNotFoundError,
  ApiProjectServiceError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { UpdateProjectBody } from "../schemas/tenancy.ts";
import { CreateProjectBody, Project } from "../Schema.ts";

export const ProjectsGroup = HttpApiGroup.make("projects")
  /**
   * Creates a project inside an organization the caller is a member of. The
   * slug is derived from the name and de-duplicated within the organization,
   * so it may differ from a naive slugification of what was sent.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.post("createProject", "/", {
      payload: CreateProjectBody,
      success: Project.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiAuthenticationError, ApiProjectServiceError],
    }),
  )
  /**
   * Reads a single project by id. Listing the projects of an organization lives
   * on the owning resource: `GET /organizations/:organizationId/projects`.
   *
   * Credential: user, secret-key.
   */
  .add(
    HttpApiEndpoint.get("getProjectById", "/:projectId", {
      params: { projectId: Schema.String },
      success: Project,
      error: [ApiActionForbiddenError, ApiProjectNotFoundError, ApiProjectServiceError],
    }),
  )
  /**
   * Renames a project. The slug is allocated at creation and is deliberately
   * left untouched, so existing project-scoped URLs keep resolving.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.patch("updateProject", "/:projectId", {
      params: { projectId: Schema.String },
      payload: UpdateProjectBody,
      success: Project,
      error: [ApiActionForbiddenError, ApiProjectNotFoundError, ApiProjectServiceError],
    }),
  )
  /**
   * Permanently deletes a project and everything scoped to it.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.delete("deleteProject", "/:projectId", {
      params: { projectId: Schema.String },
      error: [ApiActionForbiddenError, ApiProjectNotFoundError, ApiProjectServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/projects");
