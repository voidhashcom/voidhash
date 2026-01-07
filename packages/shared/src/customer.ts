import { Schema } from "effect";

export class CustomerServiceError extends Schema.TaggedError<CustomerServiceError>()(
  "CustomerServiceError",
  {
    cause: Schema.String,
  }
) {}

export class CustomerNotFoundError extends Schema.TaggedError<CustomerNotFoundError>()(
  "CustomerNotFoundError",
  {
    id: Schema.NonEmptyString,
  }
) {
  toString(): string {
    return `The following customer not found: ${this.id}`;
  }
}

export class CustomerInvalidAnonymousIdError extends Schema.TaggedError<CustomerInvalidAnonymousIdError>()(
  "CustomerInvalidAnonymousIdError",
  {
    id: Schema.NonEmptyString,
  }
) {
  toString(): string {
    return `The following anonymous ID is invalid: ${this.id}`;
  }
}
