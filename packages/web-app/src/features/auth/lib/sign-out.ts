import { toSafeReturnPathname } from "./validation";

const buildAuthUrl = (
  pathname: string,
  paramName: "returnTo",
  rawValue: string | undefined,
  fallback: string,
) => {
  const origin = window.location.origin;
  const safeValue = toSafeReturnPathname(rawValue, origin) ?? fallback;
  const url = new URL(pathname, origin);
  url.searchParams.set(paramName, safeValue);
  return url.toString();
};

export const redirectToSignOut = (returnTo = "/") => {
  window.location.href = buildAuthUrl("/auth/logout", "returnTo", returnTo, "/");
};
