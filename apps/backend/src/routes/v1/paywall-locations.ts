import { PaywallLocation, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaywallLocationServiceError,
} from "@voidhash/api-contracts/errors";
import { PaywallLocationService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const PaywallLocationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "paywall_locations",
  (handlers) =>
    Effect.gen(function* () {
      const paywallLocationService = yield* PaywallLocationService;

      return handlers.handle("listPaywallLocations", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const locations = yield* paywallLocationService.listLocations({
              includeArchived: false,
              projectId,
            });

            return locations.map(
              (location) =>
                new PaywallLocation({
                  description: location.description,
                  id: location.id,
                  name: location.name,
                  projectId: location.projectId,
                  slug: location.slug,
                }),
            );
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaywallLocationServiceError: (e) =>
              Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
          }),
        ),
      );
    }),
);
