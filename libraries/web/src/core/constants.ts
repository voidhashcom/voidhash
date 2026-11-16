import { version } from "../../package.json";

/** The published package version, reported as `x-sdk-version` and `$sdk_version`. */
export const SDK_VERSION: string = version;

/** Origin of the hosted Voidhash API, as the client options normalize it. */
export const DEFAULT_BASE_URL = "https://api.voidhash.com/";
