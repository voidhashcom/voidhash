import { Schema } from 'effect';

export class OrganizationServiceError extends Schema.TaggedError<OrganizationServiceError>()(
  'OrganizationServiceError',
  {
    message: Schema.String
  }
) {}
