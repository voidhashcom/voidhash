import type { User } from "@voidhash/api-spec";
import { AuthSession, AuthenticationError } from "@voidhash/shared";
import { Effect, Option } from "effect";

export const getUser = Effect.gen(function* getUser() {
  return Effect.fn("getUser")(function* getUser() {
    yield* Effect.log("getUser");
    const maybeSession = yield* Effect.serviceOption(AuthSession);
    if (Option.isNone(maybeSession) || !maybeSession.value.user) {
      return yield* Effect.fail(
        new AuthenticationError({
          cause: "User not found",
          message: "User not found",
        })
      );
    }
    const session = maybeSession.value;
    return {
      ...session.user,
      organizations: session.organizations.map((o) => ({
        id: o.id,
        logo: null,
        name: o.name,
        slug: o.slug,
      })),
      projects: session.projects.map((p) => ({
        id: p.id,
        logo: null,
        name: p.name,
        organizationId: p.organizationId,
        slug: p.slug,
      })),
    } satisfies typeof User.Type;
  });
});
