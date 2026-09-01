import type { AgentSessionIndex, EffectRunner } from "@voidhash/agent";
import { AgentSessionIndexService } from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/** Adapts the database index service to the portable session-core hook. */
export const makeAgentSessionIndex = <ConnectionData>(
  runEffect: EffectRunner<ConnectionData, AgentSessionIndexService | AuthSession>,
): AgentSessionIndex<ConnectionData> => ({
  touch: (input) =>
    runEffect(
      input.connectionData,
      Effect.gen(function* () {
        const index = yield* AgentSessionIndexService;
        yield* index.touch({
          id: input.sessionId,
          organizationId: input.owner.organizationId,
          projectId: input.owner.projectId,
          userId: input.owner.userId,
          surface: Option.fromNullishOr(input.metadata?.surface),
          paywallId: Option.flatMap(Option.fromNullishOr(input.metadata), (metadata) =>
            metadata.paywallId === undefined
              ? Option.none()
              : Option.some(Option.fromNullishOr(metadata.paywallId)),
          ),
          title: Option.fromNullishOr(input.title),
        });
      }),
    ),
});
