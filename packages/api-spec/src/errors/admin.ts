import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic admin service error */
export class AdminServiceError extends Schema.TaggedError<AdminServiceError>()(
  "AdminServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}
