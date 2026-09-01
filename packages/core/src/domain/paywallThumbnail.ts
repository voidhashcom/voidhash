import * as Option from "effect/Option";

/**
 * Public URL + object-key helpers for paywall thumbnails, mirroring the
 * ownership guards in {@link file://./paywallAssetImage.ts}. Thumbnails live in
 * the same public file store as paywall assets, under a distinct
 * `paywall-thumbnails/<projectId>/<paywallId>/thumbnail.png` layout, and are
 * served at `${publicBaseUrl}/files/<key>` like every other public object.
 */

/**
 * Stable object key for a paywall's rendered thumbnail. New renders overwrite
 * this object so each paywall owns at most one current thumbnail.
 */
export const derivePaywallThumbnailKey = (projectId: string, paywallId: string): string =>
  `paywall-thumbnails/${projectId}/${paywallId}/thumbnail.png`;

/**
 * Whether a stored thumbnail URL points at an object owned by the given
 * paywall in our own public file store (so it is safe to delete). Guards both
 * against deleting external URLs and against deleting another paywall's object.
 */
export const isOwnedPaywallThumbnailUrl = (
  url: Option.Option<string>,
  projectId: string,
  paywallId: string,
  publicBaseUrl: string,
): boolean =>
  Option.exists(url, (value) =>
    value.startsWith(`${publicBaseUrl}/files/paywall-thumbnails/${projectId}/${paywallId}/`),
  );

/**
 * Extracts the object key from one of our public paywall-thumbnail URLs when it
 * is owned by `paywallId` in `projectId`, or `null`. The prefix check keeps
 * deletion scoped to this paywall's own thumbnails.
 */
export const paywallThumbnailKeyFromUrl = (
  url: string,
  projectId: string,
  paywallId: string,
  publicBaseUrl: string,
): Option.Option<string> => {
  const prefix = `${publicBaseUrl}/files/`;
  if (!url.startsWith(prefix)) {
    return Option.none();
  }
  const key = url.slice(prefix.length).split(/[?#]/, 1)[0];
  if (key?.startsWith(`paywall-thumbnails/${projectId}/${paywallId}/`)) {
    return Option.some(key);
  }
  return Option.none();
};
