import { HttpApiBuilder } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { ChangesetDeploymentService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

export const ChangesetsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "changesets",
  (handlers) =>
    Effect.gen(function* ChangesetsGroupLive() {
      const service = yield* ChangesetDeploymentService;

      return handlers.handle("deployChangeset", ({ payload }) =>
        Effect.gen(function* deployChangeset() {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);

          const result = yield* service.deployChangeset({
            changeset: payload.changeset,
            projectId,
          });

          return { deploymentId: result.id };
        })
      );
    })
);
