import { Schema } from "effect";

export class OrganizationServiceError extends Schema.TaggedError<OrganizationServiceError>()(
  "OrganizationServiceError",
  {
    cause: Schema.String,
  }
) {}

export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>()(
  "OrganizationNotFoundError",
  {
    message: Schema.String,
  }
) {}
