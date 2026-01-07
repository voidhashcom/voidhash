import { Schema } from "effect";

export class UserServiceError extends Schema.TaggedError<UserServiceError>()(
  "UserServiceError",
  {
    cause: Schema.String,
  }
) {}
