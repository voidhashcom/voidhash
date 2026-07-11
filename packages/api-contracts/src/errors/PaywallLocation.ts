import { Schema } from "effect";

/** Generic paywall location service error */
export class ApiPaywallLocationServiceError extends Schema.TaggedErrorClass<ApiPaywallLocationServiceError>()(
  "Api/PaywallLocationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}
