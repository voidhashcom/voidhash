/**
 * Platform detection utilities.
 */

// Extend Navigator to include userAgentData (not yet in all TypeScript lib versions)
interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    platform: string;
  };
}

let cachedIsMac: boolean | undefined;

/**
 * Detect if the current platform is macOS.
 * Uses the modern `navigator.userAgentData` API with fallback to `navigator.platform`.
 * Result is cached for performance.
 */
export function isMacPlatform(): boolean {
  if (cachedIsMac !== undefined) {
    return cachedIsMac;
  }

  if (typeof navigator === "undefined") {
    cachedIsMac = false;
    return false;
  }

  // Modern approach with fallback to deprecated navigator.platform
  const nav = navigator as NavigatorWithUserAgentData;
  const platform = nav.userAgentData?.platform ?? navigator.platform;
  cachedIsMac = platform.toUpperCase().includes("MAC");
  return cachedIsMac;
}
