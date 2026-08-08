/**
 * Security validation utilities for OIDC flows
 */

/**
 * Validates that a redirect URL is safe (relative path or same-origin).
 * Prevents open redirect vulnerabilities.
 */
export const isValidRedirect = (url: string, origin: string): boolean => {
  // Allow relative paths that don't start with // (protocol-relative URLs)
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  const parsed = URL.parse(url, origin);
  if (!parsed) {
    return false;
  }
  return parsed.origin === origin;
};

export const toSafeReturnPathname = (
  url: string | null | undefined,
  origin?: string,
): string | undefined => {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  if (!origin || !isValidRedirect(url, origin)) {
    return undefined;
  }

  const parsed = URL.parse(url, origin);
  if (!parsed || parsed.origin !== origin) {
    return undefined;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

/**
 * Validates that a redirect URL is a localhost URL.
 * Used for device authorization flow to prevent SSRF.
 */
export const isValidLocalRedirect = (url: string): boolean => {
  const parsed = URL.parse(url);
  if (!parsed) {
    return false;
  }
  return (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]"
  );
};

/**
 * Device authorization code expiration time in milliseconds (10 minutes)
 */
export const DEVICE_CODE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Checks if a device authorization timestamp has expired
 */
export const isDeviceCodeExpired = (expiresAt: string | undefined): boolean => {
  if (!expiresAt) {
    return false;
  }
  // An unparseable timestamp yields NaN, and `NaN < now` is false — an invalid
  // code is therefore reported as not-yet-expired, matching the previous behaviour.
  return new Date(expiresAt).getTime() < Date.now();
};
