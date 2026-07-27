import { Organization, VoidhashV1Api } from "@voidhash/api-contracts";
import { ApiOrganizationServiceError } from "@voidhash/api-contracts/errors";
import { OrganizationService } from "@voidhash/core/services";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const OrganizationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "organizations",
  (handlers) =>
    Effect.gen(function* () {
      const organizationService = yield* OrganizationService;
      return handlers.handle("createOrganization", ({ payload }) =>
        bridgeAuthSession(
          organizationService
            .createOrganization({ name: payload.name })
            .pipe(Effect.map((org) => new Organization(org))),
        ).pipe(
          Effect.catchTags({
            OrganizationServiceError: (e) =>
              Effect.fail(new ApiOrganizationServiceError({ cause: e.cause })),
          }),
        ),
      );
    }),
);
