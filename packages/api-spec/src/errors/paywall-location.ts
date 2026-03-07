import { Schema } from "effect";

/** Generic paywall location service error */
export class PaywallLocationServiceError extends Schema.TaggedErrorClass<PaywallLocationServiceError>()(
  "PaywallLocationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}
