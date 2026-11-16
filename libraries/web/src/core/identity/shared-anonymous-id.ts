/**
 * The cookie behind `crossSubdomainIdentity`: an anonymous id shared by the
 * subdomains of a site, on its registrable domain. The identity manager decides
 * when it may be read or written; it never holds a user id.
 *
 * Its value is `<anonymous id>[.<digest>...]`. A digest names an id a sign-in has
 * since linked to a user, so a device still holding that id can give it up. It
 * is a digest because the linked id itself gives access to that user's
 * subscriptions and perks, and any subdomain can read this cookie.
 *
 * Every access is guarded, as `document.cookie` throws where the browser blocks
 * cookies for the page, and this code must never throw into it.
 */
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

import { readCookie } from "../analytics/attribution";
import { digest } from "../caching/cache-manager";

/** Browsers cap a cookie at 400 days. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** Any subdomain can write the cookie, so its value must look like an id the SDK made. */
const ANONYMOUS_ID_FORMAT = /^vh_anon_[\w-]{1,64}$/;

const RETIRED_DIGEST_FORMAT = /^[0-9a-f]{8}$/;

/** How many retired ids the cookie names, so several sign-ins in a row do not lose one. */
const MAX_RETIRED_IDS = 3;

/** One cookie per project, as storage is, so two projects on a site stay apart. */
export const sharedIdCookieName = (publishableKey: string) => `vh_id_${digest(publishableKey)}`;

const setCookie = Option.liftThrowable((cookie: string) => {
  document.cookie = cookie;
});

/**
 * The domains a cookie of this page could be set on, from the top down. The
 * last label alone never qualifies, so a host such as `localhost` has none,
 * and neither has a server, where consent can be set before the page exists.
 */
const candidateDomains = () => {
  if (P.isUndefined(globalThis.location)) return [];
  const labels = location.hostname.split(".");
  return Arr.reverse(labels.map((_, index) => labels.slice(index).join("."))).slice(1);
};

const cookieAttributes = (domain: string) =>
  `; Domain=${domain}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;

/**
 * The registrable domain: the highest one the browser accepts a cookie on, as
 * it refuses public suffixes such as `co.uk`. It is probed with a cookie of its
 * own, which leaves the live one alone for a tab that starts at that instant,
 * and which a shared id already on the device cannot pass for.
 */
const findRegistrableDomain = (cookieName: string) => {
  const probeName = `${cookieName}_probe`;
  return Arr.findFirst(candidateDomains(), (domain) => {
    setCookie(`${probeName}=1${cookieAttributes(domain)}`);
    const isAccepted = Option.isSome(readCookie(probeName));
    setCookie(`${probeName}=${cookieAttributes(domain)}; Max-Age=0`);
    return isAccepted;
  });
};

/**
 * What the cookie holds; none without a cookie, or when it holds anything but an
 * anonymous id. Any subdomain can write it, so a list that is not well formed
 * counts as empty, and leaves the id it came with usable.
 */
export const readSharedIdCookie = (cookieName: string) =>
  Option.flatMap(readCookie(cookieName), (value) => {
    const [anonymousId = "", ...retired] = value.split(".");
    return ANONYMOUS_ID_FORMAT.test(anonymousId)
      ? Option.some({
          anonymousId,
          retired:
            retired.length <= MAX_RETIRED_IDS &&
            retired.every((other) => RETIRED_DIGEST_FORMAT.test(other))
              ? retired
              : [],
        })
      : Option.none();
  });

/** The cookie's retired list with `anonymousId` added, the oldest giving way. */
export const retiredWith = (retired: ReadonlyArray<string>, anonymousId: string) =>
  [...retired, digest(anonymousId)].slice(-MAX_RETIRED_IDS);

/** Whether the cookie's retired list names `anonymousId`. */
export const namesRetired = (retired: ReadonlyArray<string>, anonymousId: string) =>
  retired.includes(digest(anonymousId));

/**
 * Shares `anonymousId` for another 400 days, and says whether it could: not where
 * cookies are refused, and not for an id of another form, such as a seed of the
 * app's own, which no other subdomain could read back.
 */
export const writeSharedAnonymousId = (
  cookieName: string,
  anonymousId: string,
  retired: ReadonlyArray<string>,
) => {
  if (!ANONYMOUS_ID_FORMAT.test(anonymousId)) return false;
  const domain = findRegistrableDomain(cookieName);
  if (Option.isNone(domain)) return false;
  const value = [anonymousId, ...retired].join(".");
  setCookie(`${cookieName}=${value}${cookieAttributes(domain.value)}; Max-Age=${MAX_AGE_SECONDS}`);
  return true;
};

/** Removes the shared id from every domain it could be on. */
export const deleteSharedAnonymousId = (cookieName: string) => {
  Arr.forEach(candidateDomains(), (domain) => {
    setCookie(`${cookieName}=${cookieAttributes(domain)}; Max-Age=0`);
  });
};
