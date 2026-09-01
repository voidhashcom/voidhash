import * as Schema from "effect/Schema";

export class OrganizationServiceError extends Schema.TaggedErrorClass<OrganizationServiceError>()(
  "OrganizationServiceError",
  {
    message: Schema.String,
  },
) {}
