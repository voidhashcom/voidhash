import * as Schema from "effect/Schema";

import { PageParams } from "../Pagination.ts";

/**
 * Body for `PATCH /organizations/:organizationId`. Every field is optional so a
 * caller can send a partial patch; an empty body is a no-op that still returns
 * the current organization.
 */
export class UpdateOrganizationBody extends Schema.Class<UpdateOrganizationBody>(
  "UpdateOrganizationBody",
)({
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
}) {}

/**
 * Body for `PATCH /projects/:projectId`. Renaming never touches the slug — the
 * slug is allocated once at creation and is part of every project-scoped URL.
 */
export class UpdateProjectBody extends Schema.Class<UpdateProjectBody>("UpdateProjectBody")({
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
}) {}

/**
 * Query parameters for `GET /api-keys`. `projectId` selects which of the
 * caller's projects to list; it may be omitted when the credential resolves to
 * exactly one project (always true for a secret key).
 */
export const ApiKeyListParams = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "ApiKeyListParams" });
export type ApiKeyListParams = typeof ApiKeyListParams.Type;
