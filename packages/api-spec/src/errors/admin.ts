import { Schema } from "effect";

/** Generic admin service error */
export class AdminServiceError extends Schema.TaggedErrorClass<AdminServiceError>()(
  "AdminServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}
