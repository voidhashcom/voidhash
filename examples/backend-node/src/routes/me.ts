import type { VoidhashNodeClient } from "@voidhash/node";

import type { EntitlementsCache } from "../entitlements-cache";
import { requireDistinctId, sendJson } from "../http";
import type { NoteStore } from "../notes";
import type { RouteHandler } from "../server";
import { findPersonByDistinctId } from "../voidhash";

export type MeRouteOptions = {
  readonly voidhash: VoidhashNodeClient;
  readonly entitlements: EntitlementsCache;
  readonly notes: NoteStore;
};

/**
 * `GET /v1/me?distinctId=…` — who the caller is and what they may do.
 *
 * A distinct id Voidhash has never seen is a free user with no grants, not a
 * 500: the client identifies people lazily, so "unknown" is a normal state.
 */
export const createMeRoute = (options: MeRouteOptions): RouteHandler => {
  const { entitlements, notes, voidhash } = options;

  return async (_request, response, url) => {
    const distinctId = requireDistinctId(url);

    const [person, access] = await Promise.all([
      findPersonByDistinctId(voidhash, distinctId),
      entitlements.resolve(distinctId),
    ]);

    sendJson(response, 200, {
      attributes: {
        notes_created: notes.count(distinctId),
        plan: access.hasPro ? "pro" : "free",
      },
      distinctId,
      entitlementsStale: access.stale,
      grants: access.grants,
      person,
    });
  };
};
