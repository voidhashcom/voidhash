import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic user service error */
export class UserServiceError extends Schema.TaggedError<UserServiceError>()(
  "UserServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}
