import type { AgentSessionIndex, EffectRunner } from "@voidhash/agent";
import { AgentSessionIndexService } from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { Effect } from "effect";

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
          surface: input.metadata?.surface,
          paywallId: input.metadata?.paywallId,
          title: input.title,
        });
      }),
    ),
});
