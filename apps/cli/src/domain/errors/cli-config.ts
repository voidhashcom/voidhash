import { Data } from 'effect';

export class CliConfigFileNotFoundError extends Data.TaggedError(
  'ConfigFileNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class FailedToReadCliConfigError extends Data.TaggedError(
  'FailedToReadConfigError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}
