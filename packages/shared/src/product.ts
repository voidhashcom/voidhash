import { Schema } from 'effect';

export class ProductServiceError extends Schema.TaggedError<ProductServiceError>()(
  'ProductServiceError',
  {
    cause: Schema.String
  }
) {}

export class ProductNotFoundError extends Schema.TaggedError<ProductNotFoundError>()(
  'ProductNotFoundError',
  {
    message: Schema.String
  }
) {}
