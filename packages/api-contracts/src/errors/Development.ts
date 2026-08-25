import { Schema } from "effect";

/**
 * Errors for the development-sandbox surface (`/api/v1/development/*`). The
 * sandbox simulates purchases and entitlements, so it is deliberately fenced
 * off from production traffic by the `x-environment` header.
 */

/** Generic development-sandbox service error. */
export class ApiDevelopmentModeServiceError extends Schema.TaggedErrorClass<ApiDevelopmentModeServiceError>()(
  "Api/DevelopmentModeServiceError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/**
 * The request was not marked as development traffic. Every sandbox endpoint
 * requires `x-environment: development`; refusing otherwise keeps simulated
 * purchases from ever touching a production-scoped credential.
 */
export class ApiDevelopmentEnvironmentRequiredError extends Schema.TaggedErrorClass<ApiDevelopmentEnvironmentRequiredError>()(
  "Api/DevelopmentEnvironmentRequiredError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}
