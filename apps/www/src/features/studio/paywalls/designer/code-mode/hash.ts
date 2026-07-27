/**
 * Cheap, non-cryptographic string hash (djb2) used to key compilation state by
 * source. Re-exported from `@voidhash/paywall-workspace` so the browser
 * compile pipeline and the server-side manifest cache hash source identically —
 * the manifest upload keys rows by this hash and the server resolves manifests
 * by re-hashing each code-component's source, so any drift would silently break
 * server-side registry resolution.
 */
export { hashSource } from "@voidhash/paywall-workspace";
