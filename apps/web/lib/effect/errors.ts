import { Data } from 'effect';

export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}
