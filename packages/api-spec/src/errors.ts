import { Schema } from 'effect';

export class InternalError extends Schema.TaggedError<InternalError>()(
  'InternalError',
  {
    message: Schema.optionalWith(Schema.String, {
      default: () => 'An internal error occurred'
    })
  }
) {}
