import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic billing service error */
export class BillingServiceError extends Schema.TaggedError<BillingServiceError>()(
  "BillingServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Organization billing not found */
export class OrganizationBillingNotFoundError extends Schema.TaggedError<OrganizationBillingNotFoundError>()(
  "OrganizationBillingNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Invalid billing tier error */
export class InvalidBillingTierError extends Schema.TaggedError<InvalidBillingTierError>()(
  "InvalidBillingTierError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}
