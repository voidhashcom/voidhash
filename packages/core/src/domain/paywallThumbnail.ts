/**
 * Public URL + object-key helpers for paywall thumbnails, mirroring the
 * ownership guards in {@link file://./paywallAssetImage.ts}. Thumbnails live in
 * the same public file store as paywall assets, under a distinct
 * `paywall-thumbnails/<projectId>/<paywallId>/<seq>.png` layout, and are served
 * at `${publicBaseUrl}/files/<key>` like every other public object.
 */

/**
 * Content-addressed-by-seq object key for one rendered thumbnail:
 * `paywall-thumbnails/<projectId>/<paywallId>/<seq>.png`. The `seq` in the key
 * makes each render immutable, so a newer render never overwrites an older
 * object in place — the previous object is deleted best-effort after the row
 * flips to the new URL.
 */
export const derivePaywallThumbnailKey = (
  projectId: string,
  paywallId: string,
  seq: number,
): string => `paywall-thumbnails/${projectId}/${paywallId}/${seq}.png`;

/**
 * Whether a stored thumbnail URL points at an object owned by the given
 * paywall in our own public file store (so it is safe to delete). Guards both
 * against deleting external URLs and against deleting another paywall's object.
 */
export const isOwnedPaywallThumbnailUrl = (
  url: string | null,
  projectId: string,
  paywallId: string,
  publicBaseUrl: string,
): boolean =>
  url !== null &&
  url.startsWith(`${publicBaseUrl}/files/paywall-thumbnails/${projectId}/${paywallId}/`);

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
): string | null => {
  const prefix = `${publicBaseUrl}/files/`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  const key = url.slice(prefix.length);
  return key.startsWith(`paywall-thumbnails/${projectId}/${paywallId}/`) ? key : null;
};
