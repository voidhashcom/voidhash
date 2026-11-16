/**
 * Campaign attribution: which ad or campaign brought the end user to the page.
 *
 * A page load or client-side navigation whose URL carries one of
 * {@link TOUCH_PARAMS} is a touch. The first touch is written to the person
 * once (`$initial_*` traits, via `$set_once`) and every new touch overwrites
 * the latest one (`$latest_*`, via `$set`). The page view of a touch carries
 * the same values as `$`-prefixed event properties.
 *
 * Reads of cookies and `sessionStorage` swallow failures: this code runs on
 * landing pages and must never throw into them.
 */
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";

import { isJsonObject, isStringRecord, parseJson } from "../json";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

/** Each ad platform's click id with the network it decides; the first one present wins. */
const CLICK_ID_NETWORKS = {
  fbclid: "meta",
  gclid: "google",
  gbraid: "google",
  wbraid: "google",
  gad_source: "google",
  gad_campaignid: "google",
  dclid: "google",
  ttclid: "tiktok",
  msclkid: "microsoft",
  twclid: "x",
  li_fat_id: "linkedin",
  ScCid: "snapchat",
  rdt_cid: "reddit",
  epik: "pinterest",
} as const;

const CLICK_IDS = R.keys(CLICK_ID_NETWORKS);

const AD_ID_PARAMS = ["campaign_id", "adset_id", "ad_id"] as const;

/** URL parameters whose presence makes a page view a touch. */
export const TOUCH_PARAMS = [...UTM_KEYS, ...CLICK_IDS, ...AD_ID_PARAMS];

/**
 * One touch as flat string values, keyed like the trait suffixes: the `utm_*`
 * parameters, the click ids, `ad_network`, `ad_campaign_id`, `ad_adset_id`,
 * `ad_id`, `referrer_origin`, `landing_path` and the ISO-8601 `touch_at`, which
 * is always present. Keys without a value are left out. `store_referrer` is
 * not one of them: it is what a store link carries for the touch, and is never
 * sent as a trait or an event property.
 */
export type Touch = Readonly<Record<string, string>>;

/**
 * Touches noticed that were not recorded yet because consent was pending, plus
 * the signature of the last touch, so a reload of the same campaign URL is not
 * a new touch.
 */
export interface TouchState {
  readonly first?: Touch;
  readonly latest?: Touch;
  readonly signature?: string;
}

/**
 * The touches one client holds in memory while consent is pending. With
 * `storeBeforeConsent: false` this is the only place they are, so a client-side
 * navigation before the visitor answers does not lose them.
 */
export interface HeldTouches {
  state: TouchState;
}

/** Reads a stored touch state; none when it is not one, so a corrupt state starts over. */
const decodeTouchState = (raw: string): Option.Option<TouchState> =>
  Option.flatMap(parseJson(raw), (value) => {
    if (!isJsonObject(value)) return Option.none();
    const { first, latest, signature } = value;
    if (
      (first !== undefined && !isStringRecord(first)) ||
      (latest !== undefined && !isStringRecord(latest)) ||
      (signature !== undefined && !P.isString(signature))
    ) {
      return Option.none();
    }
    return Option.some({
      ...(first !== undefined && { first }),
      ...(latest !== undefined && { latest }),
      ...(signature !== undefined && { signature }),
    });
  });

const encodeTouchState = (state: TouchState) =>
  JSON.stringify({ first: state.first, latest: state.latest, signature: state.signature });

/** What each known ad platform's `utm_source` means, lowercased. */
const SOURCE_NETWORKS: Readonly<Record<string, string>> = {
  facebook: "meta",
  fb: "meta",
  instagram: "meta",
  ig: "meta",
  meta: "meta",
  google: "google",
  adwords: "google",
  googleads: "google",
  tiktok: "tiktok",
  bing: "microsoft",
  microsoft: "microsoft",
  twitter: "x",
  x: "x",
  linkedin: "linkedin",
  snapchat: "snapchat",
  reddit: "reddit",
  pinterest: "pinterest",
};

/** `utm_medium` values, lowercased, that mark a touch as paid. */
const PAID_MEDIA: ReadonlySet<string> = new Set([
  "cpc",
  "ppc",
  "paid",
  "paid_social",
  "paidsocial",
  "paid-social",
  "paid_search",
  "paidsearch",
  "paid-search",
  "cpm",
  "cpv",
  "display",
  "banner",
  "retargeting",
  "remarketing",
  "ad",
  "ads",
  "sem",
]);

/** Longest parameter value kept; longer values are truncated. */
const MAX_VALUE_LENGTH = 1_000;

/** Meta treats an ad click as attributable for about 90 days. */
export const FBC_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const FBC_FORMAT = /^fb\.\d+\.(\d+)\.(.+)$/;

/**
 * `encodeURIComponent`, whose input can come from storage or the page: it throws
 * on half a surrogate pair, which reads as nothing to encode here.
 */
export const encodeValue = (value: string) =>
  Option.getOrElse(Option.liftThrowable(encodeURIComponent)(value), () => "");

