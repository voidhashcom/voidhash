import { Schema } from "effect";

/** Generic organization service error */
export class OrganizationServiceError extends Schema.TaggedErrorClass<OrganizationServiceError>()(
  "OrganizationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Organization not found */
export class OrganizationNotFoundError extends Schema.TaggedErrorClass<OrganizationNotFoundError>()(
  "OrganizationNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}
