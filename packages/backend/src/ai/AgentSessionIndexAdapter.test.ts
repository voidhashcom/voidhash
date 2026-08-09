import { makeLayerEffectRunner } from "@voidhash/agent";
import { AuthSession, makeInternalProjectAuthSession } from "@voidhash/core/domain/auth/Auth";
import { AgentSessionIndexService } from "@voidhash/core/services";
import { DateTime, Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { makeAgentSessionIndex } from "./AgentSessionIndexAdapter.ts";

const epoch = DateTime.toDateUtc(DateTime.makeUnsafe(0));

const testSession = makeInternalProjectAuthSession({
  id: "project-1",
  name: "Project",
  organizationId: "organization-1",
  slug: "project",
});

describe("makeAgentSessionIndex", () => {
  it("uses a fresh scoped index service after the previous operation is finalized", () => {
    let nextId = 0;
    const used: number[] = [];
    const released: number[] = [];
    const IndexLive = Layer.effect(
      AgentSessionIndexService,
      Effect.acquireRelease(
        Effect.sync(() => {
          const id = ++nextId;
          const service: AgentSessionIndexService["Service"] = {
            delete: () => Effect.die(new Error("delete is not used in this test")),
            get: () => Effect.die(new Error("get is not used in this test")),
            list: () => Effect.die(new Error("list is not used in this test")),
            touch: (input) =>
              Effect.suspend(() => {
                if (released.includes(id)) {
                  return Effect.die(new Error(`index lease ${id} was finalized`));
                }
                used.push(id);
                return Effect.succeed({
                  createdAt: epoch,
                  id: input.id,
                  organizationId: input.organizationId,
                  paywallId: null,
                  projectId: input.projectId,
                  surface: "test",
                  title: "",
                  userId: input.userId,
                  updatedAt: epoch,
                });
              }),
          };
          return { id, service };
        }),
        ({ id }) => Effect.sync(() => released.push(id)),
      ).pipe(Effect.map(({ service }) => service)),
    );
    const runEffect = makeLayerEffectRunner<void, AgentSessionIndexService | AuthSession>(() =>
      Layer.merge(IndexLive, Layer.succeed(AuthSession, testSession)),
    );
    const index = makeAgentSessionIndex(runEffect);
    const input = {
      sessionId: "session-1",
      owner: {
        organizationId: "organization-1",
        projectId: "project-1",
        userId: "user-1",
      },
      connectionData: undefined,
    };

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.promise(() => index.touch(input));
        yield* Effect.promise(() => index.touch(input));

        expect(used).toEqual([1, 2]);
        expect(released).toEqual([1, 2]);
      }),
    );
  });
});
