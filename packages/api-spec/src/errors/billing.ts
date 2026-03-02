import { Schema } from "effect";

/** Generic billing service error */
export class BillingServiceError extends Schema.TaggedErrorClass<BillingServiceError>()(
  "BillingServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Organization billing not found */
export class OrganizationBillingNotFoundError extends Schema.TaggedErrorClass<OrganizationBillingNotFoundError>()(
  "OrganizationBillingNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Invalid billing tier error */
export class InvalidBillingTierError extends Schema.TaggedErrorClass<InvalidBillingTierError>()(
  "InvalidBillingTierError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}
