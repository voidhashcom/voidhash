import { makeLayerEffectRunner } from "@voidhash/agent";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { AgentSessionIndexService } from "@voidhash/core/services";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { makeAgentSessionIndex } from "./AgentSessionIndexAdapter.ts";

describe("makeAgentSessionIndex", () => {
  it("uses a fresh scoped index service after the previous operation is finalized", async () => {
    let nextId = 0;
    const used: number[] = [];
    const released: number[] = [];
    const IndexLive = Layer.effect(
      AgentSessionIndexService,
      Effect.acquireRelease(
        Effect.sync(() => {
          const id = ++nextId;
          return {
            id,
            service: {
              touch: () =>
                Effect.sync(() => {
                  if (released.includes(id)) throw new Error(`index lease ${id} was finalized`);
                  used.push(id);
                  return undefined as never;
                }),
            } as unknown as AgentSessionIndexService["Service"],
          };
        }),
        ({ id }) => Effect.sync(() => released.push(id)),
      ).pipe(Effect.map(({ service }) => service)),
    );
    const runEffect = makeLayerEffectRunner<void, AgentSessionIndexService | AuthSession>(() =>
      Layer.merge(IndexLive, Layer.succeed(AuthSession, {} as AuthSession["Service"])),
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

    await index.touch(input);
    await index.touch(input);

    expect(used).toEqual([1, 2]);
    expect(released).toEqual([1, 2]);
  });
});
