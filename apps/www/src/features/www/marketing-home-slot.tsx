import { redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { STUDIO_PATH } from "@/lib/paths";

/**
 * What the community build serves at `/`. A self-hosted deployment is an
 * application rather than a marketing site, so the root simply hands off to the
 * studio (which in turn redirects to sign-in when there is no session).
 *
 * Hosts that ship a marketing site replace this module — see
 * `apps/www/vite.config.ts` in voidhash-mono, which aliases it to the hosted
 * landing page.
 */
export const marketingHomeLoader = async (): Promise<void> => {
  // Raised as a defect so the router sees it on the rejected loader; mirrors the
  // hosted slot that replaces this module.
  Effect.runSync(Effect.die(redirect({ to: STUDIO_PATH })));
};

export function MarketingHome() {
  return null;
}
