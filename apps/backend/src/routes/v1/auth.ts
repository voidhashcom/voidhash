import { VoidhashV1Api } from "@voidhash/api-contracts";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const AuthGroupLive = HttpApiBuilder.group(VoidhashV1Api, "auth", (handlers) =>
  handlers.handle("session", () =>
    bridgeAuthSession(
      Effect.gen(function* () {
        const authSession = yield* AuthSession;
        const method =
          authSession.method === "user"
            ? "api-key"
            : (authSession.method as "api-key" | "publishable-key" | "secret-key");
        return {
          method,
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
