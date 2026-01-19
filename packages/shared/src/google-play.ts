import { Schema } from "effect";

export class GooglePlayServiceError extends Schema.TaggedError<GooglePlayServiceError>()(
  "GooglePlayServiceError",
  {
    cause: Schema.String,
  }
) {}

export class GooglePlayNotEnabledForPackageNameError extends Schema.TaggedError<GooglePlayNotEnabledForPackageNameError>()(
  "GooglePlayNotEnabledForPackageNameError",
  {
    packageName: Schema.String,
  }
) {
  toString(): string {
    return `Google Play is not enabled for the following package name: ${this.packageName}`;
  }
}
