import { Schema } from "effect";

export class OrganizationServiceError extends Schema.TaggedErrorClass<OrganizationServiceError>()(
  "OrganizationServiceError",
  {
    message: Schema.String,
  }
) {}