/** A value, cut to length without leaving half a surrogate pair at its end. */
const param = (params: URLSearchParams, name: string) =>
  Option.map(
    Option.filter(Option.fromNullishOr(params.get(name)?.trim()), Str.isNonEmpty),
    (value) => value.slice(0, MAX_VALUE_LENGTH).replace(/[\uD800-\uDBFF]$/, ""),
  );

const originOf = Option.liftThrowable((url: string) => new URL(url).origin);

/**
 * The ad network behind a touch, none when it is organic. The Android SDK
 * applies the same rule to a store referrer; the shared
 * `touch-attribution.json` fixture keeps the two in step.
 */
const deriveAdNetwork = (params: URLSearchParams) => {
  const clicked = Arr.findFirst(R.toEntries(CLICK_ID_NETWORKS), ([clickId, network]) =>
    Option.map(param(params, clickId), () => network),
  );
  if (Option.isSome(clicked)) return Option.some<string>(clicked.value);

  const source = Option.map(param(params, "utm_source"), Str.toLowerCase);
  const network = Option.map(source, (value) =>
    Option.getOrElse(R.get(SOURCE_NETWORKS, value), () => value),
  );
  const medium = param(params, "utm_medium");
  const isPaid =
    Option.exists(medium, (value) => PAID_MEDIA.has(value.toLowerCase())) ||
    Arr.some(AD_ID_PARAMS, (name) => Option.isSome(param(params, name)));
  if (isPaid) return network;
  // A known ad platform without a medium is taken at its word; any other
  // source, or a medium that is not paid, is organic.
  return Option.isNone(medium) && Option.exists(source, (value) => R.has(SOURCE_NETWORKS, value))
    ? network
    : Option.none<string>();
};

/**
 * Reads the touch carried by `url`, if it has any of {@link TOUCH_PARAMS}.
 * `referrer` is the document referrer; only its origin is kept, as only the
 * path of the landing page is.
 */
export const parseTouch = (input: {
  readonly now: Date;
  readonly referrer: string;
  readonly url: URL;
}): Option.Option<Touch> => {
  const params = input.url.searchParams;
  if (!Arr.some(TOUCH_PARAMS, (name) => Option.isSome(param(params, name)))) {
    return Option.none();
  }

  const touchAt = input.now.toISOString();
  return Option.some({
    ...R.getSomes(
      R.fromEntries(Arr.map([...UTM_KEYS, ...CLICK_IDS], (name) => [name, param(params, name)])),
    ),
    ...R.getSomes({
      ad_network: deriveAdNetwork(params),
      ad_campaign_id: Arr.findFirst(["campaign_id", "utm_id", "gad_campaignid"], (name) =>
        param(params, name),
      ),
      ad_adset_id: param(params, "adset_id"),
      ad_id: param(params, "ad_id"),
      referrer_origin: Option.filter(originOf(input.referrer), (origin) => origin !== "null"),
      landing_path: Option.some(input.url.pathname),
    }),
    // The parameters as they came, so the Android SDK reads them with the rules
    // that read them here, and the time of the click, as Play dates an install
    // referrer to the click on its link, which can be months later.
    store_referrer: [
      ...Arr.getSomes(
        Arr.map(TOUCH_PARAMS, (name) =>
          Option.map(param(params, name), (value) => `${name}=${encodeValue(value)}`),
        ),
      ),
      `touch_at=${encodeValue(touchAt)}`,
    ].join("&"),
    touch_at: touchAt,
  });
};

const SIGNATURE_KEYS = [
  ...UTM_KEYS,
  ...CLICK_IDS,
  "ad_campaign_id",
  "ad_adset_id",
  "ad_id",
] as const;

/**
 * Identifies a touch by its campaign values, ignoring time, page and referrer,
 * so a reload or a navigation that keeps the same query is not a new touch.
 */
export const touchSignature = (touch: Touch) =>
  Arr.map(SIGNATURE_KEYS, (key) => touch[key] ?? "").join("|");

/**
 * Every value a touch can carry, in the order of the trait contract.
 * `touch_source` and `touch_kind` only have values on a touch from a native SDK;
 * a web touch writes them as `null`, so it clears what such a touch left.
 */
export const TOUCH_KEYS = [
  ...UTM_KEYS,
  ...CLICK_IDS,
  "ad_network",
  "ad_campaign_id",
  "ad_adset_id",
  "ad_id",
  "referrer_origin",
  "landing_path",
  "touch_at",
  "touch_source",
  "touch_kind",
] as const;

/**
 * The person traits of a touch under `prefix` (`$initial_` or `$latest_`).
 *
 * Every key is written, with `null` for a value the touch does not have.
 * Person traits are folded key by key, so a key left out would keep the value
 * of another touch: a later touch's `$set` would leave the previous click's
 * `$latest_ad_id` in place, and a later touch's `$set_once` would fill
 * `$initial_ad_id` for a first visit that had none.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- `null` is the JSON value that clears a person trait on the wire; it is never read back here.
export const touchTraits = (touch: Touch, prefix: string): Record<string, string | null> =>
  R.fromEntries(Arr.map(TOUCH_KEYS, (key) => [`${prefix}${key}`, touch[key] ?? null]));

/** The `$`-prefixed event properties of a touch, only the keys it has. */
export const touchProperties = (touch: Touch): Record<string, string> =>
  R.fromEntries(
    Arr.map(
      Arr.filter(R.toEntries(touch), ([key]) => key !== "store_referrer"),
      ([key, value]) => [`$${key}`, value],
    ),
  );

