import { managedRuntime, VoidhashRpc } from "@/features/studio/lib/effect-query";

/**
 * A minted mimic edit session: the document host URL plus a single-use token
 * and its expiry.
 */
export interface PaywallEditSession {
  readonly expiresAt: Date;
  readonly token: string;
  readonly url: string;
}

/** Mints a fresh single-use edit session for the paywall document. */
export function mintPaywallEditSession(paywallId: string): Promise<PaywallEditSession> {
  return managedRuntime.runPromise(
    VoidhashRpc.use((rpc) => rpc.RequestPaywallEditToken({ paywallId })),
  );
}

interface PrefetchedSession {
  readonly promise: Promise<PaywallEditSession>;
  /** Set once the mint resolves; `null` while it is still in flight. */
  expiresAt: Date | null;
}

const prefetched = new Map<string, PrefetchedSession>();

/** Safety margin so a token is never handed out moments before it expires. */
const EXPIRY_SKEW_MS = 10_000;

const isUsable = (entry: PrefetchedSession) =>
  entry.expiresAt === null || entry.expiresAt.getTime() > Date.now() + EXPIRY_SKEW_MS;

/**
 * Starts (or reuses) an edit-session mint for a paywall. Called from the
 * designer route's loader so the mint overlaps the auth loader and the
 * designer chunk download instead of queuing behind them. Failed mints evict
 * themselves, and a cached session that expired before being consumed (e.g.
 * the user navigated away mid-load and came back much later) is re-minted.
 */
export function prefetchPaywallEditSession(paywallId: string): Promise<PaywallEditSession> {
  const existing = prefetched.get(paywallId);
  if (existing && isUsable(existing)) {
    return existing.promise;
  }
  const entry: PrefetchedSession = {
    expiresAt: null,
    promise: mintPaywallEditSession(paywallId),
  };
  prefetched.set(paywallId, entry);
  entry.promise.then(
    (session) => {
      entry.expiresAt = session.expiresAt;
    },
    () => {
      if (prefetched.get(paywallId) === entry) {
        prefetched.delete(paywallId);
      }
    },
  );
  return entry.promise;
}

/**
 * Drops the prefetched session for a paywall. Edit tokens are single-use, so
 * the transport calls this the moment it consumes the prefetched token —
 * later connects (retry, revisit) then mint fresh instead of replaying a
 * spent token.
 */
export function releasePaywallEditSession(paywallId: string): void {
  prefetched.delete(paywallId);
}
