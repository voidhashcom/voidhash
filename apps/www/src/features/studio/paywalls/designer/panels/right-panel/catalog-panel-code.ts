"use client";

/**
 * Fetches a deployed catalog component's custom-panel bundle
 * (`<artifactBaseUrl>/panel.js`) so the {@link ./component-panel-host slot} can
 * mount a sandboxed session for a catalog component, mirroring the LOCAL path
 * where the compiled code lives in the store.
 *
 * The bundle is content-addressed and immutable per `contentHash`, so a single
 * module-scoped {@link Map} caches the in-flight (and resolved) fetch per hash:
 * two mounts of the same catalog component share ONE network request, and a
 * later mount reuses the resolved code with no refetch. A rejected fetch is
 * evicted from the cache so a subsequent mount may retry (a soft-degrade to the
 * default panel is not a permanent state).
 *
 * The URL is always `<artifactBaseUrl>/panel.js` where `artifactBaseUrl` is the
 * server-handed `…/c/<contentHash>` base (§5.1 of the deploy contract): no new
 * origin is introduced and the client never assembles the URL from the storage
 * layout itself. The response is size-capped at {@link PANEL_CODE_SIZE_CAP}
 * before it is read as text, so an oversized (or mislabeled) artifact degrades
 * to the default panel instead of feeding an unbounded string to the sandbox.
 */
import { SIZE_CAPS } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";

/**
 * Largest panel bundle the host will load, matching the deploy contract's JS
 * bundle cap (§1.1) — the same ceiling the CLI/server enforce on the uploaded
 * `panel.js`, so a within-contract artifact always fits.
 */
export const PANEL_CODE_SIZE_CAP = SIZE_CAPS.jsBundle;

/** The `fetch` seam — the real global by default; injectable for tests. */
export type PanelCodeFetch = (url: string) => Promise<Response>;

/**
 * Resolved successfully with the panel code, or `null` on any soft failure
 * (non-ok response, over the size cap, or a read/network error). A `null`
 * outcome tells the caller to stay on the default panel WITHOUT surfacing an
 * error banner — a missing/oversized catalog panel is a degrade, not a crash.
 */
type PanelCodeOutcome = string | null;

/** In-flight + resolved fetches, keyed by immutable `contentHash`. */
const cache = new Map<string, Promise<PanelCodeOutcome>>();

/** Test-only reset so a fresh module cache can be asserted per case. */
export function __resetCatalogPanelCodeCache(): void {
  cache.clear();
}

async function loadPanelCode(
  url: string,
  fetchImpl: PanelCodeFetch,
): Promise<PanelCodeOutcome> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      return null;
    }
    // Prefer the declared length to reject an oversized body before reading it;
    // fall back to capping the read text (a missing/lying header still can't
    // exceed the cap because the text length is re-checked below).
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > PANEL_CODE_SIZE_CAP) {
      return null;
    }
    const text = await response.text();
    if (text.length > PANEL_CODE_SIZE_CAP) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

/**
 * Returns the catalog component's panel code for `contentHash`, fetching it
 * once and caching the result (and the in-flight promise) per hash. A rejected
 * network read resolves to `null` and is evicted so a later mount may retry.
 */
export function fetchCatalogPanelCode(
  contentHash: string,
  artifactBaseUrl: string,
  fetchImpl: PanelCodeFetch = (url) => fetch(url),
): Promise<PanelCodeOutcome> {
  const existing = cache.get(contentHash);
  if (existing !== undefined) {
    return existing;
  }
  const pending = loadPanelCode(`${artifactBaseUrl}/panel.js`, fetchImpl).then((outcome) => {
    // Evict soft failures so a subsequent mount can retry; keep a successful
    // (immutable) bundle cached forever.
    if (outcome === null) {
      cache.delete(contentHash);
    }
    return outcome;
  });
  cache.set(contentHash, pending);
  return pending;
}
