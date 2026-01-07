import { Schema } from "effect";

export class ActionForbiddenError extends Schema.TaggedError<ActionForbiddenError>()(
  "ActionForbiddenError",
  {
    message: Schema.String,
  }
) {}
