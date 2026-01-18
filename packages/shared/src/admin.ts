import { Schema } from "effect";

export class AdminServiceError extends Schema.TaggedError<AdminServiceError>()(
  "AdminServiceError",
  {
    message: Schema.String,
  }
) {}
