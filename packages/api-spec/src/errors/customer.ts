import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic customer service error */
export class CustomerServiceError extends Schema.TaggedError<CustomerServiceError>()(
  "CustomerServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Customer not found */
export class CustomerNotFoundError extends Schema.TaggedError<CustomerNotFoundError>()(
  "CustomerNotFoundError",
  {
    id: Schema.NonEmptyString,
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  toString(): string {
    return `The following customer not found: ${this.id}`;
  }
}

/** Anonymous ID is invalid */
export class CustomerInvalidAnonymousIdError extends Schema.TaggedError<CustomerInvalidAnonymousIdError>()(
  "CustomerInvalidAnonymousIdError",
  {
    id: Schema.NonEmptyString,
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  toString(): string {
    return `The following anonymous ID is invalid: ${this.id}`;
  }
}
