import { Schema } from "effect";

/** Action is forbidden due to insufficient permissions */
export class ActionForbiddenError extends Schema.TaggedErrorClass<ActionForbiddenError>()(
  "ActionForbiddenError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 403 }
) {}

/** Authentication failed */
export class AuthenticationError extends Schema.TaggedErrorClass<AuthenticationError>()(
  "AuthenticationError",
  {
    cause: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** User is not authenticated */
export class NotAuthenticatedError extends Schema.TaggedErrorClass<NotAuthenticatedError>()(
  "NotAuthenticatedError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 }
) {}