const readCookieJar = Option.liftThrowable(() => document.cookie);
const decodeCookieValue = Option.liftThrowable(decodeURIComponent);

/** Reads one cookie; none when it is absent, empty or cookies are unavailable. */
export const readCookie = (name: string): Option.Option<string> => {
  if (P.isUndefined(globalThis.document)) return Option.none();
  return Option.flatMap(readCookieJar(), (jar) =>
    Arr.findFirst(jar.split(";"), (part) => {
      const separator = part.indexOf("=");
      if (separator <= 0 || part.slice(0, separator).trim() !== name) return Option.none();
      return Option.filter(decodeCookieValue(part.slice(separator + 1).trim()), Str.isNonEmpty);
    }),
  );
};

/**
 * Meta's click id in the `fb.<subdomainIndex>.<creationTimeMs>.<fbclid>` format.
 *
 * A valid `_fbc` cookie younger than {@link FBC_MAX_AGE_MS} is preferred,
 * unless the touch carries a different, newer `fbclid`. Otherwise it is built
 * from the touch's `fbclid` and the time of the click, with subdomain index 1,
 * the value Meta documents for a cookie set on the registrable domain.
 */
export const resolveFbc = (input: {
  /** Epoch milliseconds of the click that carried `fbclid`. */
  readonly clickedAt: number;
  readonly cookie: Option.Option<string>;
  readonly fbclid: Option.Option<string>;
  readonly now: number;
}): Option.Option<string> => {
  const validCookie = Option.flatMap(input.cookie, (cookie) => {
    const match = FBC_FORMAT.exec(cookie);
    if (match === null) return Option.none();
    const createdAt = Number(match[1]);
    const isFresh = createdAt > 0 && input.now - createdAt <= FBC_MAX_AGE_MS;
    const matchesClick = Option.match(input.fbclid, {
      onNone: () => true,
      onSome: (fbclid) => match[2] === fbclid,
    });
    return isFresh && matchesClick ? Option.some(cookie) : Option.none();
  });
  return Option.orElse(validCookie, () =>
    Option.map(input.fbclid, (fbclid) => `fb.1.${input.clickedAt}.${fbclid}`),
  );
};

/**
 * The referrer of the latest touch recorded, for `playStoreUrl`. Under the
 * analytics prefix, so withdrawing consent removes it with the rest.
 */
export const LATEST_TOUCH_KEY = "analytics:latest-touch";

/** `sessionStorage` key of the touch state, one per project. */
export const touchStateKey = (publishableKey: string) => `@voidhash/web:${publishableKey}:touch`;

/**
 * `sessionStorage`, if the browser allows it. Reading the property itself
 * throws a `SecurityError` when storage is blocked for the site, so the read is
 * guarded too, not just `getItem` and `setItem`.
 */
const sessionStorageRef = (): Option.Option<Storage> =>
  Option.flatMap(Option.liftThrowable(() => globalThis.sessionStorage)(), Option.fromNullishOr);

/**
 * Reads the touch state of this browser session. It lives in `sessionStorage`
 * on purpose: touches noticed before analytics consent are held there and
 * never outlive the browser session.
 */
export const readTouchState = (key: string): TouchState =>
  Option.getOrElse(
    Option.flatMap(
      Option.flatMap(
        sessionStorageRef(),
        Option.liftThrowable((storage: Storage) => storage.getItem(key)),
      ),
      (raw) => (raw === null ? Option.none() : decodeTouchState(raw)),
    ),
    () => ({}),
  );

/**
 * Stores the touch state of this browser session; a refused write is ignored.
 * An empty state removes the entry, so nothing is left in storage for a
 * visitor who declined analytics or never arrived from a campaign.
 */
export const writeTouchState = (key: string, state: TouchState) => {
  const isEmpty =
    state.first === undefined && state.latest === undefined && state.signature === undefined;
  Option.map(
    sessionStorageRef(),
    Option.liftThrowable((storage: Storage) =>
      isEmpty ? storage.removeItem(key) : storage.setItem(key, encodeTouchState(state)),
    ),
  );
};

const onlySignature = ({ signature }: TouchState): TouchState =>
  signature === undefined ? {} : { signature };

/**
 * Forgets the touches held for consent, in memory and in `sessionStorage`, when
 * the next person takes over the device: they must not pass to them. The
 * signatures stay, so a campaign URL still in the address bar is not read as
 * that person's touch.
 */
export const forgetHeldTouches = (key: string, held: HeldTouches) => {
  held.state = onlySignature(held.state);
  writeTouchState(key, onlySignature(readTouchState(key)));
};
