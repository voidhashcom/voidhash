import { Schema } from "effect";

/** Generic user service error */
export class ApiUserServiceError extends Schema.TaggedErrorClass<ApiUserServiceError>()(
  "Api/UserServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}
