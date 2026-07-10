import { Effect } from "effect";

import { ApiClient } from "../../utils/api-client";
import { OrganizationServiceError } from "./errors";

const hasNestedTag = (
  error: unknown,
  outerTag: string,
  innerTag: string,
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

export const createOrganization = Effect.gen(function* createOrganization() {
  const client = yield* ApiClient;
  return Effect.fn("createOrganization")(
    function* createOrganization(input: { name: string }) {
      const organization = yield* client.organizationsCreateOrganization({
        name: input.name,
      });

      return organization;
    },
    (effect) =>
      effect.pipe(
        Effect.catch((error) => {
          if (hasNestedTag(error, "OrganizationsCreateOrganization500", "NotAuthenticatedError")) {
            return Effect.fail(
              new OrganizationServiceError({
                message: "Failed to create an organization because you are not authenticated.",
              }),
            );
          }

          return Effect.fail(
            new OrganizationServiceError({
              message:
                "Failed to create an organization because of an unknown error. Please try again. If the problem persists, please contact us at support@voidhash.com",
            }),
          );
        }),
      ),
  );
});
