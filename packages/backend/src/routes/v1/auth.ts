import { VoidhashV1Api } from "@voidhash/api-contracts";
import { type AnyAuthSession, AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

/**
 * Maps the internal session method onto the public v1 vocabulary, where a
 * cookie/user session is reported as an api-key session.
 */
const publicMethod = (
  method: AnyAuthSession["method"],
): "api-key" | "publishable-key" | "secret-key" => {
  if (method === "user") return "api-key";
  return method;
};

export const AuthGroupLive = HttpApiBuilder.group(VoidhashV1Api, "auth", (handlers) =>
  handlers.handle("session", () =>
    bridgeAuthSession(
      Effect.gen(function* () {
        const authSession = yield* AuthSession;
        return {
          method: publicMethod(authSession.method),
          name: authSession.name,
          organizations: authSession.organizations.map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
          })),
          projects: authSession.projects.map((p) => ({
            id: p.id,
            name: p.name,
            organizationId: p.organizationId,
            slug: p.slug,
          })),
        };
      }),
    ),
  ),
);
