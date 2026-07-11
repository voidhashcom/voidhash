import { Schema } from "effect";

/** Action is forbidden due to insufficient permissions */
export class ApiActionForbiddenError extends Schema.TaggedErrorClass<ApiActionForbiddenError>()(
  "Api/ActionForbiddenError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 403 },
) {}

/** Authentication failed */
export class ApiAuthenticationError extends Schema.TaggedErrorClass<ApiAuthenticationError>()(
  "Api/AuthenticationError",
  {
    cause: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** User is not authenticated */
export class ApiNotAuthenticatedError extends Schema.TaggedErrorClass<ApiNotAuthenticatedError>()(
  "Api/NotAuthenticatedError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}
