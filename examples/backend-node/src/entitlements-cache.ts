import type { VoidhashEntitlementGrant, VoidhashNodeClient } from "@voidhash/node";

import { classifyVoidhashFailure, VoidhashUnavailableError } from "./voidhash";

const DEFAULT_TTL_MS = 60_000;

/** What the cache knows about one person's access, and how sure it is. */
export type EntitlementSnapshot = {
  readonly grants: ReadonlyArray<VoidhashEntitlementGrant>;
  readonly hasPro: boolean;
  /** `true` when Voidhash could not be reached and this is the last good answer. */
  readonly stale: boolean;
  readonly fetchedAt: number;
};

export type EntitlementsCache = {
  /**
   * Access for one person, from cache when fresh.
   *
   * Rejects with {@link VoidhashUnavailableError} only when Voidhash is
   * unreachable *and* nothing is cached for this person.
   */
  readonly resolve: (distinctId: string) => Promise<EntitlementSnapshot>;
  /** Drops the cached answer, e.g. after a purchase webhook. */
  readonly invalidate: (distinctId: string) => void;
};

type CacheEntry = Omit<EntitlementSnapshot, "stale">;

export type EntitlementsCacheOptions = {
  readonly voidhash: VoidhashNodeClient;
  /** Perk slug that grants access, resolved to an id once and reused. */
  readonly perkSlug: string;
  readonly ttlMs?: number;
};

/**
 * A 60-second read-through cache in front of the entitlement check.
 *
 * Three things here are not in the SDK, because the SDK deliberately does not
 * cache, retry or de-duplicate:
 *
 * 1. **The TTL.** An access check sits on every request; a live round trip per
 *    request is not a hot path you want.
 * 2. **Failure is not denial.** A 5xx or a transport error means *unknown*, so
 *    the last known answer is served stale rather than revoking a paying user.
 * 3. **Single flight.** Concurrent requests for the same person share one
 *    in-flight refresh instead of stampeding the API.
 */
export const createEntitlementsCache = (
  options: EntitlementsCacheOptions,
): EntitlementsCache => {
  const { perkSlug, voidhash } = options;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  const entries = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<CacheEntry>>();

  // `perkSlug` costs an extra `perks.listPerks` round trip to resolve, so do it
  // once and hold on to the id. The promise is cleared on failure so a network
  // blip during boot does not poison every later lookup.
  let perkIdPromise: Promise<string | undefined> | undefined;

  const findPerkId = async (cursor?: string): Promise<string | undefined> => {
    const page = await voidhash.perks.listPerks({
      params: { cursor, limit: undefined, projectId: undefined },
    });
    const perk = page.data.find((candidate) => candidate.slug === perkSlug);
    if (perk !== undefined) return perk.id;
    if (!page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) return undefined;
    return findPerkId(page.pageInfo.endCursor);
  };

  const resolvePerkId = (): Promise<string | undefined> => {
    if (perkIdPromise !== undefined) return perkIdPromise;
    const started = findPerkId()
      .then((perkId) => {
        if (perkId === undefined) {
          console.warn(
            `[voidhash] no perk with slug "${perkSlug}" exists in this project — nobody is Pro.`,
          );
        }
        return perkId;
      })
      .catch((error: unknown) => {
        perkIdPromise = undefined;
        throw error;
      });
    perkIdPromise = started;
    return started;
  };

  const fetchSnapshot = async (distinctId: string): Promise<CacheEntry> => {
    const perkId = await resolvePerkId();

    let grants: ReadonlyArray<VoidhashEntitlementGrant>;

    try {
      grants = await voidhash.entitlements.getGrantsByDistinctId({ distinctId });
    } catch (error) {
      if (classifyVoidhashFailure(error) !== "person_not_found") {
        throw error;
      }

      // Never identified from a client: nothing was ever bought.
      grants = [];
    }

    return {
      fetchedAt: Date.now(),
      grants,
      hasPro:
        perkId !== undefined &&
        grants.some((grant) => grant.perkId === perkId && grant.status === "active"),
    };
  };

  const refresh = (distinctId: string): Promise<CacheEntry> => {
    const pending = inFlight.get(distinctId);

    if (pending !== undefined) {
      return pending;
    }

    const started = fetchSnapshot(distinctId)
      .then((entry) => {
        entries.set(distinctId, entry);

        return entry;
      })
      .finally(() => {
        inFlight.delete(distinctId);
      });

    inFlight.set(distinctId, started);

    return started;
  };

  return {
    invalidate: (distinctId) => {
      entries.delete(distinctId);
    },
    resolve: async (distinctId) => {
      const cached = entries.get(distinctId);

      if (cached !== undefined && Date.now() - cached.fetchedAt < ttlMs) {
        return { ...cached, stale: false };
      }

      try {
        return { ...(await refresh(distinctId)), stale: false };
      } catch (error) {
        if (classifyVoidhashFailure(error) === "misconfigured") {
          console.error("[voidhash] secret key is invalid or lacks access.", error);
        } else {
          console.warn(`[voidhash] entitlement lookup for "${distinctId}" failed.`, error);
        }

        if (cached !== undefined) {
          return { ...cached, stale: true };
        }

        throw new VoidhashUnavailableError(
          `Could not resolve entitlements for "${distinctId}" and nothing is cached.`,
          { cause: error },
        );
      }
    },
  };
};
