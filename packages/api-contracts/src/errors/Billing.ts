import { Schema } from "effect";

/** Generic billing service error */
export class ApiBillingServiceError extends Schema.TaggedErrorClass<ApiBillingServiceError>()(
  "Api/BillingServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Organization billing not found */
export class ApiOrganizationBillingNotFoundError extends Schema.TaggedErrorClass<ApiOrganizationBillingNotFoundError>()(
  "Api/OrganizationBillingNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Invalid billing tier error */
export class ApiInvalidBillingTierError extends Schema.TaggedErrorClass<ApiInvalidBillingTierError>()(
  "Api/InvalidBillingTierError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}
