import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Action is forbidden due to insufficient permissions */
export class ActionForbiddenError extends Schema.TaggedError<ActionForbiddenError>()(
  "ActionForbiddenError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 403 })
) {}

/** Authentication failed */
export class AuthenticationError extends Schema.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  {
    cause: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** User is not authenticated */
export class NotAuthenticatedError extends Schema.TaggedError<NotAuthenticatedError>()(
  "NotAuthenticatedError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 401 })
) {}
