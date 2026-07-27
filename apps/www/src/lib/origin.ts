const devFallbackOrigin = "http://localhost:3000";

/**
 * Returns the origin serving the current app instance.
 */
export const getAppOrigin = (request?: Request): string => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return devFallbackOrigin;
};

/**
 * Builds an absolute app URL from the current browser origin or a server request.
 */
export const getAppUrl = (pathname: string, request?: Request): string =>
  new URL(pathname, getAppOrigin(request)).toString();
