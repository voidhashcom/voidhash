import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic organization service error */
export class OrganizationServiceError extends Schema.TaggedError<OrganizationServiceError>()(
  "OrganizationServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Organization not found */
export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>()(
  "OrganizationNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}
