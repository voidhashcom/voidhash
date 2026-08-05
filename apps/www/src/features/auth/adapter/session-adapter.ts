/**
 * Server-side identity-provider slot.
 *
 * This module is the seam between the open-source dashboard and whichever
 * identity provider a deployment runs. The open-source default implements the
 * standalone (single root user) provider; a private composition replaces this
 * module wholesale through a build alias — the same mechanism the other
 * dashboard slots use — and supplies its own provider without forking any
 * route.
 *
 * Every export is a `createServerFn` or plain data, so the bodies and the
 * server-only modules they reach stay out of the client bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import {
  clearedStandaloneSessionCookie,
  readStandaloneSession,
} from "../lib/standalone-session";

/**
 * The identity fields the dashboard needs before its own `CurrentUser` RPC
 * resolves.
 */
export interface SessionUser {
  readonly createdAt: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly externalId: string | null;
  readonly firstName: string | null;
  readonly id: string;
  readonly lastName: string | null;
  readonly profilePictureUrl: string | null;
  readonly updatedAt: string | null;
}

/** The authenticated user for the current request, or `null`. */
export const getSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await readStandaloneSession(getRequest());
    if (!session) return null;
    return {
      createdAt: null,
      email: session.user.email,
      emailVerified: true,
      externalId: null,
      firstName: session.user.name,
      id: session.user.id,
      lastName: null,
      profilePictureUrl: null,
      updatedAt: null,
    };
  },
);

/**
 * Ends the session. A server function rather than a `fetch` of the sign-out
 * route, so it works during SSR — the logout route's loader runs on the server
 * for a direct navigation, where a relative URL cannot be fetched.
 */
export const clearSession = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Set-Cookie", clearedStandaloneSessionCookie());
  return { ok: true };
});

/**
 * Ends the session for sign-out.
 *
 * Returns the path to land on, or `null` when the provider already performed
 * its own redirect (a hosted sign-out endpoint does this). The standalone
 * provider has no remote session, so clearing the cookie is the whole sign-out
 * and the redirect is the route's to perform.
 */
export const performSignOut = async (returnTo: string): Promise<string | null> => {
  await clearSession();
  return returnTo;
};

/**
 * Request middleware the provider needs on every request. The standalone
 * provider verifies a self-contained token per request and needs none.
 */
export const authRequestMiddleware = [] as const;
