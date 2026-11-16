import packageJson from "../../package.json";

/** The published package version, reported as `x-sdk-version` and `$sdk_version`. */
export const SDK_VERSION: string = packageJson.version;
