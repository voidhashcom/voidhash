import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic paywall location service error */
export class PaywallLocationServiceError extends Schema.TaggedError<PaywallLocationServiceError>()(
  "PaywallLocationServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}
