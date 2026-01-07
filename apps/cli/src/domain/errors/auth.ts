import { Data } from "effect";

export class NoSignedInUserError extends Data.TaggedError(
  "NoSignedInUserError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class FailedToGetSessionError extends Data.TaggedError(
  "FailedToGetSessionError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class FailedToLogoutError extends Data.TaggedError(
  "FailedToLogoutError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class FailedToLoginError extends Data.TaggedError("FailedToLoginError")<{
  readonly cause?: unknown;
  readonly message: string;
}> {}
