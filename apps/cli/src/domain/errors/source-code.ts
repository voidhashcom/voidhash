import { Data } from "effect";

export class PackageJsonNotFoundError extends Data.TaggedError("PackageJsonNotFoundError")<{
  readonly message: string;
}> {}

export class InvalidPackageJsonError extends Data.TaggedError("InvalidPackageJsonError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToLoadPackageJsonError extends Data.TaggedError("FailedToLoadPackageJsonError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NoPackageManagerFoundError extends Data.TaggedError("NoPackageManagerFoundError")<{
  readonly message: string;
}> {}

export class FailedToDetectPackageManagerError extends Data.TaggedError(
  "FailedToDetectPackageManagerError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class VoidhashConfigNotFoundError extends Data.TaggedError("VoidhashConfigNotFoundError")<{
  readonly message: string;
}> {}

export class InvalidVoidhashConfigError extends Data.TaggedError("InvalidVoidhashConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToLoadVoidhashConfigError extends Data.TaggedError(
  "FailedToLoadVoidhashConfigError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
