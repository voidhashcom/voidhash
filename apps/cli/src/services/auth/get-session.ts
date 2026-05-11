import { Effect } from "effect";

import { ApiClient } from "../../utils/api-client";
import { OrganizationServiceError } from "../organization/errors";

const hasNestedTag = (
  error: unknown,
  outerTag: string,
  innerTag: string
): error is { readonly _tag: string; readonly data: { readonly _tag: string } } =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === outerTag &&
  "data" in error &&
  typeof error.data === "object" &&
  error.data !== null &&
  "_tag" in error.data &&
  error.data._tag === innerTag;

export const getSession = Effect.gen(function* getSession() {
  const client = yield* ApiClient;
  return Effect.fn("getSession")(
    function* getSession() {
      const session = yield* client.authSession();
      return session;
    },
    (effect) =>
      effect.pipe(
        Effect.catch((error) => {
          if (hasNestedTag(error, "AuthSession500", "NotAuthenticatedError")) {
            return Effect.fail(
              new OrganizationServiceError({
                message:
                  "Failed to fetch the session because you are not authenticated.",
              })
            );
          }

          return Effect.fail(
            new OrganizationServiceError({
              message:
                "Failed to fetch the session because of an unknown error. Please try again. If the problem persists, please contact us at support@voidhash.com",
            })
          );
        })
      )
  );
});
