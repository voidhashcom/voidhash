import { Schema } from 'effect';

export class PaywallServiceError extends Schema.TaggedError<PaywallServiceError>()(
  'PaywallServiceError',
  {
    cause: Schema.String
  }
) {}

export class PaywallNotFoundError extends Schema.TaggedError<PaywallNotFoundError>()(
  'PaywallNotFoundError',
  {
    message: Schema.String
  }
) {}

export class PaywallSlugAlreadyExistsError extends Schema.TaggedError<PaywallSlugAlreadyExistsError>()(
  'PaywallSlugAlreadyExistsError',
  {
    slug: Schema.String
  }
) {
  toString(): string {
    return `The following paywall slug already exists: ${this.slug}`;
  }
}
