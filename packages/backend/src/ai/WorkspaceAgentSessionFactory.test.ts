import { makeLayerEffectRunner } from "@voidhash/agent";
import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import type { WorkspaceAgentDeps } from "./WorkspaceAgentSessionFactory.ts";
import { makeWorkspaceAgentSessionFactory } from "./WorkspaceAgentSessionFactory.ts";
import { workspaceTextModel, workspaceVisionModel } from "./WorkspaceAgentModels.ts";

// The workspace services are deliberately absent: `buildDesignerContext` folds
// the resulting defect into an undefined context, which is what this test drives.
const emptyDepsRunEffect = makeLayerEffectRunner<void, WorkspaceAgentDeps>(() =>
  Layer.succeedContext(Context.makeUnsafe<WorkspaceAgentDeps>(new Map())),
);

describe("makeWorkspaceAgentSessionFactory", () => {
  it("uses progressive skill disclosure and switches to vision only for image turns", () => {
    const factory = makeWorkspaceAgentSessionFactory<void>({
      defaultModel: workspaceTextModel,
      visionModel: workspaceVisionModel,
      runEffect: emptyDepsRunEffect,
    });
    const dynamicContext = { current: { selectedNodeIds: [] } };
    const owner = {
      organizationId: "organization-1",
      projectId: "project-1",
      userId: "user-1",
    };

    type PreparePromptInput = Parameters<NonNullable<typeof factory.preparePrompt>>[0];
    const preparePrompt = (input: PreparePromptInput) =>
      Effect.suspend(() => {
        const pending = factory.preparePrompt?.(input);
        if (pending === undefined) return Effect.void;
        return Effect.promise(() => pending);
      });

    return Effect.runPromise(
      Effect.gen(function* () {
        const agent = yield* Effect.suspend(() => {
          const created = factory.create({
            sessionId: "session-1",
            owner,
            connectionData: undefined,
            messages: [],
            dynamicContext,
          });
          if (created instanceof Promise) return Effect.promise(() => created);
          return Effect.succeed(created);
        });

        expect(agent.state.systemPrompt).toContain("<name>paywall-authoring</name>");
        expect(agent.state.systemPrompt).toContain("<name>code-component-authoring</name>");
        expect(agent.state.systemPrompt).not.toContain("Document model and authorable tree");
        expect(agent.state.tools.map((tool) => tool.name)).toContain("read_skill");
        expect(agent.state.tools.map((tool) => tool.name)).toContain("edit_paywall");
        const editPaywall = agent.state.tools.find((tool) => tool.name === "edit_paywall");
        expect(editPaywall?.parameters.properties).toHaveProperty("editSessionId");

        yield* preparePrompt({
          agent,
          sessionId: "session-1",
          owner,
          connectionData: undefined,
          dynamicContext,
          message: { role: "user", content: "text", timestamp: 1 },
        });
        expect(agent.state.model.id).toBe(workspaceTextModel.id);

        yield* preparePrompt({
          agent,
          sessionId: "session-1",
          owner,
          connectionData: undefined,
          dynamicContext,
          message: {
            role: "user",
            content: [{ type: "image", data: "image", mimeType: "image/png" }],
            timestamp: 2,
          },
        });
        expect(agent.state.model.id).toBe(workspaceVisionModel.id);

        const selectedModel = { ...workspaceTextModel, id: "selected-model", name: "Selected" };
        agent.state.model = selectedModel;
        yield* preparePrompt({
          agent,
          sessionId: "session-1",
          owner,
          connectionData: undefined,
          dynamicContext,
          message: { role: "user", content: "text", timestamp: 3 },
        });
        expect(agent.state.model.id).toBe(selectedModel.id);

        yield* preparePrompt({
          agent,
          sessionId: "session-1",
          owner,
          connectionData: undefined,
          dynamicContext,
          message: {
            role: "user",
            content: [{ type: "image", data: "image", mimeType: "image/png" }],
            timestamp: 4,
          },
        });
        yield* preparePrompt({
          agent,
          sessionId: "session-1",
          owner,
          connectionData: undefined,
          dynamicContext,
          message: { role: "user", content: "text", timestamp: 5 },
        });
        expect(agent.state.model.id).toBe(selectedModel.id);
      }),
    );
  });
});
