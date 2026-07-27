import { Schema } from "effect";

/** Generic person service error */
export class ApiPersonServiceError extends Schema.TaggedErrorClass<ApiPersonServiceError>()(
  "Api/PersonServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Person not found */
export class ApiPersonNotFoundError extends Schema.TaggedErrorClass<ApiPersonNotFoundError>()(
  "Api/PersonNotFoundError",
  {
    id: Schema.NonEmptyString,
  },
  { httpApiStatus: 404 },
) {
  override toString(): string {
    return `The following person not found: ${this.id}`;
  }
}

/** Anonymous ID is invalid */
export class ApiPersonInvalidAnonymousIdError extends Schema.TaggedErrorClass<ApiPersonInvalidAnonymousIdError>()(
  "Api/PersonInvalidAnonymousIdError",
  {
    id: Schema.NonEmptyString,
  },
  { httpApiStatus: 400 },
) {
  override toString(): string {
    return `The following anonymous ID is invalid: ${this.id}`;
  }
}
