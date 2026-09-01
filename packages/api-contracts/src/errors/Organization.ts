import * as Schema from "effect/Schema";

/** Generic organization service error */
export class ApiOrganizationServiceError extends Schema.TaggedErrorClass<ApiOrganizationServiceError>()(
  "Api/OrganizationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Organization not found */
export class ApiOrganizationNotFoundError extends Schema.TaggedErrorClass<ApiOrganizationNotFoundError>()(
  "Api/OrganizationNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}
