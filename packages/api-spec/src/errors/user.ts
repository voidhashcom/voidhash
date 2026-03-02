import { Schema } from "effect";

/** Generic user service error */
export class UserServiceError extends Schema.TaggedErrorClass<UserServiceError>()(
  "UserServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}
