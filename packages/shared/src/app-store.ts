import { Schema } from "effect";

export class AppStoreServiceError extends Schema.TaggedError<AppStoreServiceError>()(
  "AppStoreServiceError",
  {
    cause: Schema.String,
  }
) {}

export class AppStoreNotEnabledForFollowingBundleIdError extends Schema.TaggedError<AppStoreNotEnabledForFollowingBundleIdError>()(
  "AppStoreNotEnabledForFollowingBundleIdError",
  {
    bundleId: Schema.String,
  }
) {
  toString(): string {
    return `App Store is not enabled for the following bundle ID: ${this.bundleId}`;
  }
}
