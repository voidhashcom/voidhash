import { Perk, VoidhashV1Api } from "@voidhash/api-contracts";
import { ApiActionForbiddenError, ApiPerkServiceError } from "@voidhash/api-contracts/errors";
import { PerkService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const PerksGroupLive = HttpApiBuilder.group(VoidhashV1Api, "perks", (handlers) =>
  Effect.gen(function* () {
    const perkService = yield* PerkService;
    return handlers.handle("listPerks", () =>
      bridgeAuthSession(
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          const perks = yield* perkService.getPerks(projectId);
          return perks.map(
            (perk) =>
              new Perk({
                id: perk.id,
                name: perk.name,
                projectId: perk.projectId,
                slug: perk.slug,
              }),
          );
        }),
      ).pipe(
        Effect.catchTags({
          ActionForbiddenError: (e) =>
            Effect.fail(new ApiActionForbiddenError({ message: e.message })),
          PerkServiceError: (e) => Effect.fail(new ApiPerkServiceError({ cause: e.cause })),
        }),
      ),
    );
  }),
);
