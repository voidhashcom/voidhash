import { Effect } from "effect";

import { ApiClient } from "../../utils/api-client";
import { OrganizationServiceError } from "../organization/errors";

export const getSession = Effect.gen(function* getSession() {
  const client = yield* ApiClient;
  return Effect.fn("getSession")(
    function* getSession(input: { name: string }) {
      const organization = yield* client.organizations.createOrganization({
        payload: {
          name: input.name,
        },
      });

      return organization;
    },
    (effect) =>
      effect.pipe(
        Effect.catch((error) => {
          if (error._tag === "NotAuthenticatedError") {
            return Effect.fail(
              new OrganizationServiceError({
                message:
                  "Failed to create an organization because you are not authenticated.",
              })
            );
          }

          return Effect.fail(
            new OrganizationServiceError({
              message:
                "Failed to create an organization because of an unknown error. Please try again. If the problem persists, please contact us at support@voidhash.com",
            })
          );
        })
      )
  );
});
