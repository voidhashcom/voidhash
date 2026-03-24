import { Schema } from "effect";

/** Generic customer service error */
export class CustomerServiceError extends Schema.TaggedErrorClass<CustomerServiceError>()(
  "CustomerServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Customer not found */
export class CustomerNotFoundError extends Schema.TaggedErrorClass<CustomerNotFoundError>()(
  "CustomerNotFoundError",
  {
    id: Schema.NonEmptyString,
  },
  { httpApiStatus: 404 }
) {
  override toString(): string {
    return `The following customer not found: ${this.id}`;
  }
}

/** Anonymous ID is invalid */
export class CustomerInvalidAnonymousIdError extends Schema.TaggedErrorClass<CustomerInvalidAnonymousIdError>()(
  "CustomerInvalidAnonymousIdError",
  {
    id: Schema.NonEmptyString,
  },
  { httpApiStatus: 400 }
) {
  override toString(): string {
    return `The following anonymous ID is invalid: ${this.id}`;
  }
}
