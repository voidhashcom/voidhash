import { Schema } from 'effect';

export class ProductServiceError extends Schema.TaggedError<ProductServiceError>()(
  'ProductServiceError',
  {
    cause: Schema.String
  }
) {}

export class ProductSlugAlreadyExistsError extends Schema.TaggedError<ProductSlugAlreadyExistsError>()(
  'ProductSlugAlreadyExistsError',
  {
    slug: Schema.String
  }
) {
  toString(): string {
    return `The following product slug already exists: ${this.slug}`;
  }
}

export class ProductNotFoundError extends Schema.TaggedError<ProductNotFoundError>()(
  'ProductNotFoundError',
  {
    message: Schema.String
  }
) {}
